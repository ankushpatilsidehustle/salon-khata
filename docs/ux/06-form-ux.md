# 06 · Form UX

Salon Khata forms are the fastest way to record a business event. Every form obeys the rules below.

Cross-references: visual specs in [../design-system/10-forms.md](../design-system/10-forms.md); component specs in [../design-system/08-component-library.md](../design-system/08-component-library.md).

## Guiding Principles

1. **Minimum fields.** Ask only what is required to save.
2. **Selection over typing.** Chips, cards, and sheets beat text inputs.
3. **Sensible defaults.** Every field that can be defaulted is defaulted.
4. **Validate at the right time.** On blur, not on keystroke.
5. **Instant commit.** Save writes to SQLite first, then confirms.
6. **Undo over confirm.** Deletion uses snackbar-undo, not dialog.

## Field Order Rules

Order fields by the user's thinking, not by database schema:

- Income Entry: Employee → Services → Payment mode → Save. Amount and commission are computed.
- Expense: Category → Amount → Date (default today) → Remarks (optional).
- Add Employee: Name → Mobile (optional).
- Add Service: Name → Price.
- Commission rule: Type (% / ₹) → Value.

## Adding Data

**Trigger**: FAB or inline `+` in a selection sheet.

**Rules**

- Always opens a bottom sheet for short forms (1–3 fields).
- Always opens a full-screen modal for long forms (4+ fields).
- Focus behavior:
  - Auto-focus first field on **bottom sheet forms** (user came to type).
  - Do **not** auto-focus on **full-screen modals** that have selection fields first (user came to tap).
- After save:
  - Snackbar with `Add another` action if the user commonly repeats (Income, Expense, Employee, Service).
  - `Add another` re-opens the form pre-defaulted (payment mode, category) but cleared of amount/name.

## Editing Data

**Trigger**: tap a list row → detail sheet → `Edit`, OR tap directly on the row if the entity has no separate detail view (e.g., Services list).

**Rules**

- Screen title changes from `Add X` to `Edit X`.
- Primary CTA label changes from `Save` to `Update`.
- Fields are pre-filled with current values.
- Discard-changes dialog on back if any field changed.
- Historical records are **not** re-priced. Editing a service price affects future transactions only.

## Deleting Data

**Two flavors**

### Flavor A · Fresh entity (no history)

Undo snackbar pattern:

- User taps `Delete`.
- Row disappears immediately (soft delete).
- Snackbar `Deleted · Undo` (8 s).
- On timeout, delete is committed to sync queue.

### Flavor B · Entity with history

Confirmation dialog:

- User taps `Delete`.
- Dialog: `Delete this X? Past records will keep this X's data.`
- Primary destructive: `Delete`, secondary: `Cancel`.
- On confirm, soft delete + snackbar `Deleted` (no undo needed because dialog served as confirmation).

**Never** show a plain "Are you sure?" — always give the reason for the confirmation.

## Validation

### When to validate

| Timing | What |
| --- | --- |
| On blur | Required field, format |
| On submit | Cross-field, business rules |
| Never on keystroke | Do not shame the user while they type |

### Error surface

- Errors replace the help text under the field (Caption + `status.danger`).
- One error per field visible at a time (the most important).
- Error text is one sentence, plain language, from a translation key.
- Error text tells the user **what to do**, not what they did wrong. Good: "Enter an amount to save." Bad: "Amount is required."

### On submit failure

- Prevent submission.
- Scroll to and focus the first invalid field.
- Do **not** clear other field values.
- Do **not** disable the Save button — the user needs the failure to be discoverable.

## Keyboard Behavior

| Field | Keyboard | Return key |
| --- | --- | --- |
| Mobile number | `phone-pad` | Next |
| OTP | `number-pad` | Next (auto-advance per digit) |
| Money (amount, price) | `decimal-pad` | Done |
| Name (employee, service, category, business, owner) | `default` + `autoCapitalize="words"` | Next |
| Remarks (multi-line) | `default` | new-line |
| Search | `default` | Search icon |

**Rules**

- The `Next` key advances between fields; the `Done` key submits if the form is valid.
- Tapping outside a field dismisses the keyboard.
- The primary CTA must be visible above the keyboard on every screen; scroll the field into view above the keyboard with a `space.4` (16) margin.

## Auto Focus

Auto-focus only when it saves a tap **and** does not push the primary CTA off-screen.

| Screen | Auto-focus? |
| --- | --- |
| Mobile number | Yes |
| OTP | Yes |
| Business setup (business name) | Yes |
| Add Employee (name) | Yes (bottom sheet) |
| Add Service (name) | Yes (bottom sheet) |
| Add Expense (amount is the primary intent) | No — user picks category first |
| Income Entry | No — user taps to select first |
| Edit screens | No — user reviews before editing |

## Auto Complete

- Native keyboard suggestions allowed on name and remarks fields.
- No custom autocomplete UI in MVP (no dropdown-under-input).
- Recent selections in bottom sheets serve as autocomplete for structured fields.

## Bottom Sheet Forms

- Use only for **short forms** (1–3 fields).
- Sheet height: content-sized, up to 80% of viewport.
- Primary CTA fixed at the bottom of the sheet.
- Discard-changes dialog on swipe-down or `x` if changes exist.

## Full-Screen Forms

- Use for **long forms** (4+ fields) or when the form contains selection sheets that need space.
- App bar shows a close (`x`) icon on the left, title in the middle, no trailing action.
- Primary CTA fixed at the bottom (full-width button).
- Discard-changes dialog on back/close if changes exist.

## Dropdowns

- **Dropdown = bottom sheet.** Never a native OS dropdown.
- Trigger looks like a text field with a `chevron-down` icon.
- Sheet opens with:
  - Search bar (only if > 6 items).
  - Recent selections pinned to top.
  - Active items above inactive.
- Single-select closes the sheet on tap; multi-select requires `Done`.
- If the entity list is empty, sheet shows an empty-state with an inline `+ Add X` action.

## Date Selection

- Never a raw date input.
- Use the bottom-sheet date picker with presets first:
  - Today (default)
  - Yesterday
  - Custom
- Custom opens a calendar in the same sheet.
- Future dates are rejected for income and expense fields.

## Search

- Search inside forms uses the same rules as list search: local-only, debounced 200 ms.
- Search-empty state: `No matches` — never a blank list.
- Clear (`x`) restores the full list.

## Number Entry

- Numeric keyboard mandatory.
- Reject non-numeric input silently (drop the character, no error toast).
- Do not format while typing.
- Do not accept scientific notation or expressions.
- Zero is invalid where it makes no business sense (income amount, service price).

## Currency Entry

- Numeric decimal keyboard.
- Currency symbol shown as a static prefix inside the input (`₹` on the left, non-editable).
- Format on **blur**, not on keystroke: `1250` → `₹1,250`.
- Store in minor units (paise) regardless of what the user types.
- Grouping follows locale (`en-IN`).
- Do not accept negative values.
- Do not accept more than 2 decimal places.
- Show help text under the field only when constraints are non-obvious (`Max ₹10,00,000` for guardrails — post-MVP).

## Required vs Optional

- Required by default; optional fields labeled `<Label> (optional)`.
- No asterisks (`*`) for required.
- Group optional fields at the bottom of the form.

## Discard-Changes Guard

When the user backs out of a form with unsaved changes:

- Dialog:
  - Title: `Discard changes?`
  - Body: `Your changes will not be saved.`
  - Primary destructive: `Discard`
  - Secondary: `Cancel`
- If no changes, back is silent (no dialog).

## Auto-Save

MVP does **not** auto-save. Explicit `Save` matches the paper-notebook mental model.

Post-MVP: consider auto-save for the Business Profile form only.

## Submission Feedback

- On save success: snackbar (`Saved` / `Updated`) + return to previous screen.
- Never a modal.
- Never a full-screen success animation.
- If save fails (rare, storage full): snackbar with `Retry` action, form preserved.

## Anti-Patterns

- Using placeholder as label.
- Disabling the Save button based on empty fields.
- Multi-column form on phone.
- Requiring fields the app can compute (amount, commission).
- Confirmation dialog before every save.
- Errors that shame the user ("Wrong value").
- Free-text where a chip or dropdown works.
- Auto-focusing a field that pushes the CTA off-screen.

## Do's

- Default every field that can be defaulted.
- Use the correct keyboard type.
- Localize every label, placeholder, help, and error via translation keys.
- Focus the first invalid field on submit failure.
- Preserve user input on any failure.

## Don'ts

- Don't disable the CTA silently.
- Don't validate on keystroke.
- Don't show more than one error per field at a time.
- Don't lose data on rotate, backgrounding, or accidental back.
