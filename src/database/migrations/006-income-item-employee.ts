import { database } from "@/database/sqlite-client";

/**
 * Migration 006 — line-level employee assignment for income transaction items.
 *
 * Adds:
 *   income_transaction_items.employee_id             TEXT NULL
 *   income_transaction_items.employee_name_snapshot  TEXT NULL
 *
 * Backfills both columns from the parent income_transactions row so historical
 * entries continue to report correctly. The parent transaction's employee
 * fields remain in place for backward compatibility; they will be phased out
 * in a later cleanup pass once reports and sync are proven on the new columns.
 *
 * Idempotent: safe to run on every startup.
 */
export function runMigration006(): void {
  const cols = new Set(
    database
      .getAllSync<{ name: string }>(
        `PRAGMA table_info(income_transaction_items)`
      )
      .map((r) => r.name)
  );

  if (!cols.has("employee_id")) {
    database.execSync(
      `ALTER TABLE income_transaction_items ADD COLUMN employee_id TEXT`
    );
  }
  if (!cols.has("employee_name_snapshot")) {
    database.execSync(
      `ALTER TABLE income_transaction_items ADD COLUMN employee_name_snapshot TEXT`
    );
  }

  // Backfill from parent transaction. Only touch rows that still have NULLs
  // so re-running the migration is a no-op.
  database.execSync(`
    UPDATE income_transaction_items
    SET employee_id = (
      SELECT t.employee_id
      FROM income_transactions t
      WHERE t.id = income_transaction_items.transaction_id
    )
    WHERE employee_id IS NULL;
  `);

  database.execSync(`
    UPDATE income_transaction_items
    SET employee_name_snapshot = (
      SELECT t.employee_name_snapshot
      FROM income_transactions t
      WHERE t.id = income_transaction_items.transaction_id
    )
    WHERE employee_name_snapshot IS NULL;
  `);

  database.execSync(`
    CREATE INDEX IF NOT EXISTS idx_income_items_employee
      ON income_transaction_items (employee_id, transaction_id);
  `);
}
