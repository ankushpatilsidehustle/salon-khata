/**
 * Firestore trigger: after Razorpay Checkout success, client enqueues
 * /billing_verify_requests/{id} with payment/subscription/signature.
 * We verify HMAC and grant access (webhook remains source of truth).
 */

import { logger } from "firebase-functions/v2";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { FieldValue } from "firebase-admin/firestore";

import { isPurchaseablePlanCode, APP_PLANS } from "./config";
import { grantPaidSubscription } from "./grant-paid-subscription";
import { verifySubscriptionPaymentSignature } from "./signature";
import {
  resolveSalonFromRazorpaySubscription,
  upsertRazorpaySubscriptionMapping
} from "./subscription-lifecycle";

export const processBillingVerifyRequest = onDocumentCreated(
  "billing_verify_requests/{requestId}",
  async (event) => {
    const requestId = event.params.requestId as string;
    const snap = event.data;
    if (!snap) return;

    const data = snap.data();
    const ref = snap.ref;

    if (data.status && data.status !== "queued") {
      return;
    }

    const salonId = String(data.salon_id ?? "").trim();
    const planCode = String(data.plan_code ?? "").trim();
    const paymentId = String(data.razorpay_payment_id ?? "").trim();
    const subscriptionId = String(
      data.razorpay_subscription_id ?? ""
    ).trim();
    const signature = String(data.razorpay_signature ?? "").trim();

    await ref.set(
      {
        status: "processing",
        updated_at: new Date().toISOString()
      },
      { merge: true }
    );

    if (!salonId || !paymentId || !subscriptionId || !signature) {
      await ref.set(
        {
          status: "failed",
          error: "invalid_payload",
          updated_at: new Date().toISOString()
        },
        { merge: true }
      );
      return;
    }

    const mapped = await resolveSalonFromRazorpaySubscription(subscriptionId);
    if (mapped && mapped.salonId !== salonId) {
      await ref.set(
        {
          status: "failed",
          error: "salon_mismatch",
          updated_at: new Date().toISOString()
        },
        { merge: true }
      );
      return;
    }

    const effectivePlan =
      (mapped?.planCode && isPurchaseablePlanCode(mapped.planCode)
        ? mapped.planCode
        : null) ||
      (isPurchaseablePlanCode(planCode) ? planCode : null);

    if (!effectivePlan) {
      await ref.set(
        {
          status: "failed",
          error: "invalid_plan",
          updated_at: new Date().toISOString()
        },
        { merge: true }
      );
      return;
    }

    const valid = verifySubscriptionPaymentSignature({
      paymentId,
      subscriptionId,
      signature
    });

    if (!valid) {
      logger.warn("billing verify signature failed", {
        requestId,
        salonId,
        paymentId
      });
      await ref.set(
        {
          status: "failed",
          error: "invalid_signature",
          updated_at: new Date().toISOString()
        },
        { merge: true }
      );
      return;
    }

    try {
      const plan = APP_PLANS[effectivePlan];
      const result = await grantPaidSubscription({
        salonId,
        planCode: effectivePlan,
        externalPaymentId: paymentId,
        externalSubscriptionId: subscriptionId,
        paymentProvider: "razorpay",
        amountPaise: plan.amountPaise,
        currency: plan.currency,
        billingCycle: plan.period,
        eventType: "checkout.verify",
        metadata: { verify_request_id: requestId }
      });

      await upsertRazorpaySubscriptionMapping({
        razorpaySubscriptionId: subscriptionId,
        salonId,
        planCode: effectivePlan,
        status: "active"
      });

      await ref.set(
        {
          status: "succeeded",
          plan_code: effectivePlan,
          paid_subscription_id: result.paidSubscriptionId,
          payment_record_id: result.paymentRecordId,
          already_processed: result.alreadyProcessed,
          reward_granted: result.rewardGranted,
          updated_at: new Date().toISOString(),
          server_updated_at: FieldValue.serverTimestamp()
        },
        { merge: true }
      );

      logger.info("billing verify succeeded", {
        requestId,
        salonId,
        paymentId,
        alreadyProcessed: result.alreadyProcessed
      });
    } catch (err) {
      logger.error("billing verify failed", { requestId, err });
      await ref.set(
        {
          status: "failed",
          error: "verify_failed",
          error_message: err instanceof Error ? err.message : "verify_failed",
          updated_at: new Date().toISOString()
        },
        { merge: true }
      );
    }
  }
);
