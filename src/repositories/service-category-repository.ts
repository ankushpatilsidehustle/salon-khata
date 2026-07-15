import { database, runInTransaction } from "@/database/sqlite-client";
import type { SharedColumns } from "@/database/schema/shared-columns";
import { markDirty } from "@/database/db-meta";
import { newId } from "@/domain/id";
import { getUtcTimestamp } from "@/domain/dates";
import { trackChange } from "@/sync/change-tracker";

export type ServiceCategoryRecord = SharedColumns & {
  salon_id: string;
  name: string;
  is_active: number;
  sort_order: number;
  is_system: number;
};

export type NewServiceCategory = {
  salonId: string;
  name: string;
  isSystem?: boolean;
  sortOrder?: number;
};

export type UpdateServiceCategory = {
  name?: string;
  isActive?: boolean;
};

/** Default categories seeded for a fresh salon. */
const DEFAULT_CATEGORIES: string[] = [
  "Hair",
  "Facial",
  "Waxing",
  "Threading",
  "Manicure & Pedicure",
  "Massage",
  "Makeup",
  "Others"
];

export class ServiceCategoryRepository {
  listAll(salonId: string): ServiceCategoryRecord[] {
    return database.getAllSync<ServiceCategoryRecord>(
      `SELECT * FROM service_categories
       WHERE salon_id = ? AND deleted_at IS NULL
       ORDER BY is_active DESC, sort_order ASC, name ASC`,
      [salonId]
    );
  }

  listActive(salonId: string): ServiceCategoryRecord[] {
    return database.getAllSync<ServiceCategoryRecord>(
      `SELECT * FROM service_categories
       WHERE salon_id = ? AND is_active = 1 AND deleted_at IS NULL
       ORDER BY sort_order ASC, name ASC`,
      [salonId]
    );
  }

  getById(id: string, salonId: string): ServiceCategoryRecord | null {
    return (
      database.getFirstSync<ServiceCategoryRecord>(
        `SELECT * FROM service_categories
         WHERE id = ? AND salon_id = ? AND deleted_at IS NULL`,
        [id, salonId]
      ) ?? null
    );
  }

  insert(data: NewServiceCategory): ServiceCategoryRecord {
    const id = newId();
    const now = getUtcTimestamp();
    const sortOrder = data.sortOrder ?? this.nextSortOrder(data.salonId);
    runInTransaction(() => {
      database.runSync(
        `INSERT INTO service_categories
         (id, salon_id, name, is_active, sort_order, is_system,
          created_at, updated_at, deleted_at)
         VALUES (?, ?, ?, 1, ?, ?, ?, ?, NULL)`,
        [
          id,
          data.salonId,
          data.name.trim(),
          sortOrder,
          data.isSystem ? 1 : 0,
          now,
          now
        ]
      );
      trackChange({
        entityType: "service_categories",
        entityId: id,
        salonId: data.salonId
      });
      markDirty();
    });
    return this.getById(id, data.salonId)!;
  }

  update(id: string, salonId: string, data: UpdateServiceCategory): void {
    const now = getUtcTimestamp();
    const fields: string[] = ["updated_at = ?"];
    const values: (string | number | null)[] = [now];

    if (data.name !== undefined) {
      fields.push("name = ?");
      values.push(data.name.trim());
    }
    if (data.isActive !== undefined) {
      fields.push("is_active = ?");
      values.push(data.isActive ? 1 : 0);
    }
    values.push(id, salonId);
    runInTransaction(() => {
      database.runSync(
        `UPDATE service_categories SET ${fields.join(", ")}
         WHERE id = ? AND salon_id = ? AND deleted_at IS NULL`,
        values
      );
      trackChange({ entityType: "service_categories", entityId: id, salonId });
      markDirty();
    });
  }

  /**
   * Ensure the default set exists for this salon. Safe to call repeatedly —
   * only inserts categories that are missing by name.
   */
  ensureDefaults(salonId: string): void {
    const existing = new Set(
      this.listAll(salonId).map((c) => c.name.toLowerCase())
    );
    DEFAULT_CATEGORIES.forEach((name, index) => {
      if (existing.has(name.toLowerCase())) return;
      this.insert({ salonId, name, isSystem: true, sortOrder: index });
    });
  }

  private nextSortOrder(salonId: string): number {
    const row = database.getFirstSync<{ max_sort: number | null }>(
      `SELECT MAX(sort_order) AS max_sort FROM service_categories
       WHERE salon_id = ? AND deleted_at IS NULL`,
      [salonId]
    );
    return (row?.max_sort ?? -1) + 1;
  }
}
