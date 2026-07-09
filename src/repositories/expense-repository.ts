import { database } from "@/database/sqlite-client";
import type { SharedColumns } from "@/database/schema/shared-columns";

export type ExpensePaymentMode = "cash" | "upi" | "credit";

export type ExpenseRecord = SharedColumns & {
  salon_id: string;
  category_id: string;
  category_name_snapshot: string;
  amount: number;
  remarks: string | null;
  expense_date: string;
  payment_mode: ExpensePaymentMode;
  /** ISO UTC timestamp when a credit expense was paid off; null = still outstanding. */
  settled_at: string | null;
};

export type ExpenseDraft = {
  id: string;
  salon_id: string;
  category_id: string;
  category_name_snapshot: string;
  amount: number;
  remarks: string | null;
  expense_date: string;
  payment_mode: ExpensePaymentMode;
  settled_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  sync_status: string;
  device_id: string;
};

export class ExpenseRepository {
  /**
   * Sum of all expense amounts for a local business date (YYYY-MM-DD).
   * Excludes soft-deleted rows.
   */
  totalForBusinessDate(salonId: string, businessDate: string) {
    const row = database.getFirstSync<{ total: number | null }>(
      `SELECT SUM(amount) as total FROM expenses
       WHERE salon_id = ? AND expense_date = ? AND deleted_at IS NULL`,
      [salonId, businessDate]
    );
    return row?.total ?? 0;
  }

  /**
   * Lifetime total of unpaid credit expenses (payment_mode = 'credit' AND
   * settled_at IS NULL) — i.e. money the salon still owes vendors.
   * Excludes soft-deleted rows.
   */
  totalCreditOutstanding(salonId: string) {
    const row = database.getFirstSync<{ total: number | null }>(
      `SELECT SUM(amount) as total FROM expenses
       WHERE salon_id = ?
         AND payment_mode = 'credit'
         AND settled_at IS NULL
         AND deleted_at IS NULL`,
      [salonId]
    );
    return row?.total ?? 0;
  }

  /**
   * Mark a credit expense as paid. Sets settled_at + updated_at and flips
   * sync_status to 'pending'. No-op if the row is missing or already settled.
   */
  markCreditPaid(salonId: string, id: string, now: string, deviceId: string): void {
    database.runSync(
      `UPDATE expenses SET
         settled_at = ?,
         updated_at = ?,
         sync_status = 'pending',
         device_id = ?
       WHERE id = ? AND salon_id = ?
         AND payment_mode = 'credit'
         AND settled_at IS NULL
         AND deleted_at IS NULL`,
      [now, now, deviceId, id, salonId]
    );
  }

  /**
   * All expenses for a local business date (YYYY-MM-DD), newest first.
   */
  listByDate(salonId: string, businessDate: string): ExpenseRecord[] {
    return database.getAllSync<ExpenseRecord>(
      `SELECT * FROM expenses
       WHERE salon_id = ? AND expense_date = ? AND deleted_at IS NULL
       ORDER BY created_at DESC`,
      [salonId, businessDate]
    );
  }

  /**
   * Single expense by id. Returns null if the row is missing or soft-deleted.
   */
  getById(salonId: string, id: string): ExpenseRecord | null {
    return (
      database.getFirstSync<ExpenseRecord>(
        `SELECT * FROM expenses
         WHERE id = ? AND salon_id = ? AND deleted_at IS NULL`,
        [id, salonId]
      ) ?? null
    );
  }

  insert(draft: ExpenseDraft): void {
    database.runSync(
      `INSERT INTO expenses (
        id, salon_id, category_id, category_name_snapshot,
        amount, remarks, expense_date, payment_mode, settled_at,
        created_at, updated_at, deleted_at, sync_status, device_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        draft.id,
        draft.salon_id,
        draft.category_id,
        draft.category_name_snapshot,
        draft.amount,
        draft.remarks,
        draft.expense_date,
        draft.payment_mode,
        draft.settled_at,
        draft.created_at,
        draft.updated_at,
        draft.deleted_at,
        draft.sync_status,
        draft.device_id
      ]
    );
  }

  /** Update an existing expense, marking it pending for the sync engine. */
  update(draft: ExpenseDraft): void {
    database.runSync(
      `UPDATE expenses SET
         category_id = ?,
         category_name_snapshot = ?,
         amount = ?,
         remarks = ?,
         expense_date = ?,
         payment_mode = ?,
         settled_at = ?,
         updated_at = ?,
         sync_status = ?,
         device_id = ?
       WHERE id = ? AND salon_id = ? AND deleted_at IS NULL`,
      [
        draft.category_id,
        draft.category_name_snapshot,
        draft.amount,
        draft.remarks,
        draft.expense_date,
        draft.payment_mode,
        draft.settled_at,
        draft.updated_at,
        draft.sync_status,
        draft.device_id,
        draft.id,
        draft.salon_id
      ]
    );
  }

  /** Soft-delete: sets deleted_at + updated_at + sync_status='pending'. */
  softDelete(salonId: string, id: string, now: string, deviceId: string): void {
    database.runSync(
      `UPDATE expenses SET
         deleted_at = ?,
         updated_at = ?,
         sync_status = 'pending',
         device_id = ?
       WHERE id = ? AND salon_id = ? AND deleted_at IS NULL`,
      [now, now, deviceId, id, salonId]
    );
  }
}