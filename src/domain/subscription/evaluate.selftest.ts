/**
 * Lightweight assertions for subscription domain helpers.
 * Run: npx --yes tsx src/domain/subscription/evaluate.selftest.ts
 */
import { addDaysIso, evaluateSubscription } from "./evaluate";
import { resolveEntitlements } from "./entitlements";
import { FULL_PLAN_FEATURES } from "./plan-features";
import {
  generateReferralCode,
  isValidReferralCodeFormat,
  normalizeReferralCode
} from "./referral-code";

function assert(cond: unknown, msg: string): void {
  if (!cond) throw new Error(msg);
}

const now = new Date("2026-07-22T12:00:00.000Z");
const start = "2026-07-01T00:00:00.000Z";
const end = addDaysIso(start, 30);

const trial = evaluateSubscription(
  {
    id: "sub-1",
    status: "trial",
    start_at: start,
    end_at: end,
    grace_end_at: null
  },
  now
);
assert(trial.lifecycle === "trial", "expected trial lifecycle");
assert(trial.isInAccessWindow, "trial should be in access window");
assert(trial.remainingDays > 0, "trial should have remaining days");

const expired = evaluateSubscription(
  {
    id: "sub-2",
    status: "trial",
    start_at: "2026-01-01T00:00:00.000Z",
    end_at: "2026-01-31T00:00:00.000Z",
    grace_end_at: null
  },
  now
);
assert(expired.lifecycle === "expired", "expected expired");
assert(!expired.isInAccessWindow, "expired should lock");

const ents = resolveEntitlements({
  subscription: {
    id: "sub-2",
    status: "trial",
    start_at: "2026-01-01T00:00:00.000Z",
    end_at: "2026-01-31T00:00:00.000Z",
    grace_end_at: null
  },
  planFeatures: FULL_PLAN_FEATURES,
  planCode: "trial",
  now
});
assert(!ents.assignStaffOnBill, "expired must block staff assignment");
assert(ents.accessReports, "reports remain available");
assert(ents.manageStaff, "staff CRUD remains available");
assert(ents.isExpired, "isExpired flag");

const code = generateReferralCode("Priya Salon");
assert(isValidReferralCodeFormat(code), `generated code invalid: ${code}`);
assert(normalizeReferralCode(" ab-12 ") === "AB12", "normalize failed");

// eslint-disable-next-line no-console
console.log("subscription domain selftest: ok");
