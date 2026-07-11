import { database } from "@/database/sqlite-client";

/**
 * Migration 012 — introduce a dedicated ledger for cash advances given to
 * employees ("uptha"). Kept separate from `expenses` so owners can see the
 * running balance per employee and month-end reports can net advances
 * against earned commission.
 *
 * Fully idempotent: safe to re-run.
 */
export function runMigration012(): void {
  database.execSync(`
    CREATE TABLE IF NOT EXISTS employee_advances (
      id TEXT PRIMARY KEY NOT NULL,
      salon_id TEXT NOT NULL,
      employee_id TEXT NOT NULL,
      /** Preserves the employee name if the master row is later renamed/deleted. */
      employee_name_snapshot TEXT NOT NULL,
      /** Paise. */
      amount INTEGER NOT NULL,
      advance_date TEXT NOT NULL,
      remarks TEXT,
      /** ISO UTC timestamp when the advance was reconciled. NULL = outstanding. */
      settled_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      sync_status TEXT NOT NULL,
      device_id TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_employee_advances_salon_employee
      ON employee_advances (salon_id, employee_id, deleted_at);
    CREATE INDEX IF NOT EXISTS idx_employee_advances_salon_settled
      ON employee_advances (salon_id, settled_at, deleted_at);
  `);
}
