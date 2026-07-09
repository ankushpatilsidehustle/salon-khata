import { database } from "@/database/sqlite-client";

/**
 * Migration 009 — onboarding-related columns.
 *
 * - `salons.salon_type` drives default customer gender and starter services.
 *   'unisex' is the safe default for existing rows.
 * - `employees.is_owner` marks the auto-created owner-employee row.
 *
 * Fully idempotent: safe to re-run.
 */
export function runMigration009(): void {
  const salonCols = database.getAllSync<{ name: string }>(
    "PRAGMA table_info(salons)"
  );
  if (!salonCols.some((c) => c.name === "salon_type")) {
    database.execSync(
      `ALTER TABLE salons ADD COLUMN salon_type TEXT NOT NULL DEFAULT 'unisex'`
    );
  }

  const employeeCols = database.getAllSync<{ name: string }>(
    "PRAGMA table_info(employees)"
  );
  if (!employeeCols.some((c) => c.name === "is_owner")) {
    database.execSync(
      `ALTER TABLE employees ADD COLUMN is_owner INTEGER NOT NULL DEFAULT 0`
    );
  }
}
