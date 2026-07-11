import { database } from "@/database/sqlite-client";

/**
 * Migration 010 — introduce per-service product cost ("parts") so commission
 * can be calculated on the labor portion only.
 *
 * - `services.product_cost` (paise, default 0) is the material cost consumed
 *   per unit of the service (e.g. one hair-color tube, one waxing kit).
 * - `income_transaction_items.product_cost_snapshot` captures the value at
 *   the moment of billing so historical commission stays stable when the
 *   master service cost is later edited.
 *
 * Fully idempotent: safe to re-run.
 */
export function runMigration010(): void {
  const serviceCols = database.getAllSync<{ name: string }>(
    "PRAGMA table_info(services)"
  );
  if (!serviceCols.some((c) => c.name === "product_cost")) {
    database.execSync(
      `ALTER TABLE services ADD COLUMN product_cost INTEGER NOT NULL DEFAULT 0`
    );
  }

  const itemCols = database.getAllSync<{ name: string }>(
    "PRAGMA table_info(income_transaction_items)"
  );
  if (!itemCols.some((c) => c.name === "product_cost_snapshot")) {
    database.execSync(
      `ALTER TABLE income_transaction_items ADD COLUMN product_cost_snapshot INTEGER NOT NULL DEFAULT 0`
    );
  }
}
