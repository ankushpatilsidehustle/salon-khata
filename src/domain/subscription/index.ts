export type {
  BillingPeriod,
  Entitlements,
  PaymentStatus,
  PlanFeatures,
  ReferralReward,
  ReferralStatus,
  SubscriptionActivatedBy,
  SubscriptionLifecycle,
  SubscriptionStatus
} from "./types";

export {
  EXPIRED_PLAN_FEATURES,
  FULL_PLAN_FEATURES,
  NONE_PLAN_FEATURES,
  parsePlanFeatures,
  stringifyPlanFeatures
} from "./plan-features";

export {
  addDaysIso,
  daysBetween,
  evaluateSubscription,
  type EvaluableSubscription,
  type EvaluatedSubscription
} from "./evaluate";

export {
  canAccessReports,
  canAssignStaffOnBill,
  canManageStaff,
  canUsePremiumFeatures,
  fullEntitlementsOverlay,
  lockedEntitlements,
  resolveEntitlements
} from "./entitlements";

export {
  generateReferralCode,
  isValidReferralCodeFormat,
  normalizeReferralCode
} from "./referral-code";

export {
  buildSubscriptionGuard,
  getActivePlanCode,
  getActivePlanName,
  getAvailableFeatures,
  getSubscriptionExpiry,
  hasFeature,
  isOnTrial,
  isSubscriptionExpired,
  isUserSubscribed,
  type SubscriptionGuard
} from "./subscription-guard";
