import { database } from "@/database/sqlite-client";
import type { SharedColumns } from "@/database/schema/shared-columns";
import { getUtcTimestamp } from "@/domain/dates";
import { DEV_DEVICE_ID } from "@/constants/dev";

export type SalonType = "male" | "female" | "unisex";

export type SalonRecord = SharedColumns & {
  business_name: string;
  owner_name: string;
  mobile_number: string;
  currency: string;
  language: string;
  salon_type: SalonType;
};

export type NewSalon = {
  id: string;
  businessName: string;
  ownerName?: string;
  mobileNumber?: string;
  language: string;
  salonType: SalonType;
  currency?: string;
};

export class SalonRepository {
  hasSalon(id: string): boolean {
    const row = database.getFirstSync<{ id: string }>(
      `SELECT id FROM salons WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
      [id]
    );
    return !!row;
  }

  getById(id: string): SalonRecord | null {
    return (
      database.getFirstSync<SalonRecord>(
        `SELECT * FROM salons WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
        [id]
      ) ?? null
    );
  }

  create(data: NewSalon): SalonRecord {
    const now = getUtcTimestamp();
    database.runSync(
      `INSERT INTO salons
       (id, business_name, owner_name, mobile_number, currency, language,
        salon_type, created_at, updated_at, deleted_at, sync_status, device_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'pending', ?)`,
      [
        data.id,
        data.businessName.trim(),
        (data.ownerName ?? "").trim(),
        (data.mobileNumber ?? "").trim(),
        data.currency ?? "INR",
        data.language,
        data.salonType,
        now,
        now,
        DEV_DEVICE_ID
      ]
    );
    return this.getById(data.id)!;
  }

  updateSalonType(id: string, salonType: SalonType): void {
    const now = getUtcTimestamp();
    database.runSync(
      `UPDATE salons
       SET salon_type = ?, updated_at = ?, sync_status = 'pending'
       WHERE id = ? AND deleted_at IS NULL`,
      [salonType, now, id]
    );
  }
}
