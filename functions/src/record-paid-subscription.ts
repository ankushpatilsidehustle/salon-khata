import { onCall, onRequest, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/v2";
import { FieldValue } from "firebase-admin/firestore";

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
} from "./firestore-helpers";

export type RecordPaidSubscriptionInput = {
  /** Salon that just paid / activated a paid plan. */
  salonId: string;
  planCode: string;
  /** Idempotency key — payment id from Razorpay/etc. */
  externalPaymentId: string;
  externalSubscriptionId?: string | null;
  paymentProvider?: string | null;
  amountPaise?: number;
  currency?: string;
  /**
   * Optional shared secret for HTTP webhook path.
   * Callable path relies on Admin / trusted caller instead.
   */
};

/**
 * Core grant: when a referred salon activates a paid plan, extend the
 * referrer's access by REFERRAL_REWARD_DAYS (1 month) for *each* such
 * payment. Idempotent on externalPaymentId.
 *
 * Firebase is authoritative — local SQLite only learns via sync pull.
 */
export async function grantReferralRewardForPaidSubscription(
  input: RecordPaidSubscriptionInput
): Promise<{
  paidSubscriptionId: string;
  referralId: string | null;
  rewardGranted: boolean;
  referrerSubscriptionId: string | null;
  reason?: string;
}> {
  const salonId = input.salonId.trim();
  const planCode = (input.planCode || "monthly").trim();
  const paymentId = input.externalPaymentId.trim();
  if (!salonId || !paymentId) {
    throw new Error("salonId and externalPaymentId are required");
  }

  const nowIso = new Date().toISOString();
  const paidSubscriptionId = newId();

  // Find referral for this referred salon (at most one).
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

  await db().runTransaction(async (tx) => {
    // ── 1. Write paid subscription for the referred salon ───────────────
    const paidStart = nowIso;
    // Duration comes from plan code heuristics; payment gateway can pass
    // explicit end later. For reward purposes we only need "paid happened".
    const paidDurationDays =
      planCode === "yearly" ? 365 : planCode === "quarterly" ? 90 : 30;

    const referredBilling = await readBillingStateInTx(tx, salonId);
    const paidWindowStart =
      referredBilling?.end_at && Date.parse(referredBilling.end_at) > Date.now()
        ? referredBilling.end_at
        : paidStart;
    const paidWindowEnd = addDaysIso(paidWindowStart, paidDurationDays);
    const paidGraceEnd = addDaysIso(paidWindowEnd, 3);

    await upsertEntityInTx(tx, {
      salonId,
      entityType: "salon_subscriptions",
      recordId: paidSubscriptionId,
      payload: {
        salon_id: salonId,
        plan_id: planCode, // stable catalog id/code
        status: "active",
        start_at: paidWindowStart,
        end_at: paidWindowEnd,
        grace_end_at: paidGraceEnd,
        auto_renew: 0,
        payment_provider: input.paymentProvider ?? null,
        external_payment_id: paymentId,
        external_subscription_id: input.externalSubscriptionId ?? null,
        activated_by: "payment",
        metadata_json: JSON.stringify({
          plan_code: planCode,
          source: "recordPaidSubscription"
        }),
        created_at: nowIso,
        updated_at: nowIso,
        deleted_at: null
      }
    });

    // Payment ledger row (optional history).
    const paymentRowId = newId();
    await upsertEntityInTx(tx, {
      salonId,
      entityType: "subscription_payments",
      recordId: paymentRowId,
      payload: {
        salon_id: salonId,
        subscription_id: paidSubscriptionId,
        plan_id: planCode,
        amount_paise: input.amountPaise ?? 0,
        currency: input.currency ?? "INR",
        status: "succeeded",
        payment_provider: input.paymentProvider ?? null,
        external_payment_id: paymentId,
        paid_at: nowIso,
        failure_reason: null,
        metadata_json: JSON.stringify({ plan_code: planCode }),
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

    // ── 2. Referral reward (idempotent per payment) ─────────────────────
    if (!referralId || !referrerSalonId || !referral) {
      reason = "no_referral";
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

    // Mirror referral status into both salon entity trees.
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
  });

  logger.info("grantReferralRewardForPaidSubscription", {
    salonId,
    paymentId,
    referralId,
    rewardGranted,
    referrerSubscriptionId,
    reason
  });

  return {
    paidSubscriptionId,
    referralId,
    rewardGranted,
    referrerSubscriptionId,
    reason
  };
}

/**
 * Callable for trusted app/admin flows (and future payment success handler
 * running in-client after server verification). Prefer the HTTP webhook
 * for Razorpay.
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
    // Only the salon owner may record their own paid activation from the app.
    // Payment webhooks should use recordPaidSubscriptionWebhook instead.
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
      return await grantReferralRewardForPaidSubscription({
        salonId,
        planCode: String(request.data?.planCode ?? "monthly"),
        externalPaymentId,
        externalSubscriptionId: request.data?.externalSubscriptionId ?? null,
        paymentProvider: request.data?.paymentProvider ?? "app",
        amountPaise:
          typeof request.data?.amountPaise === "number"
            ? request.data.amountPaise
            : 0,
        currency: String(request.data?.currency ?? "INR")
      });
    } catch (err) {
      logger.error("recordPaidSubscription failed", err);
      throw new HttpsError("internal", "Failed to record subscription");
    }
  }
);

/**
 * HTTP webhook entry for payment providers.
 * Protect with `REFERRAL_WEBHOOK_SECRET` (Authorization: Bearer …).
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
      const result = await grantReferralRewardForPaidSubscription({
        salonId,
        planCode: String(body.planCode ?? "monthly"),
        externalPaymentId,
        externalSubscriptionId: body.externalSubscriptionId ?? null,
        paymentProvider: body.paymentProvider ?? "webhook",
        amountPaise:
          typeof body.amountPaise === "number" ? body.amountPaise : 0,
        currency: String(body.currency ?? "INR")
      });
      res.status(200).json({ ok: true, ...result });
    } catch (err) {
      logger.error("recordPaidSubscriptionWebhook failed", err);
      res.status(500).json({ ok: false, reason: "internal" });
    }
  }
);
