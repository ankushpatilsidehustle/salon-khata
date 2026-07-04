# 01 · User Journeys

Every journey below is written as a **sequence of user thoughts and taps**, not a feature list. If a step exceeds one tap or one sentence of thinking, we have failed.

Symbols:
- `→` = user tap or action
- `⇢` = automatic app response
- `⌥` = optional / conditional step

## Personas In Scope

| Persona | Device | Primary language | Confidence |
| --- | --- | --- | --- |
| Ravi (barber, single-chair) | Android budget phone | Hindi | Low |
| Priya (parlour owner, 4 staff) | Android mid-range | Marathi | Medium |
| Kumar (salon owner, 8 staff, POS-style use) | Android mid-range | Kannada | Medium |

All journeys below must work for **Ravi first**.

---

## Journey 1 · First Time User (0 → Dashboard)

**Goal**: user opens the app for the first time and reaches Dashboard in ≤ 90 seconds.

1. Install → open.
2. ⇢ Splash (1.5 s max).
3. ⇢ Language picker with **device locale pre-selected**.
   - → tap `Continue` (single tap if pre-selection is correct).
4. ⇢ Mobile number screen.
   - → type 10-digit number.
   - → tap `Send OTP`.
5. ⇢ OTP screen. SMS auto-read (Android).
   - ⇢ `Verify` auto-triggers on 6 digits.
6. ⇢ Business setup.
   - → type business name.
   - → tap `Continue` (owner name skipped).
7. ⇢ Dashboard with an **empty state Hero Money Card** and a single call: `Add your first income`.

**Total interactions**: 5 taps + 1 number entry + 1 name entry.

**Non-negotiables**

- No tour, no tutorial, no permission requests up front.
- No email, no password, no captcha.
- Language switch is available anytime from Settings — never gate the user.

---

## Journey 2 · Login (returning user, new device)

1. Install → open.
2. ⇢ Splash → Mobile number screen (previous number remembered if the OS restored preferences).
3. → enter mobile → `Send OTP`.
4. ⇢ OTP → auto-verify.
5. ⇢ Dashboard (with a subtle "Restoring your data" progress line if a cloud backup exists).
6. ⇢ Restore completes silently; snackbar `Restored`.

---

## Journey 3 · Onboarding (soft, in-context)

Salon Khata does not have a separate onboarding wall. Onboarding is embedded:

- **Empty state on Dashboard** teaches "Add your first income".
- **Empty state in Services** teaches "Add your first service".
- **Empty state in Employees** teaches "Add your first employee".
- **Empty state in Commission** teaches "Set commission rules".

The user learns by doing. No feature tour.

---

## Journey 4 · Add First Service

Triggered from Dashboard when the user taps `Add income` and there are no services yet.

1. Dashboard → `Add income` (FAB).
2. ⇢ Income Entry screen.
3. → tap `Select services` field.
4. ⇢ Bottom sheet: `No services yet` empty state with `Add service` action.
5. → `Add service`.
6. ⇢ Add Service sheet: `Name` + `Price` + `Save`.
7. → type "Haircut" → type "300" → `Save`.
8. ⇢ Sheet closes; the new service is auto-selected in the income entry sheet.
9. → `Done`.

The user never leaves the Income Entry flow to add a missing service.

**Key rule**: dependent entities can always be created **inline** from where they are needed.

---

## Journey 5 · Add Employee

**From Employees list**:

1. Entries tab → Employees → FAB `+`.
2. ⇢ Add Employee sheet.
3. → type name → (⌥) type mobile → `Save`.
4. ⇢ Sheet closes; snackbar `Added` with `Add another` action.

**Inline from Income Entry** (identical inline pattern as Add First Service).

---

## Journey 6 · Record First Income (the golden journey)

**Target: ≤ 10 seconds.**

1. Dashboard → `Add income` (FAB, Extended).
2. ⇢ Income Entry screen.
3. → tap `Employee` → sheet with recent employees at top → tap employee (1 tap).
4. → tap `Services` → sheet with recent services at top → tap 1–3 services (1–3 taps) → `Done`.
5. ⇢ Amount auto-computes; commission auto-computes.
6. → tap payment mode chip (defaults to last used).
7. → tap `Save`.
8. ⇢ Snackbar `Saved · Add another`.

**Total interactions on repeat entries**: 5 taps (employee → services → payment → save).

**Optimizations**

- Payment mode remembers the last selection.
- Recent employees / services always at the top.
- No confirmation dialog.
- Save writes to SQLite before showing the snackbar.

---

## Journey 7 · Record Expense

1. Dashboard → `Add expense` (secondary CTA on Dashboard, or Entries → Expenses → FAB).
2. ⇢ Expense Entry sheet.
3. → tap category chip (recent categories on top; `+ New` at end).
4. → type amount.
5. ⇢ Date defaults to today.
6. → (⌥) type remarks.
7. → `Save`.

**Total interactions**: 4 taps + 1 number.

---

## Journey 8 · View Reports

1. Bottom nav → Reports.
2. ⇢ Reports > Daily (default).
3. Hero: Today's income; peer: Today's expenses, Net collection.
4. → (⌥) segmented control → `Monthly`.
5. ⇢ Reports > Monthly with month selector.
6. → (⌥) tap employee card → per-employee detail.

No filters required to get to the default view.

---

## Journey 9 · Backup

Backup is **automatic** — the user never has to trigger it manually.

Manual backup exists only as a reassurance action:

1. More tab → Settings → `Backup now`.
2. ⇢ Progress bar (only if cloud upload > 500 ms).
3. ⇢ `Last backed up: just now`.

---

## Journey 10 · Restore (returning user, new device)

Restore is **automatic on first login** after auth (Journey 2, step 5).

Manual restore exists for edge cases:

1. Settings → `Restore from cloud`.
2. ⇢ Confirmation dialog (destructive): "This will replace your current data."
3. → `Restore`.
4. ⇢ Progress bar with cancel.
5. ⇢ Dashboard refreshes with restored data; snackbar `Restored`.

---

## Journey 11 · Logout

1. More → Settings → `Sign out` (destructive row at the bottom).
2. ⇢ Confirmation dialog: "Sign out? Your data will remain on this device."
3. → `Sign out`.
4. ⇢ Splash → Mobile number screen.

**Non-negotiable**: signing out does **not** delete local data.

---

## Journey 12 · Daily Closing (evening routine)

Not a distinct feature — an emergent behavior. Design must support it:

1. Owner closes shop, opens app.
2. ⇢ Dashboard shows the day's totals at the top (hero + peers).
3. Owner scans recent transactions to confirm nothing is missing.
4. → (⌥) `Add income` for any last customers.
5. → (⌥) `Add expense` for cash spent from the till.

**No "close the day" button** — the app knows the day rolled over automatically.

---

## Journey 13 · Monthly Review

1. Reports tab → segmented control → `Monthly`.
2. ⇢ Current month totals + top employees + top services + daily bar list.
3. → (⌥) tap month selector → pick last month.
4. → (⌥) tap an employee card → detail with per-day breakdown.

Design must make this feel like "flipping through the ledger", not "querying the database".

---

## Journey 14 · Language Change

1. More → Settings → Language.
2. ⇢ List of 7 languages, each rendered in its own script.
3. → tap language.
4. ⇢ App updates instantly, no restart.
5. ⇢ Return to Settings (back).

---

## Journey 15 · Delete a Transaction (recovery flow)

1. Reports → Daily → tap a transaction row.
2. ⇢ Detail sheet with `Edit` and `Delete`.
3. → `Delete`.
4. ⇢ Sheet closes; row removed from list; snackbar `Deleted · Undo` (8 s).
5. → (⌥) tap `Undo` if it was a mistake.

**Never a confirmation dialog** for fresh transactions. Undo is the pattern.

---

## Journey 16 · Edit a Service Price

1. Entries → Services → tap the service row.
2. ⇢ Edit Service screen with fields pre-filled.
3. → change price → `Save`.
4. ⇢ Snackbar `Updated`.

**Rule**: existing transactions are **not** re-priced. History is immutable.

---

## Journey 17 · Sync Recovery After Being Offline All Day

1. Owner has been offline all day, entered 47 transactions.
2. Phone connects to WiFi in the evening.
3. ⇢ Sync starts automatically in the background.
4. Owner sees a subtle sync indicator in the Dashboard footer.
5. ⇢ Snackbar `Synced` when complete (or silent if the owner is not actively watching).

**Non-negotiable**: no "You are offline" banners at any point during the day.

---

## Journey 18 · Handling a Sync Conflict

Rare. Handled via last-write-wins with audit log (see [../sync-engine.md](../sync-engine.md)).

1. Owner edits a transaction on device A while offline.
2. Same transaction was edited on device B (rare co-owner scenario).
3. Both devices come online.
4. ⇢ Last-write-wins applies.
5. ⇢ The loser edit is preserved in the audit log.
6. Owner sees no dialog — audit log is available in Settings > Data > History (post-MVP).

**MVP behavior**: silent last-write-wins. No user-facing conflict UI.

---

## Journey 19 · Setting Commission Rules

1. Entries → Commission → Employees list.
2. → tap employee.
3. ⇢ Employee commission screen: list of services with per-service rule.
4. → tap a service row.
5. ⇢ Bottom sheet: segmented control (% / ₹) + value + `Save`.
6. ⇢ Sheet closes; row updates.

**Bulk setup**: `Apply to all services` action at top of employee screen (post-MVP).

---

## Journey 20 · Handling a Wrong-Number OTP

1. OTP screen.
2. → user notices the wrong number, taps `Change`.
3. ⇢ Returns to mobile number screen with the number pre-filled and editable.

---

## Cross-Journey Rules

- **Every journey has a Cancel path** that returns the user to a stable screen.
- **Every journey has a discard-changes guard** for forms with unsaved input.
- **Every journey completes without leaving the app.**
- **Every journey works offline** unless it explicitly requires a network (auth, restore).

## Journey Anti-Patterns (forbidden)

- Interstitial ads.
- "Rate the app" prompts inside the first 30 days.
- Feature discovery modals.
- Multi-step confirmation dialogs.
- Requiring a permission before the user has tried the feature.
- Wizards longer than 3 steps.
