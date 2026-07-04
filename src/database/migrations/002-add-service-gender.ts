import { database } from "@/database/sqlite-client";

/**
 * Migration 002 — add `gender` column to services table.
 * Idempotent: inspects PRAGMA table_info before running ALTER TABLE.
 */
export function runMigration002(): void {
  const cols = database.getAllSync<{ name: string }>("PRAGMA table_info(services)");
  const hasGender = cols.some((c) => c.name === "gender");
  if (!hasGender) {
    database.execSync(
      `ALTER TABLE services ADD COLUMN gender TEXT NOT NULL DEFAULT 'unisex'`
    );
  }
}
