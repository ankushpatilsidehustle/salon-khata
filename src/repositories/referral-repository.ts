import { database, runInTransaction } from "@/database/sqlite-client";
import type { SharedColumns } from "@/database/schema/shared-columns";
import { markDirty } from "@/database/db-meta";
import { getUtcTimestamp } from "@/domain/dates";
import { newId } from "@/domain/id";
import {
  generateReferralCode,
  isValidReferralCodeFormat,
  normalizeReferralCode,
  type ReferralReward,
  type ReferralStatus
} from "@/domain/subscription";
import { trackChange } from "@/sync/change-tracker";

export type ReferralCodeRecord = SharedColumns & {
  salon_id: string;
  code: string;
  is_active: number;
};

export type ReferralRecord = SharedColumns & {
  referrer_salon_id: string;
  referred_salon_id: string;
  referral_code: string;
  status: ReferralStatus;
  referred_at: string;
  qualified_at: string | null;
  rewarded_at: string | null;
  reward_json: string;
  metadata_json: string;
};

export type ApplyReferralResult =
  | { ok: true; referral: ReferralRecord }
  | {
      ok: false;
      reason:
        | "invalid_format"
        | "already_applied"
        | "self_referral"
        | "code_not_found"
        | "code_inactive";
    };

const DEFAULT_REWARD: ReferralReward = {
  type: "subscription_days",
  days: 30,
  status: "pending",
  trigger: "referred_paid_subscription"
};

export class ReferralRepository {
  getCodeForSalon(salonId: string): ReferralCodeRecord | null {
    return (
      database.getFirstSync<ReferralCodeRecord>(
        `SELECT * FROM referral_codes
         WHERE salon_id = ? AND deleted_at IS NULL LIMIT 1`,
        [salonId]
      ) ?? null
    );
  }

  findActiveCode(code: string): ReferralCodeRecord | null {
    const normalized = normalizeReferralCode(code);
    if (!normalized) return null;
    return (
      database.getFirstSync<ReferralCodeRecord>(
        `SELECT * FROM referral_codes
         WHERE code = ? AND deleted_at IS NULL LIMIT 1`,
        [normalized]
      ) ?? null
    );
  }

  getReferralForReferredSalon(referredSalonId: string): ReferralRecord | null {
    return (
      database.getFirstSync<ReferralRecord>(
        `SELECT * FROM referrals
         WHERE referred_salon_id = ? AND deleted_at IS NULL LIMIT 1`,
        [referredSalonId]
      ) ?? null
    );
  }

  listByReferrer(referrerSalonId: string): ReferralRecord[] {
    return database.getAllSync<ReferralRecord>(
      `SELECT * FROM referrals
       WHERE referrer_salon_id = ? AND deleted_at IS NULL
       ORDER BY referred_at DESC`,
      [referrerSalonId]
    );
  }

  /**
   * Idempotent: returns existing code or creates a unique one.
   */
  ensureCode(
    salonId: string,
    seedName?: string | null
  ): ReferralCodeRecord {
    const existing = this.getCodeForSalon(salonId);
    if (existing) return existing;

    const now = getUtcTimestamp();
    for (let attempt = 0; attempt < 8; attempt++) {
      const code = generateReferralCode(seedName);
      const collision = this.findActiveCode(code);
      if (collision) continue;

      const id = newId();
      try {
        runInTransaction(() => {
          database.runSync(
            `INSERT INTO referral_codes
             (id, salon_id, code, is_active, created_at, updated_at, deleted_at)
             VALUES (?, ?, ?, 1, ?, ?, NULL)`,
            [id, salonId, code, now, now]
          );
          trackChange({
            entityType: "referral_codes",
            entityId: id,
            salonId
          });
          markDirty();
        });
        return this.getCodeForSalon(salonId)!;
      } catch {
        // Unique index collision — retry with a new code.
      }
    }
    throw new Error("Failed to allocate a unique referral code");
  }

  /**
   * Apply a referral code once for the referred salon.
   * Local lookup only — cross-device codes require cloud claim (see
   * `src/cloud/referral-claim.ts`) when the referrer is not on this device.
   */
  applyCode(
    referredSalonId: string,
    rawCode: string,
    options?: { reward?: ReferralReward; now?: Date }
  ): ApplyReferralResult {
    const code = normalizeReferralCode(rawCode);
    if (!isValidReferralCodeFormat(code)) {
      return { ok: false, reason: "invalid_format" };
    }

    const already = this.getReferralForReferredSalon(referredSalonId);
    if (already) {
      return { ok: false, reason: "already_applied" };
    }

    const codeRow = this.findActiveCode(code);
    if (!codeRow) {
      return { ok: false, reason: "code_not_found" };
    }
    if (codeRow.is_active !== 1) {
      return { ok: false, reason: "code_inactive" };
    }
    if (codeRow.salon_id === referredSalonId) {
      return { ok: false, reason: "self_referral" };
    }

    const id = newId();
    const now = (options?.now ?? new Date()).toISOString();
    const reward = options?.reward ?? DEFAULT_REWARD;

    runInTransaction(() => {
      database.runSync(
        `INSERT INTO referrals
         (id, referrer_salon_id, referred_salon_id, referral_code, status,
          referred_at, qualified_at, rewarded_at, reward_json, metadata_json,
          created_at, updated_at, deleted_at)
         VALUES (?, ?, ?, ?, 'pending', ?, NULL, NULL, ?, '{}', ?, ?, NULL)`,
        [
          id,
          codeRow.salon_id,
          referredSalonId,
          code,
          now,
          JSON.stringify(reward),
          now,
          now
        ]
      );
      trackChange({
        entityType: "referrals",
        entityId: id,
        salonId: referredSalonId
      });
      markDirty();
    });

    return {
      ok: true,
      referral: this.getReferralForReferredSalon(referredSalonId)!
    };
  }

  updateStatus(
    id: string,
    salonId: string,
    status: ReferralStatus,
    stamp?: { qualifiedAt?: string; rewardedAt?: string }
  ): void {
    const now = getUtcTimestamp();
    runInTransaction(() => {
      database.runSync(
        `UPDATE referrals
         SET status = ?,
             qualified_at = COALESCE(?, qualified_at),
             rewarded_at = COALESCE(?, rewarded_at),
             updated_at = ?
         WHERE id = ? AND deleted_at IS NULL`,
        [
          status,
          stamp?.qualifiedAt ?? null,
          stamp?.rewardedAt ?? null,
          now,
          id
        ]
      );
      trackChange({ entityType: "referrals", entityId: id, salonId });
      markDirty();
    });
  }
}
