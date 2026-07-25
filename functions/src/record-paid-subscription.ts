/**
 * Paid subscription activation entry points.
 *
 * Prefer Razorpay webhook (`razorpayWebhook`) as the source of truth.
 * These helpers remain for admin / trusted callers and legacy webhook secret.
 */

import { onCall, onRequest, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/v2";

import {
  grantPaidSubscription,
  type GrantPaidSubscriptionInput,
  type GrantPaidSubscriptionResult
} from "./razorpay/grant-paid-subscription";

/** @deprecated Use GrantPaidSubscriptionInput */
export type RecordPaidSubscriptionInput = GrantPaidSubscriptionInput;

/**
 * Core grant used by Razorpay verify + webhook + legacy callers.
 * Idempotent on externalPaymentId.
 */
export async function grantReferralRewardForPaidSubscription(
  input: GrantPaidSubscriptionInput
): Promise<GrantPaidSubscriptionResult> {
  return grantPaidSubscription(input);
}

/**
 * Callable for trusted app/admin flows after server-side verification.
 */
export const recordPaidSubscription = onCall(
  { enforceAppCheck: true },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Sign in required");
    }
    const salonId = String(request.data?.salonId ?? "").trim();
    if (!salonId) {
      throw new HttpsError("invalid-argument", "salonId required");
    }
    if (request.auth.uid !== salonId) {
      throw new HttpsError("permission-denied", "Not your salon");
    }

    const externalPaymentId = String(
      request.data?.externalPaymentId ?? ""
    ).trim();
    if (!externalPaymentId) {
      throw new HttpsError("invalid-argument", "externalPaymentId required");
    }

    try {
      return await grantPaidSubscription({
        salonId,
        planCode: String(request.data?.planCode ?? "monthly"),
        externalPaymentId,
        externalSubscriptionId: request.data?.externalSubscriptionId ?? null,
        paymentProvider: request.data?.paymentProvider ?? "app",
        amountPaise:
          typeof request.data?.amountPaise === "number"
            ? request.data.amountPaise
            : undefined,
        currency: String(request.data?.currency ?? "INR")
      });
    } catch (err) {
      logger.error("recordPaidSubscription failed", err);
      throw new HttpsError("internal", "Failed to record subscription");
    }
  }
);

/**
 * Legacy HTTP webhook (Bearer REFERRAL_WEBHOOK_SECRET).
 * Prefer `razorpayWebhook` with Razorpay signature validation.
 */
export const recordPaidSubscriptionWebhook = onRequest(
  { cors: false },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).send("Method not allowed");
      return;
    }

    const secret = process.env.REFERRAL_WEBHOOK_SECRET;
    const auth = req.get("authorization") ?? "";
    if (!secret || auth !== `Bearer ${secret}`) {
      res.status(401).json({ ok: false, reason: "unauthorized" });
      return;
    }

    const body = req.body ?? {};
    const salonId = String(body.salonId ?? "").trim();
    const externalPaymentId = String(body.externalPaymentId ?? "").trim();
    if (!salonId || !externalPaymentId) {
      res.status(400).json({
        ok: false,
        reason: "salonId and externalPaymentId required"
      });
      return;
    }

    try {
      const result = await grantPaidSubscription({
        salonId,
        planCode: String(body.planCode ?? "monthly"),
        externalPaymentId,
        externalSubscriptionId: body.externalSubscriptionId ?? null,
        paymentProvider: body.paymentProvider ?? "webhook",
        amountPaise:
          typeof body.amountPaise === "number" ? body.amountPaise : undefined,
        currency: String(body.currency ?? "INR")
      });
      res.status(200).json({ ok: true, ...result });
    } catch (err) {
      logger.error("recordPaidSubscriptionWebhook failed", err);
      res.status(500).json({ ok: false, reason: "internal" });
    }
  }
);
