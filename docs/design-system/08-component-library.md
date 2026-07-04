# 08 · Component Library

Every screen composes from this catalogue. If you need something not listed here, propose adding it to the system — do not build a one-off.

Each component below defines: **Purpose · Variants · States · Sizing · Spacing · Accessibility · Interaction · Do's · Don'ts**.

---

## Button

**Purpose**: Trigger a user-committed action.

**Variants**

| Variant | Use |
| --- | --- |
| Primary | The one committed action per screen |
| Secondary | Reversible or navigational actions |
| Ghost | Tertiary actions inside cards/sheets |
| Destructive | Delete, discard, remove |

**States**: default, pressed, loading, disabled.

**Sizing**

- Height: 52 dp (primary), 44 dp (secondary/ghost), 40 dp (dense contexts).
- Horizontal padding: `space.4` (16).
- Icon-to-label gap: `space.2` (8).
- Corner radius: `radius.md` (12).

**Accessibility**

- Full width on forms; auto width in inline groups.
- `accessibilityRole="button"`.
- Loading state disables re-tap.

**Do's**: single primary per screen; use verbs ("Save", "Add income"); loading state instead of disabling silently.
**Don'ts**: two primary buttons side by side; ALL CAPS labels; icons without a label unless universally known.

---

## Icon Button

**Purpose**: Trigger a common action recognized by its icon (back, close, more).

**Sizing**: 48 × 48 dp touch target; 20–24 dp icon.
**States**: default, pressed (`interactive.pressed` overlay), disabled (`opacity.disabled`).
**Accessibility**: `accessibilityLabel` required, must be a translation key (`t("common.back")`).

**Do's**: reserve for universally recognized actions.
**Don'ts**: never use for actions the user performs rarely — label them instead.

---

## FAB (Floating Action Button)

**Purpose**: One primary creation action per major screen (Add income, Add expense).

**Variants**

| Variant | Use |
| --- | --- |
| Regular | 56 dp, one per screen |
| Extended | Icon + label, 56 dp height, used when the action needs emphasis |

**Sizing**: 56 dp diameter, positioned 16 dp from bottom-right (or above bottom nav with 16 dp gap).
**Elevation**: `elevation.5` at rest, `elevation.4` when pressed.
**States**: default, pressed, hidden-on-scroll (fades over `motion.duration.normal`).

**Do's**: one FAB per screen; consistent icon (`plus`); Extended variant on Income and Expense entry screens for clarity.
**Don'ts**: FAB for destructive actions; FAB inside modals or sheets.

---

## Text Field

**Purpose**: Free-text entry when selection is not possible.

**Anatomy**: label (above), input, help/error (below).

**Variants**: single-line, multi-line (remarks), numeric, money, OTP, mobile number.

**States**: rest, focused, filled, error, disabled, read-only.

**Sizing**

- Height: 52 dp single-line.
- Horizontal padding: `space.4` (16).
- Corner radius: `radius.sm` (8).
- Border: 1 dp `border.subtle` (rest), 2 dp `brand.primary` (focus), 1 dp `status.danger` (error).

**Accessibility**

- Label always visible above input (never rely on placeholder as label).
- Numeric keyboard for money/mobile.
- Autofocus only when it saves the user a tap and does not push CTAs off-screen.
- Screen reader announces label + current value + error.

**Do's**: pair with help text for constraints; instant validation on blur; use numeric keyboard for money.
**Don'ts**: placeholder-as-label; multiple fields per row on phone; free-text where a chip/dropdown would work.

---

## Search

**Purpose**: Filter a local list quickly.

**Anatomy**: `search` icon leading, input, clear (`x`) trailing.

**Sizing**: 44 dp height, `radius.md` (12), `surface.default` background, 1 dp `border.subtle`.

**Interaction**

- Debounce 200 ms.
- Search is **local-only** (SQLite).
- Empty-search state shows the full list.
- Cancel/clear returns to the unfiltered list.

**Do's**: show recent selections above the list; keep placeholder short (`t("search.employee")`).
**Don'ts**: send search queries to network; hide search behind an extra tap on core list screens.

---

## Dropdown / Bottom Sheet Select

**Purpose**: Pick one value from a small-to-medium list.

**Rule**: On mobile, **dropdown = bottom sheet**. Never a native OS dropdown.

**Variants**: single-select, multi-select (services in income entry).

**Anatomy**: trigger looks like a text field with a `chevron-down` icon; opens a bottom sheet with search (when > 6 items) and options.

**Do's**: recent selections pinned to top; active items above inactive; large row heights (48 dp) for easy tapping.
**Don'ts**: native picker; cascading dropdowns; dropdowns inside dropdowns.

---

## Bottom Sheet

**Purpose**: Focused decision or quick edit without leaving context.

**Variants**

| Variant | Use |
| --- | --- |
| Standard | Selection, filter, quick edit |
| Modal (blocking) | Confirmation, destructive actions |
| Full-height | Long lists (rare — prefer a full screen instead) |

**Anatomy**: handle bar (24 × 4 dp), title, optional close (`x`), content, primary action fixed at bottom.

**Sizing**

- Top radius: `radius.xl` (24).
- Top padding: `space.5` (24).
- Bottom padding: `space.5` + safe area inset.

**Interaction**

- Swipe down to dismiss (non-blocking sheets).
- Tap on scrim to dismiss (non-blocking sheets).
- Blocking sheets require an explicit action to dismiss.

**Do's**: title present in all sheets; primary action reachable with one thumb.
**Don'ts**: multiple stacked sheets; scrollable content taller than 80% of viewport (use full screen instead).

---

## Date Picker

**Purpose**: Pick a business date for expense or filter.

**Rule**: Use bottom-sheet-based date picker, not native OS picker on Android (inconsistent look across devices).

**Presets** (must appear at top of sheet):

- Today
- Yesterday
- This month
- Last month
- Custom (opens calendar)

**Do's**: default to today; show selected date prominently.
**Don'ts**: allow future dates for income/expense; require year selection to change one day.

---

## List Item

**Purpose**: One row in a browsable list.

**Anatomy**: leading (avatar / icon / nothing), primary text, secondary text (optional), trailing (amount / chevron / icon / nothing).

**Sizing**

- Single-line: 56 dp height.
- Two-line: 72 dp height.
- Left/right padding: `space.4` (16).
- Leading → text gap: `space.3` (12).

**States**: default, pressed, selected (`interactive.selected` background), disabled.

**Do's**: divider between rows only when it aids scanning; consistent trailing element per list.
**Don'ts**: three lines of text per row on phone; mixed row heights within one list.

---

## Service Card

**Purpose**: Represents one service in a list or selection sheet.

**Anatomy**: service name (H3), price (Money Medium, right), active badge (if inactive).
**Sizing**: 72 dp height, `space.4` padding, `radius.md`.
**Selection**: selected state uses `interactive.selected` background and a check icon on the left.

**Do's**: show active/inactive badge only when inactive.
**Don'ts**: show more than name + price + status on a card in selection contexts.

---

## Employee Card

**Purpose**: Represents one employee for selection or list contexts.

**Anatomy**: avatar (initials on `background.subtle`), name (H3), role/subtitle (Body Small `text.secondary`), trailing metric (optional — today's commission).
**Sizing**: 72 dp height.
**States**: default, selected, inactive (opacity 0.6).

**Do's**: recent selections above inactive.
**Don'ts**: photos in MVP (initials only).

---

## Transaction Card

**Purpose**: Represents one income transaction in dashboard or reports.

**Anatomy**:

- Row 1: Employee name (Body Emphasis), payment mode chip (right).
- Row 2: Services summary (Body Small, truncated).
- Row 3: Gross amount (Money Body, right), commission amount (Caption `text.muted`, right, below).

**Do's**: tap opens a bottom sheet with full detail.
**Don'ts**: show full service list inline — truncate to 40 characters.

---

## Expense Card

**Purpose**: Represents one expense record.

**Anatomy**: category chip (left), amount (Money Body, right), date (Caption), remarks preview (Body Small, truncated to 1 line).
**Sizing**: 72 dp.

**Do's**: show remarks only when present; category chip uses category color tint.
**Don'ts**: mix currency formats.

---

## Money Card

**Purpose**: Dashboard-level statistic (today's income, today's expenses, net collection).

**Anatomy**: label (Caption `text.secondary`), value (Money Hero for lead card, Money Large for peers), optional delta (`+₹200 vs yesterday` — Body Small with icon).

**Sizing**: full-width, `space.5` (24) vertical padding, `radius.md` (12), `elevation.1`.

**Do's**: use one hero money card per screen (income); peers are Money Large.
**Don'ts**: three hero-sized values on one screen; color-code the number itself.

---

## Summary Card

**Purpose**: Compact grouping of related stats (e.g., commission per employee).

**Anatomy**: title (H3), 2–4 stat pairs (label + value), optional inline action ("View all →").

**Do's**: max 4 stats per summary card.
**Don'ts**: replace a proper report screen with an oversized summary card.

---

## Statistic Card

**Purpose**: A single labeled number with optional delta.

**Anatomy**: label (Caption `text.secondary` uppercase), value (Money Large), delta (Caption + `+/−` icon).

**Sizing**: minimum height 88 dp, flexible width.

**Do's**: use in report screens for consistent stat rendering.
**Don'ts**: crowd more than 3 in a horizontal row on phone.

---

## Avatar

**Purpose**: Represents an employee.

**Variants**: initials-only (default MVP), photo (future).

**Sizing**: `size.avatar.sm` (32), `size.avatar.md` (40), `size.avatar.lg` (56), `size.avatar.xl` (80).

**Style**: circular, `background.subtle` fill, initials in `text.primary` (Semibold), max 2 letters.

**Do's**: assign a stable subtle tint per employee (hash of ID → tint pool).
**Don'ts**: emoji as avatars; multi-color gradients.

---

## Badge

**Purpose**: Communicate short status ("Active", "Synced", "3 pending").

**Variants**: status (success/warning/danger/info), neutral, count.

**Sizing**: 20 dp height, `space.2` horizontal padding, `radius.full`.

**Anatomy**: optional icon (12 dp) + label (Caption, uppercase).

**Do's**: always include icon or clear label; use status colors from the token set.
**Don'ts**: replace icons with color-only badges.

---

## Chip

**Purpose**: Selectable option (payment mode, service in income, filter, category).

**Variants**: filter chip (multi/single select), choice chip, input chip (for typed values, rare).

**Sizing**: 36 dp height, `space.3` horizontal padding, `radius.full`.

**States**: default (`surface.default` + `border.subtle`), selected (`brand.primary` bg + `text.inverse`), disabled.

**Do's**: minimum 8 dp gap between chips; wrap onto multiple lines.
**Don'ts**: horizontal scroll of chips (harder to discover); more than 12 chips visible (introduce a bottom sheet).

---

## Tabs

**Purpose**: Switch between peer views within a screen (Reports: Daily / Monthly).

**Variants**: text tabs (default), icon+text (rare).

**Sizing**: 48 dp height, underline indicator 2 dp, `brand.primary`.

**States**: active (Body Emphasis + brand color underline), inactive (Body + `text.secondary`).

**Do's**: max 4 tabs on phone.
**Don'ts**: swipe-only tabs without visible affordance; nested tabs.

---

## Segmented Control

**Purpose**: Choose one from 2–3 mutually exclusive short options (e.g., "%" vs "₹" in commission).

**Sizing**: 40 dp height, `radius.md`, `background.subtle` outer, selected pill uses `surface.default` + `elevation.1`.

**Do's**: only 2 or 3 segments.
**Don'ts**: use for lists longer than 3 items — switch to chips or dropdown.

---

## App Bar

**Purpose**: Screen title and minimal actions.

**Anatomy**: leading (back or none), title (H2), 0–2 trailing icon buttons.

**Sizing**: 56 dp height + safe area top inset.

**Elevation**: 0 at rest, 2 on scroll.

**Do's**: single title, no subtitle; use icon buttons only for common actions (search).
**Don'ts**: overflow menus with 5+ items — move those to Settings; centered titles on Android (Android convention is left-aligned).

---

## Bottom Navigation

**Purpose**: Top-level navigation between the four MVP areas.

**Anatomy**: 4 items — Dashboard, Entries, Reports, More. Each item: icon + label.

**Sizing**: 64 dp height + safe area bottom.

**States**: active (filled icon + brand color label), inactive (outline icon + `text.secondary` label).

**Do's**: labels always visible; active state uses filled icon variant.
**Don'ts**: 5+ tabs; hide labels; add badges to the active tab.

---

## Snackbar / Toast

**Purpose**: Non-blocking feedback for background events (Saved, Sync failed, Deleted with undo).

**Variants**: neutral (default), success, warning, danger, with-action (undo/retry).

**Sizing**: 48 dp min height, `space.4` padding, `radius.md`, `elevation.5`, bottom-centered above bottom nav.

**Duration**: 3 s default, 5 s if action present, 8 s for error.

**Do's**: one snackbar at a time; short message (< 60 chars).
**Don'ts**: block the CTA area; use for critical decisions (use dialog instead).

---

## Dialog

**Purpose**: Confirmation or blocking decision (delete, discard, restore).

**Variants**: confirmation, destructive, informational.

**Anatomy**: title (H3), body (Body), primary + secondary buttons.

**Sizing**: max 320 dp width on phone, `radius.lg`, `elevation.4`.

**Do's**: reserve for irreversible or important decisions; primary action label is a verb ("Delete", not "OK").
**Don'ts**: multi-step forms in dialogs (use a screen); more than 2 buttons.

---

## Empty State

**Purpose**: Guide a user when a list has no data.

**Anatomy**: icon (`size.icon.xl`, `text.muted`), title (H2), body (Body `text.secondary`), one action (Button).

**Do's**: single actionable next step; localize all text via translation keys.
**Don'ts**: illustrations for MVP (icon only); passive "No data" message.

---

## Loading Skeleton

**Purpose**: Non-blocking hint that content is loading.

**Rules**

- Use skeletons for **initial** loads and restore operations.
- Skeleton shapes mirror the final content (cards, rows, money card).
- Never use spinners for local reads (they should be instant).

**Animation**: shimmer from left to right, `motion.duration.deliberate`, `motion.easing.standard`, loops.

**Do's**: match the layout of what will replace them.
**Don'ts**: use for user-triggered actions (use Button loading state instead).

---

## Progress

**Purpose**: Indicate progress of restore/backup operations.

**Variants**: linear (determinate), linear (indeterminate), circular (rare, for FAB or button loading).

**Do's**: show percentage for restore; provide a cancel affordance.
**Don'ts**: circular progress in cards; blocking full-screen spinners.

---

## Switch

**Purpose**: Toggle a boolean setting (active/inactive for service, employee).

**Sizing**: 32 × 20 dp thumb.
**States**: off (`interactive.disabled` track), on (`brand.primary` track).

**Do's**: label to the left, switch to the right.
**Don'ts**: switch inside forms that require Save — switches change state immediately.

---

## Checkbox

**Purpose**: Multi-select in list (rare in MVP — mainly for commission rule "apply to all services" future).

**Sizing**: 24 dp box; 48 dp touch target.
**States**: unchecked, checked, indeterminate, disabled.

**Do's**: label right of box; extend touch target to full row when in a list.

---

## Radio

**Purpose**: Single-select from a small explicit list (rare — prefer chips or segmented control).

**Sizing**: 24 dp; 48 dp touch target.

**Do's**: use only when the user must see all options at once.
**Don'ts**: 5+ options — switch to chips or bottom sheet select.

---

## Divider

**Purpose**: Visually separate list rows or grouped content.

**Variants**: full-width, inset (left-aligned to text baseline).

**Sizing**: 1 dp height, `color.divider`.

**Do's**: use sparingly; prefer spacing.
**Don'ts**: divider between every list row when spacing already suffices.

---

## Section Header

**Purpose**: Label a block of content inside a screen.

**Anatomy**: Overline text (all-caps 11 pt, letter-spacing 0.6), optional trailing action (e.g., "See all").

**Spacing**: `space.5` (24) above, `space.2` (8) below.

**Do's**: use `text.secondary` color; keep to 1 line.
**Don'ts**: mix section headers with H2 headings — one hierarchy per screen.

---

## Currency Display

**Purpose**: Render money consistently across the app.

**Rules**

- Always uses tabular figures.
- Currency symbol matches locale (₹ default).
- No decimals for whole amounts (₹1,250 not ₹1,250.00) unless the value has paise.
- Grouping follows locale (`en-IN`: ₹1,25,000).
- Negative values use a leading `−` (minus sign, not hyphen), never parentheses.
- Sign color is inherited from context, not baked into the component.

**Sizes**: use one of Money Hero / Large / Medium / Body / Small from [04-typography.md](04-typography.md).

**Do's**: use this component for every money value.
**Don'ts**: format money inline in screens; use color to convey sign.

---

## Commission Badge

**Purpose**: Show a commission value or rule.

**Variants**

| Variant | Example |
| --- | --- |
| Percentage | `20%` |
| Fixed | `₹50` |
| Zero | `No commission` (Caption `text.muted`) |

**Sizing**: 24 dp height, `space.2` padding, `radius.full`, `background.subtle` background, Body Small emphasis text.

**Do's**: consistent placement (trailing on employee-service pair rows).
**Don'ts**: colored backgrounds to distinguish % vs ₹ — the label carries meaning.

---

## Payment Mode Selector

**Purpose**: Pick payment mode during income entry (cash / UPI / card / other).

**Anatomy**: horizontal row of 4 Chips (one per mode) with icon + label.

**Rules**

- Wraps to 2 rows on narrow screens.
- Selected mode is remembered as the default for the next entry.
- Uses payment mode tints from [03-color-system.md](03-color-system.md) at rest; selected state uses `brand.primary` + `text.inverse`.

**Do's**: single-select; large chips (44 dp).
**Don'ts**: bottom sheet select (adds a step and hurts the 10-second target).

---

## Language Selector

**Purpose**: Switch app language from Settings.

**Anatomy**: list of languages with radio-style single-select. Each row shows the language name **in that language** (Hindi as "हिन्दी", not "Hindi").

**Do's**: switch is instant, no restart required.
**Don'ts**: language codes shown to the user (`en`, `hi`); flag icons (national flags don't map cleanly to languages).

---

## Component Ownership Matrix

| Category | Components |
| --- | --- |
| Core | Button, Icon Button, FAB, Text Field, Search, Dropdown, Bottom Sheet, Dialog |
| Content | List Item, Divider, Section Header, Empty State, Loading Skeleton |
| Domain | Service Card, Employee Card, Transaction Card, Expense Card, Money Card, Summary Card, Statistic Card, Currency Display, Commission Badge, Payment Mode Selector, Language Selector |
| Feedback | Snackbar, Progress, Badge |
| Selection | Chip, Tabs, Segmented Control, Switch, Checkbox, Radio |
| Navigation | App Bar, Bottom Navigation |
| Media | Avatar |

## General Rules For All Components

1. Every visible string uses a translation key (`t("...")`).
2. Every interactive element has an accessibility label.
3. Every touchable meets the 48 dp minimum target.
4. Every component reads tokens; nothing is hard-coded.
5. Every component supports both light and (future) dark tokens.
6. Every component has documented `default`, `pressed`, `disabled`, and (where relevant) `loading` states.
