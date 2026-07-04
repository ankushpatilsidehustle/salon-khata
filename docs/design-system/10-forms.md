# 10 · Forms

Forms in Salon Khata should feel like the fewest questions the app can possibly ask. Every field must earn its place.

## Principles

1. **Minimum fields** — ask only what is required to save.
2. **Selection over typing** — chips, cards, and bottom sheets beat text inputs.
3. **Sensible defaults** — date defaults to today, currency to salon default, payment mode to last used.
4. **Validate at the right time** — never block typing; validate on blur or submit.
5. **Save is instant** — writes commit to SQLite before showing feedback.

## Anatomy

Every field has:

- **Label** (above input, Caption + `text.secondary`)
- **Input** (see [08-component-library.md](08-component-library.md#text-field))
- **Help text** (below input, Caption + `text.secondary`) — optional
- **Error text** (replaces help text when in error, Caption + `status.danger`) — conditional

No inline labels (labels never sit inside the input as placeholder).

## Field Spacing

- Label → input: `space.1` (4)
- Input → help/error text: `space.1` (4)
- Field group → next field group: `space.4` (16)
- Last field → primary CTA: `space.5` (24)

## Required vs Optional

- All required fields are required by default; optional fields carry the label suffix `(optional)`.
- Do not use asterisks (`*`) to mark required — they read as decoration.
- Group optional fields at the bottom of the form.

## Input Types And Keyboards

| Field | Keyboard | Autofocus | Notes |
| --- | --- | --- | --- |
| Mobile number | `phone-pad` | Yes (OTP screen) | Prefix `+91` shown as a static prefix |
| OTP | `number-pad` | Yes | 6 digits, auto-advance across boxes |
| Money (amount, price) | `decimal-pad` | Never on load | Format on blur (₹1,25,000) |
| Employee/service/category name | `default` | Only in add sheet | Enable `autoCapitalize="words"` |
| Remarks | `default` (multi-line) | Never | Max 200 characters, counter shown at 150+ |
| Search | `default` | On sheet open | |

## Focus & Keyboard

- Only autofocus when it saves a tap and does not push the primary CTA off-screen.
- On focus, the input scrolls into view above the keyboard with a `space.4` (16) margin.
- Tapping outside a form dismisses the keyboard.
- `Next` button on the keyboard advances between fields; `Done` triggers submit only if the form is valid.

## Validation

**When to validate**

- **On blur**: single-field validation (empty required, invalid format).
- **On submit**: whole-form validation (cross-field, business rules).
- **Never on keystroke** — do not shame the user while they type.

**Error messaging**

- Errors replace the help text under the field.
- Errors are one sentence, in plain language, using a translation key.
- Bad: `t("error.INVALID_AMOUNT")` displayed as "INVALID_AMOUNT".
- Good: `t("income.amount.error.required")` → "Enter an amount to save."

**Focus on error**

- On submit failure, scroll to and focus the first invalid field.
- The primary CTA does not become disabled just because a field is empty — the user needs a clear failure message.

## Success Feedback

- Save writes to SQLite immediately.
- Show a snackbar (`Saved`) at the bottom.
- Return the user to the previous screen or reset the form for another entry (context-dependent — decide per feature).
- Never show a "success" modal that requires a tap to dismiss.

## Auto-Save

MVP does **not** auto-save. Explicit Save is more predictable and matches user expectations from paper notebooks.

## Discard Confirmation

- If the user backs out of a form with unsaved changes, show a dialog:
  - Title: `t("form.discardTitle")` → "Discard changes?"
  - Body: `t("form.discardBody")` → "Your changes will not be saved."
  - Primary destructive: `t("form.discardConfirm")` → "Discard"
  - Secondary: `t("common.cancel")` → "Cancel"

## Bottom Sheet Forms

Use bottom sheets only for **short forms** (1–3 fields). Longer forms use a full screen.

- Sheet height: content-sized, up to 80% of viewport.
- Save button fixed at bottom of the sheet.
- Discard behavior same as full-screen forms.

## Money Input

- Currency symbol prefixed inside the input as a non-editable prefix.
- Numeric keyboard only.
- Format on blur, not on keystroke.
- Store in minor units (paise) even when the user types rupees.
- Reject non-numeric input silently.
- Zero and negative amounts are invalid.

## Date Input

- Never a raw date text field.
- Use the bottom-sheet date picker component from [08-component-library.md](08-component-library.md#date-picker).
- Default value: today.
- Format follows locale (`en-IN`: `04 Jul 2026`, `hi-IN`: `04 जुल 2026`).

## Selection Input

- 2–5 options: use chips or segmented control.
- 6–20 options: use bottom sheet select with search.
- More: use search-first bottom sheet.

## Field Order

Order fields by what the user thinks about first, not the database:

**Income entry**: Employee → Services → Payment mode → Save. Amount and commission are computed, not typed.

**Expense entry**: Category → Amount → Date (default today) → Remarks (optional) → Save.

**Add employee**: Name → Mobile (optional) → Save.

**Add service**: Name → Price → Save.

**Commission rule**: Employee → Service → Percentage or Fixed toggle → Value → Save.

## Do's

- Default every field that can be defaulted.
- Use the correct keyboard for the input type.
- Show help text for non-obvious constraints.
- Localize every label, placeholder, help, and error via translation keys.
- Focus the first invalid field on submit failure.

## Don'ts

- Don't use placeholder as label.
- Don't disable Save based on empty fields.
- Don't show errors while the user is typing.
- Don't require fields the app can compute (amount, commission).
- Don't scatter form fields across cards on one screen.
