# Razorpay subscription integration — implementation plan

## Existing code (reuse, do not duplicate)

| Area | Location | Status |
| --- | --- | --- |
| Auth (phone OTP) | `src/features/auth/`, `src/firebase/auth.ts` | Salon id = Firebase `uid` |
| Trial + entitlements | `src/domain/subscription/` | 30-day trial, soft-lock |
| Plan catalog | `SubscriptionPlanRepository` | Seeds trial/monthly/quarterly/yearly |
| Local activation | `SalonSubscriptionRepository.activateOrRenew` | Payment-ready |
| Payment ledger | `SubscriptionPaymentRepository` | Ledger exists, unused by UI |
| Cloud paid grant | `functions/src/record-paid-subscription.ts` | Stub webhook + referral reward |
| Subscription UI | `SubscriptionScreen` | Read-only + “coming soon” |
| Client↔CF pattern | `src/cloud/referral-claim.ts` | Firestore queue (no Functions SDK) |

**Trial already exists** — keep it. Duration is catalog-driven (`subscription_plans.duration_days` for `trial`).

## Product plans (only these purchaseable)

| Code | Price | Cycle |
| --- | --- | --- |
| `monthly` | ₹99 (9900 paise) | month / 30 days |
| `yearly` | ₹999 (99900 paise) | year / 365 days |

Disable `quarterly`. Keep `trial` for bootstrap.

## Architecture

```text
App (SubscriptionScreen)
  → enqueue /billing_checkout_requests/{id}
  → CF createRazorpayCheckout creates Razorpay subscription
  → App opens Razorpay Checkout (subscription_id + key_id)
  → User pays
  → App enqueue /billing_verify_requests/{id} (signature check)
  → Razorpay webhook (source of truth) → grant paid sub + referral reward
  → Sync pull → local entitlements unlock
```

**Rules:** never trust client payment status; webhook is authoritative; verify signature; all grants idempotent on Razorpay payment id.

## Backend (Cloud Functions)

- Env/secrets: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`
- Optional plan overrides: `RAZORPAY_PLAN_MONTHLY_ID`, `RAZORPAY_PLAN_YEARLY_ID`
- APIs:
  - Process `billing_checkout_requests` → create Razorpay plan (ensure) + subscription
  - Process `billing_verify_requests` → verify checkout signature + grant if needed
  - `razorpayWebhook` HTTP → lifecycle events (idempotent)
- Harden `grantReferralRewardForPaidSubscription` so paid sub + payment row are idempotent

## Database

SQLite schema already tracks user/salon, plan, external ids, status, dates, payment history. No new migration required for core fields.

Firestore (server):

- `/billing_checkout_requests/{id}` — create checkout session
- `/billing_verify_requests/{id}` — post-checkout verify
- `/razorpay_subscriptions/{subId}` — map Razorpay sub → salon/plan
- `/salons/{sid}/billing/payments/{paymentId}` — processed-payment idempotency

## Frontend

- Pricing cards on `SubscriptionScreen` (monthly / yearly)
- Current plan + expiry from existing entitlements
- Purchase flow with loading / success / failure / cancel / offline
- `subscription-guard` helpers wrapping entitlements for scalable feature checks

## Security

- Checkout/verify queues: caller may only create for own `salon_id == uid`
- Webhook: HMAC `X-Razorpay-Signature`
- Amounts/plan codes resolved server-side from catalog constants
