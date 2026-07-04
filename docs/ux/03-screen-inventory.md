# 03 · Screen Inventory

The exhaustive list of every screen, sheet, dialog, and state in Salon Khata MVP. If a screen is not listed here, it does not exist.

Legend:

- **S** = full screen
- **M** = full-screen modal (has close `x`)
- **BS** = bottom sheet
- **D** = dialog
- **State** = a visual state within a screen (empty / loading / error)

## Auth

| ID | Name | Type | Purpose |
| --- | --- | --- | --- |
| AUTH-01 | Splash | S | Brand splash, session check, route to auth or main |
| AUTH-02 | Language Picker | S | First-launch language selection |
| AUTH-03 | Mobile Number Entry | S | Enter 10-digit mobile |
| AUTH-04 | OTP Verification | S | 6-digit OTP with resend |
| AUTH-05 | Business Setup | S | Business name (required), owner name (optional) |
| AUTH-06 | Restore Prompt | BS | (First login on new device) Restore from cloud yes/no |

## Dashboard tab

| ID | Name | Type | Purpose |
| --- | --- | --- | --- |
| DASH-01 | Dashboard | S | Today's totals, recent transactions, quick actions |
| DASH-01-EMPTY | Dashboard (empty) | State | First-time state with `Add your first income` |
| DASH-01-LOADING | Dashboard (loading) | State | Skeleton cards on first load |
| DASH-01-OFFLINE | Dashboard (offline) | State | Data intact; subtle offline indicator only |
| DASH-01-SYNCING | Dashboard (syncing) | State | Subtle sync indicator in footer line |

## Entries tab

### Hub

| ID | Name | Type | Purpose |
| --- | --- | --- | --- |
| ENT-01 | Entries Hub | S | Menu: Employees / Services / Commission / Expenses |

### Employees

| ID | Name | Type | Purpose |
| --- | --- | --- | --- |
| EMP-01 | Employees List | S | List of employees, grouped by Active/Inactive |
| EMP-01-EMPTY | Employees List (empty) | State | `No employees yet` |
| EMP-01-LOADING | Employees List (loading) | State | Row skeletons |
| EMP-02 | Add Employee | BS | Name + mobile (optional) |
| EMP-03 | Edit Employee | S | Name + mobile + Active toggle + Delete |
| EMP-04 | Employee Detail | BS | Read-only detail with `Edit` and `Delete` |
| EMP-05 | Employee Search | BS | Search across employees (invoked from list app bar) |

### Services

| ID | Name | Type | Purpose |
| --- | --- | --- | --- |
| SRV-01 | Services List | S | List of services, grouped by Active/Inactive |
| SRV-01-EMPTY | Services List (empty) | State | `No services yet` |
| SRV-01-LOADING | Services List (loading) | State | Row skeletons |
| SRV-02 | Add Service | BS | Name + price |
| SRV-03 | Edit Service | S | Name + price + Active toggle + Delete |
| SRV-04 | Service Detail | BS | Read-only with `Edit` and `Delete` |
| SRV-05 | Service Search | BS | Search across services |

### Commission

| ID | Name | Type | Purpose |
| --- | --- | --- | --- |
| COM-01 | Commission Employees List | S | Employees list — tap to configure |
| COM-01-EMPTY | Commission (empty) | State | `No employees yet` with `Add employee` action |
| COM-02 | Employee Commission Screen | S | List of services with per-service rule badge |
| COM-03 | Edit Commission Rule | BS | Segmented control (% / ₹) + value |
| COM-04 | Apply-to-all Sheet | BS | (Post-MVP) Bulk apply a rule |

### Expenses

| ID | Name | Type | Purpose |
| --- | --- | --- | --- |
| EXP-01 | Expenses List | S | List of expenses, grouped by date |
| EXP-01-EMPTY | Expenses List (empty) | State | `No expenses recorded today` |
| EXP-01-LOADING | Expenses List (loading) | State | Row skeletons |
| EXP-02 | Add Expense | BS | Category + amount + date + remarks |
| EXP-03 | Edit Expense | BS | Same fields, pre-filled |
| EXP-04 | Expense Detail | BS | Read-only with `Edit` and `Delete` |
| EXP-05 | Category Selector | BS | Category chips + `New` option |
| EXP-06 | Category Manager | S | (Post-MVP) Add / edit / archive categories |

## Reports tab

| ID | Name | Type | Purpose |
| --- | --- | --- | --- |
| REP-01 | Reports Root | S | Segmented control Daily/Monthly + summary cards |
| REP-01-EMPTY | Reports (empty) | State | `No data yet` with `Add income` action |
| REP-01-LOADING | Reports (loading) | State | Card skeletons |
| REP-02 | Daily Report | Tab | Today's income, expenses, net, transactions list |
| REP-03 | Monthly Report | Tab | Month totals, top employees, top services, daily bar |
| REP-04 | Employee Performance | S | Per-employee list with commission + tx count |
| REP-05 | Employee Detail Report | S | Selected employee: per-day breakdown |
| REP-06 | Service Performance | S | Per-service list with revenue + count |
| REP-07 | Service Detail Report | S | Selected service: per-day breakdown |
| REP-08 | Transaction Detail | BS | Full transaction: employee, services, amount, commission, payment mode, timestamp + `Edit` + `Delete` |
| REP-09 | Filter Sheet | BS | Date range presets + custom |
| REP-10 | Month Picker | BS | Month + year picker |

## Income Entry (invoked from Dashboard FAB)

| ID | Name | Type | Purpose |
| --- | --- | --- | --- |
| INC-01 | Income Entry | M | Full-screen: employee, services, amount (computed), commission (computed), payment mode, save |
| INC-02 | Select Employee | BS | Recent + search + `Add employee` inline |
| INC-03 | Select Services | BS | Recent + search + multi-select + `Add service` inline |
| INC-04 | Discard Changes | D | Shown on close with unsaved data |

## More tab

### Hub

| ID | Name | Type | Purpose |
| --- | --- | --- | --- |
| MORE-01 | More Hub | S | List: Settings, Backup & Restore, Language, About, Sign out |

### Settings

| ID | Name | Type | Purpose |
| --- | --- | --- | --- |
| SET-01 | Settings | S | Business, Data, Account, About sections |
| SET-02 | Business Profile | S | Business name, owner name, currency |
| SET-03 | Language | S | Language picker (7 options) |
| SET-04 | Backup & Restore | S | Backup status, backup now, restore |
| SET-05 | Restore Confirmation | D | Destructive confirmation |
| SET-06 | Restore Progress | S | Linear progress with cancel |
| SET-07 | About | S | Version, terms, privacy |
| SET-08 | Sign Out Confirmation | D | Destructive confirmation |
| SET-09 | Delete All Data | D | (Post-MVP) Nuclear reset |

### Diagnostics

| ID | Name | Type | Purpose |
| --- | --- | --- | --- |
| DIAG-01 | Sync Status | S | Pending items, last sync, retry, error log |
| DIAG-02 | Audit Log | S | (Post-MVP) Recent edits and deletions |

## Global Overlays

| ID | Name | Type | Purpose |
| --- | --- | --- | --- |
| SNACK | Snackbar | Overlay | Success, undo, error messages |
| TOAST-EXIT | Android exit hint | Overlay | `Press back again to exit` |
| DIALOG-DISCARD | Discard changes | D | Reusable across all forms |
| DIALOG-DELETE | Delete confirmation | D | Reusable across all destructive actions with history |
| DIALOG-ERROR | Generic error | D | Reserved for unrecoverable errors |

## Universal States (must exist per module)

Every list module (Employees, Services, Expenses, Transactions) has:

1. **Populated** — normal render.
2. **Empty** — zero records; empty-state component with primary action.
3. **Loading** — first-load skeleton rows.
4. **Offline (populated)** — same as populated; no banner (data is local).
5. **Error** — DB load failed; error state with `Retry` (rare edge case).
6. **Search-empty** — search returned zero; message `No matches`.

Every form has:

1. **Rest** — clean form or pre-filled edit.
2. **Focused** — a field is focused.
3. **Error** — one or more fields in error state.
4. **Saving** — Save button in loading state.
5. **Success** — snackbar shown; screen returns.
6. **Discard-guard** — dialog on back with unsaved changes.

Every screen has:

1. **Loading** — first load only.
2. **Ready** — data visible.
3. **Offline** — implicit (no distinct visual except in Sync Status).
4. **Reduced motion** — respects OS setting.
5. **Large text** — 200% OS text size, no truncation of critical values.
6. **Screen reader** — every interactive element has an accessibility label.

## Screen Count Summary

| Category | Count |
| --- | --- |
| Auth screens | 6 |
| Dashboard | 1 (+ 4 states) |
| Entries hub | 1 |
| Employees screens | 5 |
| Services screens | 5 |
| Commission screens | 4 |
| Expenses screens | 6 |
| Reports screens | 10 |
| Income Entry screens | 4 |
| More hub | 1 |
| Settings screens | 9 |
| Diagnostics | 2 |
| Global overlays | 5 |
| **Total unique surfaces (MVP)** | **~59** |

## Non-Existent Screens (explicitly out of scope for MVP)

- Notifications inbox
- Chat / messaging
- Customer profile
- Invoicing
- Payment gateway integration
- Analytics dashboard beyond the built-in Reports
- Loyalty programs
- Appointment booking
- Multi-branch management UI
- Role-based access management UI

These may appear on the roadmap (see [../roadmap.md](../roadmap.md)) but are not in the current inventory.
