# 13 · Data Visualization

Salon Khata visualizes money and activity, not analytics. Every visualization must be understandable in under 5 seconds by someone who has never used a chart before.

## Principles

1. **Numbers first, charts second.** A large money number outperforms a chart for daily use.
2. **One insight per view.** Do not stack four charts on one screen.
3. **Read like a sentence.** Label → value → optional context.
4. **Round for scannability.** ₹12,450 renders as ₹12,450 (not ₹12,450.00).
5. **No color-only meaning.** Always pair color with a label, icon, or sign.

## Money Cards

The primary visualization in the app.

### Hero Money Card (single lead metric)

Used for **today's income** on Dashboard.

Layout:

- Label (Caption `text.secondary` uppercase): "Today's income"
- Value (Money Hero): ₹12,450
- Delta (Caption): `↑ ₹1,200 vs yesterday` in `status.success` or `↓ ₹800` in `text.secondary` (never `status.danger` — down is not always bad)

### Money Card (peer metric)

Used for **today's expenses**, **net collection**, **pending sync**, etc.

Layout:

- Label
- Value (Money Large)
- Optional secondary text (Body Small)

Grid: 2-column on phone, `space.3` (12) gap between cards.

## Statistic Card

Used in reports for standalone facts (e.g., "Top service this month").

Layout:

- Label (Caption uppercase)
- Value (Money Large or H1 for non-money numbers)
- Optional context (Body Small `text.secondary`)

Minimum height: 88 dp.

## Summary Card

Groups 2–4 related stats into one card.

Layout:

- Title (H3)
- Rows of label → value pairs
- Optional trailing action (`View all →`)

Max 4 rows. If more, use a dedicated screen.

## Daily Summary (Dashboard)

Fixed layout:

1. **Hero Money Card**: Today's income
2. **Row of two Money Cards**: Today's expenses · Net collection
3. **Section header**: Recent transactions (5 most recent)
4. **Summary Card**: Sync status (last synced 2 minutes ago)

Never more than these blocks on Dashboard.

## Monthly Summary (Reports > Monthly)

1. **Month selector** (segmented control: This month / Last month / Custom)
2. **Hero Money Card**: Total income
3. **Row of Money Cards**: Total expenses · Net collection · Number of transactions
4. **Summary Card**: Top 3 employees by commission
5. **Summary Card**: Top 3 services by revenue
6. **Simple bar visualization** (see below): Income per day of the month

## Employee Performance (Reports > Employee)

Per-employee card:

- Employee name (H3)
- Row: Total commission (Money Large) · Number of transactions (H3)
- Row: Top service (Body Small `text.secondary`)
- Row: `View details →`

Sort: highest commission first.

## Service Performance (Reports > Service)

Per-service card:

- Service name (H3)
- Row: Total revenue (Money Large) · Number of times performed (H3)
- Row: `View details →`

Sort: highest revenue first.

## Simple Charts

MVP uses **one chart type only**: a **horizontal bar list**.

Reason: bar charts are the most readable across literacy levels and screen sizes.

Rules:

- Label on the left (full name).
- Bar in the middle (single color, `brand.primary`).
- Value on the right (Money Body).
- Max 7 bars per view (top N).
- If more entries exist, show `View all` linking to a full list.
- Bar width is proportional to the maximum value in the set.

**No pie charts, no line charts, no radar charts, no stacked bars in MVP.**

Future consideration: a simple sparkline for month-over-month trends.

## Progress Indicators

Used only for restore/backup operations.

- Linear determinate progress bar.
- 4 dp height, `brand.primary` fill, `background.subtle` track.
- Label above: "Restoring your data · 42%"
- Below: cancel affordance.

## Empty Visualizations

If a chart has no data:

- Do not render an empty chart.
- Show the Empty State component with a message and action.

Example: "No income yet this month · Add income".

## Formatting Rules

- Money: use Currency Display component, tabular figures, locale-aware grouping.
- Percentages: whole numbers unless ≤ 1% (`24%`, `0.5%`).
- Counts: locale-formatted integers (`1,250`).
- Dates in labels: short form (`04 Jul`, `04 Jul 2026` when the year is ambiguous).

## Comparisons

- "vs yesterday", "vs last month" use the Delta convention:
  - Positive delta: `↑ ₹1,200` in `status.success`
  - Negative delta: `↓ ₹800` in `text.secondary` (never red — spending less is not bad)
  - Zero delta: `— No change` in `text.secondary`

- Never show a raw percentage change without the absolute value beside it.

## Data Refresh

- Dashboard money values refresh:
  - On tab focus.
  - After a save/delete.
  - After a successful sync.
- Report values refresh:
  - On date range change.
  - On tab focus if data is > 5 minutes stale.
- All refreshes are computed from local SQLite — never a network call.

## Anti-Patterns

- Pie charts (impossible to compare slices accurately).
- 3D charts.
- Sparklines without values.
- Color-only meaning ("red is bad, green is good").
- Interactive tooltips that require tap-and-hold (undiscoverable).
- Charts that show more than one metric at once.

## Do's

- Lead with the number, not the chart.
- Round large values for readability.
- Use tabular figures for all money.
- Always label the metric.

## Don'ts

- Don't use color as the only differentiator.
- Don't stack multiple visualizations on one screen.
- Don't require the user to tap a chart to understand it.
