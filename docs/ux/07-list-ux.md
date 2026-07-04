# 07 · List UX

Lists are how the owner scans their day. They must be fast to read, easy to tap, and predictable.

Cross-reference: [../design-system/12-lists.md](../design-system/12-lists.md).

## List Types

| Type | Example | Sort | Grouping |
| --- | --- | --- | --- |
| Chronological | Transactions, Expenses | Newest first | By day |
| Reference | Services, Employees, Categories | Alphabetical within group | Active → Inactive |
| Ranked | Employee Performance, Service Performance | Highest metric first | None |
| Configuration | Settings rows | Fixed | By section |

## Search

**Trigger**: search icon (`search`) in the app bar.

**Behavior**

- Tapping the icon reveals a sticky search bar below the app bar.
- The keyboard opens with the field focused.
- Debounced 200 ms.
- **Local only** (SQLite). Never a network round-trip.
- Matches primary text first, then secondary text.
- Empty query returns the unfiltered list.
- Search-empty state: `No matches` (Empty State component, no action).
- Clear (`x`) button restores full list.
- Back or close (`x`) exits search mode.

**Where search is available**

| List | Search across |
| --- | --- |
| Employees | Employee name |
| Services | Service name |
| Transactions (Reports) | Employee name, service name, remarks |
| Expenses | Category name, remarks |
| Categories | Category name |

**Global search**: not in MVP.

## Sort

- Not exposed in MVP.
- Each list has a business-appropriate default sort:
  - Employees / Services: alphabetical within Active/Inactive.
  - Transactions: newest first.
  - Expenses: newest first.
  - Employee/Service performance: highest metric first.
- Post-MVP: sort exposed only inside the Filter sheet as a segmented control.

## Filter

**Trigger**: filter icon (`sliders-horizontal`) in the app bar.

**Behavior**

- Opens a bottom sheet with **presets first**:
  - Today
  - Yesterday
  - This week
  - This month
  - Last month
  - Custom (opens calendar)
- Single-select presets auto-apply and close the sheet (no `Apply` button needed for a single choice).
- Multi-select filters (e.g., payment mode + category) show an `Apply` button at the bottom.
- Applied filters render as **chips above the list** with a `Clear all` action.
- Chip label uses the filter value ("This month", "Cash", "Salary").

**Filter persistence**

- Filters do not persist across app launches (predictability wins).
- Filters do persist across in-app navigation within the same session.

## Grouping

- Chronological lists group by day.
- Group header uses the Section Header component with relative dates:
  - `Today`
  - `Yesterday`
  - `04 Jul 2026` (ISO-formatted for older dates)
- Reference lists group by status: `Active` (top) → `Inactive` (below).
- `Inactive` group is collapsed by default with a count badge (`Inactive · 3`); tap to expand.
- Empty groups are hidden.
- Grouping cannot be turned off by the user.

## Sticky Headers

- Group headers stick to the top of the list while scrolling within the group.
- Only one sticky header visible at a time.
- Sticky headers use `background.default` background, `space.3` (12) vertical padding.

## Swipe Actions

**MVP default**: **no swipe actions**.

Rationale: hidden gestures are undiscoverable for the primary persona (low technical confidence).

Instead:

- Tap a row → detail sheet → explicit `Edit` / `Delete` buttons.

Post-MVP: consider swipe-to-delete only after user research confirms discoverability across all supported languages and literacy levels.

## Selection

Single-tap on a row does:

| Context | Behavior |
| --- | --- |
| Employees list | Opens Edit Employee screen |
| Services list | Opens Edit Service screen |
| Categories list | Opens Edit Category sheet |
| Transactions list (Reports) | Opens Transaction Detail sheet |
| Expenses list | Opens Expense Detail sheet |
| Commission employees list | Opens Employee Commission screen |
| Selection sheets (`Select employee` etc.) | Selects the item and closes / toggles |

**Long press**: does nothing in MVP.

## Bulk Actions

**MVP**: no bulk actions.

Rationale: adds complexity and rarely needed at MVP scale. Owners edit records one at a time.

Post-MVP: consider bulk-inactive for Employees / Services.

## Pull To Refresh

- Available on lists that reflect syncable data (Transactions, Expenses, Employees, Services).
- Triggers a **sync attempt**, not a re-render.
- Success: silent (data is already local; sync just pushes/pulls remote changes).
- Failure: subtle snackbar `Couldn't sync · Retry`.
- Never blocks the UI.
- Refresh spinner uses `brand.primary`.

## Infinite Scroll

- Default: **paginated by day** (not by scroll offset).
- Chronological lists load 30 days at a time.
- Skeleton rows appear at the bottom while the next batch loads.
- When no more data: `t("list.endReached")` shown as a subtle line, `text.muted`.
- Never a `Load more` button.

## Pagination

- Numbered pagination is **forbidden**.
- All pagination is day-based invisible loading.

## Row Density

- Comfortable density everywhere. No dense/compact mode in MVP.
- Never shrink row height to fit more data.
- If a list feels too long, add grouping — don't compress.

## Row Anatomy Rules

- One row = one entity.
- Never combine two records visually.
- Consistent trailing element per list (always amount, or always chevron, or always icon — pick one and hold it).
- Max 3 pieces of information per row on phone.

## Loading

**First load**

- Skeleton list of 5–8 rows matching the row height.
- Shimmer animation from [../design-system/09-motion-system.md](../design-system/09-motion-system.md).

**Subsequent loads** (returning to tab)

- No skeletons. The last local data is still valid.
- Show a subtle sync indicator in the app bar if syncing.

## Errors In Lists

- Rare (only after SQLite migration failure or corruption).
- Error state: icon + title + body + `Retry` button.
- Sync failures never disturb the list — data still shows.

## Empty States

Every list has an empty state (see [09-empty-states.md](09-empty-states.md)).

**Search-empty** is a different state — a shorter empty state without an action.

## Add From List

- FAB `+` is the standard entry point.
- Add action opens a bottom sheet (short forms) or full screen (long forms).
- On save, the new row animates in (see [13-motion-flow.md](13-motion-flow.md)).

## Delete From List

- Not from swipe. From detail sheet → `Delete`.
- Row disappears with cross-fade + collapse animation.
- Undo snackbar (8 s) appears simultaneously.

## Refresh On Return

- Return to a tab / list: recompute from SQLite, do not show skeletons.
- Recent writes appear immediately.
- Sync status updates in the background.

## Header Spacing In Lists

- App bar: 56 dp + safe area top.
- Search bar (when active): 44 dp + `space.2` padding, sticky.
- Filter chips row (when filters active): 40 dp + `space.2` padding, sticky.
- Group header: `space.5` (24) above, `space.2` (8) below.
- Rows: consistent row height per list.

## Do's

- Consistent row height per list.
- Group by day or status.
- Empty state with a next action.
- Pull-to-refresh triggers sync.
- Prefer scannable over dense.

## Don'ts

- Don't hide primary actions behind gestures.
- Don't use different row layouts in the same list.
- Don't paginate with numbered pages.
- Don't add `Load more` buttons.
- Don't sort inconsistently across sessions.
- Don't use long press for critical actions.
