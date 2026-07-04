# 05 · Information Hierarchy

For every screen the same four questions are answered:

1. **Primary information** — what the user came to see.
2. **Secondary information** — context that supports the primary.
3. **Actions** — what the user can do here.
4. **Visual priority** / **Reading order** / **Interaction order**.

Visual priority is expressed as a small number (`1` = strongest).

---

## Dashboard

| Rank | Element | Rationale |
| --- | --- | --- |
| 1 | Today's income (Hero Money Card) | The number the owner opens the app to see |
| 2 | FAB `+ Add income` (Extended) | The next most likely action |
| 3 | Today's expenses / Net collection (Peer money cards) | Immediate business context |
| 4 | Recent transactions (last 5) | Verify nothing is missing |
| 5 | Sync status line | Reassurance, non-critical |
| 6 | App bar (business name, avatar) | Identity, low interaction |

**Reading order**: top-to-bottom, left-to-right.
**Interaction order**: FAB → recent tx (tap to detail) → tab switch.

**Rules**

- Never push the Hero card below the fold.
- Never show ads, banners, or announcements above the Hero card.
- Only one hero-sized number per screen.

---

## Income Entry

| Rank | Element | Rationale |
| --- | --- | --- |
| 1 | Employee field | First decision |
| 2 | Services field | Second decision (drives amount) |
| 3 | Amount (auto-computed, read-only) | Result of services |
| 4 | Commission (auto-computed, read-only, muted) | Derived, reassurance |
| 5 | Payment mode chips | Third decision (defaulted) |
| 6 | Save button (bottom fixed) | Commit |
| 7 | App bar close (`x`) | Escape |

**Reading order**: employee → services → amount → commission → payment → save.
**Interaction order**: same.

**Rules**

- Amount and commission are never editable.
- Save is always visible without scroll.
- Fields cannot be reordered.

---

## Add Expense (Bottom Sheet)

| Rank | Element | Rationale |
| --- | --- | --- |
| 1 | Category chip | First decision |
| 2 | Amount input | Second decision |
| 3 | Date (defaulted to today) | Rarely changed |
| 4 | Remarks (optional) | Contextual |
| 5 | Save button (bottom fixed) | Commit |
| 6 | Sheet close (`x`) | Escape |

---

## Employees List

| Rank | Element | Rationale |
| --- | --- | --- |
| 1 | Employee name (per row) | The primary label |
| 2 | Trailing metric (today's commission or `—`) | Business context |
| 3 | Avatar (initials) | Recognition |
| 4 | Group headers (Active / Inactive) | Grouping |
| 5 | FAB `+` | Add new |
| 6 | App bar (title, search, filter) | Navigation |

**Reading order**: title → search/filter (if used) → list rows top-to-bottom.

---

## Services List

Identical hierarchy to Employees, with `Price` as the trailing metric.

---

## Commission Employees List

| Rank | Element |
| --- | --- |
| 1 | Employee name |
| 2 | Rule summary badge (e.g., `12 rules set` or `—`) |
| 3 | Group headers (Active / Inactive) |
| 4 | App bar title |

## Employee Commission Screen

| Rank | Element |
| --- | --- |
| 1 | Screen title with employee name (H2 in app bar) |
| 2 | Service rows (name left, rule badge right) |
| 3 | `Apply to all services` (post-MVP, top action) |
| 4 | Group headers (Services / Add-ons) |

---

## Expenses List

| Rank | Element |
| --- | --- |
| 1 | Amount per row (Money Body) |
| 2 | Category chip |
| 3 | Remarks preview (truncated) |
| 4 | Date group header |
| 5 | FAB `+` |

Reading: amount first (right side of row) because owners scan for magnitudes.

---

## Reports · Daily

| Rank | Element |
| --- | --- |
| 1 | Hero Money Card (Today's income) |
| 2 | Peer cards (Expenses, Net, Transactions count) |
| 3 | Transactions list (all today's) |
| 4 | Segmented control (Daily / Monthly) at the top |
| 5 | Filter icon in app bar |

## Reports · Monthly

| Rank | Element |
| --- | --- |
| 1 | Hero Money Card (Total income for month) |
| 2 | Peer cards (Expenses, Net, Transaction count) |
| 3 | Top employees summary |
| 4 | Top services summary |
| 5 | Daily bar list |
| 6 | Month picker |

**Rule**: no more than 4 sections visible above the fold.

---

## Employee Performance / Service Performance

| Rank | Element |
| --- | --- |
| 1 | Total commission (or revenue) per row |
| 2 | Number of transactions |
| 3 | Name |
| 4 | Trailing chevron |

Sort: highest first (never alphabetical here — the point is ranking).

---

## Transaction Detail (Bottom Sheet)

| Rank | Element |
| --- | --- |
| 1 | Amount (Money Large) at top |
| 2 | Employee name (H3) |
| 3 | Services list (Body) |
| 4 | Payment mode chip |
| 5 | Commission amount (Body Small) |
| 6 | Timestamp (Caption `text.muted`) |
| 7 | `Edit` (Secondary) + `Delete` (Destructive Ghost) — bottom footer |

---

## Settings

| Rank | Element |
| --- | --- |
| 1 | Section headers (Business, Data, Account, About) |
| 2 | Rows with trailing chevron or value |
| 3 | Sign out (destructive, at bottom) |

Reading: sections in fixed order. Sign out is always last.

---

## Language Picker

| Rank | Element |
| --- | --- |
| 1 | Language rows, each rendered in its own script |
| 2 | Radio-style single-select indicator |
| 3 | App bar title |

**No `Save` button** — selection is instant.

---

## Auth Screens

### Splash

Only the logo + wordmark. No text. Dismisses within 1.5 s.

### Language Picker (first launch)

| Rank | Element |
| --- | --- |
| 1 | Language rows |
| 2 | `Continue` primary button |

### Mobile Number

| Rank | Element |
| --- | --- |
| 1 | Title (H1): "Enter your mobile number" |
| 2 | Text field |
| 3 | Primary CTA |
| 4 | Body context |

### OTP

| Rank | Element |
| --- | --- |
| 1 | Title (H1) |
| 2 | 6-digit input |
| 3 | Resend timer / link |
| 4 | Primary CTA (auto-triggers on 6 digits) |
| 5 | "Change number" link |

### Business Setup

| Rank | Element |
| --- | --- |
| 1 | Business name field |
| 2 | Owner name (optional) field |
| 3 | Primary CTA |
| 4 | Title (H1) |

---

## Universal Rules For Every Screen

### The Fold

Every screen's **most important element** must render **above the fold** on a 360 × 640 dp screen without scrolling.

### Focus Priority

The screen decides the user's first move:

- **Dashboard**: the number.
- **List screens**: the first row.
- **Forms**: the first field label (never the input — labels teach, inputs receive).
- **Reports**: the hero card.

### One Screen, One Job

A screen is designed around a single primary job. Everything else is secondary and non-competing:

- Dashboard → understand today.
- Income Entry → record a customer.
- Reports → know the trend.
- Settings → configure the app.

### Density Rules

- Never more than 3 pieces of information per list row on phone.
- Never more than 4 major sections on a Dashboard-style screen.
- Never more than 5 bottom-sheet actions.
- Never more than 6 fields per form screen (split if longer).

### Money Hierarchy

Money is the app's primary content. Money elements always rank higher visually than surrounding chrome:

- Hero card > any button on the screen.
- Peer money card > any icon.
- Row amount > row secondary text.

### Progressive Disclosure

Show the essential first, expand on demand.

- Transaction row shows amount and employee; taps open the full detail sheet.
- Report screens show the summary; drill-downs open detailed screens.
- Settings row shows the current value; taps open the picker.

## Do's

- Rank every element on every screen against these tables.
- Cut anything not in the ranking.
- Keep the primary action reachable with one thumb.

## Don'ts

- Don't compete two hero elements on one screen.
- Don't add banners above hero content.
- Don't push actions above content.
- Don't hide primary content behind gestures.
