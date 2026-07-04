import { database } from "@/database/sqlite-client";

/**
 * Migration 003 — introduce service categories, split price into male/female,
 * and link every service to a category.
 *
 * Fully idempotent: safe to run on every startup.
 */
export function runMigration003(): void {
  // ─── service_categories table ────────────────────────────────────────────
  database.execSync(`
    CREATE TABLE IF NOT EXISTS service_categories (
      id TEXT PRIMARY KEY NOT NULL,
      salon_id TEXT NOT NULL,
      name TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_system INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      sync_status TEXT NOT NULL,
      device_id TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_service_categories_salon_active
      ON service_categories (salon_id, is_active, deleted_at);
  `);

  // ─── services: add category_id, male_price, female_price ─────────────────
  const cols = database.getAllSync<{ name: string }>(
    "PRAGMA table_info(services)"
  );
  const has = (name: string) => cols.some((c) => c.name === name);

  if (!has("category_id")) {
    database.execSync(`ALTER TABLE services ADD COLUMN category_id TEXT`);
  }
  if (!has("male_price")) {
    database.execSync(
      `ALTER TABLE services ADD COLUMN male_price INTEGER NOT NULL DEFAULT 0`
    );
  }
  if (!has("female_price")) {
    database.execSync(
      `ALTER TABLE services ADD COLUMN female_price INTEGER NOT NULL DEFAULT 0`
    );
  }

  // Backfill: any existing service row with both new price columns still at 0
  // gets the legacy `price` mirrored into both. Safe to re-run because we only
  // touch rows where the new columns are still 0.
  database.execSync(`
    UPDATE services
    SET male_price = price, female_price = price
    WHERE male_price = 0 AND female_price = 0 AND price > 0;
  `);
}
