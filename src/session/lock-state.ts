import { eventBus } from "@/application/event-bus";
import type {
  DeviceLock,
  LockCheckResult,
  LockStance
} from "@/cloud/device-lock";

/**
 * In-memory mirror of the latest known lock stance, so hot paths
 * (repository writes, UI banners) can read ownership without an async
 * Firestore round-trip.
 *
 * The value is updated by the pipeline / scheduler after every
 * `acquireOrRefreshLock` or `fetchLockState` call. Transitions (own ↔
 * other ↔ free) fire `lock:changed` on the event bus so subscribers can
 * flip a banner, disable a button, or show the take-over prompt.
 *
 * "unknown" is the cold-start value and is treated as **permissive** by
 * downstream code — we don't want to block writes just because the app
 * hasn't reached Firestore yet on the first launch. The pipeline's own
 * `acquireOrRefreshLock` still gates the actual upload, so the worst
 * case is that a write happens locally and then can't be backed up
 * until the user takes over. That's the correct offline-first behaviour.
 */

type Snapshot = {
  stance: LockStance;
  lock: DeviceLock | null;
  /** Wall-clock millis of the most recent update. */
  updatedAtMs: number;
};

let current: Snapshot = {
  lock: null,
  stance: "unknown",
  updatedAtMs: 0
};

/**
 * Merge in a fresh lock read. Emits `lock:changed` only when the stance
 * transitions between own ↔ other ↔ free (not every heartbeat).
 */
export function applyLockCheck(result: LockCheckResult): void {
  const previous = current;
  current = {
    lock: result.lock,
    stance: result.stance,
    updatedAtMs: Date.now()
  };

  if (previous.stance !== result.stance) {
    eventBus.emit("lock:changed", {
      mine: result.stance === "own",
      ownerInstallId: result.lock?.ownerInstallId ?? null
    });
  }
}

/** Cheap synchronous read. */
export function getLockStance(): LockStance {
  return current.stance;
}

/** Full snapshot for the Backups / Take-over screens. */
export function getLockSnapshot(): Snapshot {
  return current;
}

/**
 * Cheap "can I write?" check. Returns:
 *   - `true`  for `own`, `free`, and `unknown` (permissive default).
 *   - `false` for `other`.
 *
 * Repositories will consume this in Phase 5 once the take-over UI exists
 * — enforcing without an escape hatch would be a footgun. For now it's a
 * pure informational read.
 */
export function canWriteLocally(): boolean {
  return current.stance !== "other";
}

/**
 * Reset the cache (sign-out, test cleanup).
 */
export function clearLockState(): void {
  const changed = current.stance !== "unknown";
  current = { lock: null, stance: "unknown", updatedAtMs: 0 };
  if (changed) {
    eventBus.emit("lock:changed", { mine: false, ownerInstallId: null });
  }
}
