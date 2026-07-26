/**
 * Non-payment lifecycle updates (cancel / expire / failed payment ledger).
 * Idempotent per Razorpay event id when provided.
 */

import { FieldValue } from "firebase-admin/firestore";
import { logger } from "firebase-functions/v2";

import {
  db,
  newId,
  readBillingStateInTx,
  upsertEntityInTx,
  writeBillingStateInTx
} from "../firestore-helpers";

function eventIdempotencyRef(eventId: string) {
  return db().collection("razorpay_webhook_events").doc(eventId);
}

function razorpaySubRef(subscriptionId: string) {
  return db().collection("razorpay_subscriptions").doc(subscriptionId);
}

export async function markWebhookEventProcessed(
  eventId: string,
  payload: Record<string, unknown>
): Promise<boolean> {
  /** @returns true if this is the first time we see the event */
  const ref = eventIdempotencyRef(eventId);
  return db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists) return false;
    tx.set(ref, {
      ...payload,
      processed_at: new Date().toISOString(),
      server_created_at: FieldValue.serverTimestamp()
    });
    return true;
  });
}

export async function upsertRazorpaySubscriptionMapping(params: {
  razorpaySubscriptionId: string;
  salonId: string;
  planCode: string;
  status: string;
  checkoutRequestId?: string | null;
}): Promise<void> {
  await razorpaySubRef(params.razorpaySubscriptionId).set(
    {
      razorpay_subscription_id: params.razorpaySubscriptionId,
      salon_id: params.salonId,
      plan_code: params.planCode,
      status: params.status,
      checkout_request_id: params.checkoutRequestId ?? null,
      updated_at: new Date().toISOString()
    },
    { merge: true }
  );
}

export async function resolveSalonFromRazorpaySubscription(
  subscriptionId: string,
  notes?: Record<string, unknown> | null
): Promise<{ salonId: string; planCode: string } | null> {
  const noteSalon =
    typeof notes?.salon_id === "string" ? notes.salon_id.trim() : "";
  const notePlan =
    typeof notes?.plan_code === "string" ? notes.plan_code.trim() : "";
  if (noteSalon && notePlan) {
    return { salonId: noteSalon, planCode: notePlan };
  }

  const snap = await razorpaySubRef(subscriptionId).get();
  if (!snap.exists) return null;
  const data = snap.data() ?? {};
  const salonId = typeof data.salon_id === "string" ? data.salon_id : "";
  const planCode = typeof data.plan_code === "string" ? data.plan_code : "";
  if (!salonId || !planCode) return null;
  return { salonId, planCode };
}

export async function recordFailedPayment(params: {
  salonId: string;
  planCode: string;
  externalPaymentId: string;
  externalSubscriptionId?: string | null;
  amountPaise?: number;
  failureReason?: string | null;
  eventType?: string | null;
}): Promise<void> {
  const nowIso = new Date().toISOString();
  const paymentRowId = newId();

  await db().runTransaction(async (tx) => {
    const billing = await readBillingStateInTx(tx, params.salonId);
    const subscriptionId = billing?.current_subscription_id ?? newId();

    await upsertEntityInTx(tx, {
      salonId: params.salonId,
      entityType: "subscription_payments",
      recordId: paymentRowId,
      payload: {
        salon_id: params.salonId,
        subscription_id: subscriptionId,
        plan_id: params.planCode,
        amount_paise: params.amountPaise ?? 0,
        currency: "INR",
        status: "failed",
        payment_provider: "razorpay",
        external_payment_id: params.externalPaymentId,
        paid_at: null,
        failure_reason: params.failureReason ?? "payment_failed",
        metadata_json: JSON.stringify({
          plan_code: params.planCode,
          external_subscription_id: params.externalSubscriptionId ?? null,
          event_type: params.eventType ?? "payment.failed"
        }),
        created_at: nowIso,
        updated_at: nowIso,
        deleted_at: null
      }
    });
  });

  logger.info("recordFailedPayment", {
    salonId: params.salonId,
    paymentId: params.externalPaymentId
  });
}

/**
 * Mark subscription cancelled (paid-through): keep access until end_at.
 */
export async function markSubscriptionCancelled(params: {
  salonId: string;
  externalSubscriptionId: string;
  eventType?: string | null;
}): Promise<void> {
  const nowIso = new Date().toISOString();

  await db().runTransaction(async (tx) => {
    const billing = await readBillingStateInTx(tx, params.salonId);
    if (!billing?.current_subscription_id) {
      writeBillingStateInTx(tx, params.salonId, {
        current_subscription_id: null,
        plan_code: billing?.plan_code ?? null,
        status: "cancelled",
        end_at: billing?.end_at ?? null,
        grace_end_at: billing?.grace_end_at ?? null,
        updated_at: nowIso
      });
      return;
    }

    const subId = billing.current_subscription_id;
    await upsertEntityInTx(tx, {
      salonId: params.salonId,
      entityType: "salon_subscriptions",
      recordId: subId,
      payload: {
        status: "cancelled",
        auto_renew: 0,
        updated_at: nowIso,
        metadata_json: JSON.stringify({
          cancelled_via: "razorpay_webhook",
          event_type: params.eventType ?? "subscription.cancelled",
          external_subscription_id: params.externalSubscriptionId
        })
      }
    });

    writeBillingStateInTx(tx, params.salonId, {
      current_subscription_id: subId,
      plan_code: billing.plan_code,
      status: "cancelled",
      end_at: billing.end_at,
      grace_end_at: billing.grace_end_at,
      updated_at: nowIso
    });
  });

  const existing = await razorpaySubRef(params.externalSubscriptionId).get();
  const planCode =
    typeof existing.data()?.plan_code === "string"
      ? String(existing.data()!.plan_code)
      : "monthly";

  await upsertRazorpaySubscriptionMapping({
    razorpaySubscriptionId: params.externalSubscriptionId,
    salonId: params.salonId,
    planCode,
    status: "cancelled"
  });

  logger.info("markSubscriptionCancelled", {
    salonId: params.salonId,
    subscriptionId: params.externalSubscriptionId
  });
}

/**
 * Mark subscription expired — access window closed.
 */
export async function markSubscriptionExpired(params: {
  salonId: string;
  externalSubscriptionId: string;
  eventType?: string | null;
}): Promise<void> {
  const nowIso = new Date().toISOString();

  await db().runTransaction(async (tx) => {
    const billing = await readBillingStateInTx(tx, params.salonId);
    if (billing?.current_subscription_id) {
      await upsertEntityInTx(tx, {
        salonId: params.salonId,
        entityType: "salon_subscriptions",
        recordId: billing.current_subscription_id,
        payload: {
          status: "expired",
          auto_renew: 0,
          updated_at: nowIso,
          metadata_json: JSON.stringify({
            expired_via: "razorpay_webhook",
            event_type: params.eventType ?? "subscription.completed",
            external_subscription_id: params.externalSubscriptionId
          })
        }
      });
    }

    writeBillingStateInTx(tx, params.salonId, {
      current_subscription_id: billing?.current_subscription_id ?? null,
      plan_code: billing?.plan_code ?? null,
      status: "expired",
      end_at: billing?.end_at ?? nowIso,
      grace_end_at: billing?.grace_end_at ?? null,
      updated_at: nowIso
    });
  });

  const existing = await razorpaySubRef(params.externalSubscriptionId).get();
  const planCode =
    typeof existing.data()?.plan_code === "string"
      ? String(existing.data()!.plan_code)
      : "monthly";

  await upsertRazorpaySubscriptionMapping({
    razorpaySubscriptionId: params.externalSubscriptionId,
    salonId: params.salonId,
    planCode,
    status: "expired"
  });

  logger.info("markSubscriptionExpired", {
    salonId: params.salonId,
    subscriptionId: params.externalSubscriptionId
  });
}
