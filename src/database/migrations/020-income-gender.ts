import { database } from "@/database/sqlite-client";

/**
 * Migration 020 — adds `customer_gender` column to `income_transactions`.
 *
 * Stores the gender the owner selected when creating the bill ("male" | "female").
 * NULL for bills created before this migration or when the toggle was left at
 * the default (unset) state. Idempotent via PRAGMA table_info.
 */
export function runMigration020(): void {
  const cols = database.getAllSync<{ name: string }>(
    "PRAGMA table_info(income_transactions)"
  );
  const names = cols.map((c) => c.name);
  if (!names.includes("customer_gender")) {
    database.execSync(
      `ALTER TABLE income_transactions ADD COLUMN customer_gender TEXT NULL;`
    );
  }
}
