/**
 * Ensure Razorpay plan ids exist for monthly / yearly.
 * Prefer env overrides; otherwise create once and cache in Firestore.
 */

import { logger } from "firebase-functions/v2";

import { db } from "../firestore-helpers";
import {
  APP_PLANS,
  getConfiguredRazorpayPlanId,
  type PurchaseablePlanCode
} from "./config";
import { createRazorpayPlan } from "./client";

type CachedPlans = {
  monthly_plan_id?: string;
  yearly_plan_id?: string;
  updated_at?: string;
};

function billingConfigRef() {
  return db().collection("billing_config").doc("razorpay_plans");
}

export async function ensureRazorpayPlanId(
  code: PurchaseablePlanCode
): Promise<string> {
  const fromEnv = getConfiguredRazorpayPlanId(code);
  if (fromEnv) return fromEnv;

  const snap = await billingConfigRef().get();
  const cached = (snap.data() ?? {}) as CachedPlans;
  const cachedId =
    code === "monthly" ? cached.monthly_plan_id : cached.yearly_plan_id;
  if (typeof cachedId === "string" && cachedId.startsWith("plan_")) {
    return cachedId;
  }

  const def = APP_PLANS[code];
  const created = await createRazorpayPlan({
    period: def.period,
    interval: def.interval,
    name: def.name,
    amountPaise: def.amountPaise,
    currency: def.currency,
    description: def.description
  });

  const nowIso = new Date().toISOString();
  await billingConfigRef().set(
    {
      ...(code === "monthly"
        ? { monthly_plan_id: created.id }
        : { yearly_plan_id: created.id }),
      updated_at: nowIso
    },
    { merge: true }
  );

  logger.info("Created Razorpay plan", { code, planId: created.id });
  return created.id;
}
