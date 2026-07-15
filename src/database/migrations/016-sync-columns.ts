import { database } from "@/database/sqlite-client";

/**
 * Migration 016 — restore per-record sync scaffolding on business tables.
 *
 * Adds the columns Phase 1 of the per-record sync engine needs on every
 * business table:
 *   - `sync_status`    TEXT NOT NULL DEFAULT 'pending'
 *       One of: pending | syncing | synced | failed | conflict.
 *       Existing rows are stamped 'pending' so Phase 2's first push loop
 *       replicates the local corpus up to the cloud (idempotent by UUID —
 *       a fresh cloud accepts them as inserts).
 *   - `sync_version`   INTEGER NOT NULL DEFAULT 0
 *       Monotonic server-assigned revision counter. 0 = never pushed. Used
 *       as the OCC base version on push.
 *   - `last_synced_at` TEXT NULL
 *       ISO UTC timestamp of the last successful ack from the cloud. NULL
 *       until the row round-trips at least once.
 *   - `updated_by`     TEXT NULL
 *       device_identity.install_id of the device that authored the current
 *       row state. Used for LWW tie-breaks.
 *   - `created_by`     TEXT NULL
 *       device_identity.install_id of the device that first created the row.
 *
 * Note: `income_transaction_items` gets the same columns for schema
 * consistency, but the sync engine treats items as *embedded children* of
 * their parent `income_transactions` document — item sync fields are not
 * consulted by the push/pull path.
 *
 * Fully idempotent — safe to re-run on every startup. Uses PRAGMA
 * table_info to feature-detect each column before ADD COLUMN.
 */
export function runMigration016(): void {
  const tables = [
    "salons",
    "services",
    "service_categories",
    "employees",
    "commission_rules",
    "income_transactions",
    "income_transaction_items",
    "expense_categories",
    "expenses",
    "customers",
    "employee_advances"
  ];

  for (const table of tables) {
    const cols = database.getAllSync<{ name: string }>(
      `PRAGMA table_info(${table})`
    );
    if (cols.length === 0) continue; // Table missing on a partial install — skip.
    const has = (name: string) => cols.some((c) => c.name === name);

    if (!has("sync_status")) {
      database.execSync(
        `ALTER TABLE ${table} ADD COLUMN sync_status TEXT NOT NULL DEFAULT 'pending'`
      );
    }
    if (!has("sync_version")) {
      database.execSync(
        `ALTER TABLE ${table} ADD COLUMN sync_version INTEGER NOT NULL DEFAULT 0`
      );
    }
    if (!has("last_synced_at")) {
      database.execSync(
        `ALTER TABLE ${table} ADD COLUMN last_synced_at TEXT`
      );
    }
    if (!has("updated_by")) {
      database.execSync(`ALTER TABLE ${table} ADD COLUMN updated_by TEXT`);
    }
    if (!has("created_by")) {
      database.execSync(`ALTER TABLE ${table} ADD COLUMN created_by TEXT`);
    }
  }

  // Bump the tracked schema_version. db_meta was created by migration 014.
  database.runSync(
    `UPDATE db_meta SET value = ?
     WHERE key = 'schema_version'
       AND (value IS NULL OR CAST(value AS INTEGER) < 16)`,
    ["16"]
  );
}
