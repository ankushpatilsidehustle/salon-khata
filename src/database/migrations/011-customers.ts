import { database } from "@/database/sqlite-client";

/**
 * Migration 011 — introduce an optional customer identity so bills can be
 * linked by phone and shared on WhatsApp.
 *
 * - `customers` is a per-salon table keyed by phone (unique per salon so two
 *   salons on the same device don't collide). Phone stored as digits-only.
 * - `income_transactions.customer_id` links the header to the customer row.
 * - `customer_name_snapshot` / `customer_phone_snapshot` capture the values
 *   at billing time so historical receipts stay stable if the master row is
 *   later edited or deleted.
 *
 * Fully idempotent: safe to re-run.
 */
export function runMigration011(): void {
  // ── customers table ───────────────────────────────────────────────────────
  database.execSync(`
    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY NOT NULL,
      salon_id TEXT NOT NULL,
      phone TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      sync_status TEXT NOT NULL,
      device_id TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_salon_phone
      ON customers (salon_id, phone);
    CREATE INDEX IF NOT EXISTS idx_customers_salon_active
      ON customers (salon_id, deleted_at);
  `);

  // ── income_transactions: customer link + snapshots ────────────────────────
  const txCols = database.getAllSync<{ name: string }>(
    "PRAGMA table_info(income_transactions)"
  );
  const has = (name: string) => txCols.some((c) => c.name === name);

  if (!has("customer_id")) {
    database.execSync(
      `ALTER TABLE income_transactions ADD COLUMN customer_id TEXT`
    );
  }
  if (!has("customer_name_snapshot")) {
    database.execSync(
      `ALTER TABLE income_transactions ADD COLUMN customer_name_snapshot TEXT`
    );
  }
  if (!has("customer_phone_snapshot")) {
    database.execSync(
      `ALTER TABLE income_transactions ADD COLUMN customer_phone_snapshot TEXT`
    );
  }
}
