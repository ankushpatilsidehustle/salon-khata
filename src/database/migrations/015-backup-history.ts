import { database } from "@/database/sqlite-client";

/**
 * Migration 015 — local diagnostic ledger for the backup engine.
 *
 * `backup_history` records every attempt (successful or not) made by the
 * BackupScheduler + BackupPipeline. It powers the "Sync status" screen and
 * gives support enough context to explain a stale cloud snapshot.
 *
 * Kept intentionally local-only — never uploaded, never syncs. A retention
 * cap of ~200 rows is enforced by `BackupHistoryRepository` on write; this
 * migration doesn't set one so re-runs are idempotent.
 *
 * Columns:
 *   - `trigger` — what caused this attempt (manual, app-background, …).
 *     Matches the `BackupTrigger` union in the event bus module.
 *   - `result` — 'success' | 'failed' | 'skipped' | 'cancelled'.
 *   - `error_code` / `error_message` — populated only when result != 'success'.
 *   - `bytes_uploaded` — ciphertext size for success rows; 0 otherwise.
 *   - `plaintext_size_bytes` — pre-compression DB size (interesting for
 *     compression-ratio diagnostics).
 *   - `duration_ms` — end-to-end wall time.
 *   - `version_id` — the cloud version id on success; NULL otherwise.
 *   - `network_type` — 'wifi' | 'cellular' | 'unknown' at start of attempt.
 */
export function runMigration015(): void {
  database.execSync(`
    CREATE TABLE IF NOT EXISTS backup_history (
      id                   TEXT PRIMARY KEY NOT NULL,
      salon_id             TEXT NOT NULL,
      trigger              TEXT NOT NULL,
      result               TEXT NOT NULL,
      started_at           TEXT NOT NULL,
      finished_at          TEXT NOT NULL,
      duration_ms          INTEGER NOT NULL,
      plaintext_size_bytes INTEGER NOT NULL DEFAULT 0,
      bytes_uploaded       INTEGER NOT NULL DEFAULT 0,
      version_id           TEXT,
      network_type         TEXT NOT NULL DEFAULT 'unknown',
      error_code           TEXT,
      error_message        TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_backup_history_salon_started
      ON backup_history (salon_id, started_at DESC);
  `);

  // Bump the tracked schema version so a future migration can key off it.
  database.runSync(
    `UPDATE db_meta SET value = ?
     WHERE key = 'schema_version'
       AND (value IS NULL OR CAST(value AS INTEGER) < 15)`,
    ["15"]
  );
}
