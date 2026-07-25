/**
 * Firestore trigger: client enqueues /billing_checkout_requests/{id}
 * → create Razorpay subscription → write checkout options back on the doc.
 */

import { logger } from "firebase-functions/v2";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { FieldValue } from "firebase-admin/firestore";

import { getRazorpayKeyId } from "./config";
import { isPurchaseablePlanCode, APP_PLANS } from "./config";
import { createRazorpaySubscription, RazorpayApiError } from "./client";
import { ensureRazorpayPlanId } from "./plans";
import { upsertRazorpaySubscriptionMapping } from "./subscription-lifecycle";

export const processBillingCheckoutRequest = onDocumentCreated(
  "billing_checkout_requests/{requestId}",
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

    await ref.set(
      {
        status: "processing",
        updated_at: new Date().toISOString()
      },
      { merge: true }
    );

    if (!salonId || !isPurchaseablePlanCode(planCode)) {
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

    const keyId = getRazorpayKeyId();
    if (!keyId || keyId.includes("YOUR_")) {
      await ref.set(
        {
          status: "failed",
          error: "razorpay_not_configured",
          updated_at: new Date().toISOString()
        },
        { merge: true }
      );
      return;
    }

    try {
      const plan = APP_PLANS[planCode];
      const razorpayPlanId = await ensureRazorpayPlanId(planCode);
      const subscription = await createRazorpaySubscription({
        planId: razorpayPlanId,
        totalCount: plan.totalCount,
        customerNotify: true,
        notes: {
          salon_id: salonId,
          plan_code: planCode,
          checkout_request_id: requestId
        }
      });

      await upsertRazorpaySubscriptionMapping({
        razorpaySubscriptionId: subscription.id,
        salonId,
        planCode,
        status: subscription.status,
        checkoutRequestId: requestId
      });

      const nowIso = new Date().toISOString();
      await ref.set(
        {
          status: "succeeded",
          key_id: keyId,
          razorpay_plan_id: razorpayPlanId,
          razorpay_subscription_id: subscription.id,
          razorpay_subscription_status: subscription.status,
          short_url: subscription.short_url ?? null,
          amount_paise: plan.amountPaise,
          currency: plan.currency,
          plan_name: plan.name,
          billing_cycle: plan.period,
          name: "Salon Khata",
          description: plan.description,
          theme_color: "#0F766E",
          updated_at: nowIso,
          server_updated_at: FieldValue.serverTimestamp()
        },
        { merge: true }
      );

      logger.info("billing checkout created", {
        requestId,
        salonId,
        planCode,
        subscriptionId: subscription.id
      });
    } catch (err) {
      const message =
        err instanceof RazorpayApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "checkout_failed";
      logger.error("billing checkout failed", { requestId, err });
      await ref.set(
        {
          status: "failed",
          error: "checkout_failed",
          error_message: message,
          updated_at: new Date().toISOString()
        },
        { merge: true }
      );
    }
  }
);
