# 08 · Dashboard UX

The Dashboard is the app's front door. The owner opens the app and sees, in ≤ 3 seconds, whether the day is going well.

## Purpose

The Dashboard answers exactly three questions at a glance:

1. **How much did I earn today?**
2. **How much did I spend today?**
3. **What's my net collection right now?**

Everything else is secondary.

## Fixed Layout (Above The Fold)

Order is fixed. Never reorder based on user preferences.

```
─────────────────────────────────
│ App bar: Business name · avatar
├───────────────────────────────
│ ▓ Hero Money Card
│    Today's income
│    ₹12,450
│    ↑ ₹1,200 vs yesterday
├───────────────────────────────
│ ▓ Money Card   │ ▓ Money Card
│   Expenses     │   Net collection
│   ₹1,200       │   ₹11,250
├───────────────────────────────
│ Section: Recent transactions
│ · Transaction Card × 5
├───────────────────────────────
│ Sync line: "Last synced 2 min ago"
─────────────────────────────────
│ FAB Extended: + Add income  │
│ Bottom nav                  │
─────────────────────────────────
```

## Anchor Elements

| Element | Position | Purpose |
| --- | --- | --- |
| Hero Money Card | Top of scroll area | The number the owner opens the app to see |
| Peer Money Cards (2) | Row below hero | Immediate context |
| Recent Transactions | Below peers | Verify nothing missing |
| Sync status line | Bottom of scroll | Reassurance |
| FAB Extended `+ Add income` | Bottom-right, 16 dp above nav | The next likely action |
| `Add expense` (ghost button, inline in Money Cards row) | Below peer cards | Second most likely action |
| Bottom nav | Fixed bottom | Global navigation |
| App bar (business name + avatar) | Fixed top | Identity |

## What Should Be Visible Immediately

- **Today's income** (Hero, Money Hero size).
- **Today's expenses** (peer, Money Large).
- **Net collection** (peer, Money Large).
- **`+ Add income`** (FAB Extended).
- **`Add expense`** (ghost secondary CTA).

These 5 elements together answer "how is today going?" and "what do I do next?"

## What Metrics Matter Most

Ranked by "why do owners open the app":

1. Today's income (₹ earned so far today).
2. Today's expenses.
3. Net collection.
4. Recent transactions (verify counts).
5. Last-synced status (trust).

**Not on the Dashboard** (available in Reports):

- Monthly totals.
- Per-employee performance.
- Per-service performance.
- Charts of any kind.
- Historical comparisons beyond ↑/↓ vs yesterday.

## How Today's Business Should Be Presented

- **Money as the hero.** Big number, tabular figures, above the fold.
- **Delta as reassurance.** `↑ ₹1,200 vs yesterday` in `status.success` OR `↓ ₹800` in `text.secondary` (never red — down is not always bad).
- **No graphs.** MVP does not put visualizations on the Dashboard.
- **No goals or targets.** MVP does not set targets the owner might not have thought about.
- **No congratulations.** No confetti, no gamification.

## How Employee Performance Should Be Shown

- **Not on the Dashboard.** Employee performance is a Reports concern.
- Rationale: the Dashboard is about the business, not about individuals. Owners want a single "am I making money?" glance.
- If the owner wants employee performance, one tap to Reports → Employee Performance.

## Should Reports Be Visual Or Numeric

- **Dashboard: numeric.** Big money numbers, no charts.
- **Reports: numeric first, then a single horizontal bar list.** No pie charts, no line graphs, no stacked bars.
- Rationale: numbers travel across all literacy levels. Charts require chart literacy.

## Recent Transactions Section

- Shows the last 5 transactions of the current business day.
- Each row: Transaction Card (see [../design-system/08-component-library.md](../design-system/08-component-library.md#transaction-card)).
- If no transactions today: replaces with a compact empty prompt: `No income yet · Add your first entry`.
- If more than 5 today: last item is a link `View all (12 today) →` navigating to Reports > Daily.

## Sync Status Line

- Sits at the bottom of the scrollable content.
- Reads `Last synced <relative time>` (e.g., `Last synced 2 minutes ago`).
- Uses `text.muted`, Body Small.
- If not synced in > 24 h: prepends a small badge `Not synced`.
- Tap navigates to Settings → Sync Status (rare).

## Business Day Boundary

- The "day" resets at **04:00 local time** (owner-configurable, post-MVP).
- Rationale: salons often close after midnight; a raw midnight rollover would split a late haircut across two days.
- Countdown to reset never shown.

## Empty State (Zero Transactions)

- Hero Money Card shows `₹0` and label `Today's income`.
- Delta line omitted.
- Peer cards render normally with `₹0`.
- Recent transactions section replaced with an inline prompt: `No income yet · Add your first entry`.
- FAB Extended prominent.

## Loading State (First Launch After Install)

- Skeleton Hero card + 2 peer skeletons + 3 row skeletons.
- Shimmer animation.
- No spinner.

## Offline State

- Identical to online state.
- Data comes from SQLite; totals are always current.
- Sync line reads `Last synced <time> · Offline` (post-MVP; MVP simply shows the last-synced time).
- No banner. No overlay. No warning.

## Syncing State

- Dashboard remains fully interactive.
- Sync line shows a small activity indicator: `Syncing…`.
- On completion: line updates to `Last synced just now`. No snackbar.

## Interaction Rules

- Tap on Hero card → nothing (it is not interactive — clarity beats extra actions).
- Tap on peer Money card → nothing.
- Tap on transaction card → Transaction Detail sheet.
- Tap on `View all` → Reports > Daily.
- Pull-to-refresh → triggers sync (silent success).
- Long press → nothing.

## Refresh Behavior

- On tab focus: recompute from SQLite (instant).
- On successful sync: recompute.
- On app foreground: recompute if > 30 s since last render.
- No manual refresh button.

## Motion On Dashboard

- Hero card and peer cards fade + slide up 8 dp on first render.
- On subsequent renders: cross-fade only.
- Adding a new transaction: new transaction card slides in from top of the recent-transactions list.
- FAB scales in on first render, hides on scroll down, reappears on scroll up.

## Density Rules

- Never more than 4 major sections above the fold (Hero, peers, recent, sync line — that's it).
- Never insert banners, tips, promos, or announcements.
- Never insert a "quick actions" row of small buttons — the FAB is the quick action.

## Notifications On Dashboard

- MVP: no in-Dashboard notifications.
- Post-MVP: a subtle `bell` icon in the app bar could surface unread items (sync failures > 24 h, backup issues). Never a modal.

## Anti-Patterns

- Any chart on the Dashboard.
- Any modal on the Dashboard.
- Any banner or announcement bar.
- Multiple hero-sized numbers.
- Employee-specific data on Dashboard.
- "Rate the app" cards.
- Featured content or upsells.
- Full-screen loading spinner.
- Confetti or gamification.

## Do's

- Keep the Hero card first and biggest.
- Keep the FAB action stable across releases.
- Keep totals instant (local read).
- Preserve the exact layout on every render.

## Don'ts

- Don't introduce personalization that shuffles the layout.
- Don't add a chart until it earns its place through research.
- Don't hide the recent transactions behind a tap.
