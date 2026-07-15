import { database } from "@/database/sqlite-client";
import { newId } from "@/domain/id";
import type { BackupTrigger } from "@/application/event-bus";

/**
 * Local-only ledger of every backup attempt. Powers the "Sync status"
 * screen and gives support enough context to explain a stale cloud
 * snapshot.
 *
 * Retention is enforced on **write**, not by a periodic sweep: after every
 * insert we prune anything beyond `MAX_ROWS_PER_SALON`. This keeps table
 * growth bounded (~15 KB per salon) without needing a background job.
 *
 * The table is **never uploaded** — it lives inside the SQLite file so any
 * restore naturally forgets old attempts (which is what we want; history
 * on one device shouldn't leak to another).
 */

/** Result codes stored in `backup_history.result`. */
export type BackupResult = "success" | "failed" | "skipped" | "cancelled";

/** Cellular / wifi / unknown, matching NetworkManager's classification. */
export type NetworkType = "wifi" | "cellular" | "unknown";

export type BackupHistoryEntry = {
  id: string;
  salon_id: string;
  trigger: BackupTrigger;
  result: BackupResult;
  started_at: string;
  finished_at: string;
  duration_ms: number;
  plaintext_size_bytes: number;
  bytes_uploaded: number;
  version_id: string | null;
  network_type: NetworkType;
  error_code: string | null;
  error_message: string | null;
};

export type NewBackupHistoryEntry = Omit<BackupHistoryEntry, "id">;

/** Cap the ledger to this many rows per salon. Older rows are pruned. */
const MAX_ROWS_PER_SALON = 200;

export class BackupHistoryRepository {
  /**
   * Insert a new attempt and prune older rows for the same salon.
   * Returns the generated row id.
   */
  record(entry: NewBackupHistoryEntry): string {
    const id = newId();
    database.runSync(
      `INSERT INTO backup_history (
        id, salon_id, trigger, result,
        started_at, finished_at, duration_ms,
        plaintext_size_bytes, bytes_uploaded,
        version_id, network_type,
        error_code, error_message
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        entry.salon_id,
        entry.trigger,
        entry.result,
        entry.started_at,
        entry.finished_at,
        entry.duration_ms,
        entry.plaintext_size_bytes,
        entry.bytes_uploaded,
        entry.version_id,
        entry.network_type,
        entry.error_code,
        entry.error_message
      ]
    );

    // Prune anything past the retention cap. The subquery lists row ids to
    // KEEP (the most recent `MAX_ROWS_PER_SALON`) so we can DELETE the rest
    // in a single statement.
    database.runSync(
      `DELETE FROM backup_history
       WHERE salon_id = ?
         AND id NOT IN (
           SELECT id FROM backup_history
           WHERE salon_id = ?
           ORDER BY started_at DESC
           LIMIT ?
         )`,
      [entry.salon_id, entry.salon_id, MAX_ROWS_PER_SALON]
    );

    return id;
  }

  /** Most recent attempts for a salon, newest first. */
  listRecent(salonId: string, limit = 50): BackupHistoryEntry[] {
    return database.getAllSync<BackupHistoryEntry>(
      `SELECT * FROM backup_history
       WHERE salon_id = ?
       ORDER BY started_at DESC
       LIMIT ?`,
      [salonId, limit]
    );
  }

  /** Single entry (used to inspect a specific failure). */
  getById(id: string): BackupHistoryEntry | null {
    return (
      database.getFirstSync<BackupHistoryEntry>(
        `SELECT * FROM backup_history WHERE id = ? LIMIT 1`,
        [id]
      ) ?? null
    );
  }

  /**
   * Most recent successful attempt for a salon. Returns null when the
   * salon has never had a successful backup on this device. Powers the
   * "Last backup: X ago" badge on the Backups screen.
   */
  latestSuccess(salonId: string): BackupHistoryEntry | null {
    return (
      database.getFirstSync<BackupHistoryEntry>(
        `SELECT * FROM backup_history
         WHERE salon_id = ? AND result = 'success'
         ORDER BY started_at DESC
         LIMIT 1`,
        [salonId]
      ) ?? null
    );
  }
}
