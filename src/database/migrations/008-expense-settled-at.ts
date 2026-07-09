import { database } from "@/database/sqlite-client";

/**
 * Adds settled_at to expenses.
 *
 * settled_at TEXT NULL — ISO UTC timestamp of when a credit expense was paid off.
 *
 * Only meaningful when payment_mode = 'credit'. NULL means still outstanding.
 * Cash / UPI rows are implicitly "settled at time of entry" and leave this NULL.
 *
 * The outstanding-credit query filters on `payment_mode = 'credit' AND settled_at IS NULL`.
 */
export function runMigration008(): void {
  const rows = database.getAllSync<{ name: string }>(
    `PRAGMA table_info(expenses)`
  );
  const cols = new Set(rows.map((r) => r.name));

  if (!cols.has("settled_at")) {
    database.execSync(`ALTER TABLE expenses ADD COLUMN settled_at TEXT`);
  }
}
