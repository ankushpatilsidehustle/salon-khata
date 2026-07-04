# 01 · Navigation Flow

Mermaid diagrams of every reachable path in Salon Khata. If a path is not diagrammed here, it is not reachable.

All diagrams derive from [../ux/02-navigation-architecture.md](../ux/02-navigation-architecture.md), [../ux/04-screen-flows.md](../ux/04-screen-flows.md), and [../navigation.md](../navigation.md). Screen IDs match [00-screen-map.md](00-screen-map.md).

## Root Navigation

The auth boundary is hard. Sign-in crosses from Auth Root to Main Tabs; sign-out crosses back.

```mermaid
flowchart LR
    Boot([App launch]) --> AUTH01[AUTH-01 Splash]
    AUTH01 -->|session valid| Tabs{{Main Tabs}}
    AUTH01 -->|no session| AUTH02[AUTH-02 Language Picker]
    AUTH02 --> AUTH03[AUTH-03 Mobile Number]
    AUTH03 --> AUTH04[AUTH-04 OTP]
    AUTH04 -->|first launch| AUTH05[AUTH-05 Business Setup]
    AUTH04 -->|new device + cloud backup| AUTH06[/AUTH-06 Restore Prompt/]
    AUTH05 --> Tabs
    AUTH06 -->|Restore| Tabs
    AUTH06 -->|Skip| Tabs
    Tabs -->|Sign out| AUTH01
```

## Main Tab Structure

Four tabs. Fixed order. Each tab has an independent stack.

```mermaid
flowchart TB
    subgraph Tabs["Bottom Navigation (fixed order)"]
        direction LR
        T0[Dashboard tab · index 0]
        T1[Entries tab · index 1]
        T2[Reports tab · index 2]
        T3[More tab · index 3]
    end
    T0 --> DASH01[DASH-01 Dashboard]
    T1 --> ENT01[ENT-01 Entries Hub]
    T2 --> REP01[REP-01 Reports Root]
    T3 --> MORE01[MORE-01 More Hub]
```

## Flow · Golden Path (Add Income, ≤ 10 s)

The single most important flow in the app. Every screen along this path is `P0`.

```mermaid
flowchart TB
    DASH01[DASH-01 Dashboard] -->|FAB '+ Add income'| INC01[INC-01 Income Entry]
    INC01 -->|tap Employee| INC02[/INC-02 Select Employee/]
    INC02 -->|tap employee| INC01
    INC02 -->|'+ Add employee'| EMP02[/EMP-02 Add Employee/]
    EMP02 -->|Save| INC02
    INC01 -->|tap Services| INC03[/INC-03 Select Services/]
    INC03 -->|Done| INC01
    INC03 -->|'+ Add service'| SRV02[/SRV-02 Add Service/]
    SRV02 -->|Save| INC03
    INC01 -->|Save| SNACK{{GLB-SNACK 'Saved · Add another'}}
    SNACK --> DASH01
    SNACK -->|Add another| INC01
    INC01 -->|close x with changes| INC04{{INC-04 Discard?}}
    INC04 -->|Discard| DASH01
    INC04 -->|Cancel| INC01
```

## Flow · Add Expense

```mermaid
flowchart TB
    DASH01[DASH-01 Dashboard] -->|'Add expense' ghost button| EXP02[/EXP-02 Add Expense/]
    EXP01[EXP-01 Expenses List] -->|FAB '+'| EXP02
    EXP02 -->|tap Category| EXP05[/EXP-05 Category Selector/]
    EXP05 -->|pick category| EXP02
    EXP05 -->|'+ New'| EXP02
    EXP02 -->|Save| SNACK{{GLB-SNACK 'Saved'}}
    SNACK --> Return[Return to caller]
```

## Flow · Employees Stack

```mermaid
flowchart TB
    ENT01[ENT-01 Entries Hub] -->|tap Employees| EMP01[EMP-01 Employees List]
    EMP01 -->|FAB '+'| EMP02[/EMP-02 Add Employee/]
    EMP01 -->|tap row| EMP04[/EMP-04 Employee Detail/]
    EMP01 -->|search icon| EMP05[/EMP-05 Employee Search/]
    EMP04 -->|Edit| EMP03[EMP-03 Edit Employee]
    EMP04 -->|Delete fresh| SNACKUNDO{{GLB-SNACK 'Deleted · Undo'}}
    EMP04 -->|Delete with history| DELDIAG{{GLB-DIALOG-DELETE}}
    DELDIAG -->|Delete| SNACK{{GLB-SNACK 'Deleted'}}
    EMP03 -->|Update| SNACK
    EMP02 -->|Save| SNACK2{{GLB-SNACK 'Added · Add another'}}
    SNACK2 --> EMP01
    SNACK2 -->|Add another| EMP02
```

## Flow · Services Stack

Structure mirrors Employees.

```mermaid
flowchart TB
    ENT01[ENT-01 Entries Hub] -->|tap Services| SRV01[SRV-01 Services List]
    SRV01 -->|FAB '+'| SRV02[/SRV-02 Add Service/]
    SRV01 -->|tap row| SRV04[/SRV-04 Service Detail/]
    SRV01 -->|search icon| SRV05[/SRV-05 Service Search/]
    SRV04 -->|Edit| SRV03[SRV-03 Edit Service]
    SRV04 -->|Delete fresh| SNACKUNDO{{GLB-SNACK 'Deleted · Undo'}}
    SRV04 -->|Delete with history| DELDIAG{{GLB-DIALOG-DELETE}}
    DELDIAG -->|Delete| SNACK{{GLB-SNACK 'Deleted'}}
    SRV03 -->|Update| SNACK
    SRV02 -->|Save| SNACK2{{GLB-SNACK 'Added · Add another'}}
    SNACK2 --> SRV01
    SNACK2 -->|Add another| SRV02
```

## Flow · Commission Rules

```mermaid
flowchart TB
    ENT01[ENT-01 Entries Hub] -->|tap Commission| COM01[COM-01 Commission Employees]
    COM01 -->|tap employee| COM02[COM-02 Employee Commission]
    COM02 -->|tap service row| COM03[/COM-03 Edit Commission Rule/]
    COM03 -->|Save| SNACK{{GLB-SNACK 'Saved'}}
    SNACK --> COM02
```

## Flow · Expenses Stack

```mermaid
flowchart TB
    ENT01[ENT-01 Entries Hub] -->|tap Expenses| EXP01[EXP-01 Expenses List]
    EXP01 -->|FAB '+'| EXP02[/EXP-02 Add Expense/]
    EXP01 -->|tap row| EXP04[/EXP-04 Expense Detail/]
    EXP04 -->|Edit| EXP03[/EXP-03 Edit Expense/]
    EXP04 -->|Delete| SNACKUNDO{{GLB-SNACK 'Deleted · Undo'}}
    EXP03 -->|Update| SNACK{{GLB-SNACK 'Updated'}}
    EXP02 -->|tap Category| EXP05[/EXP-05 Category Selector/]
    EXP05 --> EXP02
    EXP02 -->|Save| SNACK2{{GLB-SNACK 'Saved · Add another'}}
    SNACK2 --> Return[Return to caller]
    SNACK2 -->|Add another| EXP02
```

## Flow · Reports

```mermaid
flowchart TB
    REP01[REP-01 Reports Root] -->|segmented 'Daily'| REP02[REP-02 Daily Report]
    REP01 -->|segmented 'Monthly'| REP03[REP-03 Monthly Report]
    REP02 -->|tap tx row| REP08[/REP-08 Transaction Detail/]
    REP03 -->|Month picker| REP10[/REP-10 Month Picker/]
    REP03 -->|Top employees 'View all'| REP04[REP-04 Employee Performance]
    REP03 -->|Top services 'View all'| REP06[REP-06 Service Performance]
    REP04 -->|tap employee| REP05[REP-05 Employee Detail Report]
    REP06 -->|tap service| REP07[REP-07 Service Detail Report]
    REP01 -->|filter icon| REP09[/REP-09 Filter Sheet/]
    REP08 -->|Edit| INC01[INC-01 Income Entry pre-filled]
    REP08 -->|Delete| SNACKUNDO{{GLB-SNACK 'Deleted · Undo'}}
```

## Flow · More & Settings

```mermaid
flowchart TB
    MORE01[MORE-01 More Hub] -->|Settings| SET01[SET-01 Settings]
    MORE01 -->|Backup & Restore| SET04[SET-04 Backup & Restore]
    MORE01 -->|Language| SET03[SET-03 Language]
    MORE01 -->|About| SET07[SET-07 About]
    MORE01 -->|Sign out| SET08{{SET-08 Sign Out?}}
    SET01 -->|Business Profile| SET02[SET-02 Business Profile]
    SET01 -->|Sync Status| DIAG01[DIAG-01 Sync Status]
    SET04 -->|Restore from cloud| SET05{{SET-05 Restore?}}
    SET05 -->|Restore| SET06[SET-06 Restore Progress]
    SET06 --> DASH01[DASH-01 Dashboard]
    SET08 -->|Sign out| AUTH01[AUTH-01 Splash]
```

## Flow · Backup & Restore (state machine)

```mermaid
stateDiagram-v2
    [*] --> Idle
    Idle --> Syncing: write triggers debounce (5 min)
    Idle --> Syncing: manual 'Backup now'
    Syncing --> Idle: success (silent)
    Syncing --> Pending: no network / retryable failure
    Pending --> Syncing: network detected / retry
    Pending --> Failed: backoff exhausted for now
    Failed --> Syncing: user taps 'Retry now' in DIAG-01
    Failed --> Pending: next scheduled attempt
    Idle --> Restoring: user confirms SET-05
    Restoring --> Idle: success → DASH-01 + snackbar
    Restoring --> Idle: user cancels → local intact
    Restoring --> Failed: mid-flight failure (local intact)
```

## Deep Links

Deep links land on the correct tab. If the session is invalid, the app routes to AUTH-03 and remembers the intended destination for post-auth.

| Link | Destination | Notes |
| --- | --- | --- |
| `salonkhata://income/new` | Dashboard tab → INC-01 | Golden path entry from outside the app |
| `salonkhata://expense/new` | Dashboard tab → EXP-02 (as sheet over DASH-01) | Same as Dashboard ghost button |
| `salonkhata://reports/daily` | Reports tab → REP-02 | Default tab position preserved |
| `salonkhata://reports/monthly` | Reports tab → REP-03 | Fallback to REP-02 if unresolved |
| `salonkhata://settings` | More tab → SET-01 | |
| `salonkhata://sync` | More tab → DIAG-01 | Used by support / diagnostics |
| _invalid_ | Dashboard tab → DASH-01 | Silent fallback |

## Back Behavior Summary

Full rules in [../ux/02-navigation-architecture.md#back-behavior](../ux/02-navigation-architecture.md#back-behavior). Enforced everywhere:

- Back on a nested screen pops the stack.
- Back with a bottom sheet open dismisses only the sheet.
- Back on any form with unsaved changes shows GLB-DIALOG-DISCARD.
- Back at tab root with tab history → previous tab.
- Back on DASH-01 with no history → Android exit toast (GLB-TOAST-EXIT), then second back exits.

## Reachability Invariants

Every screen must satisfy:

1. **Every Primary CTA has a destination diagrammed above.**
2. **Every screen is reachable from a tab root in ≤ 3 hops** (max depth per [../ux/02-navigation-architecture.md#deep-navigation](../ux/02-navigation-architecture.md#deep-navigation)).
3. **Every screen has an exit** — back, close, or CTA-return.
4. **No modal-within-modal-within-modal** — the only permitted nesting is `sheet → dialog` (e.g., GLB-DIALOG-DISCARD closing a form modal).
5. **No screen at depth ≥ 4** — refactor into siblings or a bottom sheet.
