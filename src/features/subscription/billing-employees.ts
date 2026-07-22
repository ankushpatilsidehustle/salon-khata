import type { EmployeeRecord } from "@/repositories/employee-repository";
import type { Entitlements } from "@/domain/subscription";

/**
 * Employees selectable while creating/editing a bill, given entitlements.
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
 * True when a bill line's employee assignment is allowed.
 * Historical non-owner lines on an existing bill are allowed to remain
 * (pass `allowExisting=true` when hydrating edits).
 */
export function isEmployeeAllowedOnBill(params: {
  employee: EmployeeRecord | null | undefined;
  entitlements: Entitlements;
  allowExisting?: boolean;
}): boolean {
  if (params.entitlements.assignStaffOnBill) return true;
  if (!params.employee) {
    // Owner-only mode may save without an employee row when onboarding
    // skipped "also does services".
    return true;
  }
  if (params.employee.is_owner === 1) return true;
  return params.allowExisting === true;
}
