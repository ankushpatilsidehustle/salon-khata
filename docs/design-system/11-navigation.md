# 11 · Navigation

Navigation shape mirrors how an owner thinks about their day, not how the data is stored.

## Structure

Top-level: **bottom navigation with 4 tabs.**

| Tab | Icon | Contents |
| --- | --- | --- |
| Dashboard | `home` | Today's totals, recent transactions, primary CTAs |
| Entries | `layers` | Income, Expense, Services, Employees, Commission |
| Reports | `bar-chart-3` | Daily, Monthly, Employee, Service summaries |
| More | `menu` | Settings, Backup/Restore, Language, Profile |

Rules:

- Exactly 4 tabs. Never 3, never 5.
- Labels always visible.
- Active tab uses filled icon variant + `brand.primary` label.

## Navigation Hierarchy

```
Bottom Tab (Dashboard / Entries / Reports / More)
  └─ Stack (per tab)
       └─ Screen
            └─ Bottom Sheet (for selection, confirmation, quick edit)
```

Rules:

- Bottom sheets are **within** the current stack, not a separate root.
- Modals (dialogs) are global overlays.
- Deep-links land on the correct tab's stack.

## Nested Navigation

Each tab owns its own stack. Cross-tab jumps (rare) push a new screen onto the destination tab's stack and switch the active tab.

Example: tapping "View all transactions" on Dashboard navigates to Reports > Daily.

## Back Behavior

| Situation | Back behavior |
| --- | --- |
| Top of stack, tab switch history exists | Return to previous tab |
| Top of stack, no history | Exit confirmation on Android hardware back |
| Nested screen | Pop the stack |
| Bottom sheet open | Dismiss the sheet |
| Dialog open | Dismiss the dialog only |
| Unsaved form | Discard-changes dialog (see [10-forms.md](10-forms.md)) |

## FAB Behavior

- FAB is per screen, not global.
- Dashboard: FAB → Add income (Extended FAB with `plus` + label).
- Entries → Expense list: FAB → Add expense.
- Entries → Services list: FAB → Add service.
- Entries → Employees list: FAB → Add employee.
- Reports: no FAB.
- Settings: no FAB.

## Search

Search is contextual, never global.

| Screen | Search scope |
| --- | --- |
| Services list | Service name |
| Employees list | Employee name |
| Transactions (Reports) | Employee, service name, remarks |
| Expenses list | Category, remarks |

Rules:

- Search bar sits below the app bar, sticky when the list scrolls.
- Search is instantaneous (SQLite is local).
- Search never leaves the screen.
- Do not build a "global search" in MVP.

## Filters

Filters live in a bottom sheet triggered by a `sliders-horizontal` icon in the app bar.

Rules:

- Filter sheet shows preset chips first (Today, This month, Last month).
- Custom date range is at the bottom of the sheet.
- Applied filters render as chips above the list, with a `Clear all` action.
- The list updates immediately on filter apply (no separate "Apply" button when the filter is a single choice).

## Sorting

- Sort is not exposed in MVP for daily lists (default sort is business-appropriate: services alphabetical, transactions newest-first).
- If sort ships later, it lives in the filter sheet as a segmented control.

## Deep Links

- `salonkhata://income/new` → Dashboard tab → Income entry screen
- `salonkhata://expense/new` → Dashboard tab → Expense entry screen
- `salonkhata://reports/monthly` → Reports tab → Monthly report

Deep links must:

- Land on the correct tab.
- Not require re-login if the session is valid.
- Fall back to Dashboard if the target is invalid.

## Onboarding & Authentication

Authentication is a separate root above the main navigation.

```
Auth Root
  ├─ Splash
  ├─ Mobile number entry
  ├─ OTP verification
  └─ Business setup (first-time only)
       └─→ Main Tabs
```

Rules:

- Once authenticated, the user cannot go back to Auth screens without an explicit "Sign out" from Settings.
- Business setup is skippable except for business name.

## Screen-Level Layout Anchors

Every screen has three fixed anchor zones:

1. **Top**: App bar (56 dp + safe area top).
2. **Middle**: Scrollable content.
3. **Bottom**: Primary action or bottom nav.

Primary CTAs never appear only in the top area.

## Modal vs Full-Screen Decision

| Choose bottom sheet | Choose full screen |
| --- | --- |
| Single decision (select, filter) | Multi-step form |
| Confirmation | Detail view with actions |
| Quick edit (1–3 fields) | Long form (4+ fields) |
| List-related picker | Any flow that can be interrupted |

## Anti-Patterns

- Hamburger menus (hides features; hard to discover).
- Nested tabs.
- Slide-out drawers.
- Sticky headers deeper than one level.
- Back button that skips over meaningful screens.
- Deep links that require re-auth for simple actions.

## Do's

- Keep the tab count and order stable across releases.
- Bring primary CTAs within thumb reach.
- Show clear back and close affordances.

## Don'ts

- Don't add a 5th tab.
- Don't rely on gestures for critical actions.
- Don't nest bottom sheets.
