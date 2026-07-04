import { database } from "@/database/sqlite-client";
import type { SharedColumns } from "@/database/schema/shared-columns";
import { newId } from "@/domain/id";
import { getUtcTimestamp } from "@/domain/dates";
import { DEV_DEVICE_ID } from "@/constants/dev";

export type EmployeeGender = "male" | "female" | "other";

/** How the employee is paid. */
export type CompensationType = "salary" | "commission";

export type EmployeeRecord = SharedColumns & {
  salon_id: string;
  name: string;
  address: string | null;
  mobile_number: string | null;
  gender: EmployeeGender | null;
  /** ISO date string YYYY-MM-DD (local, not UTC). */
  joining_date: string | null;
  compensation_type: CompensationType | null;
  /** Paise per month. Only meaningful when compensation_type = 'salary'. */
  salary_amount: number | null;
  /**
   * Percent × 100 (basis-point-style). 12.5% = 1250.
   * Only meaningful when compensation_type = 'commission'.
   */
  commission_percent: number | null;
  /** 1 = active, 0 = inactive */
  is_active: number;
  sort_order: number;
};

export type NewEmployee = {
  salonId: string;
  name: string;
  address?: string | null;
  mobileNumber?: string | null;
  gender?: EmployeeGender | null;
  joiningDate?: string | null;
  compensationType?: CompensationType | null;
  salaryAmount?: number | null;
  commissionPercent?: number | null;
};

export type UpdateEmployee = {
  name?: string;
  address?: string | null;
  mobileNumber?: string | null;
  gender?: EmployeeGender | null;
  joiningDate?: string | null;
  compensationType?: CompensationType | null;
  salaryAmount?: number | null;
  commissionPercent?: number | null;
  isActive?: boolean;
};

export class EmployeeRepository {
  /** Active first, then inactive, ordered by sort_order/name. */
  listAll(salonId: string): EmployeeRecord[] {
    return database.getAllSync<EmployeeRecord>(
      `SELECT * FROM employees
       WHERE salon_id = ? AND deleted_at IS NULL
       ORDER BY is_active DESC, sort_order ASC, name ASC`,
      [salonId]
    );
  }

  listActive(salonId: string): EmployeeRecord[] {
    return database.getAllSync<EmployeeRecord>(
      `SELECT * FROM employees
       WHERE salon_id = ? AND is_active = 1 AND deleted_at IS NULL
       ORDER BY sort_order ASC, name ASC`,
      [salonId]
    );
  }

  getById(id: string, salonId: string): EmployeeRecord | null {
    return (
      database.getFirstSync<EmployeeRecord>(
        `SELECT * FROM employees WHERE id = ? AND salon_id = ? AND deleted_at IS NULL`,
        [id, salonId]
      ) ?? null
    );
  }

  insert(data: NewEmployee): EmployeeRecord {
    const id = newId();
    const now = getUtcTimestamp();
    database.runSync(
      `INSERT INTO employees
       (id, salon_id, name, address, mobile_number, gender, joining_date,
        compensation_type, salary_amount, commission_percent,
        is_active, sort_order,
        created_at, updated_at, deleted_at, sync_status, device_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, ?, ?, NULL, 'pending', ?)`,
      [
        id,
        data.salonId,
        data.name.trim(),
        data.address ?? null,
        data.mobileNumber ?? null,
        data.gender ?? null,
        data.joiningDate ?? null,
        data.compensationType ?? null,
        data.salaryAmount ?? null,
        data.commissionPercent ?? null,
        now,
        now,
        DEV_DEVICE_ID
      ]
    );
    return this.getById(id, data.salonId)!;
  }

  update(id: string, salonId: string, data: UpdateEmployee): void {
    const now = getUtcTimestamp();
    const fields: string[] = ["updated_at = ?", "sync_status = 'pending'"];
    const values: (string | number | null)[] = [now];

    if (data.name !== undefined) {
      fields.push("name = ?");
      values.push(data.name.trim());
    }
    if (data.address !== undefined) {
      fields.push("address = ?");
      values.push(data.address);
    }
    if (data.mobileNumber !== undefined) {
      fields.push("mobile_number = ?");
      values.push(data.mobileNumber);
    }
    if (data.gender !== undefined) {
      fields.push("gender = ?");
      values.push(data.gender);
    }
    if (data.joiningDate !== undefined) {
      fields.push("joining_date = ?");
      values.push(data.joiningDate);
    }
    if (data.compensationType !== undefined) {
      fields.push("compensation_type = ?");
      values.push(data.compensationType);
    }
    if (data.salaryAmount !== undefined) {
      fields.push("salary_amount = ?");
      values.push(data.salaryAmount);
    }
    if (data.commissionPercent !== undefined) {
      fields.push("commission_percent = ?");
      values.push(data.commissionPercent);
    }
    if (data.isActive !== undefined) {
      fields.push("is_active = ?");
      values.push(data.isActive ? 1 : 0);
    }

    values.push(id, salonId);
    database.runSync(
      `UPDATE employees SET ${fields.join(", ")}
       WHERE id = ? AND salon_id = ? AND deleted_at IS NULL`,
      values
    );
  }

  softDelete(id: string, salonId: string): void {
    const now = getUtcTimestamp();
    database.runSync(
      `UPDATE employees
       SET deleted_at = ?, updated_at = ?, sync_status = 'pending'
       WHERE id = ? AND salon_id = ?`,
      [now, now, id, salonId]
    );
  }
}
