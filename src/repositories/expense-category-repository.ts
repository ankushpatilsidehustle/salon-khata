import { database, runInTransaction } from "@/database/sqlite-client";
import type { SharedColumns } from "@/database/schema/shared-columns";
import { markDirty } from "@/database/db-meta";
import { newId } from "@/domain/id";
import { getUtcTimestamp } from "@/domain/dates";
import { trackChange } from "@/sync/change-tracker";

export type ExpenseCategoryRecord = SharedColumns & {
  salon_id: string;
  name: string;
  is_system: number;
  is_active: number;
};

/** Default categories seeded on first use for a fresh salon. */
const DEFAULT_CATEGORIES: string[] = [
  "Rent",
  "Utilities",
  "Supplies",
  "Salaries",
  "Marketing",
  "Other"
];

export class ExpenseCategoryRepository {
  listActive(salonId: string): ExpenseCategoryRecord[] {
    return database.getAllSync<ExpenseCategoryRecord>(
      `SELECT * FROM expense_categories
       WHERE salon_id = ? AND is_active = 1 AND deleted_at IS NULL
       ORDER BY is_system DESC, name ASC`,
      [salonId]
    );
  }

  getById(id: string, salonId: string): ExpenseCategoryRecord | null {
    return (
      database.getFirstSync<ExpenseCategoryRecord>(
        `SELECT * FROM expense_categories
         WHERE id = ? AND salon_id = ? AND deleted_at IS NULL`,
        [id, salonId]
      ) ?? null
    );
  }

  insert(salonId: string, name: string, isSystem = false): ExpenseCategoryRecord {
    const id = newId();
    const now = getUtcTimestamp();
    runInTransaction(() => {
      database.runSync(
        `INSERT INTO expense_categories
         (id, salon_id, name, is_system, is_active,
          created_at, updated_at, deleted_at)
         VALUES (?, ?, ?, ?, 1, ?, ?, NULL)`,
        [id, salonId, name.trim(), isSystem ? 1 : 0, now, now]
      );
      trackChange({
        entityType: "expense_categories",
        entityId: id,
        salonId
      });
      markDirty();
    });
    return this.getById(id, salonId)!;
  }

  /**
   * Ensure the built-in default categories exist for this salon.
   * Safe to call repeatedly — only inserts categories that are missing by name.
   */
  ensureDefaults(salonId: string): void {
    const existing = new Set(
      this.listActive(salonId).map((c) => c.name.toLowerCase())
    );
    for (const name of DEFAULT_CATEGORIES) {
      if (existing.has(name.toLowerCase())) continue;
      this.insert(salonId, name, true);
    }
  }
}
