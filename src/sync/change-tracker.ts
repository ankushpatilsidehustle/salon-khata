import { database } from "@/database/sqlite-client";
import { getUtcTimestamp } from "@/domain/dates";
import { newId } from "@/domain/id";
import { getDeviceIdentity } from "@/device/device-identity";

import type { SyncEntityType, SyncOperation } from "@/sync/types";

/**
 * ChangeTracker — the single entry point every repository write uses to
 * enroll its row in the per-record sync engine.
 *
 * Contract: `trackChange(...)` **must** be called from inside the same
 * `runInTransaction` block as the business `INSERT`/`UPDATE`. It runs two
 * SQL statements — one to stamp the business row with its author + pending
 * state, and one to upsert into `sync_queue`. Both must commit atomically
 * with the business write so a crash between them can never leave a
 * "modified but not queued" row.
 *
 * The queue never stores the row payload. Phase 2's push loop re-reads
 * the current row state at push time — this collapses rapid successive
 * edits into a single upload for free and eliminates any concern about
 * stale payload data.
 *
 * A repeated call for the same `(salon_id, entity_type, entity_id)` before
 * the queue is drained naturally coalesces via the UNIQUE index on the
 * sync_queue table: only the timestamp + operation are refreshed. A
 * pending `delete` is sticky and wins over subsequent `upsert` calls (a
 * soft-delete followed by a resurrect-edit should be rare and can be
 * modeled as a fresh insert if it ever appears).
 *
 * Callers already inside a transaction pay two cheap SQL statements per
 * business write — negligible next to the write itself.
 */

export type TrackChangeParams = {
  /** Table the row lives in. See `SyncEntityType`. */
  entityType: SyncEntityType;
  /** Primary key (`id` column) of the row that was just written. */
  entityId: string;
  /**
   * Salon scope. For the `salons` table, pass the salon's own `id` (same
   * value) — the row's `id` and its `salon_id` are the same.
   */
  salonId: string;
  /** Defaults to `'upsert'`. Pass `'delete'` for future hard-delete flows. */
  operation?: SyncOperation;
};

/**
 * Enroll the just-written row in the sync engine. Call from inside the
 * same `runInTransaction(() => { ... })` block as the business write.
 *
 * Side effects (both inside the caller's transaction):
 *   1. `UPDATE {entityType} SET sync_status = 'pending', created_by =
 *      COALESCE(created_by, ?), updated_by = ? WHERE id = ?`
 *   2. `INSERT OR ON CONFLICT UPDATE INTO sync_queue (...)`
 *
 * Never throws — a missing device identity (pre-boot / migration path) is
 * tolerated and `updated_by`/`created_by` are left NULL for a later
 * backfill.
 */
export function trackChange(params: TrackChangeParams): void {
  const { entityType, entityId, salonId } = params;
  const operation = params.operation ?? "upsert";
  const now = getUtcTimestamp();
  const installId = tryGetInstallId();

  // 1. Stamp the business row. `created_by` is COALESCE'd so the very
  //    first tracked write (INSERT path) sets it and subsequent updates
  //    leave it alone. `updated_by` is always overwritten.
  database.runSync(
    `UPDATE ${entityType}
     SET sync_status = 'pending',
         created_by  = COALESCE(created_by, ?),
         updated_by  = ?
     WHERE id = ?`,
    [installId, installId, entityId]
  );

  // 2. Upsert into sync_queue. The UNIQUE index on
  //    (salon_id, entity_type, entity_id) drives natural coalescing.
  //    `delete` is sticky: once a row is queued for delete, subsequent
  //    upserts don't downgrade it.
  database.runSync(
    `INSERT INTO sync_queue
       (id, salon_id, entity_type, entity_id, operation, status,
        attempt_count, last_attempt_at, next_attempt_at,
        error_code, error_message, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'queued', 0, NULL, NULL, NULL, NULL, ?, ?)
     ON CONFLICT(salon_id, entity_type, entity_id) DO UPDATE SET
       operation     = CASE
                         WHEN sync_queue.operation = 'delete' THEN 'delete'
                         ELSE excluded.operation
                       END,
       status        = 'queued',
       attempt_count = 0,
       last_attempt_at = NULL,
       next_attempt_at = NULL,
       error_code    = NULL,
       error_message = NULL,
       updated_at    = excluded.updated_at`,
    [newId(), salonId, entityType, entityId, operation, now, now]
  );
}

/**
 * Read the device install id without throwing when the identity singleton
 * hasn't been loaded yet. Pre-`loadDeviceIdentity()` writes (from migrations
 * or early boot) will simply leave `updated_by`/`created_by` NULL.
 */
function tryGetInstallId(): string | null {
  try {
    return getDeviceIdentity().installId;
  } catch {
    return null;
  }
}
