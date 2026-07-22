/**
 * Shared subscription / referral domain types.
 * Keep React- and SQLite-free — repositories map DB rows into these shapes.
 */

export type BillingPeriod = "trial" | "month" | "quarter" | "year" | "custom";

export type SubscriptionStatus =
  | "trial"
  | "active"
  | "grace"
  | "expired"
  | "cancelled";

/** Stored status may lag; evaluate() derives the effective lifecycle. */
export type SubscriptionLifecycle =
  | "trial"
  | "active"
  | "grace"
  | "expired"
  | "none";

export type SubscriptionActivatedBy =
  | "system_trial"
  | "payment"
  | "admin"
  | "referral_reward";

export type PaymentStatus = "pending" | "succeeded" | "failed" | "refunded";

export type ReferralStatus =
  | "pending"
  | "qualified"
  | "rewarded"
  | "rejected";

/**
 * Feature flags per plan. Unknown keys must be ignored by older clients.
 * Extending this shape does not require a DB migration — it lives in JSON.
 */
export type PlanFeatures = {
  assignStaffOnBill: boolean;
  manageStaff: boolean;
  accessReports: boolean;
  premiumFeatures: boolean;
  commissionOnBill: boolean;
};

export type Entitlements = PlanFeatures & {
  lifecycle: SubscriptionLifecycle;
  isOnTrial: boolean;
  /** Paid plan currently in active or grace window. */
  isSubscriptionActive: boolean;
  isExpired: boolean;
  remainingDays: number;
  planCode: string | null;
  planName: string | null;
  subscriptionId: string | null;
  endAt: string | null;
  graceEndAt: string | null;
};

/**
 * Extensible reward payload. Add new `type` values without schema changes.
 *
 * Examples:
 *   { "type": "subscription_days", "days": 7, "status": "pending" }
 *   { "type": "credits", "amount_paise": 50000, "status": "pending" }
 *   { "type": "cashback", "amount_paise": 10000, "status": "pending" }
 */
export type ReferralReward = {
  type: string;
  status?: "pending" | "applied" | "cancelled";
  days?: number;
  amount_paise?: number;
  [key: string]: unknown;
};
