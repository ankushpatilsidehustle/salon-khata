# 14 · Implementation Order

The build sequence for every screen in [00-screen-map.md](00-screen-map.md). Ordered by dependency, not preference. Aligned with [../roadmap.md#phase-10-application-development](../roadmap.md#phase-10-application-development).

## Guiding Rule

Each wave depends only on earlier waves. If a later wave requires an earlier wave's screen to be functional, the earlier wave lists it.

## Priorities Explained

| Priority | Meaning |
| --- | --- |
| `P0` | Blocks the golden path (record income offline in ≤ 10 s) |
| `P1` | Core support required for a usable MVP (expenses, daily reports, settings basics) |
| `P2` | Nice-to-have completeness (search, monthly reports, backup/restore surfaces) |
| `Post-MVP` | Listed but not spec'd; belongs on the [roadmap](../roadmap.md) |

## Wave Overview

| Wave | Theme | Priority | Enables |
| --- | --- | --- | --- |
| 0 | Foundations (non-UI) | — | Every wave |
| 1 | Auth & first-run | `P0` | Wave 2 |
| 2 | Entities (Employees + Services) | `P0` | Wave 3 |
| 3 | Commission | `P0` | Wave 4 |
| 4 | Golden path (Dashboard + Income) | `P0` | MVP complete for the core value proposition |
| 5 | Expenses + Daily Report | `P1` | Wave 6 |
| 6 | More & Settings basics | `P1` | Wave 7 |
| 7 | Reports polish | `P2` | Wave 8 |
| 8 | Sync surfaces (Backup/Restore/Diagnostics) | `P2` | MVP launch complete |
| 9 | Search & polish | `P2` | Ship |
| ∞ | Post-MVP | `Post-MVP` | On roadmap only |

## Wave 0 · Foundations (non-UI)

These are prerequisites, not screens. Listed for completeness — they align with [../roadmap.md](../roadmap.md) Phases 3–6.

- SQLite migrations ([../database/migrations/001-initial-schema.ts](../../src/database/migrations/001-initial-schema.ts)).
- Repositories: employee, service, commission, income, expense, settings.
- Domain services: dates, money, commission-service, report-service.
- i18n bootstrap; English strings only in MVP wave 0.
- Design System primitives already scaffolded ([../src/components/core/](../../src/components/core/), [../src/components/domain/](../../src/components/domain/)).
- Sync engine skeleton ([../src/sync/sync-engine.ts](../../src/sync/sync-engine.ts)) — not wired to UI yet.

**Exit criteria**: unit tests for repositories pass; `npm run typecheck` clean.

## Wave 1 · Auth & First-Run (P0)

Screens:

- [AUTH-01](03-auth-onboarding.md#auth-01--splash)
- [AUTH-02](03-auth-onboarding.md#auth-02--language-picker)
- [AUTH-03](03-auth-onboarding.md#auth-03--mobile-number-entry)
- [AUTH-04](03-auth-onboarding.md#auth-04--otp-verification)
- [AUTH-05](03-auth-onboarding.md#auth-05--business-setup)

**Dependencies met by Wave 0.** Adds Firebase Auth wiring.

**Exit criteria**: a first-launch user reaches DASH-01-EMPTY (empty state placeholder OK — DASH-01 comes in Wave 4).

## Wave 2 · Entities: Employees + Services (P0)

Screens (Employees):

- [EMP-01](07-employees.md#emp-01--employees-list) + [EMP-01-EMPTY](07-employees.md#emp-01-empty--empty-state) + [EMP-01-LOADING](07-employees.md#emp-01-loading--loading-state)
- [EMP-02](07-employees.md#emp-02--add-employee)

Screens (Services):

- [SRV-01](08-services.md#srv-01--services-list) + [SRV-01-EMPTY](08-services.md#srv-01-empty--empty-state) + [SRV-01-LOADING](08-services.md#srv-01-loading--loading-state)
- [SRV-02](08-services.md#srv-02--add-service)

Also:

- [ENT-01](06-entries-hub.md#ent-01--entries-hub) (needed as tab root)
- [GLB-SNACK](13-global-overlays.md#glb-snack--snackbar) (needed for save feedback)
- [GLB-DIALOG-DISCARD](13-global-overlays.md#glb-dialog-discard--discard-changes) (needed for EMP-02 / SRV-02 dirty close)

**Dependencies**: Wave 1 + Wave 0 repositories.

**Deferred to Wave 6**: EMP-03 (Edit), EMP-04 (Detail), SRV-03, SRV-04. MVP owner can Add but not Edit yet — acceptable for internal alpha.

**Exit criteria**: A user can add employees and services from ENT-01.

## Wave 3 · Commission (P0)

Screens:

- [COM-01](09-commission-rules.md#com-01--commission-employees-list) + [COM-01-EMPTY](09-commission-rules.md#com-01-empty--empty-state)
- [COM-02](09-commission-rules.md#com-02--employee-commission-screen)
- [COM-03](09-commission-rules.md#com-03--edit-commission-rule)

**Dependencies**: Wave 2 (≥ 1 Employee + ≥ 1 Service).

**Exit criteria**: A user can configure `%` or `₹` commission for any (employee, service) pair.

## Wave 4 · Golden Path: Dashboard + Income (P0)

Screens:

- [DASH-01](04-dashboard.md#dash-01--dashboard) + [DASH-01-EMPTY](04-dashboard.md#dash-01-empty--empty-state) + [DASH-01-LOADING](04-dashboard.md#dash-01-loading--loading-state) + [DASH-01-OFFLINE](04-dashboard.md#dash-01-offline--offline-state)
- [INC-01](05-income-entry.md#inc-01--income-entry)
- [INC-02](05-income-entry.md#inc-02--select-employee)
- [INC-03](05-income-entry.md#inc-03--select-services)
- [INC-04](05-income-entry.md#inc-04--discard-changes)

**Dependencies**: Wave 3 (rules power auto-commission), Wave 2 (populated selectors), Wave 1 (auth), Wave 0 (repositories, sync outbox).

**Exit criteria**: Owner records a customer in ≤ 10 seconds offline; Dashboard hero updates immediately; GLB-SNACK `Saved · Add another` appears.

**This wave ships the product value.** Everything after is polish and coverage.

## Wave 5 · Expenses + Daily Report (P1)

Screens (Expenses):

- [EXP-01](10-expenses.md#exp-01--expenses-list) + [EXP-01-EMPTY](10-expenses.md#exp-01-empty--empty-state) + [EXP-01-LOADING](10-expenses.md#exp-01-loading--loading-state)
- [EXP-02](10-expenses.md#exp-02--add-expense)
- [EXP-05](10-expenses.md#exp-05--category-selector)

Screens (Reports):

- [REP-01](11-reports.md#rep-01--reports-root) + [REP-01-EMPTY](11-reports.md#rep-01-empty--empty-state) + [REP-01-LOADING](11-reports.md#rep-01-loading--loading-state)
- [REP-02](11-reports.md#rep-02--daily-report)
- [REP-08](11-reports.md#rep-08--transaction-detail)

**Dependencies**: Wave 4 (Dashboard hosts `Add expense` ghost; REP-02 reads transactions from Wave 4).

**Also required**: seed default expense categories on first migration.

**Exit criteria**: Owner captures the full picture of a business day — income + expenses + daily view.

## Wave 6 · More & Settings Basics (P1)

Screens (More & Settings):

- [MORE-01](12-more-settings.md#more-01--more-hub)
- [SET-01](12-more-settings.md#set-01--settings)
- [SET-02](12-more-settings.md#set-02--business-profile)
- [SET-03](12-more-settings.md#set-03--language) (requires additional locale files beyond `en` — track in i18n backlog)
- [SET-08](12-more-settings.md#set-08--sign-out-confirmation)

Entity edit / detail sheets (deferred from Waves 2, 5):

- [EMP-03](07-employees.md#emp-03--edit-employee), [EMP-04](07-employees.md#emp-04--employee-detail)
- [SRV-03](08-services.md#srv-03--edit-service), [SRV-04](08-services.md#srv-04--service-detail)
- [EXP-03](10-expenses.md#exp-03--edit-expense), [EXP-04](10-expenses.md#exp-04--expense-detail)
- [GLB-DIALOG-DELETE](13-global-overlays.md#glb-dialog-delete--delete-confirmation) (needed for EMP/SRV delete with history)
- [GLB-TOAST-EXIT](13-global-overlays.md#glb-toast-exit--android-exit-hint)
- [GLB-DIALOG-ERROR](13-global-overlays.md#glb-dialog-error--generic-error) (global error boundary)

**Dependencies**: Wave 5 (full CRUD context for entities).

**Exit criteria**: Owner edits or removes any entity; changes business profile; switches language; signs out safely.

## Wave 7 · Reports Polish (P2)

Screens:

- [REP-03](11-reports.md#rep-03--monthly-report)
- [REP-04](11-reports.md#rep-04--employee-performance)
- [REP-05](11-reports.md#rep-05--employee-detail-report)
- [REP-06](11-reports.md#rep-06--service-performance)
- [REP-07](11-reports.md#rep-07--service-detail-report)
- [REP-09](11-reports.md#rep-09--filter-sheet)
- [REP-10](11-reports.md#rep-10--month-picker)

**Dependencies**: Wave 5 (Daily Report + Transaction Detail).

**Exit criteria**: Owner sees monthly performance, drills into per-employee and per-service breakdowns.

## Wave 8 · Sync Surfaces (P2)

Screens:

- [AUTH-06](03-auth-onboarding.md#auth-06--restore-prompt)
- [SET-04](12-more-settings.md#set-04--backup--restore)
- [SET-05](12-more-settings.md#set-05--restore-confirmation)
- [SET-06](12-more-settings.md#set-06--restore-progress)
- [SET-07](12-more-settings.md#set-07--about)
- [DIAG-01](12-more-settings.md#diag-01--sync-status)
- [DASH-01-SYNCING](04-dashboard.md#dash-01-syncing--syncing-state) (wire the sync line to the engine)

**Dependencies**: Full sync engine wired end-to-end (backup on debounce, restore atomic, retry logic).

**Exit criteria**: Restore-on-new-device works; manual backup/restore visible; sync diagnostics accessible.

## Wave 9 · Search & Polish (P2)

Screens:

- [EMP-05](07-employees.md#emp-05--employee-search)
- [SRV-05](08-services.md#srv-05--service-search)

**Dependencies**: Wave 2.

**Also in this wave**: performance passes on low-end Android per [../roadmap.md#phase-12-optimization](../roadmap.md#phase-12-optimization); accessibility QA per [../ux/16-ux-review-checklist.md](../ux/16-ux-review-checklist.md); design QA per [../design-system/18-design-qa-checklist.md](../design-system/18-design-qa-checklist.md).

## Post-MVP (No Wave)

Explicitly not scheduled; documented for lineage:

- [COM-04](09-commission-rules.md#com-04--apply-to-all-sheet-post-mvp)
- [EXP-06](10-expenses.md#exp-06--category-manager-post-mvp)
- [SET-09](12-more-settings.md#set-09--delete-all-data-post-mvp)
- [DIAG-02](12-more-settings.md#diag-02--audit-log-post-mvp)

Also excluded per [00-screen-map.md#non-existent-screens-explicitly-excluded-from-mvp](00-screen-map.md#non-existent-screens-explicitly-excluded-from-mvp).

## Dependency Rules Recap

1. No wave depends on a later wave.
2. Wave 4 (golden path) requires Waves 1–3 to be functional, not just present.
3. Sync UI (Wave 8) requires the sync engine to have been live in the background since Wave 0; Wave 8 only *surfaces* it.
4. Post-MVP items are never promoted mid-wave without updating this document and [00-screen-map.md](00-screen-map.md).

## Minimum Viable Wave-4 Cut

If time constrains before Wave 4 completion, the smallest shippable path is:

```
Wave 0 → Wave 1 → Wave 2 → Wave 3 → Wave 4
```

That is the smallest set that delivers the Prime Directive. Everything else can slip to a subsequent release.
