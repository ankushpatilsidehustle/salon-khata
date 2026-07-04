import { database } from "@/database/sqlite-client";

export class SettingsRepository {
  getSalonCurrency(salonId: string) {
    const row = database.getFirstSync<{ currency: string }>(
      `SELECT currency FROM salons WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
      [salonId]
    );

    return row?.currency ?? "INR";
  }
}