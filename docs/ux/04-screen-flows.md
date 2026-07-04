# 04 · Screen Flows

Every major workflow diagrammed. If a workflow is not here, it either does not exist or follows the same shape as one that is.

Notation:

```
[Screen]           full screen
{Bottom Sheet}     bottom sheet
<Dialog>           dialog
⇢                  automatic system response
→                  user action
◈ Snackbar         non-blocking feedback
✔ Success          success outcome
✘ Error            failure outcome
```

---

## Flow 1 · First Launch → Dashboard

```
[Splash]
   ⇢ (session check)
   └─ no session
        ↓
[Language Picker]  (pre-selected: device locale)
   → Continue
        ↓
[Mobile Number]
   → Send OTP
        ↓
[OTP]
   ⇢ auto-verify on 6 digits
        ↓
[Business Setup]
   → Continue
        ↓
[Dashboard · Empty state]
   ◈ Hero card: "Add your first income"
```

---

## Flow 2 · Returning User Login (existing device)

```
[Splash]
   ⇢ (session valid)
        ↓
[Dashboard]
```

## Flow 3 · Returning User Login (new device / reinstall)

```
[Splash]
   ⇢ (no local session)
        ↓
[Mobile Number]
   → Send OTP
        ↓
[OTP] ⇢ verify
        ↓
{Restore Prompt}       (only if cloud backup exists)
   → Restore
        ↓
[Dashboard]  (with restore progress line)
   ⇢ silent restore completes
   ◈ Restored
```

---

## Flow 4 · Record Income (the golden 10-second flow)

```
[Dashboard]
   → FAB "+ Add income"
        ↓
[Income Entry]
   → tap Employee field
        ↓
{Select Employee}    (recent at top; search)
   → tap employee
        ↓ (auto-close)
[Income Entry]  (employee filled)
   → tap Services field
        ↓
{Select Services}    (recent at top; multi-select; search)
   → tap 1–3 services
   → Done
        ↓
[Income Entry]  (services filled; amount + commission auto-computed)
   → tap payment mode chip  (defaults to last used)
   → Save
        ↓
✔ SQLite write
        ↓
[Dashboard]
   ◈ "Saved · Add another"
```

**Repeat entry** (owner records the next customer): tap `Add another` in the snackbar → Income Entry pre-filled with same payment mode.

## Flow 4a · Inline Add Missing Employee During Income Entry

```
[Income Entry] → tap Employee
        ↓
{Select Employee}  (empty state or user needs a new one)
   → tap "+ Add employee"
        ↓
{Add Employee}   (replaces the select sheet)
   → type name → Save
        ↓
{Select Employee}  (new employee added and auto-selected)
   → Done
        ↓
[Income Entry] (employee filled)
```

Same pattern for inline `+ Add service`.

---

## Flow 5 · Record Expense

```
[Dashboard]
   → "Add expense" (ghost button)
        ↓
{Add Expense}
   → tap Category (recent at top; "+ New" option)
        ↓
{Category Selector}
   → tap category
        ↓
{Add Expense}
   → type amount
   → (⌥) type remarks
   → Save
        ↓
[Dashboard]
   ◈ "Saved"
```

---

## Flow 6 · Delete a Transaction (undoable)

```
[Reports · Daily] → tap transaction row
        ↓
{Transaction Detail}
   → Delete
        ↓
✔ Soft delete
[Reports · Daily]  (row removed)
   ◈ "Deleted · Undo"  (8s)
      → (⌥) Undo
           ↓
           row reappears
```

## Flow 6a · Delete Employee With Historical Transactions

```
[Employees List] → tap row
        ↓
[Edit Employee]
   → Delete
        ↓
<Confirm Delete>       (only because history exists)
   "Delete this employee? Past transactions will keep this employee's records."
   → Delete
        ↓
✔ Soft delete
[Employees List]  (row removed from Active; appears in Inactive)
   ◈ "Deleted"
```

---

## Flow 7 · Edit a Service Price

```
[Services List] → tap row
        ↓
[Edit Service]  (fields pre-filled)
   → change price → Save
        ↓
✔ SQLite write
[Services List]
   ◈ "Updated"
```

**Note**: existing transactions are not re-priced.

---

## Flow 8 · View Daily Report

```
[Reports Root · Daily default]
    Hero: Today's income
    Peer cards: Expenses, Net collection
    Section: Recent transactions
      → tap row → {Transaction Detail}
    Section: Bottom bar list (income by hour — post-MVP)
```

## Flow 9 · View Monthly Report

```
[Reports Root]
   → segmented control "Monthly"
        ↓
[Monthly Report]
    → month picker → {Month Picker} → select
    Hero: Total income
    Peer cards: Expenses, Net, Transactions
    Summary: Top employees
      → View all → [Employee Performance]
    Summary: Top services
      → View all → [Service Performance]
    Bar list: Income per day
```

## Flow 10 · Drill Into Employee Performance

```
[Monthly Report] → Top employees → View all
        ↓
[Employee Performance]  (sorted by commission)
   → tap employee row
        ↓
[Employee Detail Report]  (per-day breakdown, tx count, top service)
```

---

## Flow 11 · Setting Commission Rules

```
[Entries Hub] → Commission
        ↓
[Commission Employees List]
   → tap employee
        ↓
[Employee Commission Screen]  (services list with per-service rule badge)
   → tap service row
        ↓
{Edit Commission Rule}
   → segmented control (% / ₹)
   → type value
   → Save
        ↓
[Employee Commission Screen]  (rule updated)
   ◈ "Saved"
```

---

## Flow 12 · Backup (automatic)

Background:

```
Trigger: 5 min after last write
   ⇢ sync queue drains
   ⇢ cloud accepts
   ⇢ update "last synced" timestamp on Dashboard
   ⇢ silent (no snackbar)
```

Manual (rare):

```
[Settings · Backup & Restore]
   → Backup now
        ↓
   ⇢ progress bar (only if > 500 ms)
        ↓
   ◈ "Backup complete · just now"
```

## Flow 13 · Restore (automatic on new device — see Flow 3)

Manual:

```
[Settings · Backup & Restore]
   → Restore from cloud
        ↓
<Confirm Restore>  "This will replace your current data."
   → Restore
        ↓
[Restore Progress]  (linear, cancelable)
        ↓
[Dashboard]
   ◈ "Restored"
```

---

## Flow 14 · Language Change

```
[More · Language]  (or [Settings · Language])
   → tap language row
        ↓
✔ instant re-render
[Same screen]  (localized)
```

---

## Flow 15 · Sign Out

```
[More Hub · Sign out]
   → Sign out
        ↓
<Confirm Sign Out>  "Sign out? Your data will remain on this device."
   → Sign out
        ↓
[Splash]
        ↓
[Mobile Number]
```

---

## Flow 16 · Handling Sync Failure

```
Background:
   ⇢ sync attempt fails (network)
   ⇢ retry with exponential backoff (silent)
   
If user is in Settings:
   [Settings · Sync Status]  shows count of pending items
      → Retry now  (manual override)

If persistent failure > 24h:
   [Dashboard]  subtle badge in "last synced" line
       "Not synced in 24 hours"  (informational only, never a modal)
```

**Non-negotiable**: no "sync failed" popup or banner on Dashboard.

---

## Flow 17 · Wrong OTP

```
[OTP]
   → enter wrong code
   → Verify (auto-triggered on 6 digits)
        ↓
✘ Backend: invalid
[OTP]
   → announce error under input
   → clear input, focus first box
```

## Flow 18 · OTP Timeout / Resend

```
[OTP]
   ⇢ "Resend in 30s" counter
   ⇢ (0s) counter → "Resend" link becomes active
   → tap Resend
        ↓
   ◈ "Code sent"
   ⇢ timer restarts
```

## Flow 19 · Wrong Mobile Number

```
[OTP]
   → tap "Change"  (in "Sent to +91 XXXXX XXXXX. Change")
        ↓
[Mobile Number]  (pre-filled, editable)
```

---

## Flow 20 · Discard Unsaved Changes

```
[Any form or full-screen modal]
   → tap close (x)  or  hardware back
        ↓
<Discard Changes?>
   → Cancel   → stay on form
   → Discard  → close, snackbar "Discarded"
```

---

## Flow 21 · Filter Reports

```
[Reports · Daily]
   → filter icon in app bar
        ↓
{Filter Sheet}
   → preset chip (Today / This week / This month / Custom)
        ↓ (auto-apply for single selection)
[Reports · Daily]  (list filtered; chip appears above list with Clear all)
```

---

## Flow 22 · Search Employees

```
[Employees List]
   → search icon in app bar
        ↓
[Employees List]  (search bar appears below app bar, focused)
   → type query
        ↓ (debounced 200 ms; local SQLite)
[Employees List]  (list filtered)
   → tap row → [Edit Employee] or {Employee Detail}
   → tap "x" clear or hardware back to exit search
```

---

## Flow 23 · Handling Full Storage / Rare Local Failure

```
[Add Expense] → Save
        ↓
✘ SQLite write fails (device out of storage)
   ◈ "Couldn't save · Try again" (Snackbar with Retry action)
   
[Add Expense]  (form intact, user data preserved)
```

**Rule**: the user never loses their data because the app failed.

---

## Cross-Flow Rules

- **Every flow returns the user to a stable, predictable screen.**
- **Every flow that writes data commits locally first, then syncs.**
- **Every flow that touches the network works offline** (or is queued).
- **Every flow that shows a destructive action offers Undo unless the action affects records with history.**
- **Every flow completes without leaving the app.**

## Flow Anti-Patterns

- Chained dialogs.
- Success screens that require a tap to dismiss.
- Wizards longer than 3 steps.
- Flows that end on a spinner.
- Flows where back skips over meaningful screens.
- Flows that require internet for offline-safe actions.
