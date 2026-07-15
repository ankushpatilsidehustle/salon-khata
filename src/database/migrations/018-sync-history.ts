import { database } from "@/database/sqlite-client";

/**
 * Migration 018 — local diagnostic ledger for the per-record sync engine.
 *
 * Sibling to `backup_history` (added in migration 015). The sync engine
 * writes one row per meaningful attempt so the "Sync Status" screen
 * (Phase 5) can render an activity feed and support can diagnose why a
 * record hasn't propagated.
 *
 * Kept intentionally local-only — never uploaded, never syncs. Retention
 * is enforced by `SyncHistoryRepository` on write (500 rows per salon)
 * so this migration doesn't set one; re-runs remain idempotent.
 *
 * Columns:
 *   - `trigger`         — what caused this cycle (`manual`, `app-background`,
 *                          `db:dirty` debounce, network-reconnect, periodic,
 *                          background-task, drain). Matches
 *                          `SyncTrigger` in the scheduler.
 *   - `result`          — `success` (no errors), `partial` (at least one
 *                          op errored but some succeeded), or `skipped`
 *                          (offline or no salon).
 *   - `pushed_count`    — ops the cloud accepted this cycle.
 *   - `applied_count`   — remote records pulled + upserted this cycle.
 *   - `conflicts_count` — resolver decisions (both directions).
 *   - `errors_count`    — transport / auth / permission failures.
 *   - `network_type`    — `wifi` | `cellular` | `unknown` at start.
 *   - `skipped_reason`  — populated only when `result = 'skipped'`.
 *   - `error_summary`   — short description of the first error, if any.
 */
export function runMigration018(): void {
  database.execSync(`
    CREATE TABLE IF NOT EXISTS sync_history (
      id              TEXT PRIMARY KEY NOT NULL,
      salon_id        TEXT NOT NULL,
      trigger         TEXT NOT NULL,
      result          TEXT NOT NULL,
      started_at      TEXT NOT NULL,
      finished_at     TEXT NOT NULL,
      duration_ms     INTEGER NOT NULL DEFAULT 0,
      pushed_count    INTEGER NOT NULL DEFAULT 0,
      applied_count   INTEGER NOT NULL DEFAULT 0,
      conflicts_count INTEGER NOT NULL DEFAULT 0,
      errors_count    INTEGER NOT NULL DEFAULT 0,
      network_type    TEXT NOT NULL DEFAULT 'unknown',
      skipped_reason  TEXT,
      error_summary   TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_sync_history_started
      ON sync_history (salon_id, started_at DESC);
  `);

  database.runSync(
    `UPDATE db_meta SET value = ?
     WHERE key = 'schema_version'
       AND (value IS NULL OR CAST(value AS INTEGER) < 18)`,
    ["18"]
  );
}
