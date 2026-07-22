import { database, runInTransaction } from "@/database/sqlite-client";
import type { SharedColumns } from "@/database/schema/shared-columns";
import { markDirty } from "@/database/db-meta";
import { getUtcTimestamp } from "@/domain/dates";
import { newId } from "@/domain/id";
import {
  addDaysIso,
  evaluateSubscription,
  type SubscriptionActivatedBy,
  type SubscriptionStatus
} from "@/domain/subscription";
import { trackChange } from "@/sync/change-tracker";

import type { SubscriptionPlanRecord } from "./subscription-plan-repository";
import { SubscriptionPlanRepository } from "./subscription-plan-repository";

export type SalonSubscriptionRecord = SharedColumns & {
  salon_id: string;
  plan_id: string;
  status: SubscriptionStatus;
  start_at: string;
  end_at: string;
  grace_end_at: string | null;
  auto_renew: number;
  payment_provider: string | null;
  external_payment_id: string | null;
  external_subscription_id: string | null;
  activated_by: SubscriptionActivatedBy;
  metadata_json: string;
};

export type ActivateOrRenewParams = {
  salonId: string;
  planCode: string;
  activatedBy: SubscriptionActivatedBy;
  paymentProvider?: string | null;
  externalPaymentId?: string | null;
  externalSubscriptionId?: string | null;
  metadata?: Record<string, unknown>;
  /** When omitted, starts/extends from now. */
  now?: Date;
};

const planRepo = new SubscriptionPlanRepository();

export class SalonSubscriptionRepository {
  /**
   * Latest subscription row for the salon (by end_at), including expired.
   * Callers should run evaluateSubscription for effective access.
   */
  getLatest(salonId: string): SalonSubscriptionRecord | null {
    return (
      database.getFirstSync<SalonSubscriptionRecord>(
        `SELECT * FROM salon_subscriptions
         WHERE salon_id = ? AND deleted_at IS NULL
         ORDER BY end_at DESC, created_at DESC
         LIMIT 1`,
        [salonId]
      ) ?? null
    );
  }

  getById(id: string, salonId: string): SalonSubscriptionRecord | null {
    return (
      database.getFirstSync<SalonSubscriptionRecord>(
        `SELECT * FROM salon_subscriptions
         WHERE id = ? AND salon_id = ? AND deleted_at IS NULL LIMIT 1`,
        [id, salonId]
      ) ?? null
    );
  }

  listForSalon(salonId: string): SalonSubscriptionRecord[] {
    return database.getAllSync<SalonSubscriptionRecord>(
      `SELECT * FROM salon_subscriptions
       WHERE salon_id = ? AND deleted_at IS NULL
       ORDER BY end_at DESC, created_at DESC`,
      [salonId]
    );
  }

  /**
   * Idempotent trial bootstrap. If any subscription already exists, no-op.
   */
  activateTrial(salonId: string, now: Date = new Date()): SalonSubscriptionRecord {
    const existing = this.getLatest(salonId);
    if (existing) return existing;

    planRepo.ensureDefaults();
    const plan = planRepo.getByCode("trial");
    if (!plan) {
      throw new Error("Trial plan missing from catalog");
    }

    return this.insertSubscription({
      salonId,
      plan,
      status: "trial",
      activatedBy: "system_trial",
      startAt: now.toISOString(),
      durationDays: plan.duration_days,
      gracePeriodDays: plan.grace_period_days
    });
  }

  /**
   * Payment / admin / referral hook. Extends from max(now, current.end_at)
   * when still in an access window; otherwise starts a fresh window.
   *
   * Payment gateway implementations should call this *after* verifying
   * payment server-side — never trust the client as the sole activator.
   */
  activateOrRenew(params: ActivateOrRenewParams): SalonSubscriptionRecord {
    planRepo.ensureDefaults();
    const plan = planRepo.getByCode(params.planCode);
    if (!plan) {
      throw new Error(`Unknown plan code: ${params.planCode}`);
    }
    if (plan.code === "trial") {
      return this.activateTrial(params.salonId, params.now ?? new Date());
    }
    if (plan.is_enabled !== 1) {
      throw new Error(`Plan disabled: ${params.planCode}`);
    }

    const now = params.now ?? new Date();
    const latest = this.getLatest(params.salonId);
    const evaluated = evaluateSubscription(latest, now);

    let startAt = now.toISOString();
    if (latest && evaluated.isInAccessWindow) {
      // Stack duration onto the current paid/trial end.
      startAt = latest.end_at;
    }

    // Close the previous access window row (history retained).
    if (latest && evaluated.isInAccessWindow) {
      this.markStatus(latest.id, params.salonId, "expired");
    }

    return this.insertSubscription({
      salonId: params.salonId,
      plan,
      status: "active",
      activatedBy: params.activatedBy,
      startAt,
      durationDays: plan.duration_days,
      gracePeriodDays: plan.grace_period_days,
      paymentProvider: params.paymentProvider ?? null,
      externalPaymentId: params.externalPaymentId ?? null,
      externalSubscriptionId: params.externalSubscriptionId ?? null,
      metadata: params.metadata
    });
  }

  /**
   * Persist evaluated status when it drifts (optional bookkeeping).
   */
  syncStoredStatus(salonId: string, now: Date = new Date()): void {
    const latest = this.getLatest(salonId);
    if (!latest) return;
    const evaluated = evaluateSubscription(latest, now);
    if (evaluated.effectiveStatus === "none") return;
    if (evaluated.effectiveStatus === latest.status) return;
    if (evaluated.effectiveStatus === "cancelled") return;
    this.markStatus(latest.id, salonId, evaluated.effectiveStatus);
  }

  private markStatus(
    id: string,
    salonId: string,
    status: SubscriptionStatus
  ): void {
    const now = getUtcTimestamp();
    runInTransaction(() => {
      database.runSync(
        `UPDATE salon_subscriptions
         SET status = ?, updated_at = ?
         WHERE id = ? AND salon_id = ? AND deleted_at IS NULL`,
        [status, now, id, salonId]
      );
      trackChange({
        entityType: "salon_subscriptions",
        entityId: id,
        salonId
      });
      markDirty();
    });
  }

  private insertSubscription(args: {
    salonId: string;
    plan: SubscriptionPlanRecord;
    status: SubscriptionStatus;
    activatedBy: SubscriptionActivatedBy;
    startAt: string;
    durationDays: number;
    gracePeriodDays: number;
    paymentProvider?: string | null;
    externalPaymentId?: string | null;
    externalSubscriptionId?: string | null;
    metadata?: Record<string, unknown>;
  }): SalonSubscriptionRecord {
    const id = newId();
    const now = getUtcTimestamp();
    const endAt = addDaysIso(args.startAt, args.durationDays);
    const graceEndAt =
      args.gracePeriodDays > 0
        ? addDaysIso(endAt, args.gracePeriodDays)
        : null;

    runInTransaction(() => {
      database.runSync(
        `INSERT INTO salon_subscriptions
         (id, salon_id, plan_id, status, start_at, end_at, grace_end_at,
          auto_renew, payment_provider, external_payment_id,
          external_subscription_id, activated_by, metadata_json,
          created_at, updated_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, NULL)`,
        [
          id,
          args.salonId,
          args.plan.id,
          args.status,
          args.startAt,
          endAt,
          graceEndAt,
          args.paymentProvider ?? null,
          args.externalPaymentId ?? null,
          args.externalSubscriptionId ?? null,
          args.activatedBy,
          JSON.stringify(args.metadata ?? {}),
          now,
          now
        ]
      );
      trackChange({
        entityType: "salon_subscriptions",
        entityId: id,
        salonId: args.salonId
      });
      markDirty();
    });

    return this.getById(id, args.salonId)!;
  }
}
