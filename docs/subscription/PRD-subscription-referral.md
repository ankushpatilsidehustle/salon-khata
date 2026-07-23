# PRD — Subscription, Trial, Referral & Plan Management

**Product:** Salon Khata (single-salon offline-first SaaS)  
**Status:** Design + Phase 1 implementation  
**Audience:** Engineering  
**Companion code:** `src/domain/subscription/`, `src/repositories/*subscription*`, `src/repositories/referral*`, migration `019`

When this doc and older roadmap docs disagree, prefer **this PRD** + `docs/implementation-status.md` + code.

---

## 1. Complete PRD

### 1.1 Problem

Salon Khata is free to adopt, but staff-assignment during billing is the premium lever. Owners must keep operating after a trial (login, history, owner-only bills, reports) while being nudged to subscribe. Referrals should grow acquisition without locking the schema to one reward type. Payments come later; the engine must activate/renew plans without rewrites.

### 1.2 Goals

| Goal | Success signal |
| --- | --- |
| 30-day full-feature trial for every new salon | Trial row created atomically with salon |
| Soft lock after expiry | Owner can bill; cannot assign non-owner staff |
| Central entitlements | One helper answers all access questions |
| Flexible plans | New plans = catalog rows, not code forks |
| Referral foundation | Unique codes, one claim per salon, no self-ref, extensible rewards |
| Offline-first | Entitlement decisions work from local SQLite |
| Payment-ready | Gateway only writes activation/renewal + payment history |

### 1.3 Non-goals (Phase 1)

- Razorpay / Play Billing / App Store IAP
- Multi-salon orgs, seats, or per-employee seats
- Complex reward fulfillment UI (store reward intent only) — **updated:**
  fulfillment is Cloud Function–driven; Subscription screen explains the rule
- Blocking login or wiping data on expiry
- Hard-locking reports or historical records

### 1.4 Personas & journeys

**New owner**

1. Completes onboarding (optional referral code).
2. Receives unique referral code + 30-day trial.
3. Bills with full staff assignment + commissions.

**Expired owner (no paid plan)**

1. Still signs in; all data intact.
2. Reports / history / staff CRUD remain available.
3. On bill entry, only the owner employee is assignable (or owner-only path if no owner employee row).
4. Sees upgrade CTA on More → Subscription.

**Subscribed owner**

1. Paid plan activates (future: payment webhook / admin).
2. Staff assignment + commissions return immediately from local entitlement recompute.

### 1.5 Functional requirements

**Trial**

- FR-T1: New salon gets trial plan, `status=trial`, `start_at=now`, `end_at=now+30d`.
- FR-T2: During trial, all feature flags unlocked.
- FR-T3: Existing salons without a subscription row get an idempotent bootstrap trial starting at first ensure (rollout goodwill).

**Post-expiry**

- FR-E1: Login allowed.
- FR-E2: Data + reports readable.
- FR-E3: Bills allowed.
- FR-E4: Non-owner staff **not** selectable on bill lines / who-served.
- FR-E5: Commission for non-owner staff cannot be introduced via new assignments (owner lines still compute normally).

**Subscription active / grace**

- FR-S1: Staff assignable again.
- FR-S2: Commissions resume for assigned staff.
- FR-S3: Optional plan `grace_period_days` keeps premium access until `grace_end_at`.

**Referral**

- FR-R1: Every salon has one active unique code.
- FR-R2: Referred salon may attach a code **once**.
- FR-R3: Self-referral rejected.
- FR-R4: Duplicate referred_salon rejected.
- FR-R5: Track referrer, referred, dates, status; rewards in JSON.
- FR-R6: Referrers may invite **unlimited** salons (no cap on outbound referrals).
- FR-R7: When a referred salon activates a **paid** plan, the referrer receives **+30 days** (1 free month) stacked onto their current access window.
- FR-R8: FR-R7 applies on **every** paid subscription/renewal by that referred salon (idempotent per `externalPaymentId`).
- FR-R9: Claim + reward fulfillment are **Firebase-authoritative**; SQLite only caches via sync pull.

**Plans**

- FR-P1: Catalog supports trial / monthly / quarterly / yearly / future codes.
- FR-P2: Enable/disable without app release (local seed now; cloud catalog later).
- FR-P3: Price in integer paise; features as JSON flags.
- FR-P4: Payment history table exists before gateway.

### 1.6 Entitlement questions (single API)

| Question | Helper |
| --- | --- |
| On trial? | `isOnTrial` |
| Subscription active (paid)? | `isSubscriptionActive` |
| Expired (no usable access window)? | `isExpired` |
| Assign staff on bill? | `canAssignStaffOnBill` |
| Premium features? | `canUsePremiumFeatures` |
| Access reports? | `canAccessReports` |
| Manage staff records? | `canManageStaff` |

---

## 2. Database schema

All money = integer **paise**. IDs = UUID strings. Soft-delete via `deleted_at`. Salon-scoped business tables that sync also carry sync columns (`sync_status`, `sync_version`, `last_synced_at`, `updated_by`, `created_by`).

### 2.1 `subscription_plans` (local catalog; not salon-entity-synced in Phase 1)

| Column | Type | Notes |
| --- | --- | --- |
| id | TEXT PK | Stable UUID |
| code | TEXT UNIQUE | `trial`, `monthly`, `quarterly`, `yearly`, … |
| name | TEXT | Display name |
| description | TEXT NULL | |
| billing_period | TEXT | `trial` \| `month` \| `quarter` \| `year` \| `custom` |
| duration_days | INTEGER | 30 / 30 / 90 / 365 |
| price_paise | INTEGER | 0 for trial |
| currency | TEXT | default `INR` |
| is_enabled | INTEGER | 0/1 |
| sort_order | INTEGER | UI order |
| features_json | TEXT | PlanFeatures JSON |
| grace_period_days | INTEGER | default 0 |
| created_at / updated_at / deleted_at | TEXT | |

### 2.2 `salon_subscriptions`

| Column | Type | Notes |
| --- | --- | --- |
| id | TEXT PK | |
| salon_id | TEXT | |
| plan_id | TEXT | FK logical → plans |
| status | TEXT | `trial` \| `active` \| `grace` \| `expired` \| `cancelled` |
| start_at / end_at | TEXT | ISO UTC |
| grace_end_at | TEXT NULL | |
| auto_renew | INTEGER | future |
| payment_provider | TEXT NULL | e.g. `razorpay` |
| external_payment_id | TEXT NULL | |
| external_subscription_id | TEXT NULL | |
| activated_by | TEXT | `system_trial` \| `payment` \| `admin` \| `referral_reward` |
| metadata_json | TEXT | extensibility |
| timestamps + soft-delete + sync cols | | |

Indexes: `(salon_id, status)`, `(salon_id, end_at DESC)`.

### 2.3 `subscription_payments`

Payment ledger for future gateway. Status: `pending` \| `succeeded` \| `failed` \| `refunded`. Includes `amount_paise`, provider ids, `paid_at`, `failure_reason`, `metadata_json`, sync cols.

### 2.4 `referral_codes`

One active code per salon (`salon_id` UNIQUE where not deleted). `code` UNIQUE. `is_active` 0/1.

### 2.5 `referrals`

| Column | Notes |
| --- | --- |
| referrer_salon_id / referred_salon_id | referred UNIQUE |
| referral_code | snapshot of code used |
| status | `pending` \| `qualified` \| `rewarded` \| `rejected` |
| referred_at / qualified_at / rewarded_at | |
| reward_json | **extensible rewards** — no schema change for new reward types |
| metadata_json | |

Example `reward_json`:

```json
{ "type": "subscription_days", "days": 7, "status": "pending" }
```

Future types (`credits`, `cashback`, `plan_upgrade`) are additional JSON shapes, not new columns.

### 2.6 Salon column (optional denorm)

Not required in Phase 1. Effective entitlements are derived from the latest usable `salon_subscriptions` row + plan features.

---

## 3. Entity relationships

```text
subscription_plans 1───* salon_subscriptions 1───* subscription_payments
        │
        └── features_json drives Entitlements

salons 1───1 referral_codes
salons 1───* salon_subscriptions
salons 1───* referrals (as referred)
salons 1───* referrals (as referrer)
```

Cloud (cross-salon):

```text
/referral_index/{CODE} → { salon_id, code, is_active }
/referrals/{id}        → authoritative claim (unique referred_salon_id)
/salons/{sid}/entities/salon_subscriptions|referral_codes|referrals|subscription_payments/records/{id}
```

---

## 4. Subscription lifecycle

```text
                 activateTrial()
                       │
                       ▼
                   [trial] ────── end_at ──► [grace?] ──► [expired]
                       │                         │
                       │                    (optional)
                       ▼
              payment / admin activate
                       │
                       ▼
                   [active] ──── end_at ──► [grace?] ──► [expired]
                       │
                  cancel (paid-through)
                       │
                       ▼
                 [cancelled] (entitlements until end_at if paid-through)
```

**Activation API (future payment):** `activateOrRenewPlan({ salonId, planCode, payment })`  
- Creates/extends `salon_subscriptions`  
- Writes `subscription_payments`  
- Does **not** require changing entitlement math  

**Renewal:** if current not expired, extend `end_at` from max(now, current.end_at) + duration; else start fresh window.

**Status persistence:** stored `status` is a cache; **evaluate** always recomputes from timestamps at read time, then repositories may persist the derived status opportunistically.

---

## 5. Trial lifecycle

1. Onboarding `ServicesStep` creates salon → `ensureSalonBillingBootstrap(salonId)`  
   - Seeds plans if missing  
   - Creates referral code  
   - Inserts trial subscription (`activated_by=system_trial`)  
2. Optional referral code from Business Setup → `applyReferralCode` (once)  
3. Daily use: entitlements from trial until `end_at` (+ grace)  
4. After window: effective `expired`; UI soft-locks staff assignment  

Backfill: `AuthProvider` calls the same ensure on sign-in (idempotent).

---

## 6. Referral lifecycle

**Product rule:** Share your code as often as you want. Each time a referred salon **pays for a plan**, you earn **+1 free month**.

```text
Salon A created
  → local referral_codes row
  → sync push
  → Cloud Function syncReferralIndex upserts /referral_index/{CODE}

Salon B onboarding enters A's code
  → client writes /referral_claim_requests/{id} (online)
  → Cloud Function processReferralClaimRequest:
       reject self / duplicate / missing code
       create /referrals/{id} + /referral_by_referred/{B}
       mirror referral entity into A and B salon sync trees
  → status = pending (reward not granted yet)

Salon B pays (Razorpay webhook / recordPaidSubscription)
  → Cloud Function grantReferralRewardForPaidSubscription:
       write B's paid salon_subscriptions (+ payment ledger)
       if referral exists AND grant not already recorded for this paymentId:
         extend A's access by +30 days (activated_by=referral_reward)
         write grant under /referrals/{id}/reward_grants/{paymentId}
         set referral status=rewarded, reward_count += 1
  → A's device pulls new salon_subscriptions on next sync → entitlements unlock
```

Firebase owns uniqueness and reward math. Local SQLite never invents referral rewards.

Idempotency key: `externalPaymentId` (one free month per successful paid event, not per button mash).

---

## 7. Plan management architecture

- **Catalog table** is the source of plan definitions.  
- App never hardcodes prices/durations except as **seed defaults** in migration/bootstrap.  
- Feature flags live in `features_json` so a plan can flip `assignStaffOnBill` without a binary release.  
- Disable plan: `is_enabled=0` (hidden from purchase UI; existing subs continue).  
- Future cloud catalog pull can UPSERT plans by `code` without migration.

Default Phase 1 seeds:

| code | period | days | price | grace | assignStaff |
| --- | --- | --- | --- | --- | --- |
| trial | trial | 30 | 0 | 0 | true |
| monthly | month | 30 | TBD placeholder | 3 | true |
| quarterly | quarter | 90 | TBD | 3 | true |
| yearly | year | 365 | TBD | 7 | true |

Placeholder prices are non-zero stubs in paise; purchase UI is not shipped until payments.

---

## 8. Permission / access control design

Pure domain module: `src/domain/subscription/`.

```typescript
type PlanFeatures = {
  assignStaffOnBill: boolean;
  manageStaff: boolean;
  accessReports: boolean;
  premiumFeatures: boolean;
  commissionOnBill: boolean;
};

type Entitlements = PlanFeatures & {
  lifecycle: "trial" | "active" | "grace" | "expired" | "none";
  isOnTrial: boolean;
  isSubscriptionActive: boolean; // paid active/grace
  isExpired: boolean;
  remainingDays: number;
  planCode: string | null;
  subscriptionId: string | null;
  endAt: string | null;
};
```

**Expired effective features (product rule):**

- `assignStaffOnBill: false`
- `commissionOnBill: false` for staff path (owner lines still allowed)
- `accessReports: true`
- `manageStaff: true` (records remain editable; data accessible)
- `premiumFeatures: false`

UI and repositories consult `getEntitlementsForSalon(salonId)` (repo + domain evaluate). Screens must not re-implement rules.

React: `SubscriptionProvider` caches entitlements and refreshes on focus / `db:dirty` / sign-in.

---

## 9. API design

### 9.1 Local (repositories / domain)

| API | Purpose |
| --- | --- |
| `SubscriptionPlanRepository.ensureDefaults()` | Seed/enable catalog |
| `SalonSubscriptionRepository.getCurrent(salonId)` | Latest usable sub |
| `SalonSubscriptionRepository.activateTrial(salonId)` | Idempotent trial |
| `SalonSubscriptionRepository.activateOrRenew(...)` | Payment/admin hook |
| `ReferralRepository.ensureCode(salonId)` | Unique code |
| `ReferralRepository.applyCode(referredSalonId, code)` | One-time claim |
| `evaluateSubscription(sub, plan, now)` | Pure lifecycle |
| `resolveEntitlements(...)` | Pure permissions |
| `ensureSalonBillingBootstrap(salonId)` | Trial + code + plans |

### 9.2 Cloud (future / stubs)

| Endpoint / callable | Purpose |
| --- | --- |
| `claimReferral` / `processReferralClaimRequest` | Atomic cross-salon claim |
| `recordPaidSubscription` (+ webhook) | Paid activation + referrer +30d grant |
| `syncReferralIndex` | Mirror codes → `/referral_index` |
| `GET /catalog/plans` | Optional remote plan UPSERT |

Client payment SDK is out of scope; it only needs to call `activateOrRenew` after success.

---

## 10. Offline sync considerations

| Data | Sync strategy |
| --- | --- |
| `subscription_plans` | Local seed only (Phase 1). Later: global catalog pull. |
| `salon_subscriptions` | Per-record sync under salon entities |
| `subscription_payments` | Per-record sync |
| `referral_codes` | Per-record sync + denorm `/referral_index/{CODE}` |
| `referrals` | Local row + **cloud-authoritative** claim for uniqueness |

Rules:

1. Entitlement checks never block on network.  
2. Trial is created locally before any network call.  
3. Referral claim may be `pending` offline; cloud reject flips to `rejected` with reason in `metadata_json`.  
4. LWW applies to salon-scoped subscription rows; **activation from payment should be server-authored** with higher trust (document for Phase 2: prefer remote when `activated_by=payment`).  
5. Pull order: plans local; then `referral_codes` → `salon_subscriptions` → `subscription_payments` → `referrals` (after `salons`).

---

## 11. Edge cases

| Case | Handling |
| --- | --- |
| Clock skew | Use device UTC; accept ± hours; cloud activation timestamps win on sync |
| Trial + paid overlap | Paid `activateOrRenew` supersedes; keep history rows |
| Cancel mid-cycle | `cancelled` but entitlements until `end_at` if paid-through |
| No owner employee row | Expired billing: allow save without non-owner staff; auto-bind owner when present; banner to upgrade |
| Edit old bill with staff lines while expired | Keep historical assignments; block **new** non-owner assignment |
| Self-referral | Reject |
| Re-enter referral | Reject (one row per referred salon) |
| Disabled plan | Hide from purchase; existing sub continues |
| Grace = 0 | Jump trial/active → expired at `end_at` |
| Duplicate bootstrap | Idempotent ensures |
| Payment retry | Payments table records pending/failed; activation only on succeeded |

---

## 12. Security considerations

1. **Client is not authority for paid activation** — payment webhooks / Admin SDK write subscriptions.  
2. Firestore rules: salon members may read own subscription entities; **cannot** forge another salon’s referral index.  
3. `referral_index` writes only via Cloud Functions / Admin.  
4. App Check required (existing).  
5. Do not trust client-sent `price_paise` at payment time — server loads plan by `code`.  
6. Soft-deleted codes stay unique; rotating codes = new row + deactivate old.  
7. Avoid leaking other salons’ PII through referral lookup — index returns salon_id only to the function.

---

## 13. Recommended folder structure

```text
docs/subscription/
  PRD-subscription-referral.md          ← this file

src/database/migrations/
  019-subscription-referral.ts

src/domain/subscription/
  types.ts
  plan-features.ts
  evaluate.ts              ← lifecycle + remaining days
  entitlements.ts          ← permission helpers
  referral-code.ts         ← code generation / normalize

src/repositories/
  subscription-plan-repository.ts
  salon-subscription-repository.ts
  subscription-payment-repository.ts
  referral-repository.ts
  subscription-bootstrap.ts

src/features/subscription/
  SubscriptionProvider.tsx
  SubscriptionScreen.tsx
  useBillingEmployees.ts   ← filters staff for bill UI

src/cloud/
  referral-claim.ts        ← online claim helper (stub-ready)

src/sync/types.ts          ← extend SyncEntityType
src/sync/entity-order.ts
```

---

## 14. Step-by-step implementation plan (dev order)

1. **Schema migration 019** — tables + indexes + schema_version.  
2. **Domain types + evaluate + entitlements + referral code** — pure unit-testable.  
3. **Plan seed repository** — defaults for trial/monthly/quarterly/yearly.  
4. **Salon subscription + payment + referral repositories** — SQLite + `trackChange` for synced tables.  
5. **Bootstrap** — `ensureSalonBillingBootstrap`; wire onboarding + AuthProvider.  
6. **Sync registration** — entity types + pull order + firestore rules notes.  
7. **SubscriptionProvider** — app-wide entitlements.  
8. **Income gate** — filter employees; banners; save invariants.  
9. **More → Subscription screen** — status, remaining days, referral code display, apply-code if missing.  
10. **Onboarding referral field** — BusinessSetup optional code.  
11. **i18n** — `en.json` / `hi.json` keys.  
12. **Cloud stubs** — referral index rules + claim function sketch.  
13. **Docs** — implementation-status + this PRD.  
14. **Payments (later)** — Razorpay → Cloud Function → `activateOrRenew` only.

Phase 1 ships steps 1–13 without a live payment gateway or production Cloud Function deploy requirement; claim helper is structured for online use when credentials/rules are available.
