import { database, runInTransaction } from "@/database/sqlite-client";
import { getUtcTimestamp } from "@/domain/dates";

import type { SyncEntityType, SyncQueueRow } from "@/sync/types";

/**
 * QueueManager — the *how* of moving rows through the `sync_queue`
 * lifecycle. Stateless singleton; safe to reuse across every trigger.
 *
 * State machine per queue row:
 *
 *   queued  ─claimNext()─►  processing
 *   processing ─markSuccess()─►  (row deleted)
 *   processing ─markFailure(transient)─►  queued  (with next_attempt_at)
 *   processing ─markFailure(!transient)─►  dead
 *   processing ─markFailure(attempts >= MAX)─►  dead
 *   processing ─reopenWithFreshBase()─►  queued  (resolver: local wins)
 *   processing ─markSuccess()─►  (row deleted; resolver: remote wins)
 *   processing ─markConflictDeadLetter()─►  dead  (rare: no remote payload)
 *   *processing across restart* ─resetOrphaned()─►  queued
 *
 * The retry backoff schedule mirrors the plan (§2.12) — 7 attempts total,
 * capped at 6 h between tries.
 */

/**
 * Backoff schedule in milliseconds. Attempt N picks index N-1 (or the
 * last entry if N > length). 7 attempts total before dead-letter.
 */
const BACKOFF_MS = [
  5_000,        // 5s
  15_000,       // 15s
  60_000,       // 1m
  5 * 60_000,   // 5m
  15 * 60_000,  // 15m
  60 * 60_000,  // 1h
  6 * 60 * 60_000 // 6h
];

/** Max attempts before a queue row is moved to `dead`. */
const MAX_ATTEMPTS = BACKOFF_MS.length;

/** Jitter range as a fraction of the base backoff (± this ratio). */
const JITTER_RATIO = 0.2;

/** Default batch size for `claimNext`. Kept well under Firestore's 500 op limit. */
export const DEFAULT_BATCH_SIZE = 50;

/**
 * Reason string persisted to `sync_queue.error_code` when the resolver
 * has not yet been implemented. Phase 3's ConflictResolver will replace
 * this by re-opening the queue row instead of dead-lettering it.
 */
export const CONFLICT_DEAD_LETTER_CODE = "conflict-unresolved";

export class QueueManager {
  /**
   * Atomically claim the next batch of ready rows: selects up to `limit`
   * queued rows whose `next_attempt_at` (if any) has passed, then flips
   * them to `processing` in the same transaction so a concurrent invocation
   * cannot double-claim them.
   *
   * Ordered by `created_at ASC` so older writes push first — matches the
   * "FIFO within a salon" expectation users have of a sync engine.
   */
  claimNext(salonId: string, limit = DEFAULT_BATCH_SIZE): SyncQueueRow[] {
    const now = getUtcTimestamp();
    let claimed: SyncQueueRow[] = [];

    runInTransaction(() => {
      const rows = database.getAllSync<SyncQueueRow>(
        `SELECT * FROM sync_queue
         WHERE salon_id = ?
           AND status = 'queued'
           AND (next_attempt_at IS NULL OR next_attempt_at <= ?)
         ORDER BY created_at ASC
         LIMIT ?`,
        [salonId, now, limit]
      );

      if (rows.length === 0) return;

      const placeholders = rows.map(() => "?").join(", ");
      const args: (string | number)[] = [now, ...rows.map((r) => r.id)];
      database.runSync(
        `UPDATE sync_queue
         SET status = 'processing', updated_at = ?
         WHERE id IN (${placeholders})`,
        args
      );

      // Return the freshly-updated rows to the caller — swap status locally
      // so downstream code sees the same value the DB now holds.
      claimed = rows.map((r) => ({ ...r, status: "processing" as const }));
    });

    return claimed;
  }

  /** Mark a queue row as successfully pushed — delete it. */
  markSuccess(queueRowId: string): void {
    database.runSync(`DELETE FROM sync_queue WHERE id = ?`, [queueRowId]);
  }

  /**
   * Record a failed attempt. Transient errors reschedule with backoff;
   * fatal errors or exceeding `MAX_ATTEMPTS` move the row to `dead`.
   * The row's `error_code` / `error_message` are always updated for the
   * Sync Status UI (Phase 5).
   */
  markFailure(
    queueRowId: string,
    error: { code: string; message: string; transient: boolean }
  ): void {
    const now = getUtcTimestamp();
    const current = database.getFirstSync<{ attempt_count: number }>(
      `SELECT attempt_count FROM sync_queue WHERE id = ?`,
      [queueRowId]
    );
    if (!current) return; // Row vanished (e.g. queue reset) — nothing to do.

    const nextAttempt = current.attempt_count + 1;
    const exhausted = nextAttempt >= MAX_ATTEMPTS;
    const status = !error.transient || exhausted ? "dead" : "queued";
    const nextAttemptAt =
      status === "queued" ? computeNextAttemptAt(nextAttempt) : null;

    database.runSync(
      `UPDATE sync_queue SET
         status          = ?,
         attempt_count   = ?,
         last_attempt_at = ?,
         next_attempt_at = ?,
         error_code      = ?,
         error_message   = ?,
         updated_at      = ?
       WHERE id = ?`,
      [
        status,
        nextAttempt,
        now,
        nextAttemptAt,
        error.code,
        error.message,
        now,
        queueRowId
      ]
    );
  }

  /**
   * Phase 3 — invoked by the ConflictResolver when it decides "local wins":
   * clear all failure/retry state so the next `pushOnce` sends the row
   * again. The caller is responsible for having already bumped the
   * business row's `sync_version` to `remote.version` so OCC succeeds
   * on the next attempt.
   */
  reopenWithFreshBase(queueRowId: string): void {
    const now = getUtcTimestamp();
    database.runSync(
      `UPDATE sync_queue SET
         status          = 'queued',
         attempt_count   = 0,
         last_attempt_at = NULL,
         next_attempt_at = NULL,
         error_code      = NULL,
         error_message   = NULL,
         updated_at      = ?
       WHERE id = ?`,
      [now, queueRowId]
    );
  }

  /**
   * Lookup a queue row by its entity coordinates. Used by `SyncService`
   * during pull to detect whether a pending local write races the
   * incoming remote record — in which case the ConflictResolver runs.
   */
  findByEntity(
    salonId: string,
    entityType: SyncEntityType,
    entityId: string
  ): SyncQueueRow | null {
    return (
      database.getFirstSync<SyncQueueRow>(
        `SELECT * FROM sync_queue
         WHERE salon_id = ? AND entity_type = ? AND entity_id = ?
         LIMIT 1`,
        [salonId, entityType, entityId]
      ) ?? null
    );
  }

  /**
   * Phase 2 fallback — dead-letter a queue row with a synthetic conflict
   * code. Retained for the rare path where `SyncService` cannot invoke
   * the resolver (e.g. remote payload arrived corrupted). Phase 3's
   * primary conflict path invokes the resolver instead and calls
   * `reopenWithFreshBase()` or `markSuccess()`.
   */
  markConflictDeadLetter(queueRowId: string, serverVersion: number): void {
    const now = getUtcTimestamp();
    database.runSync(
      `UPDATE sync_queue SET
         status          = 'dead',
         last_attempt_at = ?,
         error_code      = ?,
         error_message   = ?,
         updated_at      = ?
       WHERE id = ?`,
      [
        now,
        CONFLICT_DEAD_LETTER_CODE,
        `Server version ${serverVersion} does not match local base and no remote payload was available`,
        now,
        queueRowId
      ]
    );
  }

  /**
   * Reset any rows stuck in `processing` from a previous session that
   * crashed mid-push. Called from `SyncService.start()` and safe to call
   * on every app launch.
   *
   * A 60-second grace window prevents a concurrent live invocation from
   * having its own claim yanked out from under it. In practice each app
   * launch triggers this exactly once before the scheduler kicks in, so
   * the grace is mostly a defensive belt-and-braces.
   */
  resetOrphanedProcessing(salonId: string, graceMs = 60_000): number {
    const cutoff = new Date(Date.now() - graceMs).toISOString();
    const now = getUtcTimestamp();
    const result = database.runSync(
      `UPDATE sync_queue SET
         status = 'queued',
         updated_at = ?
       WHERE salon_id = ?
         AND status = 'processing'
         AND updated_at <= ?`,
      [now, salonId, cutoff]
    );
    return result.changes;
  }

  /**
   * Diagnostic — count queue rows by status. Powers the Sync Status
   * screen in Phase 5.
   */
  countByStatus(salonId: string): {
    queued: number;
    processing: number;
    dead: number;
  } {
    const rows = database.getAllSync<{ status: string; count: number }>(
      `SELECT status, COUNT(*) AS count
       FROM sync_queue
       WHERE salon_id = ?
       GROUP BY status`,
      [salonId]
    );
    const out = { dead: 0, processing: 0, queued: 0 };
    for (const r of rows) {
      if (r.status === "queued") out.queued = r.count;
      else if (r.status === "processing") out.processing = r.count;
      else if (r.status === "dead") out.dead = r.count;
    }
    return out;
  }

  /** True when the salon has any queued rows ready to push right now. */
  hasReadyWork(salonId: string): boolean {
    const now = getUtcTimestamp();
    const row = database.getFirstSync<{ one: number }>(
      `SELECT 1 AS one FROM sync_queue
       WHERE salon_id = ?
         AND status = 'queued'
         AND (next_attempt_at IS NULL OR next_attempt_at <= ?)
       LIMIT 1`,
      [salonId, now]
    );
    return !!row;
  }
}

/** Singleton — the QueueManager is stateless, so one instance is fine. */
export const queueManager = new QueueManager();

/**
 * Compute the next attempt timestamp for a queued retry. Applies ±20%
 * jitter around the backoff-schedule value so bursts of failed clients
 * don't thundering-herd the server.
 */
function computeNextAttemptAt(attemptCount: number): string {
  const idx = Math.min(attemptCount - 1, BACKOFF_MS.length - 1);
  const base = BACKOFF_MS[idx];
  const jitter = base * JITTER_RATIO * (Math.random() * 2 - 1);
  return new Date(Date.now() + base + jitter).toISOString();
}
