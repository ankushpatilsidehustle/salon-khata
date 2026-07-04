import { database } from "@/database/sqlite-client";

/**
 * Migration 004 — expand employees with address, gender, joining date, and
 * compensation (salary OR commission).
 *
 * Storage notes:
 * - `salary_amount` is in paise (INR smallest unit), matching services/prices.
 * - `commission_percent` is basis points × 1 (i.e. percent × 100), so
 *   12.5% = 1250. This mirrors the paise pattern and avoids REAL rounding.
 * - `compensation_type` is null when neither has been chosen yet.
 *
 * Fully idempotent: safe to re-run.
 */
export function runMigration004(): void {
  const cols = database.getAllSync<{ name: string }>(
    "PRAGMA table_info(employees)"
  );
  const has = (name: string) => cols.some((c) => c.name === name);

  if (!has("address")) {
    database.execSync(`ALTER TABLE employees ADD COLUMN address TEXT`);
  }
  if (!has("gender")) {
    database.execSync(`ALTER TABLE employees ADD COLUMN gender TEXT`);
  }
  if (!has("joining_date")) {
    database.execSync(`ALTER TABLE employees ADD COLUMN joining_date TEXT`);
  }
  if (!has("compensation_type")) {
    database.execSync(
      `ALTER TABLE employees ADD COLUMN compensation_type TEXT`
    );
  }
  if (!has("salary_amount")) {
    database.execSync(
      `ALTER TABLE employees ADD COLUMN salary_amount INTEGER`
    );
  }
  if (!has("commission_percent")) {
    database.execSync(
      `ALTER TABLE employees ADD COLUMN commission_percent INTEGER`
    );
  }
}
