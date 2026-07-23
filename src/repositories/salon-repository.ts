import { database, runInTransaction } from "@/database/sqlite-client";
import type { SharedColumns } from "@/database/schema/shared-columns";
import { markDirty } from "@/database/db-meta";
import { getUtcTimestamp } from "@/domain/dates";
import { trackChange } from "@/sync/change-tracker";

export type SalonType = "male" | "female" | "unisex";

export type SalonRecord = SharedColumns & {
  business_name: string;
  owner_name: string;
  mobile_number: string;
  currency: string;
  language: string;
  salon_type: SalonType;
  owner_uid: string | null;
};

export type NewSalon = {
  id: string;
  businessName: string;
  ownerName?: string;
  mobileNumber?: string;
  language: string;
  salonType: SalonType;
  currency?: string;
  /** Firebase Auth uid — links the salon to the signed-in user. */
  ownerUid?: string;
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

  /** Lookup by Firebase Auth uid (populated by migration 013). */
  findByOwnerUid(ownerUid: string): SalonRecord | null {
    return (
      database.getFirstSync<SalonRecord>(
        `SELECT * FROM salons
         WHERE owner_uid = ? AND deleted_at IS NULL
         LIMIT 1`,
        [ownerUid]
      ) ?? null
    );
  }

  create(data: NewSalon): SalonRecord {
    const now = getUtcTimestamp();
    runInTransaction(() => {
      database.runSync(
        `INSERT INTO salons
         (id, business_name, owner_name, mobile_number, currency, language,
          salon_type, owner_uid, created_at, updated_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
        [
          data.id,
          data.businessName.trim(),
          (data.ownerName ?? "").trim(),
          (data.mobileNumber ?? "").trim(),
          data.currency ?? "INR",
          data.language,
          data.salonType,
          data.ownerUid ?? null,
          now,
          now
        ]
      );
      // salons.id doubles as its own salon_id — the row is its own scope.
      trackChange({ entityType: "salons", entityId: data.id, salonId: data.id });
      markDirty();
    });
    return this.getById(data.id)!;
  }

  updateSalonType(id: string, salonType: SalonType): void {
    const now = getUtcTimestamp();
    runInTransaction(() => {
      database.runSync(
        `UPDATE salons
         SET salon_type = ?, updated_at = ?
         WHERE id = ? AND deleted_at IS NULL`,
        [salonType, now, id]
      );
      trackChange({ entityType: "salons", entityId: id, salonId: id });
      markDirty();
    });
  }

  /** Persist the owner's preferred UI language (local commit + sync queue). */
  updateLanguage(id: string, language: string): void {
    const now = getUtcTimestamp();
    runInTransaction(() => {
      database.runSync(
        `UPDATE salons
         SET language = ?, updated_at = ?
         WHERE id = ? AND deleted_at IS NULL`,
        [language, now, id]
      );
      trackChange({ entityType: "salons", entityId: id, salonId: id });
      markDirty();
    });
  }
}
