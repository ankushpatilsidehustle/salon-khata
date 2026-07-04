# Dashboard Screen — Design

Grounded in [Template 1: Dashboard](../../design-system/17-screen-templates.md#template-1-dashboard) and [08 · Dashboard UX](../../ux/08-dashboard-ux.md). Every component named below already exists in [08 · Component Library](../../design-system/08-component-library.md). Nothing new is introduced.

This is the detailed design for [DASH-01](../04-dashboard.md#dash-01--dashboard).

---

## 1. Purpose

Answer three questions in ≤ 3 seconds of app-open, without a tap:

1. How much did I earn today?
2. How much did I spend today?
3. What is my net collection right now?

Serve one likely next action: **Add income**. Serve one secondary action: **Add expense**. Everything else is deliberately absent.

---

## 2. Layout Hierarchy

Three anchor zones from [17 · Screen Templates](../../design-system/17-screen-templates.md#template-anchor-zones). Order is fixed — no personalization ever reshuffles it.

```
┌─ Safe area top ─────────────────────────────┐
│  APP BAR    · business name · avatar (44)   │  ← 56 dp + safe area
├─────────────────────────────────────────────┤
│  space.4                                     │
│  ┌───────────────────────────────────────┐   │
│  │  HERO MONEY CARD                      │   │  ← Today's income
│  │  Today's income     ₹12,450           │   │     Money Hero
│  │  ↑ ₹1,200 vs yesterday                │   │     status.success delta
│  └───────────────────────────────────────┘   │
│  space.3                                     │
│  ┌──────────────┐  ┌──────────────┐         │
│  │ MONEY CARD   │  │ MONEY CARD   │         │  ← peer row
│  │ Expenses     │  │ Net collect. │         │     Money Medium
│  │ ₹1,200       │  │ ₹11,250      │         │
│  └──────────────┘  └──────────────┘         │
│  space.2                                     │
│  [ Ghost Button · + Add expense ]           │  ← inline secondary
│  space.5                                     │
│  SECTION HEADER · RECENT TRANSACTIONS       │  ← Overline
│  ┌───────────────────────────────────────┐   │
│  │  Transaction Card  · × up to 5        │   │  ← 72 dp each
│  └───────────────────────────────────────┘   │
│  space.5                                     │
│  Sync line: · Last synced 2 min ago         │  ← Body Small · text.muted
│  space.9 (FAB clearance)                    │
├─────────────────────────────────────────────┤
│              [+ Add income]  FAB Extended   │  ← 16 dp above bottom nav
│  ═══════════════════════════════════════    │
│   Dashboard  Entries  Reports  More         │  ← Bottom Navigation
└─ Safe area bottom ──────────────────────────┘
```

Vertical order is a promise. Density limit: **4 major blocks above the fold** (hero, peers, recent header, one recent card). No banners, no promos, no tips row.

---

## 3. Component Hierarchy

Only Design System components. Every entry links to its catalogue definition.

| Depth | Component | Variant | Source |
| --- | --- | --- | --- |
| Frame | [App Bar](../../design-system/08-component-library.md#app-bar) | Title only, avatar trailing | Fixed top |
| Frame | [Bottom Navigation](../../design-system/08-component-library.md#bottom-navigation) | 4-tab, Dashboard active | Fixed bottom |
| Frame | [FAB](../../design-system/08-component-library.md#fab-floating-action-button) | Extended, `plus` icon | Bottom-right |
| Content | [Money Card](../../design-system/08-component-library.md#money-card) | Hero (1) | Today's income |
| Content | [Money Card](../../design-system/08-component-library.md#money-card) | Standard (2) | Expenses · Net |
| Content | [Button](../../design-system/08-component-library.md#button) | Ghost, secondary height 44 dp | Add expense |
| Content | [Section Header](../../design-system/08-component-library.md#section-header) | Overline + trailing action | Recent transactions · `View all →` |
| Content | [Transaction Card](../../design-system/08-component-library.md#transaction-card) | Default | Up to 5 rows |
| Content | [Empty State](../../design-system/08-component-library.md#empty-state) | Icon + title + body + Button | Dashboard-empty |
| Content | [Loading Skeleton](../../design-system/08-component-library.md#loading-skeleton) | Card + row shapes | First launch |
| Content | [Currency Display](../../design-system/08-component-library.md#currency-display) | Money Hero / Medium / Body | Inside every card |
| Content | [Avatar](../../design-system/08-component-library.md#avatar) | Initials · `size.avatar.md` | App bar trailing |
| Content | [Badge](../../design-system/08-component-library.md#badge) | Status (warning) | Not-synced prefix on sync line |
| Content | [Icon Button](../../design-system/08-component-library.md#icon-button) | 44 dp target | Avatar tap (opens More) |
| Feedback | [Snackbar](../../design-system/08-component-library.md#snackbar--toast) | Success with `Add another` action | After Save from INC-01 |

**Not on this screen** (documented for defenders reading later): Tabs, Segmented Control, Chip, Search, Filter, Card charts, Statistic Card, Summary Card. Any of these would break the [Density Rules](../../ux/08-dashboard-ux.md#density-rules).

---

## 4. Information Hierarchy

Ranked strictly by "why do owners open the app" ([08 · Dashboard UX](../../ux/08-dashboard-ux.md#what-metrics-matter-most)).

| Rank | Element | Size / weight | Rationale |
| --- | --- | --- | --- |
| 1 | Today's income value | Money Hero (32 / 700) | The number the app is opened to see |
| 2 | Today's income label + delta | Caption + Body Small (delta with icon) | Context around the hero |
| 3 | Expenses value | Money Medium (20 / 700) | Cost side of today |
| 4 | Net collection value | Money Medium (20 / 700) | What's left |
| 5 | `+ Add income` FAB label | Button style (16 / 700), text.inverse on brand.primary | Next action |
| 6 | `+ Add expense` ghost | Button style, brand.primary text | Secondary action |
| 7 | Recent transaction rows | Body Emphasis (name) · Body Small (services) · Money Body (amount) | Verify counts |
| 8 | Section header "Recent transactions" | Overline, text.secondary | Label only, not a competitor |
| 9 | Sync line | Body Small, text.muted | Trust cue, out of the way |
| 10 | App bar business name | H2, text.primary | Identity — not the story |

No two elements share the same tier of visual weight; contrast in size/weight is the hierarchy vehicle, per [04 · Typography](../../design-system/04-typography.md#do-s--don-ts).

---

## 5. Spacing

Every gap comes from [05 · Spacing System](../../design-system/05-spacing-system.md). No custom values.

| Between | Token | dp |
| --- | --- | --- |
| Screen horizontal padding | `space.4` | 16 |
| App bar bottom → hero card top | `space.4` | 16 |
| Hero card → peer row | `space.3` | 12 |
| Peer card ↔ peer card (gutter) | `space.3` | 12 |
| Peer row → Add expense ghost | `space.2` | 8 |
| Add expense ghost → section header | `space.5` | 24 |
| Section header ↔ first transaction | `space.2` | 8 (per Section Header spec) |
| Transaction card ↔ transaction card | `space.2` | 8 |
| Last transaction → sync line | `space.5` | 24 |
| Sync line → bottom nav (FAB clearance) | `space.8`+ | ≥ 48 |
| Hero card internal vertical padding | `space.5` | 24 |
| Peer card internal vertical padding | `space.4` | 16 |
| FAB → screen edges (right + bottom above nav) | 16 dp per FAB spec | 16 |

Rhythm rule: every card ends on a `space.4` boundary; every section break uses `space.5`. Never `space.3` or below for screen padding.

---

## 6. Typography

Sourced from [04 · Typography](../../design-system/04-typography.md#type-scale) and the semantic table. All styles are tokens, never inline values.

| Element | Style token | Color token |
| --- | --- | --- |
| App bar title (business name) | `font.style.h2` | `color.text.primary` |
| Hero card label ("Today's income") | `font.style.caption` (uppercase off) | `color.text.secondary` |
| Hero card value | Money Hero (32 / 700, tabular) | `color.text.primary` |
| Hero delta `↑ ₹1,200 vs yesterday` | `font.style.bodySmall` + `↑` icon | `color.status.success` for `+`, `color.text.secondary` for `−` (never red) |
| Peer card label | `font.style.caption` | `color.text.secondary` |
| Peer card value | Money Medium (20 / 700, tabular) | `color.text.primary` |
| Add expense ghost button | `font.style.button` | `color.brand.primary` |
| Section header "RECENT TRANSACTIONS" | `font.style.overline` (11 / 700, 0.6 tracking, uppercase) | `color.text.secondary` |
| Section header trailing `View all →` | `font.style.button` (14) | `color.brand.primary` |
| Transaction card row 1: employee name | `font.style.bodyEmphasis` | `color.text.primary` |
| Transaction card row 2: services | `font.style.bodySmall` | `color.text.secondary` |
| Transaction card row 3: gross amount | Money Body (16 / 600) | `color.text.primary` |
| Transaction card row 3: commission | `font.style.caption` | `color.text.muted` |
| Payment mode chip on card | `font.style.caption` uppercase off | tint per [Payment Mode Tints](../../design-system/03-color-system.md#payment-mode-tints) |
| Sync line | `font.style.bodySmall` | `color.text.muted` |
| Sync line prefix badge "Not synced" (> 24 h) | Badge with `sync-off` icon | `color.status.warning` text, `color.status.warningBg` background |
| FAB Extended label "+ Add income" | `font.style.button` | `color.text.inverse` on `color.brand.primary` |

Money is never italic, never truncated, always tabular figures (`tnum`). Currency symbol matches value weight.

---

## 7. Card Layout

Uses [Money Card](../../design-system/08-component-library.md#money-card) and [Transaction Card](../../design-system/08-component-library.md#transaction-card) as-is — no bespoke variants.

### Hero Money Card

```
┌────────────────────────────────────────────┐
│  TODAY'S INCOME                            │   ← Caption, text.secondary
│                                            │
│  ₹12,450                                   │   ← Money Hero, text.primary
│                                            │
│  ↑ ₹1,200 vs yesterday                     │   ← Body Small + icon, status.success
└────────────────────────────────────────────┘
   surface.default · radius.md · elevation.1
   space.5 vertical · space.4 horizontal · full width
```

- Non-interactive. No tap target ([08 · Dashboard UX Interaction Rules](../../ux/08-dashboard-ux.md#interaction-rules)).
- Delta row omitted when there is no yesterday data (day 1) or when today value is `₹0`.
- Delta uses `↑`/`↓` icon from icon set — never a `+`/`−` color-only signal (satisfies [Color · not by color alone](../../design-system/03-color-system.md#status)).

### Peer Money Cards (Expenses · Net collection)

```
┌───────────────────┐   ┌───────────────────┐
│  EXPENSES         │   │  NET COLLECTION   │
│  ₹1,200           │   │  ₹11,250          │
└───────────────────┘   └───────────────────┘
```

- Two equal-width cards separated by `space.3`.
- Same anatomy as hero but Money Medium; no delta line (avoids competing with hero).
- Non-interactive.

### Transaction Card (used in Recent Transactions)

Spec is verbatim from the component library:

```
┌────────────────────────────────────────────┐
│ Suresh Kumar                    [ Cash ]   │  ← Body Emphasis + payment chip
│ Haircut · Beard                            │  ← Body Small, truncated 40 chars
│                                 ₹450       │  ← Money Body
│                                  ₹90 comm. │  ← Caption, text.muted
└────────────────────────────────────────────┘
   72 dp min · space.4 padding
```

- Tap → Transaction Detail sheet (uses [Bottom Sheet](../../design-system/08-component-library.md#bottom-sheet), not defined here).
- Long press → nothing (per [16 · UX Guidelines](../../design-system/16-ux-guidelines.md) and Dashboard UX).
- Divider between rows omitted; whitespace does the separating.

### Section Header

```
RECENT TRANSACTIONS                View all (12 today) →
```

- Overline left · Button-style trailing action, brand.primary.
- Trailing action appears **only** when there are more than 5 rows today.

---

## 8. Empty State

Reference: [08 · Dashboard UX · Empty State](../../ux/08-dashboard-ux.md#empty-state-zero-transactions), rendered with [Empty State](../../design-system/08-component-library.md#empty-state) mechanics.

Content layout is preserved — hero and peers still render with `₹0`, because the shape of the day is the message. Only the Recent Transactions block is replaced.

```
┌────────────────────────────────────────────┐
│  TODAY'S INCOME                            │
│  ₹0                                        │
└────────────────────────────────────────────┘
┌───────────────────┐   ┌───────────────────┐
│  EXPENSES  ₹0     │   │  NET  ₹0          │
└───────────────────┘   └───────────────────┘

           ┌─────────────┐
           │  📥 (icon)  │   ← size.icon.xl, text.muted
           └─────────────┘
        No income yet
        Add your first entry to see today's totals.
                  ─
              (FAB below carries the CTA)
```

- Empty State body sits centered in place of the transactions list.
- No inline button: the FAB Extended `+ Add income` is the only CTA (avoids two primaries — [One Primary Action Per Screen](../../design-system/16-ux-guidelines.md#one-primary-action-per-screen)).
- Ghost `+ Add expense` remains available above (that is the second-highest-frequency action for a fresh day).
- Hero delta row is omitted.
- Sync line renders normally.

Copy uses translation keys (see §15).

---

## 9. Loading State

Reference: [Loading Skeleton](../../design-system/08-component-library.md#loading-skeleton) and [08 · Dashboard UX · Loading State](../../ux/08-dashboard-ux.md#loading-state-first-launch-after-install).

Only shown on **first launch after install** (or after restore). Repeat visits read SQLite instantly — no skeleton, ever.

Skeleton shapes exactly mirror final content:

```
┌────────────────────────────────────────────┐
│ ▓▓▓▓▓▓▓                                    │  ← hero label placeholder
│ ▓▓▓▓▓▓▓▓▓▓▓▓                               │  ← hero value placeholder (Money Hero height)
└────────────────────────────────────────────┘
┌────────────────┐   ┌────────────────┐
│ ▓▓▓            │   │ ▓▓▓            │
│ ▓▓▓▓▓▓▓        │   │ ▓▓▓▓▓▓▓        │
└────────────────┘   └────────────────┘
▓▓▓▓▓▓▓▓▓▓▓▓ (section header)
[ ▓▓▓▓ card ] × 3
```

- Shimmer: `background.subtle → surface.raised → background.subtle`, sweep over `motion.duration.deliberate` (480 ms), 200 ms rest.
- No spinner. Skeletons only.
- FAB is present but **disabled** (no data model yet); becomes enabled the moment the first frame of real data lands.
- On reduced-motion: shimmer becomes a static pulse (opacity 0.4 → 0.7 → 0.4) per [Motion System](../../design-system/09-motion-system.md#reduced-motion).

---

## 10. Offline State

Reference: [08 · Dashboard UX · Offline State](../../ux/08-dashboard-ux.md#offline-state).

Design intent: **offline is not an error**. The Dashboard reads from SQLite; totals are always current. Therefore the offline state is *visually identical* to online.

- No banner. No overlay. No warning.
- Every card, chip, and CTA renders identically.
- FAB works. Save writes to SQLite and enqueues to the sync outbox.
- **Only signal**: the sync line reads `Last synced <time> · Offline`. Uses Body Small, `text.muted`, no icon flag.
- If the device stays offline > 24 h, the sync line gains a `Not synced` [Badge](../../design-system/08-component-library.md#badge) (status.warning, with `sync-off` icon).

Rationale: presence of an "offline banner" would train the owner to distrust the app during real-world signal drops.

---

## 11. Sync Status

Reference: [08 · Dashboard UX · Sync Status Line](../../ux/08-dashboard-ux.md#sync-status-line) and [Sync Status · Dashboard Syncing](../../ux/08-dashboard-ux.md#syncing-state).

Single line at the bottom of the scroll surface, immediately above the FAB clearance.

| State | Content | Component |
| --- | --- | --- |
| Synced (recent) | `Last synced 2 minutes ago` | Body Small · text.muted |
| Syncing | `Syncing…` with 12 dp inline circular progress | Body Small · text.muted + [Progress](../../design-system/08-component-library.md#progress) circular |
| Just completed | `Last synced just now` | Body Small · text.muted (cross-fade over `motion.duration.fast`) |
| Not synced > 24 h | `[Not synced] Last synced 3 hours ago` | [Badge](../../design-system/08-component-library.md#badge) status.warning prepended |
| Offline | `Last synced 2 minutes ago · Offline` | Body Small · text.muted (single line) |
| Sync failed | Line stays as last-synced; the retry surfaces via [Snackbar](../../design-system/08-component-library.md#snackbar--toast) with `Retry` action | Snackbar variant `with-action` |

Rules:

- Tap on the sync line → navigates to Settings → Sync Status (rare tap).
- The Dashboard **never opens a dialog** for a sync issue. Blocking on sync would violate [Dashboard Anti-Patterns · Any modal on the Dashboard](../../ux/08-dashboard-ux.md#anti-patterns).
- Sync line is inside the scroll surface (not fixed), so it does not compete with the FAB.

---

## 12. Success Feedback

Reference: [16 · UX Guidelines · Success](../../design-system/16-ux-guidelines.md), [Snackbar](../../design-system/08-component-library.md#snackbar--toast), and [09 · Motion](../../design-system/09-motion-system.md#success-animation).

The Dashboard emits no success feedback of its own (screens don't celebrate opening). Success arrives *back* from an action that returned the user to the Dashboard.

| Trigger | Feedback |
| --- | --- |
| Return from INC-01 after Save | Success Snackbar: `Saved · Add another`, 5 s (has action) |
| Return from EXP-02 after Save | Success Snackbar: `Expense saved · Add another`, 5 s |
| Undo delete of a transaction (from the Detail sheet) | Neutral Snackbar: `Transaction restored`, 3 s |
| First-render on cold start | Silent — the *presence* of updated totals is the feedback |

Rules:

- Snackbar is bottom-centered, positioned **above** the FAB and bottom nav (FAB and nav stay tappable — snackbar never covers the CTA area per [Snackbar Do's & Don'ts](../../design-system/08-component-library.md#snackbar--toast)).
- One snackbar at a time.
- Snackbar action `Add another` re-opens INC-01 (or EXP-02) pre-blanked.
- Adding a new transaction on the same-day view causes the new [Transaction Card](../../design-system/08-component-library.md#transaction-card) to slide in at the top of the Recent Transactions list (fade + 8 dp slide up, `motion.duration.normal`, `motion.easing.standard`).
- Hero and peer values recompute silently — no animated count-up (would delay the read).

No confetti, no full-screen check overlay, no goal-hit celebration ([Anti-Patterns](../../ux/08-dashboard-ux.md#anti-patterns)).

---

## 13. Error Handling

The Dashboard is a read surface. It has no forms and no user-committed writes, so its error surface is narrow.

| Failure | Surface | Component |
| --- | --- | --- |
| SQLite read fails on cold start | Full-screen [Empty State](../../design-system/08-component-library.md#empty-state) with `alert-triangle` icon, title "Couldn't load", body "Restart the app or restore from backup.", primary Button "Restore" → SET-04 | Empty State (reused, not new) |
| Sync error (foreground, user pulled to refresh) | [Snackbar](../../design-system/08-component-library.md#snackbar--toast) danger variant, 8 s, action `Retry` | Snackbar |
| Sync error (background, silent) | No banner. Sync line stays on last-synced; if > 24 h, `Not synced` [Badge](../../design-system/08-component-library.md#badge) appears. | Badge on sync line |
| Transaction card fails to open its Detail sheet | Neutral Snackbar `Couldn't open transaction`, 5 s | Snackbar |
| Network required for an action that reached the Dashboard | Never happens — the Dashboard requires no network ([DASH-01-OFFLINE](../04-dashboard.md#dash-01-offline--offline-state)) |
| Unknown crash during render | Fallback to global [Dialog](../../design-system/08-component-library.md#dialog) `GLB-DIALOG-ERROR` from [13 · Global Overlays](../13-global-overlays.md#glb-dialog-error--generic-error) | Dialog |

Rules:

- Errors never modal-block the Dashboard for anything the user did not personally trigger.
- Error snackbars use icon + label + color (not color alone) per [Accessibility · not by color alone](../../design-system/15-accessibility.md#color-contrast).
- Snackbar retry re-runs the exact failed operation and reports success or a fresh failure once.

---

## 14. Accessibility

Enforces [15 · Accessibility](../../design-system/15-accessibility.md).

- **Touch targets**: FAB 56 dp, secondary Ghost button 44 dp, transaction card 72 dp row, App Bar avatar wrapped in a 48 dp Icon Button, `View all →` extended to a 48 dp target with padding.
- **Focus order**: App Bar avatar → Hero Money Card (read-only text) → Expenses card → Net card → `Add expense` ghost → Section Header → each Transaction Card in list order → `View all` → Sync line → FAB → Bottom Nav (Dashboard tab active, other 3 tabs).
- **Roles**:
  - App Bar title: `header`.
  - Money Cards: `text` (grouped) with `accessibilityLabel` compound: `"Today's income, twelve thousand four hundred fifty rupees, up one thousand two hundred versus yesterday"`.
  - Transaction Card: `button`, label reads employee name, services, amount, and payment mode.
  - Ghost / FAB: `button`.
  - Sync line: `button` when tappable, hint `"Opens sync status"`.
- **Live announcements**:
  - After save: `announceForAccessibility("Income saved. Add another available.")`.
  - When a new transaction slides into the list: polite live region on the recent-transactions container.
  - When sync line flips to `Syncing…` / `Last synced just now`: `accessibilityLiveRegion="polite"` on the sync line.
- **Reduced motion**: cross-fades replace slide/scale; skeleton pulse replaces shimmer; FAB fades in without scale.
- **Text scaling**: layout tested to 200 % OS text size. Money never truncates — instead, `label` above the value wraps to two lines. Peer cards stack vertically at very large scales.
- **Color independence**: delta always includes `↑`/`↓`; `Not synced` always includes an icon; payment mode chip carries the mode label, not just the tint.
- **Haptics**: light haptic on FAB press-release, medium haptic on failed pull-to-refresh, none on scroll or card render.
- **No time-limited actions.** Snackbars pause on screen reader focus.

---

## 15. Localization

Enforces [14 · Localization](../../design-system/14-localization.md).

- Every string is a translation key. No literals on the Dashboard.

| Element | Key |
| --- | --- |
| App bar avatar `accessibilityLabel` | `common.profile` |
| Hero label | `dashboard.income.today` |
| Delta up | `dashboard.delta.up` with `{{amount}}` |
| Delta down | `dashboard.delta.down` with `{{amount}}` |
| Peer expense label | `dashboard.expenses.today` |
| Peer net label | `dashboard.net.today` |
| Ghost button | `expense.add` |
| Section header | `dashboard.recent.title` |
| Section trailing action | `dashboard.recent.viewAll` with `{{count}}` |
| Empty state title | `dashboard.empty.title` |
| Empty state body | `dashboard.empty.body` |
| Sync line synced | `sync.line.synced` with `{{relative}}` |
| Sync line syncing | `sync.line.syncing` |
| Sync line offline | `sync.line.offline` |
| Not-synced badge | `sync.badge.notSynced` |
| FAB Extended label | `income.add` |
| Success snackbar | `income.saved` + action `common.addAnother` |
| Error snackbar (sync) | `sync.error.retry` + action `common.retry` |

Rules on the Dashboard specifically:

- Peer cards are **equal width** by design — long translations of "Net collection" (up to +40 % in Kannada/Tamil per [String Length Assumptions](../../design-system/14-localization.md#string-length-assumptions)) wrap to two lines rather than shrinking the value.
- Money is always Latin digits (`₹12,450`) across all 7 MVP locales; locale controls grouping only (`en-IN` grouping is default).
- Relative time on the sync line uses locale-native words via i18next relative-time plugin.
- Devanagari/Tamil/Telugu labels use `Anek` script fonts with `lineHeight.relaxed` (1.6) so glyph descenders do not clip inside cards.
- No Dashboard string may be uppercased in Indic scripts — the Overline `RECENT TRANSACTIONS` is uppercased only for Latin; for Indic locales the Overline style keeps 0.6 tracking but drops the uppercase transform.

---

## 16. One-Handed Usability

The design assumes the owner is holding the phone in one hand — often the non-dominant one — while a client is in the chair. Every action lives inside the thumb arc.

- **Primary action** (`+ Add income` FAB) sits bottom-right, 16 dp above bottom nav. Reachable by a right-handed thumb without regripping. Left-handed users still reach it because FAB is within 25 mm of the bottom edge.
- **Secondary action** (`+ Add expense` ghost) sits inside the scroll area but is intentionally placed high enough that mid-scroll it drifts into the thumb arc as the list moves.
- **Bottom nav** anchors thumb-friendly global navigation.
- **App bar** contains **only** read-only identity + a rarely-tapped avatar. No back button (root screen). No search icon (Dashboard is not a list).
- **No top-of-screen tap requirements** for the golden path. The only reason to reach up is to switch app or open the profile — both infrequent.
- **Transaction rows**: 72 dp height provides thumb comfort even at the top of the recent list; tap opens a Bottom Sheet, which itself has thumb-anchored actions.
- **Pull-to-refresh** is the primary "refresh" gesture — a natural downward pull with the thumb.
- **No long-press interactions** anywhere on this screen ([UX Guidelines](../../design-system/16-ux-guidelines.md) and [Dashboard Interaction Rules](../../ux/08-dashboard-ux.md#interaction-rules)).
- **Snackbar** appears above the FAB so its `Add another` action is also within the thumb arc.
- **FAB hides on scroll-down, reveals on scroll-up** — a thumb dragging up to scroll immediately regains the FAB when they change direction to tap it.

---

## 17. Animation Notes

All motion uses tokens from [09 · Motion System](../../design-system/09-motion-system.md). Nothing new.

| Moment | Motion | Duration token | Easing token |
| --- | --- | --- | --- |
| First render of Hero + peers | Fade + slide up 8 dp | `motion.duration.slow` (320 ms) | `motion.easing.standard` |
| Subsequent renders (tab return) | Cross-fade only | `motion.duration.fast` (120 ms) | `motion.easing.standard` |
| Skeleton shimmer | Left-to-right gradient sweep | `motion.duration.deliberate` (480 ms) loop, 200 ms rest | `motion.easing.standard` |
| Skeleton → real data swap | Cross-fade | `motion.duration.normal` (200 ms) | `motion.easing.standard` |
| New transaction card enters list | Fade + slide up 8 dp | `motion.duration.normal` | `motion.easing.enter` |
| FAB first render | Scale 0.8 → 1.0 + opacity 0 → 1 | `motion.duration.normal` | `motion.easing.standard` |
| FAB press | Scale 1.0 → 0.94 → 1.0 | `motion.duration.instant` (80 ms) | `motion.easing.standard` |
| FAB hide on scroll-down | Scale to 0 + fade out | `motion.duration.fast` | `motion.easing.exit` |
| FAB reveal on scroll-up | Scale back + fade in | `motion.duration.fast` | `motion.easing.enter` |
| Sync line syncing → synced | Cross-fade text | `motion.duration.fast` | `motion.easing.standard` |
| Snackbar in / out | Slide from bottom + fade | `motion.duration.normal` | `enter` / `exit` |
| App bar shadow at scroll > 4 dp | Cross-fade | `motion.duration.fast` | `motion.easing.standard` |
| Reduced motion | All slides/scales replaced by cross-fade of same duration; shimmer becomes static pulse (opacity 0.4 ↔ 0.7) | — | — |

Anti-patterns explicitly forbidden here: value count-up animations on money (delays the read), bounce on FAB, parallax on the hero card, staggered entrance on transaction cards ("all-at-once cross-fade" is the rule for repeat renders).

---

## 18. Developer Notes

For the team implementing [DASH-01](../04-dashboard.md#dash-01--dashboard). Composition guidance only — no runtime code implied.

- **Compose, don't extend.** The Dashboard is a composition of catalogue components; no new component class is introduced. If the design appears to need one, revisit the spec.
- **Single source of truth for money values.** Hero, peer cards, and each Transaction Card all render through the [Currency Display](../../design-system/08-component-library.md#currency-display) component. No inline formatting. This guarantees tabular figures, grouping, and negative-sign handling.
- **Reads are local.** All four aggregates (today's income, expenses, net, recent transactions) are single SQLite queries against the same day-boundary (04:00 local per [Business Day Boundary](../../ux/08-dashboard-ux.md#business-day-boundary)). Aggregate in a single `report-service` call; do not fan out four queries from the screen.
- **Recompute triggers**:
  1. Tab focus on Dashboard.
  2. Successful sync completion.
  3. App foregrounded and > 30 s since last render.
  4. Return from INC-01 / EXP-02 with a save result.
  There is no polling interval and no manual refresh button.
- **Skeleton gate.** Skeleton renders **only** when no snapshot has been produced by `report-service` in the current app process. Once a snapshot exists (even empty), reopening the screen never re-shows skeletons.
- **Delta computation.** Yesterday's income comes from the same aggregate service. If yesterday's snapshot is absent (day 1) or if today is `₹0`, the delta row is omitted — not rendered as `↑ ₹0`.
- **View-all threshold.** Section header trailing action visible iff `transactionsToday.length > 5`. Count in the label reflects total, not the 5 shown.
- **FAB and Snackbar coexist.** The Snackbar layer must position itself above the FAB and the Bottom Navigation using safe-area math from a single "footer stack" calculation. No hard-coded offsets.
- **Data model dependencies.** Prerequisites per [15 · Dependency Matrix — DASH-01](../15-dependency-matrix.md): Auth ✓, BusSet ✓, Migrate ✓, SetRepo ✓, RepSvc ✓; IncRepo / ExpRepo are soft (screen still renders when empty).
- **State classes owned by this screen**: `data | empty | loading | error`. Offline is *not* a state of this screen — it is a property of the environment reflected only in the sync line.
- **Analytics**: fire `dashboard.viewed` on focus, `dashboard.fab.pressed` on FAB tap, `dashboard.ghost.expense.pressed` on ghost tap, `dashboard.transaction.opened` on transaction tap, `dashboard.viewAll.pressed` on section trailing action. No PII in event props.
- **Testing hooks**: expose stable `testID` on hero card, both peer cards, FAB, ghost button, section header, and each transaction row (`testID={\`dash-tx-${transaction.id}\`}`).
- **Non-goals for MVP**: greetings ("Good morning"), any chart, any card badge on the bottom-nav Dashboard tab, in-Dashboard notifications, weekly/monthly toggles, targets/goals ([Anti-Patterns](../../ux/08-dashboard-ux.md#anti-patterns)).
- **Cross-links**: entering from cold start goes Splash → Auth (if needed) → Dashboard; from other tabs, tab switch is an instant cross-fade per [Motion · Tab switch](../../design-system/09-motion-system.md#screen-transitions).

---

## Traceability

Every element above resolves to a Design System catalogue entry:

App Bar · Bottom Navigation · FAB (Extended) · Money Card · Transaction Card · Section Header · Button (Ghost) · Snackbar · Empty State · Loading Skeleton · Progress (inline circular) · Badge · Icon Button · Avatar · Currency Display · Dialog (fallback only) · Bottom Sheet (transaction detail exit, not on this screen). Zero net-new components.
