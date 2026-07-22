/**
 * Online referral claim helper.
 *
 * Local `ReferralRepository.applyCode` can only resolve codes that already
 * exist in this device's SQLite. Cross-salon claims need a Cloud Function
 * (or Admin SDK) that:
 *   1. Reads `/referral_index/{CODE}`
 *   2. Rejects self-referral / duplicate referred_salon_id
 *   3. Writes `/referrals/{id}` + mirrors into both salons' entity trees
 *
 * Phase 1 ships the client contract; deploy the function when payments /
 * growth tooling go live. See docs/subscription/PRD-subscription-referral.md §9–12.
 */

export type ClaimReferralRequest = {
  code: string;
  referredSalonId: string;
};

export type ClaimReferralResponse =
  | {
      ok: true;
      referrerSalonId: string;
      referralId: string;
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
        | "unavailable";
    };

/**
 * Placeholder until a callable Cloud Function is deployed.
 * Callers should fall back to local applyCode and queue cloud reconcile.
 */
export async function claimReferralOnline(
  _request: ClaimReferralRequest
): Promise<ClaimReferralResponse> {
  return { ok: false, reason: "unavailable" };
}
