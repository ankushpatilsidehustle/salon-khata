import { AppState, type AppStateStatus } from "react-native";

import { eventBus } from "@/application/event-bus";
import { getNetworkState, isOnline } from "@/network/network-manager";
import { syncService } from "@/sync/sync-service";
import type { PullSummary, PushSummary } from "@/sync/sync-api";
import { queueManager } from "@/sync/queue-manager";
import {
  syncHistoryRepo,
  type SyncHistoryResult,
  type SyncNetworkType
} from "@/sync/sync-history-repo";

/**
 * SyncScheduler — decides *when* the per-record sync engine runs.
 *
 * Runs independently of `BackupScheduler` (which drives the whole-DB
 * disaster-recovery file backup, kept alive until Phase 7). Both start
 * and stop from AuthProvider on sign-in/sign-out.
 *
 * Trigger matrix:
 *
 *   ┌───────────────────────────────┬─────────────────────────────────────┐
 *   │ Trigger                       │ Behaviour                           │
 *   ├───────────────────────────────┼─────────────────────────────────────┤
 *   │ Manual "Sync now" button      │ runNow(): push + pull, offline is   │
 *   │                               │ surfaced as skip.                   │
 *   │ AppState → background         │ push only (bill just entered, save  │
 *   │                               │ before OS suspends).                │
 *   │ AppState → active             │ push + pull; restart periodic timer.│
 *   │ db:dirty event                │ Debounced 5 s push. No pull — the   │
 *   │                               │ user just wrote; nothing new is on  │
 *   │                               │ the server yet.                     │
 *   │ network:changed → online      │ push + pull (drain the backlog).    │
 *   │ Periodic timer (foreground)   │ Every 15 min while foregrounded.    │
 *   │ OS background task            │ push + pull (see background-sync-   │
 *   │                               │ task.ts).                           │
 *   └───────────────────────────────┴─────────────────────────────────────┘
 *
 * Concurrency model:
 *   - Exactly one attempt at a time. Concurrent triggers set a
 *     `pendingRerun` flag and are coalesced into a single rerun once the
 *     current attempt settles.
 *   - `syncService.pushOnce`/`pullOnce` have their own in-flight guards
 *     as a second line of defence.
 *   - After a push that returns `hasMore=true`, the scheduler
 *     immediately re-attempts to drain the backlog (up to `MAX_DRAIN`
 *     cycles per burst so we don't hog resources on a huge queue).
 *
 * Retry / failure model:
 *   - Per-row backoff lives inside `QueueManager` — the scheduler does
 *     not maintain its own error backoff. Rows that transient-fail are
 *     rescheduled by `QueueManager.markFailure` with `next_attempt_at`
 *     in the future, and `claimNext` naturally skips them until due.
 *   - This means the scheduler can safely fire on every trigger without
 *     hammering a failing server — an empty `claimNext` returns
 *     instantly.
 *
 * The scheduler is **stateless across process restarts** — on cold start
 * AuthProvider calls `start(salonId)` and any half-processed queue rows
 * are reset to `queued` by `queueManager.resetOrphanedProcessing()`.
 */

const DEBOUNCE_MS = 5_000;
const FOREGROUND_INTERVAL_MS = 15 * 60 * 1000; // 15 min
/** Max push-drain cycles per burst before yielding back to the scheduler. */
const MAX_DRAIN = 5;

/**
 * All triggers understood by the scheduler. Used for observability and
 * for gating which triggers run the pull step (see PULL_TRIGGERS below).
 */
export type SyncTrigger =
  | "manual"
  | "app-background"
  | "app-foreground"
  | "post-write-debounce"
  | "periodic"
  | "network-reconnect"
  | "background-task"
  | "drain";

/**
 * Triggers that fetch remote changes in addition to pushing local ones.
 * Post-write-debounce is excluded — the user just wrote something, no
 * new remote is expected. App-background is excluded — the user is
 * leaving; save first, catch remote next time. Drain is excluded — it's
 * a follow-up push-only cycle.
 */
const PULL_TRIGGERS = new Set<SyncTrigger>([
  "manual",
  "app-foreground",
  "network-reconnect",
  "periodic",
  "background-task"
]);

/** Aggregate outcome of a single scheduler attempt. */
export type SyncAttemptOutcome =
  | { result: "ran"; trigger: SyncTrigger; push: PushSummary; pull: PullSummary | null }
  | { result: "skipped"; trigger: SyncTrigger; reason: "offline" | "no-salon" | "no-work" };

class SyncScheduler {
  private salonId: string | null = null;
  private started = false;
  private appState: AppStateStatus = "active";

  private currentRun: Promise<SyncAttemptOutcome> | null = null;
  private pendingRerun = false;
  private pendingTrigger: SyncTrigger | null = null;

  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private periodicTimer: ReturnType<typeof setInterval> | null = null;

  private unsubscribers: Array<() => void> = [];

  /**
   * Begin observing lifecycle + network + write events for the given salon.
   * Idempotent — a second call with the same salon is a no-op; with a
   * different salon, the scheduler is stopped and re-started.
   *
   * Also runs `queueManager.resetOrphanedProcessing()` so any rows left
   * in `processing` from a crashed previous session flip back to
   * `queued` and get picked up on the next attempt.
   */
  start(salonId: string): void {
    if (this.started && this.salonId === salonId) return;
    if (this.started) this.stop();

    this.salonId = salonId;
    this.started = true;

    // Recover any orphaned "processing" rows from a previous crash.
    queueManager.resetOrphanedProcessing(salonId);

    const appStateSub = AppState.addEventListener(
      "change",
      this.handleAppStateChange
    );
    this.unsubscribers.push(() => appStateSub.remove());
    this.appState = AppState.currentState;
    this.startPeriodicIfForegrounded();

    this.unsubscribers.push(eventBus.on("db:dirty", this.handleDirty));
    this.unsubscribers.push(
      eventBus.on("network:changed", this.handleNetworkChanged)
    );

    // Nudge at startup — catches the common case of an app relaunching
    // with a non-empty queue from a previous session.
    void this.attempt("app-foreground");
  }

  /**
   * Tear down every subscription and timer. Called from AuthProvider on
   * sign-out.
   */
  stop(): void {
    if (!this.started) return;

    this.clearDebounce();
    this.clearPeriodic();

    for (const u of this.unsubscribers) {
      try {
        u();
      } catch {
        // Unsubscribers must not throw; if they do, keep cleanup going.
      }
    }
    this.unsubscribers = [];

    this.started = false;
    this.salonId = null;
    this.pendingRerun = false;
    this.pendingTrigger = null;
    this.currentRun = null;
  }

  /**
   * User tapped "Sync now" — force an attempt regardless of debounce.
   * Returns the outcome so the UI can render a toast/snackbar with the
   * push/pull totals.
   */
  runNow(): Promise<SyncAttemptOutcome> {
    return this.attempt("manual");
  }

  // ─── event handlers ───────────────────────────────────────────────────

  private handleAppStateChange = (next: AppStateStatus): void => {
    const previous = this.appState;
    this.appState = next;

    if (next === "background") {
      // Primary write-out trigger — take the shot before the OS suspends.
      this.clearDebounce();
      this.clearPeriodic();
      void this.attempt("app-background");
    } else if (next === "active" && previous !== "active") {
      this.startPeriodicIfForegrounded();
      void this.attempt("app-foreground");
    }
  };

  private handleDirty = (): void => {
    // Debounce: reset the timer on every write so a burst of edits
    // (e.g. a bill with 5 line items) fires one push 5 s after the last
    // write instead of one per line.
    this.clearDebounce();
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      void this.attempt("post-write-debounce");
    }, DEBOUNCE_MS);
  };

  private handleNetworkChanged = (payload: { isOnline: boolean }): void => {
    if (!payload.isOnline) return;
    // We just came online — drain any backlog. Guard with hasReadyWork
    // so a transient wifi flap doesn't fire a needless empty cycle.
    if (this.salonId && queueManager.hasReadyWork(this.salonId)) {
      void this.attempt("network-reconnect");
    } else {
      // Even with an empty queue, we probably missed remote changes.
      void this.attempt("network-reconnect");
    }
  };

  // ─── attempt orchestration ───────────────────────────────────────────

  private async attempt(trigger: SyncTrigger): Promise<SyncAttemptOutcome> {
    // Coalesce concurrent triggers into a single follow-up rerun.
    if (this.currentRun) {
      this.pendingRerun = true;
      this.pendingTrigger = trigger;
      return this.currentRun;
    }

    const promise = this.runCycle(trigger);
    this.currentRun = promise;

    try {
      const outcome = await promise;
      // If the push reports more work, drain immediately without waiting
      // for the next trigger. Cap the drain so we don't spin on a huge
      // backlog and starve the UI thread.
      if (outcome.result === "ran" && outcome.push.hasMore) {
        this.scheduleDrain();
      }
      return outcome;
    } finally {
      this.currentRun = null;
      if (this.pendingRerun) {
        this.pendingRerun = false;
        const rerun = this.pendingTrigger ?? trigger;
        this.pendingTrigger = null;
        // Yield one tick so the caller's await resolves before we start again.
        setTimeout(() => void this.attempt(rerun), 0);
      }
    }
  }

  private drainCount = 0;

  private scheduleDrain(): void {
    if (this.drainCount >= MAX_DRAIN) {
      // Reached the burst cap. Let the next natural trigger pick up.
      this.drainCount = 0;
      return;
    }
    this.drainCount++;
    setTimeout(() => void this.attempt("drain"), 100);
  }

  private async runCycle(trigger: SyncTrigger): Promise<SyncAttemptOutcome> {
    const salonId = this.salonId;
    const startedAt = Date.now();
    const startedIso = new Date(startedAt).toISOString();
    const networkType = classifyNetwork();

    if (!salonId) return { reason: "no-salon", result: "skipped", trigger };
    if (!isOnline()) {
      recordSkipped({
        networkType,
        reason: "offline",
        salonId,
        startedIso,
        trigger
      });
      return { reason: "offline", result: "skipped", trigger };
    }

    const push = await syncService.pushOnce(salonId);
    const pull = PULL_TRIGGERS.has(trigger)
      ? await syncService.pullOnce(salonId)
      : null;

    // Reset drain counter once the queue is genuinely drained.
    if (!push.hasMore) this.drainCount = 0;

    const finishedIso = new Date().toISOString();
    const durationMs = Date.now() - startedAt;
    const totalErrors = push.errors + (pull?.errors ?? 0);
    const totalConflicts = push.conflicts + (pull?.conflicts ?? 0);
    const didWork =
      push.pushed > 0 ||
      totalConflicts > 0 ||
      totalErrors > 0 ||
      (pull?.applied ?? 0) > 0;

    // Only log cycles that actually did something, plus manual attempts
    // (users want feedback for their explicit tap even if nothing happened).
    // Skipping empty cycles keeps `sync_history` from being flooded by
    // periodic timers and post-write debounces on quiet days.
    if (didWork || trigger === "manual") {
      const result: SyncHistoryResult =
        totalErrors > 0 ? "partial" : "success";
      syncHistoryRepo.record({
        applied_count: pull?.applied ?? 0,
        conflicts_count: totalConflicts,
        duration_ms: durationMs,
        error_summary: null,
        errors_count: totalErrors,
        finished_at: finishedIso,
        network_type: networkType,
        pushed_count: push.pushed,
        result,
        salon_id: salonId,
        skipped_reason: null,
        started_at: startedIso,
        trigger
      });
    }

    return { pull, push, result: "ran", trigger };
  }

  // ─── timer helpers ────────────────────────────────────────────────────

  private startPeriodicIfForegrounded(): void {
    if (this.appState !== "active") return;
    if (this.periodicTimer) return;
    this.periodicTimer = setInterval(() => {
      void this.attempt("periodic");
    }, FOREGROUND_INTERVAL_MS);
  }

  private clearPeriodic(): void {
    if (this.periodicTimer) {
      clearInterval(this.periodicTimer);
      this.periodicTimer = null;
    }
  }

  private clearDebounce(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }
}

/** Process-wide singleton. */
export const syncScheduler = new SyncScheduler();

/**
 * Classify the current network for the history ledger. `unknown` covers
 * both the cold-start pre-probe state and offline (offline branches log
 * `unknown` too, since we don't know what connection they'll return on).
 */
function classifyNetwork(): SyncNetworkType {
  const state = getNetworkState();
  if (!state.isOnline) return "unknown";
  return state.isWifi ? "wifi" : "cellular";
}

/**
 * Record a skipped attempt to the history ledger. Kept as a top-level
 * helper so the scheduler's `runCycle` reads linearly without duplicating
 * the row shape.
 */
function recordSkipped(params: {
  salonId: string;
  trigger: SyncTrigger;
  startedIso: string;
  networkType: SyncNetworkType;
  reason: string;
}): void {
  syncHistoryRepo.record({
    applied_count: 0,
    conflicts_count: 0,
    duration_ms: 0,
    error_summary: null,
    errors_count: 0,
    finished_at: params.startedIso,
    network_type: params.networkType,
    pushed_count: 0,
    result: "skipped",
    salon_id: params.salonId,
    skipped_reason: params.reason,
    started_at: params.startedIso,
    trigger: params.trigger
  });
}
