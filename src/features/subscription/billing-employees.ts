import type { EmployeeRecord } from "@/repositories/employee-repository";
import type { Entitlements } from "@/domain/subscription";

/**
 * Employees selectable for *new* assignments on a bill.
 * After trial/subscription expiry only the owner employee remains available.
 */
export function filterBillingEmployees(
  employees: EmployeeRecord[],
  entitlements: Entitlements
): EmployeeRecord[] {
  const active = employees.filter((e) => e.is_active === 1);
  if (entitlements.assignStaffOnBill) return active;
  return active.filter((e) => e.is_owner === 1);
}

/**
 * Employees shown in bill pickers. In edit mode under a soft-lock, include
 * any employees already on the bill so historical staff assignments remain
 * visible without rewriting them to the owner.
 */
export function employeesForBillPicker(params: {
  employees: EmployeeRecord[];
  entitlements: Entitlements;
  /** Employee ids already present on the bill (edit / hydrated). */
  assignedEmployeeIds?: Iterable<string>;
  isEditing?: boolean;
}): EmployeeRecord[] {
  const selectable = filterBillingEmployees(
    params.employees,
    params.entitlements
  );
  if (params.entitlements.assignStaffOnBill || !params.isEditing) {
    return selectable;
  }

  const byId = new Map(selectable.map((e) => [e.id, e]));
  for (const id of params.assignedEmployeeIds ?? []) {
    if (byId.has(id)) continue;
    const existing = params.employees.find((e) => e.id === id);
    if (existing) byId.set(existing.id, existing);
  }
  return Array.from(byId.values());
}

/**
 * True when a bill line's employee assignment is allowed.
 * Historical non-owner lines on an existing bill are allowed to remain
 * (pass `allowExisting=true`).
 */
export function isEmployeeAllowedOnBill(params: {
  employee: EmployeeRecord | null | undefined;
  entitlements: Entitlements;
  allowExisting?: boolean;
}): boolean {
  if (params.entitlements.assignStaffOnBill) return true;
  if (!params.employee) {
    // Owner-only mode may temporarily lack an employee row; save path
    // calls ensureOwnerEmployee before insert.
    return true;
  }
  if (params.employee.is_owner === 1) return true;
  return params.allowExisting === true;
}
