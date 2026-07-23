/**
 * Online referral claim — Firebase is authoritative.
 *
 * Writes `/referral_claim_requests/{id}` and waits for the Cloud Function
 * `processReferralClaimRequest` to resolve it. No native Functions SDK
 * required (works with existing Firestore + App Check).
 *
 * Local SQLite is only a cache via sync pull after the cloud claim succeeds.
 */

import firestore from "@react-native-firebase/firestore";

import { isOnline } from "@/network/network-manager";
import {
  isValidReferralCodeFormat,
  normalizeReferralCode
} from "@/domain/subscription";
import { newId } from "@/domain/id";

export type ClaimReferralRequest = {
  code: string;
  referredSalonId: string;
};

export type ClaimReferralResponse =
  | {
      ok: true;
      referrerSalonId: string;
      referralId: string;
      alreadyApplied?: boolean;
    }
  | {
      ok: false;
      reason:
        | "invalid_format"
        | "already_applied"
        | "self_referral"
        | "code_not_found"
        | "code_inactive"
        | "offline"
        | "timeout"
        | "unavailable"
        | "claim_failed";
    };

const POLL_MS = 400;
const TIMEOUT_MS = 15_000;

export async function claimReferralOnline(
  request: ClaimReferralRequest
): Promise<ClaimReferralResponse> {
  const code = normalizeReferralCode(request.code);
  const referredSalonId = request.referredSalonId.trim();

  if (!isValidReferralCodeFormat(code)) {
    return { ok: false, reason: "invalid_format" };
  }
  if (!referredSalonId) {
    return { ok: false, reason: "invalid_format" };
  }
  if (!isOnline()) {
    return { ok: false, reason: "offline" };
  }

  const requestId = newId();
  const ref = firestore().collection("referral_claim_requests").doc(requestId);

  try {
    await ref.set({
      code,
      referred_salon_id: referredSalonId,
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
        referralId: String(data.referral_id ?? ""),
        referrerSalonId: String(data.referrer_salon_id ?? ""),
        alreadyApplied: data.already_applied === true
      };
    }

    if (status === "failed") {
      const error = String(data.error ?? "claim_failed");
      if (
        error === "invalid_format" ||
        error === "already_applied" ||
        error === "self_referral" ||
        error === "code_not_found" ||
        error === "code_inactive" ||
        error === "claim_failed"
      ) {
        return { ok: false, reason: error };
      }
      return { ok: false, reason: "claim_failed" };
    }
  }

  return { ok: false, reason: "timeout" };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
