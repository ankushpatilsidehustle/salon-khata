# 16 · UX Guidelines

Consistent interaction rules across every screen. If a pattern is not documented here, it does not exist in the app.

## The 10-Second Rule

Any core entry (income, expense) must be completable in **10 seconds or less** on an average device with an average user.

Every design decision is measured against this rule.

## One Primary Action Per Screen

- Exactly one visually dominant CTA per screen.
- Never two primary buttons side by side.
- Secondary actions use secondary or ghost buttons.

## Thumb-First Layout

- Primary CTAs live in the bottom third.
- Bottom nav is the only exception because it is itself primary.
- Top-bar actions are limited to icon buttons (back, close, search).

## Delete

**Non-destructive by default.**

- Every "delete" is a **soft delete** (`deleted_at` timestamp set).
- Visible immediately after tap: item disappears from the list.
- Snackbar appears with `Undo` action, 8-second duration.
- If the user does nothing, delete is committed to sync queue.
- If the user taps `Undo`, `deleted_at` clears; item reappears.

Confirmation dialog required only for:

- Deleting an employee with historical transactions.
- Deleting a service with historical transactions.
- Deleting a commission rule that has been applied.

The dialog title is a question, the primary action is a verb:

- Title: `t("service.deleteTitle")` → "Delete this service?"
- Body: `t("service.deleteBody")` → "Past transactions will keep this service."
- Primary destructive: `t("common.delete")` → "Delete"
- Secondary: `t("common.cancel")` → "Cancel"

## Edit

- Tap on a row → detail sheet with `Edit` and `Delete` buttons.
- Edit navigates to the form screen pre-filled.
- Save behavior matches Add (instant SQLite write, snackbar).
- Cancel/back with unsaved changes → discard-changes dialog.

## Add

- FAB is the primary entry point (see [11-navigation.md](11-navigation.md#fab-behavior)).
- Add flows are optimized for repeat use — after Save, offer `Add another` action in the snackbar for high-frequency flows (Income, Expense).

## Search

- Contextual, per screen.
- Instantaneous, local-only.
- Empty search returns to the unfiltered list.
- Search bar sticky below the app bar.

## Filter

- Filter icon in the app bar (`sliders-horizontal`).
- Opens a bottom sheet with presets first (Today, This month, Last month, Custom).
- Applied filters render as chips above the list with a `Clear all` action.

## Select

- Selection lives in bottom sheets, not full screens.
- Search included when the list has more than 6 items.
- Recent selections pinned to the top.
- Active items above inactive.
- Single-tap selects and dismisses (single-select) or toggles (multi-select).
- Multi-select sheets have a `Done` button.

## Confirmation

Confirmation dialogs are for irreversible or high-consequence actions only.

Overuse breaks trust — asking "Are you sure?" on every save trains the user to tap through mindlessly.

Confirm:

- Deleting entities with historical data.
- Logging out.
- Restoring from backup (data replacement).
- Deleting all data.

Do **not** confirm:

- Saving a form.
- Deleting a fresh entry (use undo pattern).
- Language change.
- Toggle switches.

## Undo

Undo is the default recovery pattern for reversible destructive actions.

- Appears in a snackbar with the destructive action.
- 8-second duration for delete, 5 seconds for other actions.
- Only one undo snackbar at a time.
- Undo is atomic — restores the exact prior state.

## Success

- Silent for expected outcomes (opening a screen, switching tabs).
- Snackbar with a check icon for user-triggered saves and deletes.
- Never a full-screen success page.
- Never a modal that requires a tap to dismiss.

## Failure

Three tiers based on user impact:

| Tier | Example | Feedback |
| --- | --- | --- |
| Silent | Sync failed | No user-facing message; retry silently, show badge in Settings |
| Subtle | Refresh failed | Snackbar with `Retry` action |
| Blocking | Save failed (rare) | Dialog with error and `Try again` |

Never blame the user. Errors describe what happened and what to do next.

## Offline

Salon Khata **works fully offline**. Offline is not an error state.

- No "You are offline" banners.
- No "Please connect to internet" blocking overlays.
- Show a subtle offline indicator only in Settings.
- Sync automatically resumes when the network returns.

## Syncing

- Sync happens silently in the background.
- Sync status visible only in Settings and Dashboard's "last synced" line.
- Never block the user during sync.
- Never show a full-screen sync spinner.

## Loading

- Local reads: **instant** (no spinner).
- First launch: full-screen splash → dashboard skeleton.
- Restore: linear progress with cancel.
- Report screens: card skeletons only if the query is > 300 ms.

## Retry

- Retry actions live in the failure snackbar or dialog.
- One tap re-runs the same request.
- Exponential backoff for automatic retries (sync engine).
- Never spam the user with `Retry` prompts — one visible retry per event.

## Empty States

Every list has an empty state with:

- Icon
- Title (what is missing)
- Body (why they might not have it)
- Primary action (add the missing thing)

See [12-lists.md](12-lists.md#empty-states) for per-list copy.

## First-Run Experience

- Splash (< 1.5 s).
- Language picker (device locale pre-selected).
- Mobile number → OTP.
- Business setup: business name (required), owner name (optional).
- Land on Dashboard with a Money Card empty state ("Add your first income").

Skip everything skippable. Never gate the user behind a tour or tutorial.

## Onboarding & Discovery

- No product tours in MVP.
- Empty states carry all first-use guidance.
- Feature hints (tooltips) not used — trust the icon + label pattern.

## Feedback Consistency Matrix

| Action | Feedback |
| --- | --- |
| Save (add) | Snackbar "Saved" + return to previous screen |
| Save (edit) | Snackbar "Updated" + return to previous screen |
| Delete | Row disappears + Snackbar "Deleted" with Undo |
| Restore | Snackbar "Restored" |
| Sync success | Silent (updates "last synced" line) |
| Sync failure | Snackbar with Retry (subtle) |
| Form validation error | Focus first invalid field + error under field |
| Network operation failure | Snackbar with Retry |
| Unrecoverable error | Dialog with clear next step |

## Interaction Latency

| Action | Max acceptable latency |
| --- | --- |
| Tap → visual feedback (pressed state) | 50 ms |
| Tap → screen transition start | 100 ms |
| Save → snackbar visible | 300 ms |
| List filter → updated list | 200 ms |
| Search keystroke → filtered result | 200 ms |

If a local operation exceeds these limits, the interaction is broken — treat it as a bug.

## Anti-Patterns

- Confirmation on every save.
- Full-screen loading spinners on tab return.
- Toasts stacking three deep.
- Dialogs used for form entry.
- Notifications that block the CTA.
- Autoplaying tutorials.

## Do's

- One primary action per screen.
- Consistent feedback pattern for every action type.
- Undo over confirmation for reversible actions.
- Fail gracefully with a clear next step.

## Don'ts

- Don't ask "Are you sure?" more than once per user session for the same action type.
- Don't hide errors — surface them with a clear recovery.
- Don't block on network for core flows.
