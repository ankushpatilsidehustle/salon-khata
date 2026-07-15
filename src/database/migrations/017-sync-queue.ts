import { database } from "@/database/sqlite-client";

/**
 * Migration 017 — introduce the per-record sync engine's local tables.
 *
 * Creates three tables consumed by `src/sync/`:
 *
 *   1. `sync_queue` — the pending-changes ledger.
 *      One row per (salon_id, entity_type, entity_id) that needs to be
 *      pushed to the cloud. Naturally coalesces multiple writes to the
 *      same row via the UNIQUE constraint + UPSERT semantics — see
 *      `ChangeTracker.trackChange`. The queue never stores payloads:
 *      Phase 2's push loop re-reads the current row state at push time so
 *      rapid edits collapse into a single upload.
 *
 *      Columns:
 *        - id             — UUID for the queue row itself (log-tracking).
 *        - salon_id       — scope for security-rule shard.
 *        - entity_type    — table name (e.g. 'services').
 *        - entity_id      — the row's UUID.
 *        - operation      — 'upsert' | 'delete'. Soft-deletes are 'upsert'
 *                            (the row still exists with deleted_at set);
 *                            'delete' is reserved for future hard-delete
 *                            semantics.
 *        - status         — 'queued' | 'processing' | 'failed' | 'dead'.
 *        - attempt_count  — number of push attempts so far.
 *        - last_attempt_at / next_attempt_at — retry backoff scheduling.
 *        - error_code / error_message — last failure diagnostics.
 *        - created_at / updated_at — row lifecycle timestamps.
 *
 *      Indexes:
 *        - UNIQUE (salon_id, entity_type, entity_id) — coalesce key.
 *        - (salon_id, status, next_attempt_at) — dequeue hot path.
 *
 *   2. `sync_state` — key/value store for per-entity pull cursors and any
 *      other one-off state the sync engine needs. Mirrors the shape of
 *      `db_meta` (added by migration 014). Well-known keys:
 *        - `cursor:{entity_type}`         — last pulled `serverUpdatedAt`.
 *        - `last_pull_at:{entity_type}`   — ISO of most recent pull.
 *        - `last_full_sync_at`            — ISO of last complete cycle.
 *
 *   3. `conflict_log` — local-only audit trail for conflict-resolver
 *      decisions. Kept small (~500 rows, enforced in Phase 5 by the
 *      SyncHistoryRepository); never uploaded.
 *
 * Fully idempotent — CREATE TABLE IF NOT EXISTS + CREATE INDEX IF NOT EXISTS.
 */
export function runMigration017(): void {
  database.execSync(`
    CREATE TABLE IF NOT EXISTS sync_queue (
      id              TEXT PRIMARY KEY NOT NULL,
      salon_id        TEXT NOT NULL,
      entity_type     TEXT NOT NULL,
      entity_id       TEXT NOT NULL,
      operation       TEXT NOT NULL DEFAULT 'upsert',
      status          TEXT NOT NULL DEFAULT 'queued',
      attempt_count   INTEGER NOT NULL DEFAULT 0,
      last_attempt_at TEXT,
      next_attempt_at TEXT,
      error_code      TEXT,
      error_message   TEXT,
      created_at      TEXT NOT NULL,
      updated_at      TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_sync_queue_entity
      ON sync_queue (salon_id, entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS idx_sync_queue_status_next
      ON sync_queue (salon_id, status, next_attempt_at);
  `);

  database.execSync(`
    CREATE TABLE IF NOT EXISTS sync_state (
      key   TEXT PRIMARY KEY NOT NULL,
      value TEXT
    );
  `);

  database.execSync(`
    CREATE TABLE IF NOT EXISTS conflict_log (
      id             TEXT PRIMARY KEY NOT NULL,
      salon_id       TEXT NOT NULL,
      entity_type    TEXT NOT NULL,
      entity_id      TEXT NOT NULL,
      local_payload  TEXT,
      remote_payload TEXT,
      resolution     TEXT NOT NULL,
      reason         TEXT,
      created_at     TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_conflict_log_created
      ON conflict_log (salon_id, created_at DESC);
  `);

  database.runSync(
    `UPDATE db_meta SET value = ?
     WHERE key = 'schema_version'
       AND (value IS NULL OR CAST(value AS INTEGER) < 17)`,
    ["17"]
  );
}
