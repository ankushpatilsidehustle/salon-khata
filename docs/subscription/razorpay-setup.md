# Razorpay setup & test guide

## Environment variables

### Cloud Functions (`functions/`)

Set these in Firebase Secret Manager / function runtime env (never commit real values):

| Variable | Required | Purpose |
| --- | --- | --- |
| `RAZORPAY_KEY_ID` | Yes | Razorpay Key ID (test or live) |
| `RAZORPAY_KEY_SECRET` | Yes | Razorpay Key Secret |
| `RAZORPAY_WEBHOOK_SECRET` | Yes | Webhook signing secret from Razorpay Dashboard |
| `RAZORPAY_PLAN_MONTHLY_ID` | Optional | Existing Razorpay plan id for ₹99/month |
| `RAZORPAY_PLAN_YEARLY_ID` | Optional | Existing Razorpay plan id for ₹999/year |

Placeholders (replace before go-live):

```bash
RAZORPAY_KEY_ID=rzp_test_YOUR_KEY_ID
RAZORPAY_KEY_SECRET=YOUR_KEY_SECRET
RAZORPAY_WEBHOOK_SECRET=YOUR_WEBHOOK_SECRET
# Optional overrides if you create plans manually in the dashboard:
# RAZORPAY_PLAN_MONTHLY_ID=plan_xxxxxxxx
# RAZORPAY_PLAN_YEARLY_ID=plan_yyyyyyyy
```

Example with Firebase Functions secrets:

```bash
firebase functions:secrets:set RAZORPAY_KEY_ID
firebase functions:secrets:set RAZORPAY_KEY_SECRET
firebase functions:secrets:set RAZORPAY_WEBHOOK_SECRET
```

If you prefer plain env for local emulators, copy `functions/.env.example` → `functions/.env`.

If plan ids are omitted, the first checkout creates Razorpay plans automatically and caches ids in Firestore `/billing_config/razorpay_plans`.

### App (Expo)

The checkout Key ID is returned by the backend checkout session — do **not** put the Key Secret in the app. No `EXPO_PUBLIC_RAZORPAY_*` secret is required.

## Deploy

```bash
# From repo root
cd functions && npm install && npm run build && cd ..
firebase deploy --only functions,firestore:rules
```

Webhook URL (after deploy):

```text
https://<region>-<project-id>.cloudfunctions.net/razorpayWebhook
```

In Razorpay Dashboard → **Settings → Webhooks**:

1. Add the URL above.
2. Secret → copy into `RAZORPAY_WEBHOOK_SECRET`.
3. Enable events:
   - `subscription.authenticated`
   - `subscription.activated`
   - `subscription.charged`
   - `subscription.pending`
   - `subscription.halted`
   - `subscription.cancelled`
   - `subscription.completed`
   - `payment.captured`
   - `payment.failed`

## App rebuild (native checkout)

```bash
npm install
npx expo prebuild --clean
npx expo run:android   # or run:ios
```

`react-native-razorpay` requires a custom dev client (Expo Go will not work).

## Testing (Razorpay test mode)

1. Use test Key ID / Secret (`rzp_test_…`).
2. Deploy functions + rules.
3. Sign in to the app → **More → Subscription & referral**.
4. Choose **Monthly (₹99)** or **Yearly (₹999)** → **Subscribe**.
5. In Razorpay test checkout, use test cards:
   - Success: `4111 1111 1111 1111`, any future expiry / CVV
   - Failure: `4000 0000 0000 0002` (or Razorpay’s documented failure cards)
6. After success:
   - App verifies signature via `/billing_verify_requests`
   - Webhook grants/activates subscription (idempotent)
   - Sync pull unlocks entitlements (staff on bills)
7. Close the app mid-payment: webhook still activates; open Subscription → **Refresh status**.
8. Replay the same webhook in Dashboard → should return `duplicate` / `alreadyProcessed` with no double grant.

## Plans in the app

| Code | Price | Cycle |
| --- | --- | --- |
| `monthly` | ₹99 | Monthly |
| `yearly` | ₹999 | Yearly |

Trial remains local/catalog-driven (default 30 days via `subscription_plans` seed `duration_days`). Change trial length by updating that seed (or row) — no code fork required.

## Security checklist

- [ ] Key Secret + Webhook Secret only on Functions
- [ ] Webhook signature verification enabled
- [ ] Firestore rules deny client writes to `razorpay_*` / `billing_config`
- [ ] Checkout/verify queues scoped to `salon_id == auth.uid`
- [ ] Never activate paid plans from the client SQLite path alone
