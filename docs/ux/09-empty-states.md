# 09 · Empty States

Every empty state teaches the user what to do next. A blank list is a bug.

## Universal Shape

Every empty state has exactly these elements:

1. **Icon** — Lucide, `size.icon.xl`, `text.muted`.
2. **Title** — H2, one short sentence.
3. **Body** — Body, one or two sentences, `text.secondary`.
4. **Primary action** — Button, verbs only.

Never illustrations in MVP. Never a passive "No data" message. Never a decorative background.

## Copy Style

- Sentence case.
- Second person (`you`, `your`) implicit — the copy addresses the owner directly.
- Never blame the user for the empty state.
- Localized via translation keys (see [../design-system/14-localization.md](../design-system/14-localization.md)).

---

## Dashboard (no transactions today)

| Element | Content |
| --- | --- |
| Icon | `wallet` |
| Title | `No income yet today` |
| Body | `Add your first customer to see today's totals grow.` |
| Action | `Add income` (opens Income Entry) |

Rendered as an inline empty prompt where the recent-transactions list would be. The Hero card still shows `₹0`.

---

## Services (list empty)

| Element | Content |
| --- | --- |
| Icon | `scissors` |
| Title | `No services yet` |
| Body | `Add the services you offer, along with their prices. You can always change them later.` |
| Action | `Add service` |

---

## Employees (list empty)

| Element | Content |
| --- | --- |
| Icon | `users` |
| Title | `No employees yet` |
| Body | `Add the people who work at your salon so you can track their commissions.` |
| Action | `Add employee` |

If the salon is a single-owner shop, the owner still needs at least one employee row (usually themselves) to record income against.

---

## Commission (no rules set)

| Element | Content |
| --- | --- |
| Icon | `percent` |
| Title | `No commission rules yet` |
| Body | `Set how much each employee earns per service, either as a percentage or a fixed amount.` |
| Action | `Set up commission` (opens Commission Employees list) |

If no employees exist, this screen shows the Employees empty state instead.

---

## Expenses (no expenses today)

| Element | Content |
| --- | --- |
| Icon | `receipt-text` |
| Title | `No expenses recorded today` |
| Body | `Add rent, supplies, salaries, or any other business expense to keep track.` |
| Action | `Add expense` |

---

## Expenses (no expenses ever)

| Element | Content |
| --- | --- |
| Icon | `receipt-text` |
| Title | `No expenses yet` |
| Body | `Track every business expense so you know your true profit.` |
| Action | `Add expense` |

---

## Categories (no categories set)

MVP ships with default categories (Rent, Supplies, Salary, Utilities, Other). This empty state applies only if the user deletes all categories.

| Element | Content |
| --- | --- |
| Icon | `folder-open` |
| Title | `No categories yet` |
| Body | `Categories group your expenses. Add ones that fit your business.` |
| Action | `Add category` |

---

## Transactions (Reports · no transactions in range)

| Element | Content |
| --- | --- |
| Icon | `list` |
| Title | `No transactions in this range` |
| Body | `Try a different date range, or add a new transaction to get started.` |
| Action | `Add income` |

Filter chips above the empty state remain visible with a `Clear all` action.

---

## Employee Performance (no data in range)

| Element | Content |
| --- | --- |
| Icon | `award` |
| Title | `No employee data yet` |
| Body | `Record customer transactions to see how each employee is performing.` |
| Action | `Add income` |

---

## Service Performance (no data in range)

| Element | Content |
| --- | --- |
| Icon | `bar-chart-3` |
| Title | `No service data yet` |
| Body | `Record customer transactions to see which services earn the most.` |
| Action | `Add income` |

---

## Search (no results)

Compact variant — no illustration, no primary action.

| Element | Content |
| --- | --- |
| Icon | `search-x` |
| Title | `No matches` |
| Body | `Try a different name or clear the search to see all entries.` |
| Action | (none) |

---

## Filter (no results after filter applied)

| Element | Content |
| --- | --- |
| Icon | `filter-x` |
| Title | `No entries match your filters` |
| Body | `Try a wider date range or clear the filters.` |
| Action | `Clear filters` |

---

## No Internet (informational only)

Salon Khata is offline-first. The app **never** shows a "No Internet" full-screen state on core screens.

The only place a no-internet message appears is in **Sync Status** (Settings):

| Element | Content |
| --- | --- |
| Icon | `wifi-off` |
| Title | `You're offline` |
| Body | `Sync will resume automatically when you're back online. Your data is safe on this device.` |
| Action | (none) |

No banners on Dashboard, Reports, Entries, or forms.

---

## No Backup (first sync in progress)

Only visible in Settings → Backup & Restore when the user has never synced.

| Element | Content |
| --- | --- |
| Icon | `cloud-off` |
| Title | `No backup yet` |
| Body | `Your data is safe on this device. A backup will be created automatically when you're online.` |
| Action | `Back up now` |

---

## Restore (no cloud backup found)

Shown in Restore Prompt on new-device login when no backup exists.

| Element | Content |
| --- | --- |
| Icon | `cloud-off` |
| Title | `Nothing to restore` |
| Body | `We couldn't find a previous backup for this account. Start fresh.` |
| Action | `Continue` (proceeds to Dashboard) |

---

## Loading Timeout / Rare DB Failure

| Element | Content |
| --- | --- |
| Icon | `alert-circle` |
| Title | `Something went wrong` |
| Body | `We couldn't load your data. Try again.` |
| Action | `Retry` |

Used only for local storage failures. Every core flow otherwise handles offline silently.

---

## Empty State Positioning

- **Full-screen empty states** (Services, Employees, Categories, etc.): vertically centered in the available content area, `space.6` between icon and title.
- **Inline empty prompts** (Dashboard recent-transactions area): compact, left-aligned, no icon.

## Empty State Rules

- Always include a primary action unless there is nothing meaningful to do (search-empty).
- Action is always a verb, always localized.
- Never a stack of buttons — one primary only.
- Never a link to help documentation (there is no help documentation in MVP).
- Never illustrations (icon only).

## Anti-Patterns

- Generic "No data" messages.
- Sad-face emoji.
- "Oops!" or "Uh-oh!"
- Blaming the user (`You haven't added anything`).
- Requiring the user to think about what to do next.
- Empty state that just shows the search bar with no context.

## Do's

- Ship every list with an empty state before merging.
- Test empty states in the longest translation.
- Localize every string.

## Don'ts

- Don't leave a screen blank if there is no data.
- Don't show a spinner in place of an empty state.
- Don't show two calls-to-action.
