import { database, runInTransaction } from "@/database/sqlite-client";
import type { SharedColumns } from "@/database/schema/shared-columns";
import { markDirty } from "@/database/db-meta";
import { getUtcTimestamp } from "@/domain/dates";
import { newId } from "@/domain/id";
import type { PaymentStatus } from "@/domain/subscription";
import { trackChange } from "@/sync/change-tracker";

export type SubscriptionPaymentRecord = SharedColumns & {
  salon_id: string;
  subscription_id: string;
  plan_id: string;
  amount_paise: number;
  currency: string;
  status: PaymentStatus;
  payment_provider: string | null;
  external_payment_id: string | null;
  paid_at: string | null;
  failure_reason: string | null;
  metadata_json: string;
};

export type NewSubscriptionPayment = {
  salonId: string;
  subscriptionId: string;
  planId: string;
  amountPaise: number;
  currency?: string;
  status: PaymentStatus;
  paymentProvider?: string | null;
  externalPaymentId?: string | null;
  paidAt?: string | null;
  failureReason?: string | null;
  metadata?: Record<string, unknown>;
};

/**
 * Payment history ledger. Gateway integration writes rows here and then
 * calls SalonSubscriptionRepository.activateOrRenew — the subscription
 * engine does not need to know about Razorpay/etc.
 */
export class SubscriptionPaymentRepository {
  listForSalon(salonId: string): SubscriptionPaymentRecord[] {
    return database.getAllSync<SubscriptionPaymentRecord>(
      `SELECT * FROM subscription_payments
       WHERE salon_id = ? AND deleted_at IS NULL
       ORDER BY created_at DESC`,
      [salonId]
    );
  }

  insert(data: NewSubscriptionPayment): SubscriptionPaymentRecord {
    const id = newId();
    const now = getUtcTimestamp();
    runInTransaction(() => {
      database.runSync(
        `INSERT INTO subscription_payments
         (id, salon_id, subscription_id, plan_id, amount_paise, currency,
          status, payment_provider, external_payment_id, paid_at,
          failure_reason, metadata_json, created_at, updated_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
        [
          id,
          data.salonId,
          data.subscriptionId,
          data.planId,
          data.amountPaise,
          data.currency ?? "INR",
          data.status,
          data.paymentProvider ?? null,
          data.externalPaymentId ?? null,
          data.paidAt ?? null,
          data.failureReason ?? null,
          JSON.stringify(data.metadata ?? {}),
          now,
          now
        ]
      );
      trackChange({
        entityType: "subscription_payments",
        entityId: id,
        salonId: data.salonId
      });
      markDirty();
    });
    return this.getById(id, data.salonId)!;
  }

  getById(id: string, salonId: string): SubscriptionPaymentRecord | null {
    return (
      database.getFirstSync<SubscriptionPaymentRecord>(
        `SELECT * FROM subscription_payments
         WHERE id = ? AND salon_id = ? AND deleted_at IS NULL LIMIT 1`,
        [id, salonId]
      ) ?? null
    );
  }
}
