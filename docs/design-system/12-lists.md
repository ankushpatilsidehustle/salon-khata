# 12 · Lists

Lists are how the owner scans their day. They must be fast to read, easy to tap, and predictable.

## Principles

- **Newest and most relevant first** for chronological lists.
- **Alphabetical** for reference lists (services, employees) when active items appear first.
- **One row = one entity.** Never combine two records visually.
- **Consistent trailing element** per list — always the same slot for amount/chevron/status.

## Row Anatomy

Each row uses the List Item component (see [08-component-library.md](08-component-library.md#list-item)).

- Leading: avatar / icon / nothing.
- Primary text (Body Emphasis).
- Secondary text (Body Small `text.secondary`) — optional, 1 line.
- Trailing: amount / chevron / badge / nothing.

Row heights:

- Single-line: 56 dp
- Two-line: 72 dp
- Never three lines on phone — open a detail sheet instead.

## Empty States

Every list must have an empty state with:

- Icon (`size.icon.xl`, `text.muted`)
- Title (H2)
- Body (Body + `text.secondary`)
- One primary action (Button)

Do not show a generic "No data" — always tell the user what to do next.

Examples:

| List | Empty title | Empty action |
| --- | --- | --- |
| Services | `t("services.emptyTitle")` → "No services yet" | Add service |
| Employees | `t("employees.emptyTitle")` → "No employees yet" | Add employee |
| Today's transactions | `t("transactions.emptyTitle")` → "No income recorded today" | Add income |
| Today's expenses | `t("expenses.emptyTitle")` → "No expenses recorded today" | Add expense |

## Infinite Scroll vs Pagination

**Default**: paginated by business date (Today, Yesterday, This week, etc.), not "load more" scrolling.

**Reason**: owners think in days, not in scroll offsets.

**When infinite scroll is appropriate**:

- Long historical report (past 12 months) — load 30 days at a time as the user scrolls.
- Never on Dashboard.

Rules:

- Show a subtle skeleton row while the next page loads.
- Never show a `Load more` button on lists that already scroll naturally.
- Stop loading and show `t("list.endReached")` when no more data.

## Grouping

Group items by business date on chronological lists.

- Group header: Section Header component (Overline, `text.secondary`).
- Values: `Today`, `Yesterday`, then `04 Jul 2026` format.
- Groups collapse when a group has zero items (do not show empty groups).

For reference lists (services, employees), group by active status:

- `ACTIVE` (default, at top)
- `INACTIVE` (below, collapsed by default)

## Sticky Headers

- Group headers stick to the top of the list while scrolling within the group.
- Only one sticky header visible at a time.
- Sticky headers use `background.default` background, `space.3` (12) vertical padding.

## Selection

Multi-select is not in MVP.

Single tap on a row:

- Employee/service row (in selection sheet): selects the item.
- Transaction row: opens a bottom sheet with details and actions (Edit, Delete).
- Service/employee row (in settings list): opens edit screen.

## Swipe Actions

MVP defaults: **no swipe actions**. They are hidden and undiscoverable for non-tech-savvy users.

Instead:

- Tap a row → detail sheet → explicit Edit/Delete buttons.

Future consideration: enable swipe-to-delete only after user research confirms discoverability.

## Long Press

- Long press does **nothing** in MVP.
- Do not use long press to expose destructive actions.
- Reserve for future accessibility features.

## Pull To Refresh

- Only on lists that reflect syncable data (transactions, expenses, employees, services).
- Triggers a sync attempt; success is silent, failure shows a subtle snackbar.
- Never blocks the UI.

## Loading

**First load**

- Show a skeleton list of 5–8 rows matching the row height.
- Skeleton uses shimmer animation from [09-motion-system.md](09-motion-system.md).

**Subsequent updates**

- Do not show skeletons on tab return — the last data is still valid.
- Show a subtle sync indicator in the app bar only.

## Errors In Lists

- If a list fails to load from local SQLite, show an error state with a Retry button. This is a rare case (only after DB corruption or migration failure).
- If a sync fails, do not disturb the list — show a subtle snackbar and keep displaying local data.

## Row Density Rules

- **Comfortable** density everywhere. No dense/compact mode in MVP.
- Do not shrink row height to fit more data.
- If a list feels too long, add grouping — do not compress.

## List-Level Actions

- List-level actions (Add) live in the FAB, not in the app bar.
- Search and filter live in the app bar as icon buttons.
- Sort is not exposed in MVP.

## Anti-Patterns

- Rows with 4+ pieces of information.
- Two different trailing element types in the same list.
- Row heights that vary within one list.
- Hidden actions behind long press or swipe on core flows.
- Empty states that only say "Nothing here".

## Do's

- Consistent row height per list.
- Group by date or status.
- Always show an empty state action.
- Prefer scannable over dense.

## Don'ts

- Don't use different row layouts in the same list.
- Don't hide primary actions behind gestures.
- Don't paginate with numbered pages.
