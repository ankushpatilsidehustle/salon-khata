import { database } from "@/database/sqlite-client";

/**
 * Migration 019 — subscription plans, salon subscriptions, payments,
 * referral codes, and referrals.
 *
 * See docs/subscription/PRD-subscription-referral.md.
 *
 * `subscription_plans` is a local catalog (seeded in bootstrap). The other
 * tables are salon-scoped and join the per-record sync engine.
 */
export function runMigration019(): void {
  database.execSync(`
    CREATE TABLE IF NOT EXISTS subscription_plans (
      id                 TEXT PRIMARY KEY NOT NULL,
      code               TEXT NOT NULL,
      name               TEXT NOT NULL,
      description        TEXT,
      billing_period     TEXT NOT NULL,
      duration_days      INTEGER NOT NULL,
      price_paise        INTEGER NOT NULL DEFAULT 0,
      currency           TEXT NOT NULL DEFAULT 'INR',
      is_enabled         INTEGER NOT NULL DEFAULT 1,
      sort_order         INTEGER NOT NULL DEFAULT 0,
      features_json      TEXT NOT NULL DEFAULT '{}',
      grace_period_days  INTEGER NOT NULL DEFAULT 0,
      created_at         TEXT NOT NULL,
      updated_at         TEXT NOT NULL,
      deleted_at         TEXT
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_subscription_plans_code
      ON subscription_plans (code)
      WHERE deleted_at IS NULL;

    CREATE TABLE IF NOT EXISTS salon_subscriptions (
      id                        TEXT PRIMARY KEY NOT NULL,
      salon_id                  TEXT NOT NULL,
      plan_id                   TEXT NOT NULL,
      status                    TEXT NOT NULL,
      start_at                  TEXT NOT NULL,
      end_at                    TEXT NOT NULL,
      grace_end_at              TEXT,
      auto_renew                INTEGER NOT NULL DEFAULT 0,
      payment_provider          TEXT,
      external_payment_id       TEXT,
      external_subscription_id  TEXT,
      activated_by              TEXT NOT NULL DEFAULT 'system_trial',
      metadata_json             TEXT NOT NULL DEFAULT '{}',
      created_at                TEXT NOT NULL,
      updated_at                TEXT NOT NULL,
      deleted_at                TEXT,
      sync_status               TEXT NOT NULL DEFAULT 'pending',
      sync_version              INTEGER NOT NULL DEFAULT 0,
      last_synced_at            TEXT,
      updated_by                TEXT,
      created_by                TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_salon_subscriptions_salon_end
      ON salon_subscriptions (salon_id, end_at DESC);

    CREATE INDEX IF NOT EXISTS idx_salon_subscriptions_salon_status
      ON salon_subscriptions (salon_id, status);

    CREATE TABLE IF NOT EXISTS subscription_payments (
      id                   TEXT PRIMARY KEY NOT NULL,
      salon_id             TEXT NOT NULL,
      subscription_id      TEXT NOT NULL,
      plan_id              TEXT NOT NULL,
      amount_paise         INTEGER NOT NULL,
      currency             TEXT NOT NULL DEFAULT 'INR',
      status               TEXT NOT NULL,
      payment_provider     TEXT,
      external_payment_id  TEXT,
      paid_at              TEXT,
      failure_reason       TEXT,
      metadata_json        TEXT NOT NULL DEFAULT '{}',
      created_at           TEXT NOT NULL,
      updated_at           TEXT NOT NULL,
      deleted_at           TEXT,
      sync_status          TEXT NOT NULL DEFAULT 'pending',
      sync_version         INTEGER NOT NULL DEFAULT 0,
      last_synced_at       TEXT,
      updated_by           TEXT,
      created_by           TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_subscription_payments_salon
      ON subscription_payments (salon_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS referral_codes (
      id              TEXT PRIMARY KEY NOT NULL,
      salon_id        TEXT NOT NULL,
      code            TEXT NOT NULL,
      is_active       INTEGER NOT NULL DEFAULT 1,
      created_at      TEXT NOT NULL,
      updated_at      TEXT NOT NULL,
      deleted_at      TEXT,
      sync_status     TEXT NOT NULL DEFAULT 'pending',
      sync_version    INTEGER NOT NULL DEFAULT 0,
      last_synced_at  TEXT,
      updated_by      TEXT,
      created_by      TEXT
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_referral_codes_salon
      ON referral_codes (salon_id)
      WHERE deleted_at IS NULL;

    CREATE UNIQUE INDEX IF NOT EXISTS idx_referral_codes_code
      ON referral_codes (code)
      WHERE deleted_at IS NULL;

    CREATE TABLE IF NOT EXISTS referrals (
      id                 TEXT PRIMARY KEY NOT NULL,
      referrer_salon_id  TEXT NOT NULL,
      referred_salon_id  TEXT NOT NULL,
      referral_code      TEXT NOT NULL,
      status             TEXT NOT NULL,
      referred_at        TEXT NOT NULL,
      qualified_at       TEXT,
      rewarded_at        TEXT,
      reward_json        TEXT NOT NULL DEFAULT '{}',
      metadata_json      TEXT NOT NULL DEFAULT '{}',
      created_at         TEXT NOT NULL,
      updated_at         TEXT NOT NULL,
      deleted_at         TEXT,
      sync_status        TEXT NOT NULL DEFAULT 'pending',
      sync_version       INTEGER NOT NULL DEFAULT 0,
      last_synced_at     TEXT,
      updated_by         TEXT,
      created_by         TEXT
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_referrals_referred_salon
      ON referrals (referred_salon_id)
      WHERE deleted_at IS NULL;

    CREATE INDEX IF NOT EXISTS idx_referrals_referrer
      ON referrals (referrer_salon_id, referred_at DESC);
  `);

  database.runSync(
    `UPDATE db_meta SET value = ?
     WHERE key = 'schema_version'
       AND (value IS NULL OR CAST(value AS INTEGER) < 19)`,
    ["19"]
  );
}
