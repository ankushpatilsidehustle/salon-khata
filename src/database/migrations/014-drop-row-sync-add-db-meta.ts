import { database } from "@/database/sqlite-client";

/**
 * Migration 014 — pivot off row-level sync onto whole-DB-file backup.
 *
 * Deletes the row-sync scaffolding that was never wired up:
 *   - Tables `sync_queue` and `audit_logs`.
 *   - Columns `sync_status` and `device_id` on every business table.
 *
 * Adds the singleton key/value `db_meta` table that tracks the "local DB
 * has unsynced changes" flag consumed by the new BackupScheduler. Rows are
 * (key, value); readers cast the value on demand.
 *
 * Fully idempotent — safe to re-run on every startup:
 *   - DROP TABLE / DROP COLUMN use IF EXISTS / feature-detection.
 *   - db_meta seeding uses INSERT OR IGNORE.
 *
 * SQLite `DROP COLUMN` requires 3.35+ (Mar 2021). expo-sqlite in SDK 54
 * bundles 3.44+ so this is safe on all supported devices.
 */
export function runMigration014(): void {
  // ── Drop obsolete row-sync tables ──────────────────────────────────────
  database.execSync(`DROP TABLE IF EXISTS sync_queue`);
  database.execSync(`DROP TABLE IF EXISTS audit_logs`);

  // ── Drop sync_status + device_id from every table that has them ────────
  const tables = [
    "salons",
    "services",
    "employees",
    "commission_rules",
    "income_transactions",
    "income_transaction_items",
    "expense_categories",
    "expenses",
    "service_categories",
    "customers",
    "employee_advances"
  ];

  for (const table of tables) {
    const cols = database.getAllSync<{ name: string }>(
      `PRAGMA table_info(${table})`
    );
    if (cols.length === 0) continue; // Table missing on a fresh install order — skip.
    const has = (name: string) => cols.some((c) => c.name === name);
    if (has("sync_status")) {
      database.execSync(`ALTER TABLE ${table} DROP COLUMN sync_status`);
    }
    if (has("device_id")) {
      database.execSync(`ALTER TABLE ${table} DROP COLUMN device_id`);
    }
  }

  // ── Create db_meta singleton key/value store ───────────────────────────
  database.execSync(`
    CREATE TABLE IF NOT EXISTS db_meta (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT
    )
  `);

  // Seed the well-known keys so callers can UPSERT without existence checks.
  // 'schema_version' is bumped by every migration that ships a new baseline.
  const seed: Array<[string, string | null]> = [
    ["schema_version", "14"],
    ["install_id", null],
    ["dirty_since", null],
    ["change_count", "0"],
    ["last_backup_at", null],
    ["last_backup_version_id", null],
    ["last_backup_checksum", null],
    ["active_device_lock_owner", null],
    ["active_device_lock_expires_at", null]
  ];
  for (const [key, value] of seed) {
    database.runSync(
      `INSERT OR IGNORE INTO db_meta (key, value) VALUES (?, ?)`,
      [key, value]
    );
  }

  // Ensure schema_version reflects at least 14 even if a prior partial run
  // seeded an older value.
  database.runSync(
    `UPDATE db_meta SET value = ? WHERE key = 'schema_version' AND (value IS NULL OR CAST(value AS INTEGER) < 14)`,
    ["14"]
  );
}
