import { database } from "@/database/sqlite-client";

export class ExpenseRepository {
  totalForBusinessDate(salonId: string, businessDate: string) {
    const row = database.getFirstSync<{ total: number | null }>(
      `SELECT SUM(amount) as total FROM expenses WHERE salon_id = ? AND expense_date = ? AND deleted_at IS NULL`,
      [salonId, businessDate]
    );

    return row?.total ?? 0;
  }
}