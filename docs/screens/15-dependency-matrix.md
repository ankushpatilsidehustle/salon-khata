# 15 · Dependency Matrix

Every screen × the prerequisites it needs to be functional. If a prerequisite is missing, the screen either does not render, renders in its empty state, or degrades gracefully — the matrix says which.

Dependency legend:

- `✓` — hard dependency (screen cannot function without it).
- `∅` — soft dependency (screen renders but shows its empty state or degraded content).
- `—` — no dependency.

Prerequisite legend:

| Column | Meaning |
| --- | --- |
| **Auth** | AUTH-04 completed; valid session token present. |
| **BusSet** | AUTH-05 completed; `settings.business_name` populated. |
| **Migrate** | SQLite migrations run to current schema version. |
| **EmpRepo** | Employee repository ready + `employees` table present. |
| **SrvRepo** | Service repository ready + `services` table present. |
| **≥1 Emp** | At least one non-deleted, active employee exists. |
| **≥1 Srv** | At least one non-deleted, active service exists. |
| **ComRepo** | Commission repository ready + `commission_rules` table present. |
| **IncRepo** | Income repository ready + `transactions` + `transaction_items` tables present. |
| **ExpRepo** | Expense repository ready + `expenses` + `expense_categories` tables present. |
| **SetRepo** | Settings repository ready + `settings` table present. |
| **RepSvc** | Report service ready (aggregation queries). |
| **Sync** | Sync engine wired end-to-end (backup, restore, retry). |
| **i18n** | i18n framework loaded with at least one locale bundle. |
| **Net** | Live network required for the operation. |

## Matrix

| Screen | Auth | BusSet | Migrate | EmpRepo | SrvRepo | ≥1 Emp | ≥1 Srv | ComRepo | IncRepo | ExpRepo | SetRepo | RepSvc | Sync | i18n | Net |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| AUTH-01 Splash | — | — | ✓ | — | — | — | — | — | — | — | ✓ | — | — | ✓ | — |
| AUTH-02 Language Picker | — | — | — | — | — | — | — | — | — | — | ✓ | — | — | ✓ | — |
| AUTH-03 Mobile Number | — | — | — | — | — | — | — | — | — | — | — | — | — | ✓ | ✓ |
| AUTH-04 OTP | — | — | — | — | — | — | — | — | — | — | — | — | — | ✓ | ✓ |
| AUTH-05 Business Setup | ✓ | — | ✓ | — | — | — | — | — | — | — | ✓ | — | — | ✓ | — |
| AUTH-06 Restore Prompt | ✓ | — | ✓ | — | — | — | — | — | — | — | — | — | ✓ | ✓ | ✓ |
| DASH-01 Dashboard | ✓ | ✓ | ✓ | — | — | — | — | — | ∅ | ∅ | ✓ | ✓ | — | ✓ | — |
| DASH-01-EMPTY | ✓ | ✓ | ✓ | — | — | — | — | — | — | — | ✓ | — | — | ✓ | — |
| DASH-01-LOADING | ✓ | ✓ | ✓ | — | — | — | — | — | — | — | ✓ | — | — | ✓ | — |
| DASH-01-OFFLINE | ✓ | ✓ | ✓ | — | — | — | — | — | ∅ | ∅ | ✓ | ✓ | — | ✓ | — |
| DASH-01-SYNCING | ✓ | ✓ | ✓ | — | — | — | — | — | ∅ | ∅ | ✓ | ✓ | ✓ | ✓ | — |
| INC-01 Income Entry | ✓ | ✓ | ✓ | ✓ | ✓ | ∅ | ∅ | ✓ | ✓ | — | ✓ | — | — | ✓ | — |
| INC-02 Select Employee | ✓ | ✓ | ✓ | ✓ | — | ∅ | — | — | — | — | — | — | — | ✓ | — |
| INC-03 Select Services | ✓ | ✓ | ✓ | — | ✓ | — | ∅ | — | — | — | — | — | — | ✓ | — |
| INC-04 Discard | ✓ | ✓ | — | — | — | — | — | — | — | — | — | — | — | ✓ | — |
| ENT-01 Entries Hub | ✓ | ✓ | ✓ | — | — | — | — | — | — | — | ✓ | — | — | ✓ | — |
| EMP-01 Employees List | ✓ | ✓ | ✓ | ✓ | — | ∅ | — | — | — | — | — | — | — | ✓ | — |
| EMP-01-EMPTY | ✓ | ✓ | ✓ | ✓ | — | — | — | — | — | — | — | — | — | ✓ | — |
| EMP-01-LOADING | ✓ | ✓ | ✓ | ✓ | — | — | — | — | — | — | — | — | — | ✓ | — |
| EMP-02 Add Employee | ✓ | ✓ | ✓ | ✓ | — | — | — | — | — | — | — | — | — | ✓ | — |
| EMP-03 Edit Employee | ✓ | ✓ | ✓ | ✓ | — | ✓ | — | — | ∅ | — | — | — | — | ✓ | — |
| EMP-04 Employee Detail | ✓ | ✓ | ✓ | ✓ | — | ✓ | — | — | ∅ | — | — | — | — | ✓ | — |
| EMP-05 Employee Search | ✓ | ✓ | ✓ | ✓ | — | ∅ | — | — | — | — | — | — | — | ✓ | — |
| SRV-01 Services List | ✓ | ✓ | ✓ | — | ✓ | — | ∅ | — | — | — | — | — | — | ✓ | — |
| SRV-01-EMPTY | ✓ | ✓ | ✓ | — | ✓ | — | — | — | — | — | — | — | — | ✓ | — |
| SRV-01-LOADING | ✓ | ✓ | ✓ | — | ✓ | — | — | — | — | — | — | — | — | ✓ | — |
| SRV-02 Add Service | ✓ | ✓ | ✓ | — | ✓ | — | — | — | — | — | — | — | — | ✓ | — |
| SRV-03 Edit Service | ✓ | ✓ | ✓ | — | ✓ | — | ✓ | — | ∅ | — | — | — | — | ✓ | — |
| SRV-04 Service Detail | ✓ | ✓ | ✓ | — | ✓ | — | ✓ | — | ∅ | — | — | — | — | ✓ | — |
| SRV-05 Service Search | ✓ | ✓ | ✓ | — | ✓ | — | ∅ | — | — | — | — | — | — | ✓ | — |
| COM-01 Commission Employees | ✓ | ✓ | ✓ | ✓ | — | ∅ | — | ✓ | — | — | — | — | — | ✓ | — |
| COM-01-EMPTY | ✓ | ✓ | ✓ | ✓ | — | — | — | — | — | — | — | — | — | ✓ | — |
| COM-02 Employee Commission | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ∅ | ✓ | — | — | — | — | — | ✓ | — |
| COM-03 Edit Commission Rule | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | — | — | — | — | ✓ | — |
| EXP-01 Expenses List | ✓ | ✓ | ✓ | — | — | — | — | — | — | ✓ | — | — | — | ✓ | — |
| EXP-01-EMPTY | ✓ | ✓ | ✓ | — | — | — | — | — | — | ✓ | — | — | — | ✓ | — |
| EXP-01-LOADING | ✓ | ✓ | ✓ | — | — | — | — | — | — | ✓ | — | — | — | ✓ | — |
| EXP-02 Add Expense | ✓ | ✓ | ✓ | — | — | — | — | — | — | ✓ | — | — | — | ✓ | — |
| EXP-03 Edit Expense | ✓ | ✓ | ✓ | — | — | — | — | — | — | ✓ | — | — | — | ✓ | — |
| EXP-04 Expense Detail | ✓ | ✓ | ✓ | — | — | — | — | — | — | ✓ | — | — | — | ✓ | — |
| EXP-05 Category Selector | ✓ | ✓ | ✓ | — | — | — | — | — | — | ✓ | — | — | — | ✓ | — |
| REP-01 Reports Root | ✓ | ✓ | ✓ | — | — | — | — | — | ∅ | ∅ | — | ✓ | — | ✓ | — |
| REP-01-EMPTY | ✓ | ✓ | ✓ | — | — | — | — | — | — | — | — | ✓ | — | ✓ | — |
| REP-01-LOADING | ✓ | ✓ | ✓ | — | — | — | — | — | — | — | — | ✓ | — | ✓ | — |
| REP-02 Daily Report | ✓ | ✓ | ✓ | — | — | — | — | — | ∅ | ∅ | — | ✓ | — | ✓ | — |
| REP-03 Monthly Report | ✓ | ✓ | ✓ | — | — | — | — | — | ∅ | ∅ | — | ✓ | — | ✓ | — |
| REP-04 Employee Performance | ✓ | ✓ | ✓ | ✓ | — | ∅ | — | ✓ | ∅ | — | — | ✓ | — | ✓ | — |
| REP-05 Employee Detail Report | ✓ | ✓ | ✓ | ✓ | — | ✓ | — | ✓ | ∅ | — | — | ✓ | — | ✓ | — |
| REP-06 Service Performance | ✓ | ✓ | ✓ | — | ✓ | — | ∅ | — | ∅ | — | — | ✓ | — | ✓ | — |
| REP-07 Service Detail Report | ✓ | ✓ | ✓ | — | ✓ | — | ✓ | — | ∅ | — | — | ✓ | — | ✓ | — |
| REP-08 Transaction Detail | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | ✓ | — | — | — | — | ✓ | — |
| REP-09 Filter Sheet | ✓ | ✓ | ✓ | — | — | — | — | — | — | — | — | — | — | ✓ | — |
| REP-10 Month Picker | ✓ | ✓ | ✓ | — | — | — | — | — | — | — | — | — | — | ✓ | — |
| MORE-01 More Hub | ✓ | ✓ | ✓ | — | — | — | — | — | — | — | ✓ | — | — | ✓ | — |
| SET-01 Settings | ✓ | ✓ | ✓ | — | — | — | — | — | — | — | ✓ | — | ∅ | ✓ | — |
| SET-02 Business Profile | ✓ | ✓ | ✓ | — | — | — | — | — | — | — | ✓ | — | — | ✓ | — |
| SET-03 Language | ✓ | ✓ | ✓ | — | — | — | — | — | — | — | ✓ | — | — | ✓ | — |
| SET-04 Backup & Restore | ✓ | ✓ | ✓ | — | — | — | — | — | — | — | ✓ | — | ✓ | ✓ | ∅ |
| SET-05 Restore Confirmation | ✓ | ✓ | ✓ | — | — | — | — | — | — | — | — | — | ✓ | ✓ | ✓ |
| SET-06 Restore Progress | ✓ | ✓ | ✓ | — | — | — | — | — | — | — | — | — | ✓ | ✓ | ✓ |
| SET-07 About | ✓ | ✓ | — | — | — | — | — | — | — | — | — | — | — | ✓ | — |
| SET-08 Sign Out Confirmation | ✓ | ✓ | — | — | — | — | — | — | — | — | — | — | — | ✓ | — |
| DIAG-01 Sync Status | ✓ | ✓ | ✓ | — | — | — | — | — | — | — | — | — | ✓ | ✓ | — |
| GLB-SNACK Snackbar | — | — | — | — | — | — | — | — | — | — | — | — | — | ✓ | — |
| GLB-TOAST-EXIT | — | — | — | — | — | — | — | — | — | — | — | — | — | ✓ | — |
| GLB-DIALOG-DISCARD | — | — | — | — | — | — | — | — | — | — | — | — | — | ✓ | — |
| GLB-DIALOG-DELETE | — | — | — | — | — | — | — | — | — | — | — | — | — | ✓ | — |
| GLB-DIALOG-ERROR | — | — | — | — | — | — | — | — | — | — | — | — | — | ✓ | — |

## How To Read A Row

- `✓` in a column means the screen **will not function** without that prerequisite. Build it earlier.
- `∅` in a column means the screen renders but shows an empty state or degrades. This is expected — INC-01 with no employees renders and routes into inline `+ Add employee` per [Flow 4a](../ux/04-screen-flows.md#flow-4a--inline-add-missing-employee-during-income-entry).
- `—` means the screen is agnostic to that prerequisite.

## Notable Chains

- **Golden path**: Auth → BusSet → EmpRepo + ≥1 Emp → SrvRepo + ≥1 Srv → ComRepo → IncRepo → RepSvc → DASH-01 + INC-01.
- **Reports depth**: RepSvc + IncRepo + ExpRepo + ComRepo → REP-* (any). REP-04/REP-05 add EmpRepo; REP-06/REP-07 add SrvRepo.
- **Sync surfaces**: Sync engine live + Net → SET-04 / SET-05 / SET-06 / AUTH-06.
- **Global overlays**: only i18n. Deliberately universal so any screen can invoke them.

## What Blocks What

| If this is missing | These screens degrade to empty state | These screens are unreachable / broken |
| --- | --- | --- |
| BusSet | — | Everything after AUTH-05 |
| ≥1 Emp | INC-02 shows inline add; COM-01 empty; REP-04 empty | INC-01 cannot Save until an employee is picked (which triggers inline add) |
| ≥1 Srv | INC-03 shows inline add; COM-02 empty; REP-06 empty | INC-01 cannot Save until at least one service is picked |
| ComRepo | INC-01 commission = 0 (degraded) | COM-01, COM-02, COM-03 broken |
| RepSvc | REP-* empty; DASH-01 aggregates missing | REP-* not shippable |
| Sync engine | DASH-01 sync line frozen; SET-04 cannot Backup now / Restore | AUTH-06, SET-04, SET-05, SET-06, DIAG-01 |
| Net | AUTH-03 / AUTH-04 cannot send/verify OTP; manual backup/restore blocked | Cold-start auth flows fail with blocking dialog per [10-error-ux.md#tier-blocking-auth](../ux/10-error-ux.md#tier-blocking-auth) |

## Cross-Reference

Build order that respects this matrix: see [14-implementation-order.md](14-implementation-order.md).
