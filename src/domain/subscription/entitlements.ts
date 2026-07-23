import {
  EXPIRED_PLAN_FEATURES,
  FULL_PLAN_FEATURES,
  NONE_PLAN_FEATURES,
  parsePlanFeatures
} from "./plan-features";
import {
  evaluateSubscription,
  type EvaluableSubscription
} from "./evaluate";
import type { Entitlements, PlanFeatures } from "./types";

export type EntitlementInput = {
  subscription: EvaluableSubscription | null;
  /** Raw features_json from the plan row (or pre-parsed). */
  planFeaturesJson?: string | null;
  planFeatures?: PlanFeatures | null;
  planCode?: string | null;
  planName?: string | null;
  now?: Date;
};

/**
 * Central permission helper. Screens and repositories should call this
 * (via SubscriptionProvider / getEntitlementsForSalon) instead of
 * scattering trial/expiry checks.
 */
export function resolveEntitlements(input: EntitlementInput): Entitlements {
  const evaluated = evaluateSubscription(
    input.subscription,
    input.now ?? new Date()
  );

  const catalogFeatures =
    input.planFeatures ??
    parsePlanFeatures(input.planFeaturesJson ?? null);

  let features: PlanFeatures;
  if (evaluated.lifecycle === "none") {
    features = { ...NONE_PLAN_FEATURES };
  } else if (evaluated.isInAccessWindow) {
    // Trial / active / grace → plan features (defaults to full).
    features = { ...catalogFeatures };
  } else {
    // Expired / past grace → soft lock.
    features = { ...EXPIRED_PLAN_FEATURES };
  }

  const isOnTrial = evaluated.lifecycle === "trial";
  const isSubscriptionActive =
    evaluated.lifecycle === "active" || evaluated.lifecycle === "grace";
  const isExpired =
    evaluated.lifecycle === "expired" || evaluated.lifecycle === "none";

  return {
    ...features,
    lifecycle: evaluated.lifecycle,
    isOnTrial,
    isSubscriptionActive,
    isExpired,
    remainingDays: evaluated.remainingDays,
    planCode: input.planCode ?? null,
    planName: input.planName ?? null,
    subscriptionId: evaluated.subscriptionId,
    endAt: evaluated.endAt,
    graceEndAt: evaluated.graceEndAt
  };
}

/** Convenience predicates — thin wrappers for call-site clarity. */
export function canAssignStaffOnBill(e: Entitlements): boolean {
  return e.assignStaffOnBill;
}

export function canUsePremiumFeatures(e: Entitlements): boolean {
  return e.premiumFeatures;
}

export function canAccessReports(e: Entitlements): boolean {
  return e.accessReports;
}

export function canManageStaff(e: Entitlements): boolean {
  return e.manageStaff;
}

/** Fallback entitlements before bootstrap finishes. */
export function lockedEntitlements(): Entitlements {
  return resolveEntitlements({ subscription: null });
}

/** Full access helper for tests / trial seed assertions. */
export function fullEntitlementsOverlay(
  partial: Partial<Entitlements> = {}
): Entitlements {
  return {
    ...FULL_PLAN_FEATURES,
    lifecycle: "trial",
    isOnTrial: true,
    isSubscriptionActive: false,
    isExpired: false,
    remainingDays: 30,
    planCode: "trial",
    planName: "Free Trial",
    subscriptionId: null,
    endAt: null,
    graceEndAt: null,
    ...partial
  };
}
