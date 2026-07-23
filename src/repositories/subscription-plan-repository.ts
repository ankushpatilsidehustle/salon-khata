import { database, runInTransaction } from "@/database/sqlite-client";
import type { SharedColumns } from "@/database/schema/shared-columns";
import { getUtcTimestamp } from "@/domain/dates";
import {
  FULL_PLAN_FEATURES,
  stringifyPlanFeatures,
  type BillingPeriod,
  type PlanFeatures
} from "@/domain/subscription";

export type SubscriptionPlanRecord = SharedColumns & {
  code: string;
  name: string;
  description: string | null;
  billing_period: BillingPeriod;
  duration_days: number;
  price_paise: number;
  currency: string;
  is_enabled: number;
  sort_order: number;
  features_json: string;
  grace_period_days: number;
};

type PlanSeed = {
  code: string;
  name: string;
  description: string;
  billingPeriod: BillingPeriod;
  durationDays: number;
  pricePaise: number;
  sortOrder: number;
  gracePeriodDays: number;
  features?: PlanFeatures;
};

/**
 * Default catalog. Prices are placeholders until payment ships — the
 * entitlement engine only cares about duration + features for trial.
 */
const DEFAULT_PLANS: PlanSeed[] = [
  {
    code: "trial",
    name: "Free Trial",
    description: "30-day full-feature trial for new salons",
    billingPeriod: "trial",
    durationDays: 30,
    pricePaise: 0,
    sortOrder: 0,
    gracePeriodDays: 0,
    features: FULL_PLAN_FEATURES
  },
  {
    code: "monthly",
    name: "Monthly",
    description: "Billed every 30 days",
    billingPeriod: "month",
    durationDays: 30,
    pricePaise: 49900,
    sortOrder: 10,
    gracePeriodDays: 3,
    features: FULL_PLAN_FEATURES
  },
  {
    code: "quarterly",
    name: "Quarterly",
    description: "Billed every 90 days",
    billingPeriod: "quarter",
    durationDays: 90,
    pricePaise: 129900,
    sortOrder: 20,
    gracePeriodDays: 3,
    features: FULL_PLAN_FEATURES
  },
  {
    code: "yearly",
    name: "Yearly",
    description: "Billed every 365 days",
    billingPeriod: "year",
    durationDays: 365,
    pricePaise: 449900,
    sortOrder: 30,
    gracePeriodDays: 7,
    features: FULL_PLAN_FEATURES
  }
];

/**
 * Local catalog repository. Plans are not salon-entity-synced in Phase 1;
 * see PRD §10. Future cloud catalog pull can UPSERT by `code`.
 *
 * Plan primary keys are stable and equal the plan `code` (`trial`,
 * `monthly`, …) so cloud-written / synced `salon_subscriptions.plan_id`
 * resolves on every install after restore or second-device sync.
 */
export class SubscriptionPlanRepository {
  ensureDefaults(): void {
    const now = getUtcTimestamp();
    runInTransaction(() => {
      for (const seed of DEFAULT_PLANS) {
        this.ensurePlanRow(seed, now);
      }
    });
  }

  private ensurePlanRow(seed: PlanSeed, now: string): void {
    const stableId = seed.code;
    const byStableId = database.getFirstSync<{ id: string }>(
      `SELECT id FROM subscription_plans
       WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
      [stableId]
    );
    if (byStableId) return;

    // Legacy installs seeded random UUIDs — remap subscriptions then
    // replace the catalog row with the stable id.
    const byCode = database.getFirstSync<{ id: string }>(
      `SELECT id FROM subscription_plans
       WHERE code = ? AND deleted_at IS NULL LIMIT 1`,
      [seed.code]
    );
    if (byCode && byCode.id !== stableId) {
      database.runSync(
        `UPDATE salon_subscriptions
         SET plan_id = ?, updated_at = ?
         WHERE plan_id = ?`,
        [stableId, now, byCode.id]
      );
      database.runSync(
        `UPDATE subscription_payments
         SET plan_id = ?, updated_at = ?
         WHERE plan_id = ?`,
        [stableId, now, byCode.id]
      );
      database.runSync(
        `UPDATE subscription_plans
         SET deleted_at = ?, updated_at = ?
         WHERE id = ? AND deleted_at IS NULL`,
        [now, now, byCode.id]
      );
    }

    database.runSync(
      `INSERT INTO subscription_plans
       (id, code, name, description, billing_period, duration_days,
        price_paise, currency, is_enabled, sort_order, features_json,
        grace_period_days, created_at, updated_at, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'INR', 1, ?, ?, ?, ?, ?, NULL)`,
      [
        stableId,
        seed.code,
        seed.name,
        seed.description,
        seed.billingPeriod,
        seed.durationDays,
        seed.pricePaise,
        seed.sortOrder,
        stringifyPlanFeatures(seed.features ?? FULL_PLAN_FEATURES),
        seed.gracePeriodDays,
        now,
        now
      ]
    );
  }

  getByCode(code: string): SubscriptionPlanRecord | null {
    return (
      database.getFirstSync<SubscriptionPlanRecord>(
        `SELECT * FROM subscription_plans
         WHERE code = ? AND deleted_at IS NULL LIMIT 1`,
        [code]
      ) ?? null
    );
  }

  getById(id: string): SubscriptionPlanRecord | null {
    return (
      database.getFirstSync<SubscriptionPlanRecord>(
        `SELECT * FROM subscription_plans
         WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
        [id]
      ) ?? null
    );
  }

  /**
   * Cloud-authored subscriptions may store `plan_id` as the stable plan
   * code (`monthly`, `trial`, …). Resolve by id first, then by code.
   */
  getByIdOrCode(idOrCode: string): SubscriptionPlanRecord | null {
    return this.getById(idOrCode) ?? this.getByCode(idOrCode);
  }

  listEnabled(): SubscriptionPlanRecord[] {
    return database.getAllSync<SubscriptionPlanRecord>(
      `SELECT * FROM subscription_plans
       WHERE is_enabled = 1 AND deleted_at IS NULL
       ORDER BY sort_order ASC, name ASC`
    );
  }

  listPurchaseable(): SubscriptionPlanRecord[] {
    return database.getAllSync<SubscriptionPlanRecord>(
      `SELECT * FROM subscription_plans
       WHERE is_enabled = 1
         AND deleted_at IS NULL
         AND code != 'trial'
       ORDER BY sort_order ASC`
    );
  }
}
