import { database } from "@/database/sqlite-client";

/**
 * Adds discount columns to income_transactions.
 *
 * discount_type   TEXT             — "percentage" | "flat" | NULL (no discount)
 * discount_value  INTEGER          — basis points for %, paise for flat  (e.g. 10% = 1000, ₹50 = 5000)
 * discount_amount INTEGER          — calculated paise always (snapshot)
 *
 * net_amount semantics: gross_amount − discount_amount  (what the customer pays).
 * commission_amount is always on the full gross (employer settles separately).
 */
export function runMigration005(): void {
  const rows = database.getAllSync<{ name: string }>(
    `PRAGMA table_info(income_transactions)`
  );
  const cols = new Set(rows.map((r) => r.name));

  if (!cols.has("discount_type")) {
    database.execSync(
      `ALTER TABLE income_transactions ADD COLUMN discount_type TEXT`
    );
  }
  if (!cols.has("discount_value")) {
    database.execSync(
      `ALTER TABLE income_transactions ADD COLUMN discount_value INTEGER NOT NULL DEFAULT 0`
    );
  }
  if (!cols.has("discount_amount")) {
    database.execSync(
      `ALTER TABLE income_transactions ADD COLUMN discount_amount INTEGER NOT NULL DEFAULT 0`
    );
  }
}
