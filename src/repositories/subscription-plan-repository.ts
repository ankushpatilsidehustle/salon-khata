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
  /** When false, plan is hidden from purchase UI but kept for history. */
  enabled?: boolean;
  features?: PlanFeatures;
};

/**
 * Default catalog. Purchaseable plans: monthly ₹99, yearly ₹999.
 * Trial duration is configurable via the `trial` row (`durationDays`).
 */
const DEFAULT_PLANS: PlanSeed[] = [
  {
    code: "trial",
    name: "Free Trial",
    description: "Full-feature trial for new salons",
    billingPeriod: "trial",
    durationDays: 30,
    pricePaise: 0,
    sortOrder: 0,
    gracePeriodDays: 0,
    enabled: true,
    features: FULL_PLAN_FEATURES
  },
  {
    code: "monthly",
    name: "Monthly",
    description: "Billed every month",
    billingPeriod: "month",
    durationDays: 30,
    pricePaise: 9900,
    sortOrder: 10,
    gracePeriodDays: 3,
    enabled: true,
    features: FULL_PLAN_FEATURES
  },
  {
    code: "yearly",
    name: "Yearly",
    description: "Billed every year",
    billingPeriod: "year",
    durationDays: 365,
    pricePaise: 99900,
    sortOrder: 20,
    gracePeriodDays: 7,
    enabled: true,
    features: FULL_PLAN_FEATURES
  },
  {
    code: "quarterly",
    name: "Quarterly",
    description: "Legacy plan — not offered for purchase",
    billingPeriod: "quarter",
    durationDays: 90,
    pricePaise: 129900,
    sortOrder: 90,
    gracePeriodDays: 3,
    enabled: false,
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
    const enabled = seed.enabled === false ? 0 : 1;
    const featuresJson = stringifyPlanFeatures(
      seed.features ?? FULL_PLAN_FEATURES
    );

    const byStableId = database.getFirstSync<{ id: string }>(
      `SELECT id FROM subscription_plans
       WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
      [stableId]
    );

    if (byStableId) {
      // Keep seed prices / enablement in sync (e.g. ₹99 / ₹999 rollout).
      database.runSync(
        `UPDATE subscription_plans
         SET name = ?, description = ?, billing_period = ?,
             duration_days = ?, price_paise = ?, is_enabled = ?,
             sort_order = ?, features_json = ?, grace_period_days = ?,
             updated_at = ?
         WHERE id = ? AND deleted_at IS NULL`,
        [
          seed.name,
          seed.description,
          seed.billingPeriod,
          seed.durationDays,
          seed.pricePaise,
          enabled,
          seed.sortOrder,
          featuresJson,
          seed.gracePeriodDays,
          now,
          stableId
        ]
      );
      return;
    }

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
       VALUES (?, ?, ?, ?, ?, ?, ?, 'INR', ?, ?, ?, ?, ?, ?, NULL)`,
      [
        stableId,
        seed.code,
        seed.name,
        seed.description,
        seed.billingPeriod,
        seed.durationDays,
        seed.pricePaise,
        enabled,
        seed.sortOrder,
        featuresJson,
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
