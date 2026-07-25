/**
 * Razorpay credentials — environment / Secret Manager only.
 * Never hardcode keys. Placeholders documented in docs/subscription/razorpay-setup.md.
 */

export type PurchaseablePlanCode = "monthly" | "yearly";

export type AppPlanDefinition = {
  code: PurchaseablePlanCode;
  name: string;
  description: string;
  /** Razorpay plan period */
  period: "monthly" | "yearly";
  interval: number;
  amountPaise: number;
  currency: "INR";
  /** Local entitlement window in days */
  durationDays: number;
  gracePeriodDays: number;
  /** Max billing cycles on the Razorpay subscription */
  totalCount: number;
};

/** Canonical purchaseable catalog — keep in sync with SQLite seeds. */
export const APP_PLANS: Record<PurchaseablePlanCode, AppPlanDefinition> = {
  monthly: {
    code: "monthly",
    name: "Monthly Plan",
    description: "Salon Khata monthly subscription",
    period: "monthly",
    interval: 1,
    amountPaise: 9900,
    currency: "INR",
    durationDays: 30,
    gracePeriodDays: 3,
    totalCount: 120
  },
  yearly: {
    code: "yearly",
    name: "Yearly Plan",
    description: "Salon Khata yearly subscription",
    period: "yearly",
    interval: 1,
    amountPaise: 99900,
    currency: "INR",
    durationDays: 365,
    gracePeriodDays: 7,
    totalCount: 10
  }
};

export function isPurchaseablePlanCode(
  value: string
): value is PurchaseablePlanCode {
  return value === "monthly" || value === "yearly";
}

export function getRazorpayKeyId(): string {
  return (process.env.RAZORPAY_KEY_ID ?? "").trim();
}

export function getRazorpayKeySecret(): string {
  return (process.env.RAZORPAY_KEY_SECRET ?? "").trim();
}

export function getRazorpayWebhookSecret(): string {
  return (process.env.RAZORPAY_WEBHOOK_SECRET ?? "").trim();
}

export function getConfiguredRazorpayPlanId(
  code: PurchaseablePlanCode
): string | null {
  const envKey =
    code === "monthly"
      ? process.env.RAZORPAY_PLAN_MONTHLY_ID
      : process.env.RAZORPAY_PLAN_YEARLY_ID;
  const value = (envKey ?? "").trim();
  return value || null;
}

export function assertRazorpayConfigured(): {
  keyId: string;
  keySecret: string;
} {
  const keyId = getRazorpayKeyId();
  const keySecret = getRazorpayKeySecret();
  if (!keyId || !keySecret) {
    throw new Error(
      "Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET."
    );
  }
  if (keyId.includes("YOUR_") || keySecret.includes("YOUR_")) {
    throw new Error(
      "Razorpay placeholders detected. Replace RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET with real values."
    );
  }
  return { keyId, keySecret };
}
