import { database } from "@/database/sqlite-client";
import type { SharedColumns } from "@/database/schema/shared-columns";

export type EmployeeAdvanceRecord = SharedColumns & {
  salon_id: string;
  employee_id: string;
  employee_name_snapshot: string;
  /** Paise. */
  amount: number;
  advance_date: string;
  remarks: string | null;
  /** ISO UTC timestamp when reconciled. NULL = outstanding. */
  settled_at: string | null;
};

/** Draft passed to insert/update — mirrors the row shape 1:1. */
export type EmployeeAdvanceDraft = {
  id: string;
  salon_id: string;
  employee_id: string;
  employee_name_snapshot: string;
  amount: number;
  advance_date: string;
  remarks: string | null;
  settled_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  sync_status: string;
  device_id: string;
};

export type EmployeeOutstanding = {
  employee_id: string;
  total: number;
};

export class EmployeeAdvanceRepository {
  /** Single advance by id (excludes soft-deleted). */
  getById(salonId: string, id: string): EmployeeAdvanceRecord | null {
    return (
      database.getFirstSync<EmployeeAdvanceRecord>(
        `SELECT * FROM employee_advances
         WHERE id = ? AND salon_id = ? AND deleted_at IS NULL`,
        [id, salonId]
      ) ?? null
    );
  }

  /** All advances for the salon, newest first. Excludes soft-deleted. */
  listAll(salonId: string): EmployeeAdvanceRecord[] {
    return database.getAllSync<EmployeeAdvanceRecord>(
      `SELECT * FROM employee_advances
       WHERE salon_id = ? AND deleted_at IS NULL
       ORDER BY advance_date DESC, created_at DESC`,
      [salonId]
    );
  }

  /** All advances for one employee, newest first. */
  listByEmployee(
    salonId: string,
    employeeId: string
  ): EmployeeAdvanceRecord[] {
    return database.getAllSync<EmployeeAdvanceRecord>(
      `SELECT * FROM employee_advances
       WHERE salon_id = ? AND employee_id = ? AND deleted_at IS NULL
       ORDER BY advance_date DESC, created_at DESC`,
      [salonId, employeeId]
    );
  }

  /**
   * Sum of unsettled advances per employee for the salon. Employees with a
   * zero balance are omitted so callers can render badges only when > 0.
   */
  outstandingByEmployee(salonId: string): EmployeeOutstanding[] {
    return database.getAllSync<EmployeeOutstanding>(
      `SELECT employee_id, SUM(amount) AS total
       FROM employee_advances
       WHERE salon_id = ?
         AND deleted_at IS NULL
         AND settled_at IS NULL
       GROUP BY employee_id
       HAVING total > 0`,
      [salonId]
    );
  }

  /** Total unsettled advances across every employee. Returns 0 when empty. */
  totalOutstanding(salonId: string): number {
    const row = database.getFirstSync<{ total: number | null }>(
      `SELECT COALESCE(SUM(amount), 0) AS total
       FROM employee_advances
       WHERE salon_id = ?
         AND deleted_at IS NULL
         AND settled_at IS NULL`,
      [salonId]
    );
    return row?.total ?? 0;
  }

  insert(draft: EmployeeAdvanceDraft): void {
    database.runSync(
      `INSERT INTO employee_advances (
        id, salon_id, employee_id, employee_name_snapshot,
        amount, advance_date, remarks, settled_at,
        created_at, updated_at, deleted_at, sync_status, device_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        draft.id,
        draft.salon_id,
        draft.employee_id,
        draft.employee_name_snapshot,
        draft.amount,
        draft.advance_date,
        draft.remarks,
        draft.settled_at,
        draft.created_at,
        draft.updated_at,
        draft.deleted_at,
        draft.sync_status,
        draft.device_id
      ]
    );
  }

  update(draft: EmployeeAdvanceDraft): void {
    database.runSync(
      `UPDATE employee_advances SET
         employee_id = ?, employee_name_snapshot = ?,
         amount = ?, advance_date = ?, remarks = ?, settled_at = ?,
         updated_at = ?, sync_status = ?, device_id = ?
       WHERE id = ? AND salon_id = ? AND deleted_at IS NULL`,
      [
        draft.employee_id,
        draft.employee_name_snapshot,
        draft.amount,
        draft.advance_date,
        draft.remarks,
        draft.settled_at,
        draft.updated_at,
        draft.sync_status,
        draft.device_id,
        draft.id,
        draft.salon_id
      ]
    );
  }

  /**
   * Mark an unsettled advance as reconciled. No-op on already-settled or
   * already-deleted rows so it's safe to call twice.
   */
  markSettled(
    salonId: string,
    id: string,
    now: string,
    deviceId: string
  ): void {
    database.runSync(
      `UPDATE employee_advances
       SET settled_at = ?, updated_at = ?, sync_status = 'pending', device_id = ?
       WHERE id = ? AND salon_id = ?
         AND settled_at IS NULL AND deleted_at IS NULL`,
      [now, now, deviceId, id, salonId]
    );
  }

  softDelete(
    salonId: string,
    id: string,
    now: string,
    deviceId: string
  ): void {
    database.runSync(
      `UPDATE employee_advances
       SET deleted_at = ?, updated_at = ?, sync_status = 'pending', device_id = ?
       WHERE id = ? AND salon_id = ? AND deleted_at IS NULL`,
      [now, now, deviceId, id, salonId]
    );
  }
}
