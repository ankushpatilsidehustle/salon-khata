import { database } from "@/database/sqlite-client";
import type { SharedColumns } from "@/database/schema/shared-columns";
import { newId } from "@/domain/id";
import { getUtcTimestamp } from "@/domain/dates";
import { DEV_DEVICE_ID } from "@/constants/dev";

/**
 * Legacy `gender` column values retained for schema compatibility.
 * New rows always insert 'unisex' — gender-based pricing is now expressed
 * via separate `male_price` / `female_price` columns.
 */
export type ServiceGender = "unisex" | "male" | "female";

export type ServiceRecord = SharedColumns & {
  salon_id: string;
  category_id: string | null;
  name: string;
  /** Legacy single price (paise). Kept mirrored to whichever gender price is set. */
  price: number;
  /** Paise. 0 means the service is not offered for male clients. */
  male_price: number;
  /** Paise. 0 means the service is not offered for female clients. */
  female_price: number;
  /**
   * Material ("parts") cost per unit of the service, in paise. Subtracted
   * from the line amount before applying percentage commissions so stylists
   * earn on the labor portion only. 0 disables the labor split.
   */
  product_cost: number;
  is_active: number;
  sort_order: number;
  gender: ServiceGender;
};

export type NewService = {
  salonId: string;
  categoryId: string | null;
  name: string;
  malePrice: number;
  femalePrice: number;
  /** Paise. Optional; defaults to 0 (no labor split). */
  productCost?: number;
};

export type UpdateService = {
  categoryId?: string | null;
  name?: string;
  malePrice?: number;
  femalePrice?: number;
  productCost?: number;
  isActive?: boolean;
};

/** `all` = no filter; otherwise a category id. */
export type ServiceCategoryFilter = "all" | string;

export class ServiceRepository {
  listAll(
    salonId: string,
    categoryId: ServiceCategoryFilter = "all"
  ): ServiceRecord[] {
    if (categoryId === "all") {
      return database.getAllSync<ServiceRecord>(
        `SELECT * FROM services
         WHERE salon_id = ? AND deleted_at IS NULL
         ORDER BY is_active DESC, sort_order ASC, name ASC`,
        [salonId]
      );
    }
    return database.getAllSync<ServiceRecord>(
      `SELECT * FROM services
       WHERE salon_id = ? AND category_id = ? AND deleted_at IS NULL
       ORDER BY is_active DESC, sort_order ASC, name ASC`,
      [salonId, categoryId]
    );
  }

  listActive(salonId: string): ServiceRecord[] {
    return database.getAllSync<ServiceRecord>(
      `SELECT * FROM services
       WHERE salon_id = ? AND is_active = 1 AND deleted_at IS NULL
       ORDER BY sort_order ASC, name ASC`,
      [salonId]
    );
  }

  getById(id: string, salonId: string): ServiceRecord | null {
    return (
      database.getFirstSync<ServiceRecord>(
        `SELECT * FROM services WHERE id = ? AND salon_id = ? AND deleted_at IS NULL`,
        [id, salonId]
      ) ?? null
    );
  }

  insert(data: NewService): ServiceRecord {
    const id = newId();
    const now = getUtcTimestamp();
    // Legacy `price` column is NOT NULL — mirror the more relevant price so
    // any old code path reading it still gets something sensible.
    const legacyPrice = data.malePrice > 0 ? data.malePrice : data.femalePrice;
    database.runSync(
      `INSERT INTO services
       (id, salon_id, category_id, name,
        price, male_price, female_price, product_cost, gender,
        is_active, sort_order,
        created_at, updated_at, deleted_at, sync_status, device_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'unisex', 1, 0, ?, ?, NULL, 'pending', ?)`,
      [
        id,
        data.salonId,
        data.categoryId,
        data.name.trim(),
        legacyPrice,
        data.malePrice,
        data.femalePrice,
        data.productCost ?? 0,
        now,
        now,
        DEV_DEVICE_ID
      ]
    );
    return this.getById(id, data.salonId)!;
  }

  update(id: string, salonId: string, data: UpdateService): void {
    const now = getUtcTimestamp();
    const fields: string[] = ["updated_at = ?", "sync_status = 'pending'"];
    const values: (string | number | null)[] = [now];

    if (data.categoryId !== undefined) {
      fields.push("category_id = ?");
      values.push(data.categoryId);
    }
    if (data.name !== undefined) {
      fields.push("name = ?");
      values.push(data.name.trim());
    }
    if (data.malePrice !== undefined) {
      fields.push("male_price = ?");
      values.push(data.malePrice);
    }
    if (data.femalePrice !== undefined) {
      fields.push("female_price = ?");
      values.push(data.femalePrice);
    }
    if (data.malePrice !== undefined || data.femalePrice !== undefined) {
      // Keep legacy `price` mirrored so historical queries stay meaningful.
      const existing = this.getById(id, salonId);
      const nextMale = data.malePrice ?? existing?.male_price ?? 0;
      const nextFemale = data.femalePrice ?? existing?.female_price ?? 0;
      const legacy = nextMale > 0 ? nextMale : nextFemale;
      fields.push("price = ?");
      values.push(legacy);
    }
    if (data.productCost !== undefined) {
      fields.push("product_cost = ?");
      values.push(data.productCost);
    }
    if (data.isActive !== undefined) {
      fields.push("is_active = ?");
      values.push(data.isActive ? 1 : 0);
    }

    values.push(id, salonId);
    database.runSync(
      `UPDATE services SET ${fields.join(", ")}
       WHERE id = ? AND salon_id = ? AND deleted_at IS NULL`,
      values
    );
  }

  softDelete(id: string, salonId: string): void {
    const now = getUtcTimestamp();
    database.runSync(
      `UPDATE services
       SET deleted_at = ?, updated_at = ?, sync_status = 'pending'
       WHERE id = ? AND salon_id = ?`,
      [now, now, id, salonId]
    );
  }
}
