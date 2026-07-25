/**
 * Reusable subscription access helpers.
 *
 * Prefer these over ad-hoc lifecycle checks so future plans/features
 * can extend PlanFeatures without rewriting call sites.
 */

import type { Entitlements, PlanFeatures } from "./types";
import {
  canAccessReports,
  canAssignStaffOnBill,
  canManageStaff,
  canUsePremiumFeatures
} from "./entitlements";

/** True when the salon is in any paid/trial access window. */
export function isUserSubscribed(entitlements: Entitlements): boolean {
  return (
    entitlements.isOnTrial ||
    entitlements.isSubscriptionActive ||
    entitlements.lifecycle === "grace"
  );
}

/** Active plan code (`trial` | `monthly` | `yearly` | …) or null. */
export function getActivePlanCode(entitlements: Entitlements): string | null {
  return entitlements.planCode;
}

export function getActivePlanName(entitlements: Entitlements): string | null {
  return entitlements.planName;
}

export function isSubscriptionExpired(entitlements: Entitlements): boolean {
  return entitlements.isExpired;
}

export function isOnTrial(entitlements: Entitlements): boolean {
  return entitlements.isOnTrial;
}

export function getSubscriptionExpiry(
  entitlements: Entitlements
): string | null {
  return entitlements.endAt;
}

/** Feature flags available under the current entitlement window. */
export function getAvailableFeatures(
  entitlements: Entitlements
): PlanFeatures {
  return {
    assignStaffOnBill: entitlements.assignStaffOnBill,
    manageStaff: entitlements.manageStaff,
    accessReports: entitlements.accessReports,
    premiumFeatures: entitlements.premiumFeatures,
    commissionOnBill: entitlements.commissionOnBill
  };
}

/**
 * Check a single feature key. Extend PlanFeatures to add new gates
 * without changing this signature.
 */
export function hasFeature(
  entitlements: Entitlements,
  feature: keyof PlanFeatures
): boolean {
  switch (feature) {
    case "assignStaffOnBill":
      return canAssignStaffOnBill(entitlements);
    case "manageStaff":
      return canManageStaff(entitlements);
    case "accessReports":
      return canAccessReports(entitlements);
    case "premiumFeatures":
      return canUsePremiumFeatures(entitlements);
    case "commissionOnBill":
      return entitlements.commissionOnBill;
    default:
      return false;
  }
}

export type SubscriptionGuard = {
  isUserSubscribed: boolean;
  isOnTrial: boolean;
  isExpired: boolean;
  isSubscriptionActive: boolean;
  planCode: string | null;
  planName: string | null;
  expiresAt: string | null;
  remainingDays: number;
  features: PlanFeatures;
  hasFeature: (feature: keyof PlanFeatures) => boolean;
};

/** Bundle for screens / hooks that need multiple answers at once. */
export function buildSubscriptionGuard(
  entitlements: Entitlements
): SubscriptionGuard {
  return {
    isUserSubscribed: isUserSubscribed(entitlements),
    isOnTrial: entitlements.isOnTrial,
    isExpired: entitlements.isExpired,
    isSubscriptionActive: entitlements.isSubscriptionActive,
    planCode: entitlements.planCode,
    planName: entitlements.planName,
    expiresAt: entitlements.endAt,
    remainingDays: entitlements.remainingDays,
    features: getAvailableFeatures(entitlements),
    hasFeature: (feature) => hasFeature(entitlements, feature)
  };
}
