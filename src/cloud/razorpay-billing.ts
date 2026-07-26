/**
 * Razorpay billing client — Firestore request queues (no Functions SDK).
 *
 * 1. createBillingCheckout → /billing_checkout_requests
 * 2. Open Razorpay Checkout with returned options
 * 3. verifyBillingPayment → /billing_verify_requests
 *
 * Webhook remains the source of truth; verify is a fast-path unlock.
 */

import firestore from "@react-native-firebase/firestore";

import { isOnline } from "@/network/network-manager";
import { newId } from "@/domain/id";

export type PurchaseablePlanCode = "monthly" | "yearly";

export type BillingCheckoutResult =
  | {
      ok: true;
      requestId: string;
      keyId: string;
      subscriptionId: string;
      amountPaise: number;
      currency: string;
      planName: string;
      billingCycle: string;
      name: string;
      description: string;
      themeColor: string;
      shortUrl: string | null;
    }
  | {
      ok: false;
      reason:
        | "offline"
        | "invalid_plan"
        | "razorpay_not_configured"
        | "checkout_failed"
        | "timeout"
        | "unavailable";
      message?: string;
    };

export type BillingVerifyResult =
  | {
      ok: true;
      alreadyProcessed: boolean;
      paidSubscriptionId: string;
    }
  | {
      ok: false;
      reason:
        | "offline"
        | "invalid_payload"
        | "invalid_signature"
        | "salon_mismatch"
        | "invalid_plan"
        | "verify_failed"
        | "timeout"
        | "unavailable";
      message?: string;
    };

const POLL_MS = 400;
const TIMEOUT_MS = 25_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function createBillingCheckout(params: {
  salonId: string;
  planCode: PurchaseablePlanCode;
}): Promise<BillingCheckoutResult> {
  const salonId = params.salonId.trim();
  const planCode = params.planCode;

  if (planCode !== "monthly" && planCode !== "yearly") {
    return { ok: false, reason: "invalid_plan" };
  }
  if (!salonId) {
    return { ok: false, reason: "invalid_plan" };
  }
  if (!isOnline()) {
    return { ok: false, reason: "offline" };
  }

  const requestId = newId();
  const ref = firestore().collection("billing_checkout_requests").doc(requestId);

  try {
    await ref.set({
      salon_id: salonId,
      plan_code: planCode,
      status: "queued",
      created_at: new Date().toISOString()
    });
  } catch {
    return { ok: false, reason: "unavailable" };
  }

  const started = Date.now();
  while (Date.now() - started < TIMEOUT_MS) {
    await sleep(POLL_MS);
    let snap;
    try {
      snap = await ref.get();
    } catch {
      return { ok: false, reason: "unavailable" };
    }
    if (!snap.exists) continue;
    const data = snap.data() ?? {};
    const status = String(data.status ?? "");
    if (status === "queued" || status === "processing") continue;

    if (status === "succeeded") {
      return {
        ok: true,
        requestId,
        keyId: String(data.key_id ?? ""),
        subscriptionId: String(data.razorpay_subscription_id ?? ""),
        amountPaise:
          typeof data.amount_paise === "number" ? data.amount_paise : 0,
        currency: String(data.currency ?? "INR"),
        planName: String(data.plan_name ?? planCode),
        billingCycle: String(data.billing_cycle ?? planCode),
        name: String(data.name ?? "Salon Khata"),
        description: String(data.description ?? ""),
        themeColor: String(data.theme_color ?? "#0F766E"),
        shortUrl:
          typeof data.short_url === "string" ? data.short_url : null
      };
    }

    if (status === "failed") {
      const error = String(data.error ?? "checkout_failed");
      if (
        error === "invalid_plan" ||
        error === "razorpay_not_configured" ||
        error === "checkout_failed"
      ) {
        return {
          ok: false,
          reason: error,
          message:
            typeof data.error_message === "string"
              ? data.error_message
              : undefined
        };
      }
      return {
        ok: false,
        reason: "checkout_failed",
        message:
          typeof data.error_message === "string"
            ? data.error_message
            : undefined
      };
    }
  }

  return { ok: false, reason: "timeout" };
}

export async function verifyBillingPayment(params: {
  salonId: string;
  planCode: PurchaseablePlanCode;
  razorpayPaymentId: string;
  razorpaySubscriptionId: string;
  razorpaySignature: string;
}): Promise<BillingVerifyResult> {
  const salonId = params.salonId.trim();
  if (!salonId || !params.razorpayPaymentId || !params.razorpaySignature) {
    return { ok: false, reason: "invalid_payload" };
  }
  if (!isOnline()) {
    return { ok: false, reason: "offline" };
  }

  const requestId = newId();
  const ref = firestore().collection("billing_verify_requests").doc(requestId);

  try {
    await ref.set({
      salon_id: salonId,
      plan_code: params.planCode,
      razorpay_payment_id: params.razorpayPaymentId,
      razorpay_subscription_id: params.razorpaySubscriptionId,
      razorpay_signature: params.razorpaySignature,
      status: "queued",
      created_at: new Date().toISOString()
    });
  } catch {
    return { ok: false, reason: "unavailable" };
  }

  const started = Date.now();
  while (Date.now() - started < TIMEOUT_MS) {
    await sleep(POLL_MS);
    let snap;
    try {
      snap = await ref.get();
    } catch {
      return { ok: false, reason: "unavailable" };
    }
    if (!snap.exists) continue;
    const data = snap.data() ?? {};
    const status = String(data.status ?? "");
    if (status === "queued" || status === "processing") continue;

    if (status === "succeeded") {
      return {
        ok: true,
        alreadyProcessed: data.already_processed === true,
        paidSubscriptionId: String(data.paid_subscription_id ?? "")
      };
    }

    if (status === "failed") {
      const error = String(data.error ?? "verify_failed");
      if (
        error === "invalid_payload" ||
        error === "invalid_signature" ||
        error === "salon_mismatch" ||
        error === "invalid_plan" ||
        error === "verify_failed"
      ) {
        return {
          ok: false,
          reason: error,
          message:
            typeof data.error_message === "string"
              ? data.error_message
              : undefined
        };
      }
      return { ok: false, reason: "verify_failed" };
    }
  }

  return { ok: false, reason: "timeout" };
}
