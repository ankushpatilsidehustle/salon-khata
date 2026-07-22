# Salon Khata — Agent Index

Offline-first Expo/React Native app for small salon daily bookkeeping (income, expenses, commissions, reports). Not a salon ERP.

**Source of truth for “what shipped”:** [`docs/implementation-status.md`](docs/implementation-status.md)  
**Product vision:** [`docs/vision.md`](docs/vision.md)  
**Coding rules:** [`docs/coding-standards.md`](docs/coding-standards.md)

---

## Stack

| Layer | Choice |
| --- | --- |
| App | Expo SDK 54, React 19, RN 0.81, TypeScript strict |
| Local DB | SQLite (`expo-sqlite`) — offline source of truth |
| Auth | Firebase Phone OTP + App Check |
| Sync | Firestore per-record sync (`src/sync/`) |
| DR backup | Encrypted whole-DB snapshot (`src/backup/` + `src/cloud/`) |
| i18n | i18next — `en` full, `hi` stub |
| Alias | `@/*` → `src/*` |

**Runtime:** custom dev client required (native Firebase modules). Expo Go will not work.

```bash
npm install
npx expo prebuild --clean
npx expo run:android   # or run:ios
npx expo start --dev-client
npm run typecheck
```

---

## Boot & auth gate

```
App.tsx → AppRoot
  migrations → device identity → network → backup prefs → App Check → bg sync register
  AuthProvider
    signed-out          → AuthNavigator (Phone → Otp)
    signed-in-no-salon  → OnboardingNavigator (Language → SalonType → BusinessSetup → Services)
    signed-in           → AppNavigator (tabs + modals)
```

Salon id = Firebase `user.uid`. Set via `src/session/current-salon.ts` (`DEV_SALON_ID` is a live getter).

---

## Layer map (import direction)

| Folder | Owns | May import | Must not |
| --- | --- | --- | --- |
| `features/` | Screens, feature UI | components, domain, repositories, session | SQLite client directly |
| `components/` | Reusable UI | design-system, i18n | repositories, firebase |
| `domain/` | Pure business logic | utilities only | React, repositories |
| `repositories/` | SQLite CRUD | database | screens, firebase |
| `sync/` | Queue, push/pull, conflicts | repositories, firestore sync API | UI screens |
| `backup/` + `cloud/` | DR file backup | database, security, session | feature UI (except triggers) |
| `firebase/` | Auth + App Check | RN Firebase SDK | business rules |
| `application/` | Bootstrap, nav shell, event-bus | everything orchestration | domain calculations |
| `design-system/` | Tokens/theme | nothing app-specific | — |
| `i18n/` | Locales + setup | — | hardcoded UI strings elsewhere |

**Offline-first:** commit to SQLite first; network never blocks daily ops; reports read local data.

---

## Feature → code map

| Area | Path | Notes |
| --- | --- | --- |
| Auth | `src/features/auth/` | Phone OTP; see also `src/firebase/auth.ts` |
| Onboarding | `src/features/onboarding/` | Seeds default services by salon type |
| Dashboard | `src/features/dashboard/` | Today: income / expenses / commission / net |
| Income (bill) | `src/features/income/` | FAB / center tab; line commission snapshots |
| Expenses | `src/features/expenses/` | cash / upi / credit + `settled_at` |
| Entries hub | `src/features/entries/` | Navigation hub for day activity |
| Employees | `src/features/employees/` | Salary or commission; per-service rules sheet |
| Advances | `src/features/advances/` | Staff cash advances |
| Customers | `src/features/customers/` | Search, detail, call/WhatsApp |
| Services | `src/features/services/` | Categories + gender prices + product_cost |
| Reports | `src/features/reports/` | Period selector; commission / top lists |
| More | `src/features/more/` | Sync, export, account, dev reset |
| Sync status UI | `src/features/sync/` | Queue depth / dead letters |
| Subscription | `src/features/subscription/` | Trial/plan entitlements, referral code UI |

---

## Data model (SQLite)

Migrations: `src/database/migrations/` (001–018, idempotent). Client: `src/database/sqlite-client.ts`.

**Business tables:** `salons`, `services`, `service_categories`, `employees`, `commission_rules`, `income_transactions`, `income_transaction_items`, `expenses`, `expense_categories`, `customers`, `employee_advances`, `salon_subscriptions`, `subscription_payments`, `referral_codes`, `referrals`

**Catalog (local):** `subscription_plans`

**Infra tables:** `db_meta`, `sync_queue`, `sync_state`, `conflict_log`, `sync_history`, `backup_history`

Shared row shape: `id`, `created_at`, `updated_at`, `deleted_at` + sync columns (`sync_status`, `sync_version`, `last_synced_at`, `updated_by`, `created_by`).

**Money:** integer minor units (paise). **IDs:** UUID strings. Soft-delete via `deleted_at`.

Repos: one per aggregate under `src/repositories/*-repository.ts`.

Domain services: `commission-service.ts`, `report-service.ts`, `money.ts`, `dates.ts`, `period.ts`, `phone.ts`, `id.ts`, `subscription/` (entitlements + lifecycle).

Schema detail: [`docs/database-schema.md`](docs/database-schema.md).  
Subscription PRD: [`docs/subscription/PRD-subscription-referral.md`](docs/subscription/PRD-subscription-referral.md).

---

## Sync & backup (two engines)

1. **Per-record sync** — `src/sync/` → Firestore. Auto on dirty/online; LWW conflicts; background task.
2. **File backup (DR)** — `src/backup/` packs encrypted SQLite blob → `src/cloud/` Storage. Manual “Export snapshot” on More screen.

Deep docs: [`docs/sync-engine.md`](docs/sync-engine.md), [`docs/sync-engine-implementation.md`](docs/sync-engine-implementation.md).

Event bus: `src/application/event-bus.ts` (`db:dirty`, `sync:*`, `network:changed`, …).

---

## Design system

Tokens: `src/design-system/` — use namespaced paths only (`colors.brand.primary`, not flat aliases).

Core UI: `src/components/core/` · Domain UI: `src/components/domain/`.

Docs: `docs/design-system/` + `docs/screens/`.

---

## Firebase / cloud (repo root)

| Artifact | Role |
| --- | --- |
| `firestore.rules` | App Check + owner/`member_uids` ACL |
| `firestore.indexes.json` | Composite indexes |
| `functions/src/index.ts` | `tombstoneGc` nightly |
| `google-services.json` / `GoogleService-Info.plist` | Required locally (not always in git) |

---

## Doc trust order

When docs disagree with code, prefer **code** + [`docs/implementation-status.md`](docs/implementation-status.md).

| Doc | Trust |
| --- | --- |
| `implementation-status.md` | Current shipped state |
| `sync-engine*.md`, `database-schema.md` | Architecture (mostly current) |
| `folder-structure.md`, `api-contract.md` | Partially stale — do not follow blindly |
| `future-features.md`, `roadmap.md` | Not built |
| `vision.md` non-goals | Some (e.g. customers) were added later — check implementation-status |

---

## Quick “where do I change X?”

| Need | Start here |
| --- | --- |
| New screen | `src/features/<area>/` + wire in `AppNavigator` / feature navigator |
| Save/query data | matching `*-repository.ts` |
| Commission math | `src/domain/commission-service.ts` |
| Report totals | `src/domain/report-service.ts` |
| New DB column | new migration in `src/database/migrations/` + register in `index.ts` |
| Visible string | `src/i18n/locales/en.json` (+ `hi.json`) — never hardcode |
| Auth flow | `AuthProvider` + `src/firebase/auth.ts` |
| Sync bug | `src/sync/sync-service.ts`, `queue-manager.ts`, `conflict-resolver.ts` |
| Colors/type | `src/design-system/` |

---

## Hard constraints for agents

- Do not add `src/app/` (Expo Router collision).
- UI must not open SQLite directly — go through repositories.
- Domain must stay React-free.
- Save locally before any network call.
- Prefer editing existing feature folders over inventing new top-level layers.
- `android/` / `ios/` are prebuild output — change `app.json` / plugins instead when possible.
