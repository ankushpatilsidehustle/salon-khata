import { database } from "@/database/sqlite-client";

/**
 * Migration 013 — link each salon row to the signed-in Firebase user.
 *
 * `owner_uid` stores the Firebase Auth `uid`. Nullable for backfill safety:
 * any pre-auth dev data (`id = 'dev-salon-1'`) keeps `owner_uid = NULL` and
 * is invisible to `SalonRepository.findByOwnerUid()`. A partial unique index
 * enforces one active salon per uid without blocking the historical rows.
 *
 * Fully idempotent — safe to re-run.
 */
export function runMigration013(): void {
  const columns = database.getAllSync<{ name: string }>(
    `PRAGMA table_info('salons')`
  );
  const hasOwnerUid = columns.some((c) => c.name === "owner_uid");

  if (!hasOwnerUid) {
    database.execSync(`ALTER TABLE salons ADD COLUMN owner_uid TEXT`);
  }

  database.execSync(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_salons_owner_uid
    ON salons (owner_uid)
    WHERE owner_uid IS NOT NULL AND deleted_at IS NULL;
  `);
}
