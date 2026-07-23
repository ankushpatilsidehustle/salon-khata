import { onDocumentCreated } from "firebase-functions/v2/firestore";
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
 * Process client-written claim requests.
 *
 * Clients (without a Functions SDK dependency) create:
 *   /referral_claim_requests/{id}
 *     { code, referred_salon_id, status: 'queued' }
 *
 * This trigger is the Firebase-authoritative claim path.
 */
export const processReferralClaimRequest = onDocumentCreated(
  "referral_claim_requests/{requestId}",
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const data = snap.data() ?? {};
    const requestId = event.params.requestId as string;
    const referredSalonId = String(data.referred_salon_id ?? "").trim();
    const code = normalizeReferralCode(String(data.code ?? ""));

    const fail = async (reason: string) => {
      await snap.ref.set(
        {
          status: "failed",
          error: reason,
          processed_at: new Date().toISOString()
        },
        { merge: true }
      );
      logger.warn("processReferralClaimRequest failed", {
        requestId,
        reason
      });
    };

    if (!referredSalonId || !isValidReferralCodeFormat(code)) {
      await fail("invalid_format");
      return;
    }

    const indexSnap = await referralIndexRef(code).get();
    if (!indexSnap.exists) {
      await fail("code_not_found");
      return;
    }
    const index = indexSnap.data() ?? {};
    if (index.is_active === false) {
      await fail("code_inactive");
      return;
    }
    const referrerSalonId = String(index.salon_id ?? "");
    if (!referrerSalonId) {
      await fail("code_not_found");
      return;
    }
    if (referrerSalonId === referredSalonId) {
      await fail("self_referral");
      return;
    }

    const referralId = newId();
    const nowIso = new Date().toISOString();
    const rewardJson = { ...DEFAULT_REWARD };
    const metadata = { source: "processReferralClaimRequest", requestId };

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
        const byReferredRef = db()
          .collection("referral_by_referred")
          .doc(referredSalonId);
        const byReferredSnap = await tx.get(byReferredRef);
        if (byReferredSnap.exists) {
          const existingId = String(
            byReferredSnap.data()?.referral_id ?? ""
          );
          tx.set(
            snap.ref,
            {
              status: "succeeded",
              already_applied: true,
              referral_id: existingId,
              referrer_salon_id: String(
                byReferredSnap.data()?.referrer_salon_id ?? referrerSalonId
              ),
              processed_at: nowIso
            },
            { merge: true }
          );
          return;
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

        tx.set(
          snap.ref,
          {
            status: "succeeded",
            already_applied: false,
            referral_id: referralId,
            referrer_salon_id: referrerSalonId,
            processed_at: nowIso
          },
          { merge: true }
        );
      });

      logger.info("processReferralClaimRequest succeeded", {
        requestId,
        referralId,
        referrerSalonId,
        referredSalonId
      });
    } catch (err) {
      logger.error("processReferralClaimRequest transaction failed", err);
      await fail("claim_failed");
    }
  }
);
