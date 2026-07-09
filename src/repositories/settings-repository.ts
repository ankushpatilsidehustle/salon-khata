import { database } from "@/database/sqlite-client";
import type { SalonType } from "@/repositories/salon-repository";

export class SettingsRepository {
  getSalonCurrency(salonId: string) {
    const row = database.getFirstSync<{ currency: string }>(
      `SELECT currency FROM salons WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
      [salonId]
    );

    return row?.currency ?? "INR";
  }

  getSalonType(salonId: string): SalonType {
    const row = database.getFirstSync<{ salon_type: SalonType }>(
      `SELECT salon_type FROM salons WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
      [salonId]
    );
    return row?.salon_type ?? "unisex";
  }

  getSalonLanguage(salonId: string): string {
    const row = database.getFirstSync<{ language: string }>(
      `SELECT language FROM salons WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
      [salonId]
    );
    return row?.language ?? "en";
  }
}