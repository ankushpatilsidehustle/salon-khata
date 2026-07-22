import { SalonRepository } from "@/repositories/salon-repository";
import { ReferralRepository } from "@/repositories/referral-repository";
import { SalonSubscriptionRepository } from "@/repositories/salon-subscription-repository";
import { SubscriptionPlanRepository } from "@/repositories/subscription-plan-repository";
import {
  lockedEntitlements,
  resolveEntitlements,
  type Entitlements
} from "@/domain/subscription";

const planRepo = new SubscriptionPlanRepository();
const subRepo = new SalonSubscriptionRepository();
const referralRepo = new ReferralRepository();
const salonRepo = new SalonRepository();

/**
 * Idempotent salon billing bootstrap:
 *  1. Seed plan catalog
 *  2. Ensure referral code
 *  3. Activate trial if no subscription exists
 *
 * Safe to call from onboarding finish and AuthProvider sign-in.
 * Commits locally; network/sync is best-effort afterward.
 */
export function ensureSalonBillingBootstrap(salonId: string): void {
  planRepo.ensureDefaults();

  const salon = salonRepo.getById(salonId);
  referralRepo.ensureCode(salonId, salon?.business_name ?? salon?.owner_name);

  subRepo.activateTrial(salonId);
  subRepo.syncStoredStatus(salonId);
}

/**
 * Read path used by SubscriptionProvider and billing gates.
 */
export function getEntitlementsForSalon(
  salonId: string,
  now: Date = new Date()
): Entitlements {
  planRepo.ensureDefaults();
  const latest = subRepo.getLatest(salonId);
  if (!latest) {
    return lockedEntitlements();
  }
  const plan = planRepo.getById(latest.plan_id);
  return resolveEntitlements({
    subscription: latest,
    planFeaturesJson: plan?.features_json,
    planCode: plan?.code ?? null,
    planName: plan?.name ?? null,
    now
  });
}
