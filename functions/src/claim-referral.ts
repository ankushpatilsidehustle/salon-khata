import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/v2";
import { FieldValue } from "firebase-admin/firestore";

import {
  db,
  isValidReferralCodeFormat,
  newId,
  normalizeReferralCode,
  referralDocRef,
  referralIndexRef,
  upsertEntityInTx
} from "./firestore-helpers";

const DEFAULT_REWARD = {
  type: "subscription_days",
  days: 30,
  status: "pending",
  trigger: "referred_paid_subscription"
};

/**
 * Authoritative referral claim.
 *
 * - Unlimited outbound referrals per referrer (many referred salons).
 * - Each referred salon may claim a code only once.
 * - Self-referral rejected.
 * - Reward is NOT granted here — only when the referred salon pays
 *   (see recordPaidSubscription).
 */
export const claimReferral = onCall(
  { enforceAppCheck: true },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Sign in required");
    }

    const referredSalonId = String(request.data?.referredSalonId ?? "").trim();
    const code = normalizeReferralCode(String(request.data?.code ?? ""));

    if (!referredSalonId) {
      throw new HttpsError("invalid-argument", "referredSalonId required");
    }
    if (request.auth.uid !== referredSalonId) {
      throw new HttpsError(
        "permission-denied",
        "You can only claim a referral for your own salon"
      );
    }
    if (!isValidReferralCodeFormat(code)) {
      throw new HttpsError("invalid-argument", "invalid_format");
    }

    const indexSnap = await referralIndexRef(code).get();
    if (!indexSnap.exists) {
      throw new HttpsError("not-found", "code_not_found");
    }
    const index = indexSnap.data() ?? {};
    if (index.is_active === false) {
      throw new HttpsError("failed-precondition", "code_inactive");
    }
    const referrerSalonId = String(index.salon_id ?? "");
    if (!referrerSalonId) {
      throw new HttpsError("not-found", "code_not_found");
    }
    if (referrerSalonId === referredSalonId) {
      throw new HttpsError("failed-precondition", "self_referral");
    }

    const existing = await db()
      .collection("referrals")
      .where("referred_salon_id", "==", referredSalonId)
      .limit(1)
      .get();
    if (!existing.empty) {
      const row = existing.docs[0]!;
      return {
        ok: true as const,
        alreadyApplied: true,
        referralId: row.id,
        referrerSalonId: String(
          row.data().referrer_salon_id ?? referrerSalonId
        )
      };
    }

    const referralId = newId();
    const nowIso = new Date().toISOString();
    const rewardJson = { ...DEFAULT_REWARD };
    const metadata = { source: "claimReferral" };

    const entityPayload = {
      id: referralId,
      referrer_salon_id: referrerSalonId,
      referred_salon_id: referredSalonId,
      referral_code: code,
      status: "pending",
      referred_at: nowIso,
      qualified_at: null,
      rewarded_at: null,
      reward_json: JSON.stringify(rewardJson),
      metadata_json: JSON.stringify(metadata),
      created_at: nowIso,
      updated_at: nowIso,
      deleted_at: null
    };

    try {
      await db().runTransaction(async (tx) => {
        // Create-only top-level doc. Duplicate referred_salon races lose here
        // only if we also enforce with a deterministic doc id — we use a
        // secondary unique doc keyed by referred salon.
        const byReferredRef = db()
          .collection("referral_by_referred")
          .doc(referredSalonId);
        const byReferredSnap = await tx.get(byReferredRef);
        if (byReferredSnap.exists) {
          throw new HttpsError("already-exists", "already_applied");
        }

        tx.create(byReferredRef, {
          referral_id: referralId,
          referrer_salon_id: referrerSalonId,
          referred_salon_id: referredSalonId,
          created_at: nowIso
        });

        tx.create(referralDocRef(referralId), {
          ...entityPayload,
          reward_json: rewardJson,
          metadata_json: metadata,
          reward_count: 0,
          server_created_at: FieldValue.serverTimestamp()
        });

        await upsertEntityInTx(tx, {
          salonId: referredSalonId,
          entityType: "referrals",
          recordId: referralId,
          payload: entityPayload
        });

        await upsertEntityInTx(tx, {
          salonId: referrerSalonId,
          entityType: "referrals",
          recordId: referralId,
          payload: entityPayload
        });
      });
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      logger.error("claimReferral transaction failed", err);
      throw new HttpsError("internal", "claim_failed");
    }

    logger.info("claimReferral: created", {
      referralId,
      referrerSalonId,
      referredSalonId,
      code
    });

    return {
      ok: true as const,
      alreadyApplied: false,
      referralId,
      referrerSalonId
    };
  }
);
