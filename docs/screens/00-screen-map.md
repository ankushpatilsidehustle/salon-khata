# 00 · Screen Map

The exhaustive index of every surface in Salon Khata. If a surface is not in this table, it does not exist.

IDs are reused verbatim from [../ux/03-screen-inventory.md](../ux/03-screen-inventory.md). Templates reference [../design-system/17-screen-templates.md](../design-system/17-screen-templates.md).

## Legend

- **Surface**: `S` screen · `M` full-screen modal · `BS` bottom sheet · `D` dialog · `Overlay` snackbar/toast · `State` visual state variant
- **Template**: `T1` Dashboard · `T2` List · `T3` Form (full screen) · `T4` Report · `T5` Settings · `T6` Bottom Sheet · `T7` Auth · `T8` Empty · `—` not a template surface
- **Priority**: `P0` golden path · `P1` core support · `P2` nice-to-have · `Post-MVP` scoped out
- **Spec**: link to the feature file section with the full spec

## Auth & Onboarding

| ID | Name | Surface | Template | Priority | Dependencies | Spec |
| --- | --- | --- | --- | --- | --- | --- |
| AUTH-01 | Splash | S | T7 (7a) | P0 | none | [03](03-auth-onboarding.md#auth-01--splash) |
| AUTH-02 | Language Picker | S | T7 | P0 | none | [03](03-auth-onboarding.md#auth-02--language-picker) |
| AUTH-03 | Mobile Number Entry | S | T7 (7b) | P0 | Firebase Auth configured | [03](03-auth-onboarding.md#auth-03--mobile-number-entry) |
| AUTH-04 | OTP Verification | S | T7 (7c) | P0 | AUTH-03 | [03](03-auth-onboarding.md#auth-04--otp-verification) |
| AUTH-05 | Business Setup | S | T7 (7d) | P0 | AUTH-04 succeeded | [03](03-auth-onboarding.md#auth-05--business-setup) |
| AUTH-06 | Restore Prompt | BS | T6 | P1 | AUTH-04 + cloud backup exists | [03](03-auth-onboarding.md#auth-06--restore-prompt) |

## Dashboard

| ID | Name | Surface | Template | Priority | Dependencies | Spec |
| --- | --- | --- | --- | --- | --- | --- |
| DASH-01 | Dashboard | S | T1 | P0 | AUTH-05, income repository | [04](04-dashboard.md#dash-01--dashboard) |
| DASH-01-EMPTY | Dashboard (empty state) | State | T1 + T8 inline | P0 | DASH-01 | [04](04-dashboard.md#dash-01-empty--empty-state) |
| DASH-01-LOADING | Dashboard (loading) | State | T1 skeletons | P0 | DASH-01 | [04](04-dashboard.md#dash-01-loading--loading-state) |
| DASH-01-OFFLINE | Dashboard (offline) | State | T1 | P0 | DASH-01 | [04](04-dashboard.md#dash-01-offline--offline-state) |
| DASH-01-SYNCING | Dashboard (syncing) | State | T1 | P2 | Sync engine live | [04](04-dashboard.md#dash-01-syncing--syncing-state) |

## Income Entry

| ID | Name | Surface | Template | Priority | Dependencies | Spec |
| --- | --- | --- | --- | --- | --- | --- |
| INC-01 | Income Entry | M | T3 | P0 | ≥1 Employee, ≥1 Service, Commission repo | [05](05-income-entry.md#inc-01--income-entry) |
| INC-02 | Select Employee | BS | T6 | P0 | INC-01 | [05](05-income-entry.md#inc-02--select-employee) |
| INC-03 | Select Services | BS | T6 | P0 | INC-01 | [05](05-income-entry.md#inc-03--select-services) |
| INC-04 | Discard Changes | D | — | P0 | INC-01 with dirty state | [05](05-income-entry.md#inc-04--discard-changes) |

## Entries Hub

| ID | Name | Surface | Template | Priority | Dependencies | Spec |
| --- | --- | --- | --- | --- | --- | --- |
| ENT-01 | Entries Hub | S | T5 (list variant) | P0 | AUTH-05 | [06](06-entries-hub.md#ent-01--entries-hub) |

## Employees

| ID | Name | Surface | Template | Priority | Dependencies | Spec |
| --- | --- | --- | --- | --- | --- | --- |
| EMP-01 | Employees List | S | T2 | P0 | employee repository | [07](07-employees.md#emp-01--employees-list) |
| EMP-01-EMPTY | Employees List (empty) | State | T8 | P0 | EMP-01 | [07](07-employees.md#emp-01-empty--empty-state) |
| EMP-01-LOADING | Employees List (loading) | State | T2 skeletons | P0 | EMP-01 | [07](07-employees.md#emp-01-loading--loading-state) |
| EMP-02 | Add Employee | BS | T6 | P0 | EMP-01 | [07](07-employees.md#emp-02--add-employee) |
| EMP-03 | Edit Employee | S | T3 | P1 | EMP-01 | [07](07-employees.md#emp-03--edit-employee) |
| EMP-04 | Employee Detail | BS | T6 (detail pattern) | P1 | EMP-01 | [07](07-employees.md#emp-04--employee-detail) |
| EMP-05 | Employee Search | BS | T6 | P2 | EMP-01 | [07](07-employees.md#emp-05--employee-search) |

## Services

| ID | Name | Surface | Template | Priority | Dependencies | Spec |
| --- | --- | --- | --- | --- | --- | --- |
| SRV-01 | Services List | S | T2 | P0 | service repository | [08](08-services.md#srv-01--services-list) |
| SRV-01-EMPTY | Services List (empty) | State | T8 | P0 | SRV-01 | [08](08-services.md#srv-01-empty--empty-state) |
| SRV-01-LOADING | Services List (loading) | State | T2 skeletons | P0 | SRV-01 | [08](08-services.md#srv-01-loading--loading-state) |
| SRV-02 | Add Service | BS | T6 | P0 | SRV-01 | [08](08-services.md#srv-02--add-service) |
| SRV-03 | Edit Service | S | T3 | P1 | SRV-01 | [08](08-services.md#srv-03--edit-service) |
| SRV-04 | Service Detail | BS | T6 (detail pattern) | P1 | SRV-01 | [08](08-services.md#srv-04--service-detail) |
| SRV-05 | Service Search | BS | T6 | P2 | SRV-01 | [08](08-services.md#srv-05--service-search) |

## Commission Rules

| ID | Name | Surface | Template | Priority | Dependencies | Spec |
| --- | --- | --- | --- | --- | --- | --- |
| COM-01 | Commission Employees List | S | T2 | P0 | ≥1 Employee | [09](09-commission-rules.md#com-01--commission-employees-list) |
| COM-01-EMPTY | Commission (empty) | State | T8 | P0 | COM-01 | [09](09-commission-rules.md#com-01-empty--empty-state) |
| COM-02 | Employee Commission Screen | S | T2 (with rule badges) | P0 | COM-01, ≥1 Service | [09](09-commission-rules.md#com-02--employee-commission-screen) |
| COM-03 | Edit Commission Rule | BS | T6 | P0 | COM-02 | [09](09-commission-rules.md#com-03--edit-commission-rule) |
| COM-04 | Apply-to-all Sheet | BS | T6 | Post-MVP | COM-02 | [09](09-commission-rules.md#com-04--apply-to-all-sheet-post-mvp) |

## Expenses

| ID | Name | Surface | Template | Priority | Dependencies | Spec |
| --- | --- | --- | --- | --- | --- | --- |
| EXP-01 | Expenses List | S | T2 | P1 | expense repository | [10](10-expenses.md#exp-01--expenses-list) |
| EXP-01-EMPTY | Expenses List (empty) | State | T8 | P1 | EXP-01 | [10](10-expenses.md#exp-01-empty--empty-state) |
| EXP-01-LOADING | Expenses List (loading) | State | T2 skeletons | P1 | EXP-01 | [10](10-expenses.md#exp-01-loading--loading-state) |
| EXP-02 | Add Expense | BS | T6 | P1 | EXP-01, default categories seeded | [10](10-expenses.md#exp-02--add-expense) |
| EXP-03 | Edit Expense | BS | T6 | P1 | EXP-01 | [10](10-expenses.md#exp-03--edit-expense) |
| EXP-04 | Expense Detail | BS | T6 (detail pattern) | P1 | EXP-01 | [10](10-expenses.md#exp-04--expense-detail) |
| EXP-05 | Category Selector | BS | T6 | P1 | seeded categories | [10](10-expenses.md#exp-05--category-selector) |
| EXP-06 | Category Manager | S | T2 | Post-MVP | EXP-05 | [10](10-expenses.md#exp-06--category-manager-post-mvp) |

## Reports

| ID | Name | Surface | Template | Priority | Dependencies | Spec |
| --- | --- | --- | --- | --- | --- | --- |
| REP-01 | Reports Root | S | T4 | P1 | report service | [11](11-reports.md#rep-01--reports-root) |
| REP-01-EMPTY | Reports (empty) | State | T8 | P1 | REP-01 | [11](11-reports.md#rep-01-empty--empty-state) |
| REP-01-LOADING | Reports (loading) | State | T4 skeletons | P1 | REP-01 | [11](11-reports.md#rep-01-loading--loading-state) |
| REP-02 | Daily Report | Tab in REP-01 | T4 | P1 | REP-01 | [11](11-reports.md#rep-02--daily-report) |
| REP-03 | Monthly Report | Tab in REP-01 | T4 | P2 | REP-01 | [11](11-reports.md#rep-03--monthly-report) |
| REP-04 | Employee Performance | S | T4 | P2 | REP-03 | [11](11-reports.md#rep-04--employee-performance) |
| REP-05 | Employee Detail Report | S | T4 | P2 | REP-04 | [11](11-reports.md#rep-05--employee-detail-report) |
| REP-06 | Service Performance | S | T4 | P2 | REP-03 | [11](11-reports.md#rep-06--service-performance) |
| REP-07 | Service Detail Report | S | T4 | P2 | REP-06 | [11](11-reports.md#rep-07--service-detail-report) |
| REP-08 | Transaction Detail | BS | T6 (detail pattern) | P1 | REP-02 or DASH-01 | [11](11-reports.md#rep-08--transaction-detail) |
| REP-09 | Filter Sheet | BS | T6 | P2 | REP-01 | [11](11-reports.md#rep-09--filter-sheet) |
| REP-10 | Month Picker | BS | T6 | P2 | REP-03 | [11](11-reports.md#rep-10--month-picker) |

## More & Settings

| ID | Name | Surface | Template | Priority | Dependencies | Spec |
| --- | --- | --- | --- | --- | --- | --- |
| MORE-01 | More Hub | S | T5 | P1 | AUTH-05 | [12](12-more-settings.md#more-01--more-hub) |
| SET-01 | Settings | S | T5 | P1 | MORE-01 | [12](12-more-settings.md#set-01--settings) |
| SET-02 | Business Profile | S | T3 | P1 | SET-01, settings repository | [12](12-more-settings.md#set-02--business-profile) |
| SET-03 | Language | S | T5 (list variant) | P1 | i18n live | [12](12-more-settings.md#set-03--language) |
| SET-04 | Backup & Restore | S | T5 | P2 | Sync engine live | [12](12-more-settings.md#set-04--backup--restore) |
| SET-05 | Restore Confirmation | D | — | P2 | SET-04 | [12](12-more-settings.md#set-05--restore-confirmation) |
| SET-06 | Restore Progress | S | T4 (progress) | P2 | SET-05 confirmed | [12](12-more-settings.md#set-06--restore-progress) |
| SET-07 | About | S | T5 | P2 | none | [12](12-more-settings.md#set-07--about) |
| SET-08 | Sign Out Confirmation | D | — | P1 | AUTH-04 succeeded | [12](12-more-settings.md#set-08--sign-out-confirmation) |
| SET-09 | Delete All Data | D | — | Post-MVP | SET-01 | [12](12-more-settings.md#set-09--delete-all-data-post-mvp) |
| DIAG-01 | Sync Status | S | T5 (with actions) | P2 | Sync engine live | [12](12-more-settings.md#diag-01--sync-status) |
| DIAG-02 | Audit Log | S | T2 | Post-MVP | Sync audit log live | [12](12-more-settings.md#diag-02--audit-log-post-mvp) |

## Global Overlays

| ID | Name | Surface | Template | Priority | Dependencies | Spec |
| --- | --- | --- | --- | --- | --- | --- |
| GLB-SNACK | Snackbar | Overlay | — | P0 | none | [13](13-global-overlays.md#glb-snack--snackbar) |
| GLB-TOAST-EXIT | Android exit hint | Overlay | — | P1 | DASH-01 | [13](13-global-overlays.md#glb-toast-exit--android-exit-hint) |
| GLB-DIALOG-DISCARD | Discard changes dialog | D | — | P0 | any form | [13](13-global-overlays.md#glb-dialog-discard--discard-changes) |
| GLB-DIALOG-DELETE | Delete confirmation dialog | D | — | P1 | any deletable with history | [13](13-global-overlays.md#glb-dialog-delete--delete-confirmation) |
| GLB-DIALOG-ERROR | Generic error dialog | D | — | P1 | fatal error handler | [13](13-global-overlays.md#glb-dialog-error--generic-error) |

## Ambiguities & Reconciliations

Recorded here rather than silently invented. Each entry cross-links to the conflicting sources.

| Ref | Item | Sources | Resolution |
| --- | --- | --- | --- |
| A1 | **Quick Setup screen** | Mentioned in [../screen-flow.md#first-launch](../screen-flow.md#first-launch); absent from [../ux/03-screen-inventory.md](../ux/03-screen-inventory.md) | **Not added.** [../ux/03-screen-inventory.md](../ux/03-screen-inventory.md) is the canonical inventory and it deliberately routes AUTH-05 straight to DASH-01. `Optional Quick Setup` in [../screen-flow.md](../screen-flow.md) is interpreted as the *empty-state guidance* on DASH-01 + EMP-01 + SRV-01, not a distinct screen. |
| A2 | **Category Manager (EXP-06)** | Flagged Post-MVP in [../ux/03-screen-inventory.md](../ux/03-screen-inventory.md#expenses); editable in [../ux/06-form-ux.md](../ux/06-form-ux.md); default categories seeded per [../business-workflows.md#expense-entry](../business-workflows.md#expense-entry) | **EXP-06 stays Post-MVP.** MVP ships default categories and the `+ New` inline option in EXP-05. No management screen. |
| A3 | **Audit Log UI (DIAG-02)** | Sync-side audit log defined in [../sync-engine.md](../sync-engine.md); [../ux/12-offline-ux.md#conflict-resolution](../ux/12-offline-ux.md#conflict-resolution) says no user-facing UI in MVP | **DIAG-02 stays Post-MVP.** Audit log is written but not surfaced. |
| A4 | **Delete All Data (SET-09)** | Post-MVP per [../ux/03-screen-inventory.md](../ux/03-screen-inventory.md#settings) | **SET-09 stays Post-MVP.** |
| A5 | **Employee delete flavor** | [../ux/06-form-ux.md#deleting-data](../ux/06-form-ux.md#deleting-data) defines two flavors (fresh + with-history) | **Implemented in EMP-03 spec.** Undo snackbar for fresh; confirm dialog (GLB-DIALOG-DELETE) if any transactions reference the employee. Same pattern for SRV-03. |

## Non-Existent Screens (explicitly excluded from MVP)

Repeated from [../ux/03-screen-inventory.md#non-existent-screens-explicitly-out-of-scope-for-mvp](../ux/03-screen-inventory.md#non-existent-screens-explicitly-out-of-scope-for-mvp) for enforcement:

- Notifications inbox
- Chat / messaging
- Customer profile
- Invoicing
- Payment gateway integration
- Analytics dashboard beyond Reports
- Loyalty programs
- Appointment booking
- Multi-branch management UI
- Role-based access management UI
- Onboarding tour / feature discovery carousels
- Rate-the-app cards
- In-app promotions

## Screen Count Summary

| Category | Screens | States | Sheets | Dialogs | Overlays | Total |
| --- | --- | --- | --- | --- | --- | --- |
| Auth & Onboarding | 5 | 0 | 1 | 0 | 0 | 6 |
| Dashboard | 1 | 4 | 0 | 0 | 0 | 5 |
| Income Entry | 0 | 0 | 2 | 1 | 0 | 3 + INC-01 (M) = 4 |
| Entries Hub | 1 | 0 | 0 | 0 | 0 | 1 |
| Employees | 2 | 2 | 3 | 0 | 0 | 7 |
| Services | 2 | 2 | 3 | 0 | 0 | 7 |
| Commission | 2 | 1 | 1 (+1 Post-MVP) | 0 | 0 | 4 (5 with Post-MVP) |
| Expenses | 1 | 2 | 4 (+1 screen Post-MVP) | 0 | 0 | 7 (8 with Post-MVP) |
| Reports | 6 | 2 | 3 | 0 | 0 | 11 |
| More & Settings | 6 | 0 | 0 | 3 (+1 Post-MVP) | 0 | 9 (10 with Post-MVP) |
| Diagnostics | 1 (+1 Post-MVP) | 0 | 0 | 0 | 0 | 1 (2 with Post-MVP) |
| Global Overlays | 0 | 0 | 0 | 3 | 2 | 5 |
| **MVP total** | | | | | | **~63 surfaces** |

The count matches [../ux/03-screen-inventory.md#screen-count-summary](../ux/03-screen-inventory.md#screen-count-summary) (~59) plus explicit state variants surfaced here.
