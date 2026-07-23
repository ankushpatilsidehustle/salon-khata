import type { PlanFeatures } from "./types";

/** Full access — trial and paid plans. */
export const FULL_PLAN_FEATURES: PlanFeatures = {
  assignStaffOnBill: true,
  manageStaff: true,
  accessReports: true,
  premiumFeatures: true,
  commissionOnBill: true
};

/**
 * Soft-lock after trial/paid window ends.
 * Owner can still operate: reports, staff CRUD, owner-only billing.
 */
export const EXPIRED_PLAN_FEATURES: PlanFeatures = {
  assignStaffOnBill: false,
  manageStaff: true,
  accessReports: true,
  premiumFeatures: false,
  commissionOnBill: false
};

/** No subscription row yet (should be rare after bootstrap). */
export const NONE_PLAN_FEATURES: PlanFeatures = { ...EXPIRED_PLAN_FEATURES };

export function parsePlanFeatures(raw: string | null | undefined): PlanFeatures {
  if (!raw) return { ...FULL_PLAN_FEATURES };
  try {
    const parsed = JSON.parse(raw) as Partial<PlanFeatures>;
    return {
      assignStaffOnBill: parsed.assignStaffOnBill ?? true,
      manageStaff: parsed.manageStaff ?? true,
      accessReports: parsed.accessReports ?? true,
      premiumFeatures: parsed.premiumFeatures ?? true,
      commissionOnBill: parsed.commissionOnBill ?? true
    };
  } catch {
    return { ...FULL_PLAN_FEATURES };
  }
}

export function stringifyPlanFeatures(features: PlanFeatures): string {
  return JSON.stringify(features);
}
