import { database } from "@/database/sqlite-client";

/**
 * Adds payment_mode to expenses.
 *
 * payment_mode TEXT NOT NULL DEFAULT 'cash' — "cash" | "upi" | "credit"
 *
 * "credit" means the salon owes the vendor (money out is deferred) —
 * useful for tracking supplier IOUs. Existing rows are backfilled to "cash"
 * so historical totals are unaffected.
 */
export function runMigration007(): void {
  const rows = database.getAllSync<{ name: string }>(
    `PRAGMA table_info(expenses)`
  );
  const cols = new Set(rows.map((r) => r.name));

  if (!cols.has("payment_mode")) {
    database.execSync(
      `ALTER TABLE expenses ADD COLUMN payment_mode TEXT NOT NULL DEFAULT 'cash'`
    );
  }
}
