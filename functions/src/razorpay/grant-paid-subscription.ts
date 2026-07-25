/**
 * Authoritative paid-subscription grant (Firebase → sync → SQLite).
 * Idempotent on externalPaymentId so webhooks / verify / retries are safe.
 */

import { FieldValue } from "firebase-admin/firestore";
import { logger } from "firebase-functions/v2";

import {
  REFERRAL_REWARD_DAYS,
  REFERRAL_REWARD_PLAN_ID,
  addDaysIso,
  db,
  newId,
  readBillingStateInTx,
  referralDocRef,
  upsertEntityInTx,
  writeBillingStateInTx,
  type BillingState
} from "../firestore-helpers";
import { APP_PLANS, isPurchaseablePlanCode } from "./config";

export type GrantPaidSubscriptionInput = {
  salonId: string;
  planCode: string;
  /** Idempotency key — Razorpay payment id (preferred) or synthetic event id. */
  externalPaymentId: string;
  externalSubscriptionId?: string | null;
  externalOrderId?: string | null;
  paymentProvider?: string | null;
  amountPaise?: number;
  currency?: string;
  billingCycle?: string | null;
  eventType?: string | null;
  paidAt?: string | null;
  metadata?: Record<string, unknown>;
};

export type GrantPaidSubscriptionResult = {
  paidSubscriptionId: string;
  paymentRecordId: string;
  referralId: string | null;
  rewardGranted: boolean;
  referrerSubscriptionId: string | null;
  alreadyProcessed: boolean;
  reason?: string;
};

function paymentIdempotencyRef(salonId: string, paymentId: string) {
  return db()
    .collection("salons")
    .doc(salonId)
    .collection("billing")
    .doc("payments")
    .collection("processed")
    .doc(paymentId);
}

function planDurationDays(planCode: string): number {
  if (isPurchaseablePlanCode(planCode)) {
    return APP_PLANS[planCode].durationDays;
  }
  if (planCode === "yearly") return 365;
  if (planCode === "quarterly") return 90;
  return 30;
}

function planGraceDays(planCode: string): number {
  if (isPurchaseablePlanCode(planCode)) {
    return APP_PLANS[planCode].gracePeriodDays;
  }
  return planCode === "yearly" ? 7 : 3;
}

function planAmountPaise(planCode: string): number {
  if (isPurchaseablePlanCode(planCode)) {
    return APP_PLANS[planCode].amountPaise;
  }
  return 0;
}

function billingCycleFor(planCode: string): string {
  if (isPurchaseablePlanCode(planCode)) {
    return APP_PLANS[planCode].period;
  }
  return planCode === "yearly" ? "yearly" : "monthly";
}

/**
 * When a salon pays, write paid subscription + payment ledger and grant
 * referrer +30d if a referral exists. Safe under concurrent webhooks.
 */
export async function grantPaidSubscription(
  input: GrantPaidSubscriptionInput
): Promise<GrantPaidSubscriptionResult> {
  const salonId = input.salonId.trim();
  const planCode = (input.planCode || "monthly").trim();
  const paymentId = input.externalPaymentId.trim();
  if (!salonId || !paymentId) {
    throw new Error("salonId and externalPaymentId are required");
  }

  const nowIso = input.paidAt ?? new Date().toISOString();
  const amountPaise =
    typeof input.amountPaise === "number"
      ? input.amountPaise
      : planAmountPaise(planCode);
  const currency = input.currency ?? "INR";
  const billingCycle = input.billingCycle ?? billingCycleFor(planCode);
  const provider = input.paymentProvider ?? "razorpay";

  // Fast path outside the main referral tx.
  const existingPay = await paymentIdempotencyRef(salonId, paymentId).get();
  if (existingPay.exists) {
    const data = existingPay.data() ?? {};
    return {
      paidSubscriptionId: String(data.subscription_id ?? ""),
      paymentRecordId: String(data.payment_record_id ?? ""),
      referralId:
        typeof data.referral_id === "string" ? data.referral_id : null,
      rewardGranted: data.reward_granted === true,
      referrerSubscriptionId:
        typeof data.referrer_subscription_id === "string"
          ? data.referrer_subscription_id
          : null,
      alreadyProcessed: true,
      reason: "already_processed"
    };
  }

  const paidSubscriptionId = newId();
  const paymentRowId = newId();

  const referralSnap = await db()
    .collection("referrals")
    .where("referred_salon_id", "==", salonId)
    .limit(1)
    .get();

  const referralDoc = referralSnap.empty ? null : referralSnap.docs[0]!;
  const referralId = referralDoc?.id ?? null;
  const referral = referralDoc?.data() ?? null;
  const referrerSalonId =
    typeof referral?.referrer_salon_id === "string"
      ? referral.referrer_salon_id
      : null;

  let rewardGranted = false;
  let referrerSubscriptionId: string | null = null;
  let reason: string | undefined;
  let alreadyProcessed = false;

  await db().runTransaction(async (tx) => {
    const idempotencyRef = paymentIdempotencyRef(salonId, paymentId);
    const idemSnap = await tx.get(idempotencyRef);
    if (idemSnap.exists) {
      alreadyProcessed = true;
      reason = "already_processed";
      tx.set(
        idempotencyRef,
        {
          last_seen_at: nowIso
        },
        { merge: true }
      );
      return;
    }

    const paidDurationDays = planDurationDays(planCode);
    const graceDays = planGraceDays(planCode);
    const referredBilling = await readBillingStateInTx(tx, salonId);
    const paidWindowStart =
      referredBilling?.end_at && Date.parse(referredBilling.end_at) > Date.now()
        ? referredBilling.end_at
        : nowIso;
    const paidWindowEnd = addDaysIso(paidWindowStart, paidDurationDays);
    const paidGraceEnd = addDaysIso(paidWindowEnd, graceDays);

    await upsertEntityInTx(tx, {
      salonId,
      entityType: "salon_subscriptions",
      recordId: paidSubscriptionId,
      payload: {
        salon_id: salonId,
        plan_id: planCode,
        status: "active",
        start_at: paidWindowStart,
        end_at: paidWindowEnd,
        grace_end_at: paidGraceEnd,
        auto_renew: 1,
        payment_provider: provider,
        external_payment_id: paymentId,
        external_subscription_id: input.externalSubscriptionId ?? null,
        activated_by: "payment",
        metadata_json: JSON.stringify({
          plan_code: planCode,
          billing_cycle: billingCycle,
          external_order_id: input.externalOrderId ?? null,
          event_type: input.eventType ?? null,
          source: "grantPaidSubscription",
          ...(input.metadata ?? {})
        }),
        created_at: nowIso,
        updated_at: nowIso,
        deleted_at: null
      }
    });

    await upsertEntityInTx(tx, {
      salonId,
      entityType: "subscription_payments",
      recordId: paymentRowId,
      payload: {
        salon_id: salonId,
        subscription_id: paidSubscriptionId,
        plan_id: planCode,
        amount_paise: amountPaise,
        currency,
        status: "succeeded",
        payment_provider: provider,
        external_payment_id: paymentId,
        paid_at: nowIso,
        failure_reason: null,
        metadata_json: JSON.stringify({
          plan_code: planCode,
          billing_cycle: billingCycle,
          external_subscription_id: input.externalSubscriptionId ?? null,
          external_order_id: input.externalOrderId ?? null,
          event_type: input.eventType ?? null
        }),
        created_at: nowIso,
        updated_at: nowIso,
        deleted_at: null
      }
    });

    writeBillingStateInTx(tx, salonId, {
      current_subscription_id: paidSubscriptionId,
      plan_code: planCode,
      status: "active",
      end_at: paidWindowEnd,
      grace_end_at: paidGraceEnd,
      updated_at: nowIso
    });

    // Referral reward (idempotent per payment via reward_grants/{paymentId})
    if (!referralId || !referrerSalonId || !referral) {
      reason = "no_referral";
      tx.set(idempotencyRef, {
        salon_id: salonId,
        payment_id: paymentId,
        subscription_id: paidSubscriptionId,
        payment_record_id: paymentRowId,
        plan_code: planCode,
        referral_id: null,
        reward_granted: false,
        referrer_subscription_id: null,
        reason: "no_referral",
        created_at: nowIso,
        server_created_at: FieldValue.serverTimestamp()
      });
      return;
    }

    const grantRef = referralDocRef(referralId)
      .collection("reward_grants")
      .doc(paymentId);
    const existingGrant = await tx.get(grantRef);
    if (existingGrant.exists) {
      reason = "already_granted_for_payment";
      referrerSubscriptionId =
        typeof existingGrant.data()?.referrer_subscription_id === "string"
          ? existingGrant.data()!.referrer_subscription_id
          : null;
      tx.set(idempotencyRef, {
        salon_id: salonId,
        payment_id: paymentId,
        subscription_id: paidSubscriptionId,
        payment_record_id: paymentRowId,
        plan_code: planCode,
        referral_id: referralId,
        reward_granted: false,
        referrer_subscription_id: referrerSubscriptionId,
        reason: "already_granted_for_payment",
        created_at: nowIso,
        server_created_at: FieldValue.serverTimestamp()
      });
      return;
    }

    const referrerBilling = await readBillingStateInTx(tx, referrerSalonId);
    const rewardStart =
      referrerBilling?.end_at &&
      Date.parse(referrerBilling.end_at) > Date.now()
        ? referrerBilling.end_at
        : nowIso;
    const rewardEnd = addDaysIso(rewardStart, REFERRAL_REWARD_DAYS);
    const rewardGraceEnd = addDaysIso(rewardEnd, 3);
    referrerSubscriptionId = newId();

    await upsertEntityInTx(tx, {
      salonId: referrerSalonId,
      entityType: "salon_subscriptions",
      recordId: referrerSubscriptionId,
      payload: {
        salon_id: referrerSalonId,
        plan_id: REFERRAL_REWARD_PLAN_ID,
        status: "active",
        start_at: rewardStart,
        end_at: rewardEnd,
        grace_end_at: rewardGraceEnd,
        auto_renew: 0,
        payment_provider: null,
        external_payment_id: null,
        external_subscription_id: null,
        activated_by: "referral_reward",
        metadata_json: JSON.stringify({
          plan_code: REFERRAL_REWARD_PLAN_ID,
          source: "referral_reward",
          referral_id: referralId,
          referred_salon_id: salonId,
          triggering_payment_id: paymentId,
          triggering_subscription_id: paidSubscriptionId,
          days: REFERRAL_REWARD_DAYS
        }),
        created_at: nowIso,
        updated_at: nowIso,
        deleted_at: null
      }
    });

    writeBillingStateInTx(tx, referrerSalonId, {
      current_subscription_id: referrerSubscriptionId,
      plan_code: REFERRAL_REWARD_PLAN_ID,
      status: "active",
      end_at: rewardEnd,
      grace_end_at: rewardGraceEnd,
      updated_at: nowIso
    } satisfies BillingState);

    const prevCount =
      typeof referral.reward_count === "number" ? referral.reward_count : 0;
    const nextCount = prevCount + 1;
    const rewardJson = {
      type: "subscription_days",
      days: REFERRAL_REWARD_DAYS,
      status: "applied",
      trigger: "referred_paid_subscription",
      grant_count: nextCount
    };

    tx.set(
      grantRef,
      {
        referral_id: referralId,
        referrer_salon_id: referrerSalonId,
        referred_salon_id: salonId,
        days: REFERRAL_REWARD_DAYS,
        triggering_payment_id: paymentId,
        triggering_subscription_id: paidSubscriptionId,
        referrer_subscription_id: referrerSubscriptionId,
        created_at: nowIso,
        server_created_at: FieldValue.serverTimestamp()
      },
      { merge: true }
    );

    tx.set(
      referralDocRef(referralId),
      {
        status: "rewarded",
        qualified_at: referral.qualified_at ?? nowIso,
        rewarded_at: nowIso,
        reward_count: nextCount,
        reward_json: rewardJson,
        updated_at: nowIso
      },
      { merge: true }
    );

    const mirrored = {
      id: referralId,
      referrer_salon_id: referrerSalonId,
      referred_salon_id: salonId,
      referral_code: referral.referral_code ?? "",
      status: "rewarded",
      referred_at: referral.referred_at ?? nowIso,
      qualified_at: referral.qualified_at ?? nowIso,
      rewarded_at: nowIso,
      reward_json: JSON.stringify(rewardJson),
      metadata_json: JSON.stringify({
        ...(typeof referral.metadata_json === "object" &&
        referral.metadata_json !== null
          ? referral.metadata_json
          : {}),
        last_grant_payment_id: paymentId
      }),
      created_at: referral.created_at ?? nowIso,
      updated_at: nowIso,
      deleted_at: null
    };

    await upsertEntityInTx(tx, {
      salonId,
      entityType: "referrals",
      recordId: referralId,
      payload: mirrored
    });
    await upsertEntityInTx(tx, {
      salonId: referrerSalonId,
      entityType: "referrals",
      recordId: referralId,
      payload: mirrored
    });

    rewardGranted = true;

    tx.set(idempotencyRef, {
      salon_id: salonId,
      payment_id: paymentId,
      subscription_id: paidSubscriptionId,
      payment_record_id: paymentRowId,
      plan_code: planCode,
      referral_id: referralId,
      reward_granted: true,
      referrer_subscription_id: referrerSubscriptionId,
      created_at: nowIso,
      server_created_at: FieldValue.serverTimestamp()
    });
  });

  if (alreadyProcessed) {
    const snap = await paymentIdempotencyRef(salonId, paymentId).get();
    const data = snap.data() ?? {};
    return {
      paidSubscriptionId: String(data.subscription_id ?? paidSubscriptionId),
      paymentRecordId: String(data.payment_record_id ?? paymentRowId),
      referralId:
        typeof data.referral_id === "string" ? data.referral_id : referralId,
      rewardGranted: data.reward_granted === true,
      referrerSubscriptionId:
        typeof data.referrer_subscription_id === "string"
          ? data.referrer_subscription_id
          : null,
      alreadyProcessed: true,
      reason: "already_processed"
    };
  }

  logger.info("grantPaidSubscription", {
    salonId,
    paymentId,
    planCode,
    referralId,
    rewardGranted,
    referrerSubscriptionId,
    reason
  });

  return {
    paidSubscriptionId,
    paymentRecordId: paymentRowId,
    referralId,
    rewardGranted,
    referrerSubscriptionId,
    alreadyProcessed: false,
    reason
  };
}
