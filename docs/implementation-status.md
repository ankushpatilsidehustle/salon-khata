# Salon Khata — Implementation Status

Snapshot of what is actually built in the codebase as of 2026-07-15.
Companion to [sync-engine-implementation.md](sync-engine-implementation.md)
(the sync/backup subsystems), and pointer into the deeper design docs
already in `docs/`.

If a feature is in this doc it's shipped, running, and typechecked. If
it's in [`docs/future-features.md`](future-features.md) or
[`docs/roadmap.md`](roadmap.md), it isn't (yet).

---

## 1. Overview

- **App**: single-owner salon bookkeeping — daily income, expenses,
  employee commission, customer ledger, reports.
- **Stack**: Expo SDK 54.0.35, React 19.1.0, React Native 0.81.5,
  TypeScript strict.
- **Local DB**: SQLite via `expo-sqlite` 16.0.10.
- **Cloud**: Firebase — Auth (phone OTP), Firestore (per-record sync),
  Storage (DR file backup), App Check (Play Integrity / DeviceCheck).
- **i18n**: `i18next` / `react-i18next` — `en`, `hi`, `mr`, `gu`, `bn`, `ta`, `kn` (full).
- **Runtime target**: dev client (Expo Go doesn't work — native modules
  from `@react-native-firebase/*` + `react-native-share`).

---

## 2. Feature inventory

### 2.1 Authentication

Firebase phone-OTP + App Check. Auth-gate splash → phone → OTP →
onboarding (first time) → main tabs.

| File | Role |
| --- | --- |
| `src/firebase/auth.ts` | `signInWithPhone`, `verifyOtp`, `signOut`, `deleteAccount`, `subscribeAuthState` — typed `AuthError { code, message }` |
| `src/firebase/app-check.ts` | `initializeAppCheck()` — Debug provider under `__DEV__`, Play Integrity / DeviceCheck in prod; prints debug token to console |
| `src/features/auth/AuthProvider.tsx` | Context. States: `loading | signed-out | signed-in-no-salon | signed-in`. 3 s splash timeout guard. Also starts sync scheduler + backup scheduler + membership on sign-in |
| `src/features/auth/AuthNavigator.tsx` | Native stack: `Phone` → `Otp` |
| `src/features/auth/PhoneNumberScreen.tsx` | Brand + icon, +91 prefix, 10-digit input, Send OTP |
| `src/features/auth/OtpScreen.tsx` | 6 boxes + auto-submit on 6th digit, Change number, 30 s resend, SMS auto-fill |
| `src/domain/phone.ts` | `toE164`, `formatE164ForDisplay` |

Sign-out and Delete-account are surfaced on `MoreScreen` under an
**Account** section. Delete handles `requires-recent-login` by prompting
re-auth.

### 2.2 Onboarding

Four-step wizard shown when user is authenticated but has no salon:

`Language → SalonType → BusinessSetup → Services`.

| File | Role |
| --- | --- |
| `src/features/onboarding/OnboardingNavigator.tsx` | Native stack |
| `src/features/onboarding/LanguageStep.tsx` | en / hi / mr / gu / bn / ta / kn |
| `src/features/onboarding/SalonTypeStep.tsx` | male / female / unisex |
| `src/features/onboarding/BusinessSetupStep.tsx` | Business name, owner name |
| `src/features/onboarding/ServicesStep.tsx` | Seeds an industry-appropriate service menu (`defaultServices.ts` — ~16 men's, ~30 women's; unisex = both). All rows insert on Finish; blank price = ₹0. Ensures default service categories exist |

Finish step creates the salon with `id = user.uid`, `owner_uid =
user.uid`, `mobile_number = user.phoneNumber`.

### 2.3 Dashboard

`src/features/dashboard/DashboardScreen.tsx` — today's snapshot.

Layout:

- Hero **Income** card
- Row: `Expenses | Commission` (both pressable — Commission →
  `CommissionSummary`)
- Single **Net collection** card with formula hint "Income − Expenses −
  Commission"
- FAB → `IncomeEntry`

Uses today's local business date. Money variants use tabular numerals.

### 2.4 Bill entry (income)

Full-screen modal from FAB or bottom-tab center button.

- **Customer section** (top, expandable): typeahead over
  `CustomerRepository.searchByQuery` (digit-heavy query → phone prefix;
  else name substring). Debounced 250 ms. Selecting fills phone + name
  and sets `matchedCustomerId`. On save, `upsert` if both phone (10 digits) + name provided.
- **Who served** — employee picker per bill line (line-level assignment).
  Falls back to header employee for legacy rows.
- **Service picker** — pick from active services, quantity, per-unit
  price snapshotted at billing time.
- **Payment mode** — cash / upi / card / credit / other.
- **Discount** — optional `discount_type` (percentage or amount).
- **Commission calculation** (per line, via
  `src/domain/commission-service.ts`):
  - Per-service `commission_rules` row wins if set.
  - Else synthetic rule from `employee.commission_percent` (when
    `compensation_type='commission'`).
  - Else 0.
  - **Percentage rules** subtract `product_cost` before applying the
    percent (labor-only): `commissionable = max(0, lineAmount − productCost × qty)`.
  - Snapshots (`commission_rule_type_snapshot`,
    `commission_rule_value_snapshot`) written per line so historical
    bills stay stable if the employee's default later changes.
- **Receipt sharing** after save — WhatsApp direct-to-chat when customer
  phone present (`react-native-share` v12 → `Share.shareSingle` with
  `whatsAppNumber`), else generic OS share sheet
  (`expo-sharing.shareAsync`). Fixed 360-px `ReceiptCard`
  (`src/components/domain/ReceiptCard.tsx`) rendered to PNG via
  `react-native-view-shot`.

### 2.5 Expenses

- List by business date + edit + soft-delete.
- Payment modes: `cash | upi | credit` (credit tracked to
  `settled_at`).
- `markCreditPaid()` flags a credit expense as reconciled.
- `totalCreditOutstanding()` for the outstanding badge.
- Categories seeded from a default set on first use.

Screens:
- `src/features/expenses/ExpenseEntryScreen.tsx`
- Expenses appear on Dashboard + Reports (no separate hub tile).

### 2.6 Employees

`EmployeesScreen` with active/inactive sections.

- Compensation: `salary` (paise/month) OR `commission` (percent × 100,
  e.g. 40% = 4000).
- Per-service commission rule overrides, edited from inside the
  employee form (nested `CommissionRulesSheet` modal).
- Owner tag (`is_owner`) — inline pill in the row title with star icon;
  read-only banner in the edit form; no toggle.
- Outstanding-advance badge in the row's trailing slot when > 0; tap
  → `AdvancesList` filtered by that employee.

### 2.7 Employee advances

Cash given to employees between paydays. Same soft-delete + mark-paid
pattern as expenses' credit flow.

- `AdvancesListScreen`, `AdvanceEntryScreen`, `AdvanceDetailSheet`.
- `outstandingByEmployee`, `totalOutstanding` aggregations.
- Reached via the "Staff advances" tile on `MoreScreen` OR the
  employee-row badge tap.

### 2.8 Customers

`src/features/customers/`

- `CustomersListScreen` — search debounced client-side; digit-heavy
  query → phone prefix match, else name substring; sorted by
  `last_visit DESC NULLS LAST`.
- `CustomerFormSheet` — name + phone; `DuplicatePhoneError` triggers
  snackbar with "Open existing" jump action.
- `CustomerDetailSheet` — visit / spend / last-visit stats from
  `listBillsForCustomer`; action row Call / WhatsApp / Edit / Delete;
  past-bills tappable → `IncomeEntry` edit.
- Phone normalization: strip non-digits, keep last 10 digits.
- WhatsApp uses `https://wa.me/91<10digits>` (India default); Call uses
  `Linking.openURL('tel:...')`.

### 2.9 Reports

Unified surface at `src/features/reports/ReportsScreen.tsx` covering
Day / Week / Month / Custom period.

Sections (in order):
- `PeriodSelector` (`src/components/domain/PeriodSelector.tsx`) —
  `SegmentedControl` + `‹ label ›` stepper + Custom modal with
  `@react-native-community/datetimepicker`
- Hero Income
- Expenses | Net row
- Commission (pressable → `CommissionSummary`)
- Bill stats (count · avg)
- Top employees (3 + "View all" → `TopEmployeesScreen`)
- Top services (3 + "View all" → `TopServicesScreen`)
- Payment split bars
- New vs Repeat (+ walk-in)
- Transactions list (tappable → `IncomeEntry` edit)

Companion screens:
- `CommissionSummaryScreen` — per-employee commission totals with % share
- `EmployeeCommissionDetailScreen` — line-item breakdown by employee for a range
- `TopEmployeesScreen` / `TopServicesScreen` — ranked bar rows

Period helpers in `src/domain/period.ts` — ISO week is Monday-anchored;
`makeCustomPeriod` for user-picked ranges; `normalizeReportPeriod` in
`src/features/reports/period-params.ts` handles both the legacy
`{ date }` and new `{ start, end, mode }` route params.

### 2.10 Services + categories

- `ServicesScreen` + `ServiceCategoryRepository.ensureDefaults()` seeds
  8 default categories (Hair, Facial, Waxing, Threading, Manicure &
  Pedicure, Massage, Makeup, Others).
- Gender-based pricing on the service (`male_price`, `female_price`) —
  legacy `price` column mirrored for compatibility.
- `product_cost` per service (labor-split for percentage commissions).

### 2.11 More screen

`src/features/more/MoreScreen.tsx` — tiles + Account section.

Tiles:
- Staff advances → `AdvancesList`
- **Subscription & referral** → trial/plan status, referral code, plan catalog
- **Sync now** (per-record sync engine) — snackbar with outcome
- **Sync status** (screen) → queue depth, activity, dead-letters
- **Export snapshot** (DR file backup) — confirm alert → snackbar

Account:
- Language → `LanguageScreen` (instant switch; persists `salons.language`)
- Log out (with confirm alert)
- Delete account (with confirm + re-auth handling)

Dev-only section (gated on `__DEV__`):
- Reset app data — closes + deletes the SQLite DB and calls
  `DevSettings.reload()`. Wired via `src/database/reset.ts`.

### 2.11b Subscription, trial & referral (Phase 1)

Full PRD: [`docs/subscription/PRD-subscription-referral.md`](subscription/PRD-subscription-referral.md).

Shipped locally:

- Migration `019` — `subscription_plans`, `salon_subscriptions`,
  `subscription_payments`, `referral_codes`, `referrals`
- Domain entitlements in `src/domain/subscription/`
- Repositories + `ensureSalonBillingBootstrap` (onboarding + AuthProvider)
- `SubscriptionProvider` + More → Subscription screen
- Income entry soft-lock: after trial/paid window, only owner staff
  assignable on bills
- Optional referral code on Business Setup (Firebase claim when online)
- **Referral reward:** +1 free month to referrer on every referred paid
  subscription — granted by Cloud Functions (`recordPaidSubscription`),
  synced down to SQLite (not computed locally)
- Sync entity types registered for salon-scoped subscription tables
- Firestore rules stubs for `/referral_index`, `/referrals`, claim queue
- Payment gateway **not** implemented — webhook hook is ready

### 2.12 Global overlays

- **Snackbar** — global via `SnackbarProvider` at AppRoot (wraps both
  onboarding and main navigators). `useSnackbar().showSnackbar(msg | opts)`.
  Persists across `navigation.goBack()`.
- **BootSplash** — while `AuthProvider` is `loading`.

### 2.13 i18n

- `src/i18n/index.ts` — `compatibilityJSON: 'v4'` set for
  `_one`/`_other` plural interpolation.
- `src/i18n/languages.ts` — shared language registry (codes, native
  names, Intl locales).
- Locale files under `src/i18n/locales/`: `en`, `hi`, `mr`, `gu`, `bn`,
  `ta`, `kn` — full translations (formal register).
- Onboarding language picker and **More → Account → Language**
  (`LanguageScreen`) both use the shared registry; change is instant
  and persisted on `salons.language`.
- Registered locales: `en`, `hi`, `mr`, `gu`, `bn`, `ta`, `kn`.

---

## 3. Cross-cutting infrastructure

### 3.1 Design system

`src/design-system/` — tokens + theme. Namespaced access:
`colors.brand.primary`, `colors.status.danger`, etc. **No flat
aliases** — `colors.primary` etc. were removed. Update any legacy code
accordingly.

Typography tokens: `display, h1–h3, body, bodyEmphasis, bodySmall,
caption, overline (uppercase built-in), button, moneyHero, moneyLarge,
moneyMedium, moneyBody, moneySmall`. Money variants set
`fontVariant: ['tabular-nums']` for correct alignment.

Radius scale: `xs (4), sm (8), md (12), lg (16), xl (24), full (999)`.

DS primitives built (`src/components/core/`):
- `Button` (primary / secondary / ghost / destructive; `fullWidth`)
- `Card` (compact / default / comfortable padding + `style` prop)
- `MoneyCard` (hero / standard + delta)
- `SectionHeader` (title + optional action)
- `EmptyState`
- `Fab` (regular / extended by label)
- `AppBar` (`variant: default | brand`, `leading`, `title`, `trailing`)
- `BottomTabBar` (with center-button hook that routes to `IncomeEntry`)
- `BottomSheet`
- `ListItem` (title accepts string or ReactNode)
- `SegmentedControl`
- `Snackbar`
- `TextField`

Domain components (`src/components/domain/`): `PeriodSelector`,
`ReceiptCard`.

**No icon library yet** — using Unicode symbols as MVP stand-ins in
some places; Ionicons wired where used (via `@expo/vector-icons`).

Full design docs live under `docs/design-system/` (18 files) and
`docs/screens/` (17 files) — reference for future work.

### 3.2 Database

- Single SQLite file: `salon-khata.db` under
  `<documentDirectory>/SQLite/`.
- WAL mode; single-thread JS ensures no concurrent writers.
- 18 migrations, all idempotent (safe to re-run on every boot). See
  `src/database/migrations/index.ts`.
- Access via `database.runSync` / `getFirstSync` / `getAllSync` +
  `runInTransaction(work)` from `src/database/sqlite-client.ts`.
- Shared columns per business table: `id`, `created_at`, `updated_at`,
  `deleted_at`, plus 5 sync columns added by migration 016 (see
  [sync-engine-implementation.md](sync-engine-implementation.md)).

Migration history:

| # | What |
| --- | --- |
| 001 | Initial schema — 8 business tables + `sync_queue` + `audit_logs` |
| 002 | `services.gender` column |
| 003 | `service_categories` table |
| 004 | Employees expanded (address, gender, joining_date, compensation) |
| 005 | Income discount fields |
| 006 | Line-level `employee_id` on `income_transaction_items` |
| 007 | Expense payment_mode |
| 008 | Expense `settled_at` |
| 009 | `salons.salon_type`, `employees.is_owner` |
| 010 | Services + item `product_cost` |
| 011 | `customers` table + customer_id/snapshot columns on income |
| 012 | `employee_advances` table |
| 013 | `salons.owner_uid` + partial unique index |
| 014 | Dropped legacy row-sync scaffolding + added `db_meta` singleton |
| 015 | `backup_history` diagnostic table |
| 016 | Restored per-record sync columns on all 11 business tables |
| 017 | `sync_queue` + `sync_state` + `conflict_log` |
| 018 | `sync_history` |

### 3.3 Sync + backup

See **[sync-engine-implementation.md](sync-engine-implementation.md)**
for the full story (8 phases, all shipped 2026-07-15). Two engines run
side-by-side:

- **Per-record sync engine** (`src/sync/`) — Firestore, automatic
  triggers, LWW conflict resolution, multi-writer safe.
- **Whole-DB file backup** (`src/backup/`, `src/cloud/`) — manual-only
  Export snapshot; DR safety net.

### 3.4 Firebase integration

- `@react-native-firebase/{app,auth,app-check,firestore,storage}` v22
  (native modules — dev client required).
- Requires `google-services.json` under `android/app/` and
  `GoogleService-Info.plist` under `ios/SalonKhata/`.
- App Check: Debug provider in dev; grab the token from adb / xcode
  logs and paste into Firebase Console → App Check → Manage debug
  tokens.
- Firestore Security Rules at repo root ([firestore.rules](../firestore.rules))
  — App Check enforced globally; owner + `member_uids` ACL.
- Cloud Function at `functions/src/index.ts` (`tombstoneGc`, nightly).

Deploy commands:
```bash
firebase deploy --only firestore:rules,firestore:indexes
cd functions && npm install && firebase deploy --only functions
```

### 3.5 Session + device identity

- `src/session/current-salon.ts` — runtime salon id via
  `export let DEV_SALON_ID = UNSET_SENTINEL`. Babel emits getters so
  every legacy `import { DEV_SALON_ID }` reads the current value.
  `AuthProvider` calls `setCurrentSalonId(uid)` on sign-in;
  `clearCurrentSalonId()` on sign-out.
- `src/session/session-storage.ts` — persistent salon id for the OS
  background worker (which can't read React context).
- `src/device/device-identity.ts` — UUID stored in Keychain
  (`expo-secure-store`) + mirrored to `db_meta.install_id`. Secure
  Store is authoritative; DB mirror survives Keychain wipes.
- `src/security/key-vault.ts` — AES-GCM DEK for the DR backup envelope,
  stored in Secure Store.

### 3.6 Networking

- `src/network/network-manager.ts` — `startNetworkManager()` boots at
  app start; caches `NetworkState { isOnline, isWifi, isMetered }`;
  emits `network:changed` on the event bus. `waitForOnline(timeoutMs)`
  helper.

### 3.7 Event bus

- `src/application/event-bus.ts` — tiny typed pub/sub. Events:
  `db:dirty`, `db:clean`, `backup:started/succeeded/failed`,
  `restore:completed`, `network:changed`, `lock:changed`,
  `sync:push-started/completed`, `sync:pull-started/completed`,
  `sync:conflict`. Handlers run synchronously in registration order;
  throwing handlers are logged and skipped.

---

## 4. Build & run

### One-time setup

```bash
npm install
```

Copy Firebase config files into place (from Firebase Console):
- `google-services.json` → `android/app/google-services.json`
- `GoogleService-Info.plist` → `ios/SalonKhata/GoogleService-Info.plist`

Generate native projects:
```bash
npx expo prebuild --clean
```

Run once on each platform to build the dev client:
```bash
npx expo run:android    # or run:ios
```

### Everyday dev loop

```bash
npx expo start --dev-client
```

### Verify

```bash
npm run typecheck                              # tsc --noEmit
CI=1 npx expo install --check                 # deps up-to-date
python3 -c "import json,glob; [json.load(open(p)) for p in glob.glob('src/i18n/locales/*.json')]; print('ok')"
```

### Reset local DB during dev

`MoreScreen` (in `__DEV__`) has a **Reset app data** button. It closes
the SQLite DB, deletes the file, and calls `DevSettings.reload()`.

---

## 5. Directory structure

```
salon-khata/
├── App.tsx                          # Entry point → AppRoot
├── app.json                         # Expo config + plugins
├── firebase.json                    # Firebase CLI config
├── firestore.rules                  # Security rules
├── firestore.indexes.json           # Composite indexes
├── functions/                       # Cloud Functions (standalone TS project)
│   ├── package.json
│   ├── tsconfig.json
│   └── src/index.ts                 # tombstoneGc
├── android/, ios/                   # Generated by prebuild — do not commit
├── docs/                            # Design docs (many pre-dating the current build)
│   ├── sync-engine.md               # Sync engine design (Phase 8)
│   ├── sync-engine-implementation.md# Sync engine implementation reference
│   ├── implementation-status.md     # THIS file
│   └── ... (many others — see the "Where existing docs live" section)
└── src/
    ├── application/                 # AppRoot, AppNavigator, event-bus
    ├── backup/                      # File-backup engine (DR, manual)
    ├── cloud/                       # Firestore + Storage clients
    ├── components/                  # DS primitives + domain composites
    ├── constants/                   # DEV_SALON_ID re-export
    ├── database/                    # SQLite client + migrations + reset + shared schema
    ├── design-system/               # Colors, typography, spacing, radius, shadows
    ├── device/                      # Device identity (Keychain-backed UUID)
    ├── domain/                      # Pure domain helpers (dates, id, phone, period, commission, etc.)
    ├── features/                    # One folder per feature (auth, onboarding, dashboard, income, expenses, employees, advances, customers, services, reports, more, sync)
    ├── firebase/                    # Firebase Auth + App Check init
    ├── i18n/                        # i18next setup + locale JSONs
    ├── network/                     # NetInfo wrapper
    ├── repositories/                # SQLite repo per aggregate (11 total)
    ├── security/                    # Key vault
    ├── session/                     # Current-salon runtime state + persistent storage + lock state
    └── sync/                        # Per-record sync engine (14 files)
```

Notes:
- Do **not** create `src/app/` — Expo auto-detects it as a router root.
- `android/` and `ios/` are regenerated by prebuild; source of truth is
  `app.json` + installed plugins.

---

## 6. Known limitations + future work

### In flight or not built yet

- **Full multi-writer UI** — invite / manage members (helpers exist in
  `src/cloud/salon-membership.ts`).
- **Row-level `sync_status` badges** — data flows through, UI hooks
  not built into row detail sheets.
- **Restore-from-snapshot UI** — the DR blob exists in Storage but
  there's no in-app restore flow (per-record sync covers new-device
  provisioning by pulling records).
- **Weekly Export-snapshot reminder toast** — trivial to add.
- **Icon library** — Ionicons via `@expo/vector-icons` is present but
  some places still use Unicode stand-ins. Full lucide-react-native or
  Ionicons pass pending.
- **`docs/api-contract.md`** — describes an HTTP push/pull API that
  doesn't match the Firestore-native reality. Full rewrite deferred.

### By design / not planned

- **Web target** — not supported.
- **Offline-only mode** — always Firebase Auth first; no local-only
  account flow.
- **`db_meta.dirty_since` / `change_count` prune** — still used
  internally by DR backup pipeline; keeping.
- **File-level device lock** — kept for DR-backup single-writer safety
  (per-record sync uses OCC instead).

### Manual next steps for the user

1. **Firebase console setup**: enable Phone provider, add Android
   SHA-1/256, register App Check apps (Play Integrity + DeviceCheck),
   add test phone numbers.
2. Drop `google-services.json` / `GoogleService-Info.plist` in.
3. `npx expo prebuild --clean` then rebuild dev client.
4. Grab the App Check debug token from adb/xcode logs → paste into
   Firebase Console → App Check → Manage debug tokens.
5. `firebase deploy --only firestore:rules,firestore:indexes`.
6. `cd functions && npm install && firebase deploy --only functions`.
7. Old `dev-salon-1` seed data (if any) becomes orphaned after auth —
   run `Reset app data` once (MoreScreen dev section) to clean it.

---

## 7. Where existing design docs live

Kept for reference — some pre-date the current build and describe
planned rather than shipped state.

**Product / vision:**
- [`docs/vision.md`](vision.md), [`docs/product-principles.md`](product-principles.md), [`docs/personas.md`](personas.md), [`docs/roadmap.md`](roadmap.md), [`docs/future-features.md`](future-features.md), [`docs/business-workflows.md`](business-workflows.md)

**UX + screens:**
- [`docs/ux-guidelines.md`](ux-guidelines.md), [`docs/screen-flow.md`](screen-flow.md), [`docs/navigation.md`](navigation.md)
- [`docs/ux/`](ux/) — 15 files covering journeys, information hierarchy, form/list UX, empty/error/success states, offline, motion, accessibility
- [`docs/screens/`](screens/) — per-screen specs (17 files) + `designs/` folder

**Design system:**
- [`docs/design-system.md`](design-system.md), [`docs/design-tokens.md`](design-tokens.md), [`docs/color-system.md`](color-system.md), [`docs/typography.md`](typography.md), [`docs/spacing-system.md`](spacing-system.md), [`docs/component-library.md`](component-library.md)
- [`docs/design-system/`](design-system/) — 18 detailed files (philosophy → tokens → each component)

**Data + architecture:**
- [`docs/database-schema.md`](database-schema.md) — updated in Phase 8
  for sync columns
- [`docs/api-contract.md`](api-contract.md) — **stale**; describes an
  HTTP API that isn't what shipped
- [`docs/service-engine.md`](service-engine.md), [`docs/folder-structure.md`](folder-structure.md), [`docs/coding-standards.md`](coding-standards.md)
- [`docs/sync-engine.md`](sync-engine.md) — architecture reference
  (rewritten Phase 8)
- [`docs/sync-engine-implementation.md`](sync-engine-implementation.md) —
  implementation + deploy reference

---

_Last updated: 2026-07-15._
