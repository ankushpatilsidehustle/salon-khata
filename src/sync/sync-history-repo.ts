import { database } from "@/database/sqlite-client";
import { newId } from "@/domain/id";

import type { SyncTrigger } from "@/sync/sync-scheduler";

/**
 * Local-only ledger of every meaningful sync attempt. Powers the "Sync
 * Status" screen (Phase 5) and gives support enough context to explain
 * why a record hasn't propagated.
 *
 * Retention is enforced on **write**, not by a periodic sweep: after
 * every insert we prune anything beyond `MAX_ROWS_PER_SALON`. Same
 * pattern as `BackupHistoryRepository`.
 *
 * The table is **never uploaded** — it lives inside the SQLite file so
 * any cloud round-trip / restore naturally forgets old attempts (which
 * is what we want; history on one device shouldn't leak to another).
 */

export type SyncHistoryResult = "success" | "partial" | "skipped";

/** Cellular / wifi / unknown, matching NetworkManager's classification. */
export type SyncNetworkType = "wifi" | "cellular" | "unknown";

export type SyncHistoryEntry = {
  id: string;
  salon_id: string;
  trigger: SyncTrigger;
  result: SyncHistoryResult;
  started_at: string;
  finished_at: string;
  duration_ms: number;
  pushed_count: number;
  applied_count: number;
  conflicts_count: number;
  errors_count: number;
  network_type: SyncNetworkType;
  skipped_reason: string | null;
  error_summary: string | null;
};

export type NewSyncHistoryEntry = Omit<SyncHistoryEntry, "id">;

/** Cap the ledger to this many rows per salon. Older rows are pruned. */
const MAX_ROWS_PER_SALON = 500;

export class SyncHistoryRepository {
  /**
   * Insert a new attempt and prune older rows for the same salon.
   * Returns the generated row id. Silently swallows failures — logging
   * must never break the sync path.
   */
  record(entry: NewSyncHistoryEntry): string | null {
    const id = newId();
    try {
      database.runSync(
        `INSERT INTO sync_history (
          id, salon_id, trigger, result,
          started_at, finished_at, duration_ms,
          pushed_count, applied_count, conflicts_count, errors_count,
          network_type, skipped_reason, error_summary
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          entry.salon_id,
          entry.trigger,
          entry.result,
          entry.started_at,
          entry.finished_at,
          entry.duration_ms,
          entry.pushed_count,
          entry.applied_count,
          entry.conflicts_count,
          entry.errors_count,
          entry.network_type,
          entry.skipped_reason,
          entry.error_summary
        ]
      );

      // Keep the newest N rows for this salon; delete the rest in one shot.
      database.runSync(
        `DELETE FROM sync_history
         WHERE salon_id = ?
           AND id NOT IN (
             SELECT id FROM sync_history
             WHERE salon_id = ?
             ORDER BY started_at DESC
             LIMIT ?
           )`,
        [entry.salon_id, entry.salon_id, MAX_ROWS_PER_SALON]
      );
      return id;
    } catch {
      return null;
    }
  }

  /** Most recent attempts for a salon, newest first. */
  listRecent(salonId: string, limit = 50): SyncHistoryEntry[] {
    return database.getAllSync<SyncHistoryEntry>(
      `SELECT * FROM sync_history
       WHERE salon_id = ?
       ORDER BY started_at DESC
       LIMIT ?`,
      [salonId, limit]
    );
  }

  /**
   * Most recent successful attempt for a salon. Powers the
   * "Last synced: X ago" badge. Returns null when the salon has never
   * had a successful sync on this device.
   */
  latestSuccess(salonId: string): SyncHistoryEntry | null {
    return (
      database.getFirstSync<SyncHistoryEntry>(
        `SELECT * FROM sync_history
         WHERE salon_id = ? AND result IN ('success', 'partial')
         ORDER BY started_at DESC
         LIMIT 1`,
        [salonId]
      ) ?? null
    );
  }
}

/** Singleton — history repo is stateless. */
export const syncHistoryRepo = new SyncHistoryRepository();
