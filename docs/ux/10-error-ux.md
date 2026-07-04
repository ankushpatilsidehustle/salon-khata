# 10 · Error UX

Errors are inevitable. The app's job is to make them **invisible when possible**, **recoverable when not**, and **never scary**.

## Error Tiering

Every error falls into one of four tiers. The tier decides the feedback.

| Tier | Description | Feedback pattern |
| --- | --- | --- |
| **Silent** | Recovered automatically, no user impact | No UI |
| **Subtle** | Non-blocking, retry available | Snackbar with `Retry` |
| **Blocking** | User cannot proceed without action | Dialog |
| **Fatal** | App cannot continue | Error screen with `Retry` and `Contact support` |

## Copy Style

- **Plain language.** No error codes.
- **Second person.** "We couldn't save your entry" — not "Save failed".
- **What happened + what to do.** Never one without the other.
- **No blame.** Never "You entered an invalid value."
- **Localized** via translation keys.

Good: `We couldn't save this entry. Try again in a moment.`
Bad: `SAVE_ERROR_500`

---

## Validation Errors (form-level)

**Trigger**: on-blur (single field) or on-submit (form).

**Behavior**

- Error text replaces the help text under the field.
- Field border switches to `status.danger`.
- On submit failure: scroll to and focus the first invalid field.
- One error per field visible at a time.
- Errors clear the moment the value becomes valid on the next blur.

**Copy examples**

| Field | Error copy |
| --- | --- |
| Amount empty | `Enter an amount to save.` |
| Amount ≤ 0 | `Amount must be greater than zero.` |
| Mobile length wrong | `Enter a 10-digit mobile number.` |
| OTP wrong | `The code doesn't match. Try again.` |
| Employee name empty | `Give this employee a name.` |
| Service name empty | `Give this service a name.` |
| Price ≤ 0 | `Enter a price greater than zero.` |

**Never** show `Required field` or `Invalid input`. Always be specific.

---

## Offline Errors

**Salon Khata is offline-first.** Being offline is **not** an error.

Behavior on core screens (Dashboard, Entries, Reports, forms):

- No banner.
- No overlay.
- No warning.
- Writes go to SQLite immediately, sync queues in the background.

The only place offline is surfaced:

- **Settings → Sync Status** shows "You're offline" + count of pending items.
- **Sync line on Dashboard**: `Last synced 2h ago` (no `Offline` label in MVP; the timestamp is enough).

**Non-negotiable**: no "Please connect to internet" message on any screen the user is trying to use.

---

## Network Errors (backend request failed)

Occurs during: OTP send, OTP verify, backup, restore, auth session refresh.

### Tier: Subtle (recoverable)

- Snackbar `Couldn't reach the server. Retry.`
- `Retry` action re-runs the same request.
- No blocking overlay.
- Preserve any user input.

### Tier: Blocking (auth)

Only during OTP flows where the app cannot proceed without a network:

- Dialog `Couldn't send the code`
  - Body: `Please check your internet connection and try again.`
  - Primary: `Try again`
  - Secondary: `Cancel` (returns to Mobile Number screen)

---

## Sync Failures

**Silent by default.** The sync engine retries with exponential backoff.

Visible surfaces:

1. **Dashboard sync line**
   - Normal: `Last synced 2 minutes ago`.
   - > 24 h without sync: subtle inline badge `Not synced`.

2. **Settings → Sync Status**
   - Count of pending items.
   - Last successful sync time.
   - `Retry now` button.

3. **Snackbar on pull-to-refresh failure**
   - `Couldn't sync · Retry`.
   - Only shown when the user triggered the sync manually.

**Never**:

- A full-screen sync-failure error.
- A modal blocking the user.
- Repeated snackbars on background retries.

---

## Restore Failures

Restore is a user-triggered destructive action, so failure is more visible.

- If restore fails mid-way:
  - Progress screen shows `Restore failed at 42%`.
  - Local data is **not** modified (restore commits at the end).
  - Buttons: `Try again`, `Cancel`.
- If restore succeeds partially and the app cannot recover:
  - Dialog: `Restore incomplete. Try again from Settings.`
  - Take the user to Settings → Backup & Restore.

---

## Unexpected Errors (uncaught exceptions)

**Fatal tier.** Should be extremely rare.

- Full-screen error state:
  - Icon: `alert-triangle`
  - Title: `Something went wrong`
  - Body: `The app hit an unexpected problem. Please try again. Your data is safe.`
  - Primary: `Try again` (restarts the current stack)
  - Secondary: `Contact support` (opens WhatsApp deep link, post-MVP)
- The exception is logged for engineering (see [../coding-standards.md](../coding-standards.md)).
- User's data is never lost — local SQLite is untouched.

---

## Permission Errors

MVP requests minimal permissions:

- **Notifications** (post-MVP for backup reminders): asked in context, never on first launch.
- **Contacts** (post-MVP for adding employees quickly): asked in context, silently continue if denied.
- **Storage** (Android legacy): never prompted; scoped storage only.

**Behavior when denied**

- Never re-prompt automatically.
- Continue without the feature.
- If the user attempts the feature again, show a small inline hint: `Enable notifications in your device settings to get reminders.` with a `Open settings` action.

**Never**:

- Full-screen "You must enable X" walls.
- Repeated permission dialogs.

---

## Authentication Errors

### OTP send failed

- Subtle snackbar `Couldn't send the code · Retry`.
- Preserve mobile number.

### OTP wrong

- Field-level error under OTP input: `The code doesn't match. Try again.`
- Clear the input, focus first box.
- Increment attempt counter (post-MVP: lock after 5 wrong attempts for 5 minutes).

### OTP expired

- Field-level: `Code expired. Send a new one.`
- Highlight the `Resend` link.

### Session expired

- Silent: try to refresh in background.
- If refresh fails: sign the user out silently → Splash → Mobile number screen.
- Snackbar on the mobile number screen: `Please sign in again.`
- Preserve unsaved local data (never sync-blocked).

---

## Storage Errors (device out of space)

Rare but non-recoverable at the point of write.

- Snackbar `Couldn't save · your device is out of storage.`
- Preserve the form values.
- The user can free space and retry.

---

## Recovery Patterns

| Error type | Recovery |
| --- | --- |
| Field validation | Inline correction |
| Network request | Snackbar `Retry` |
| Sync | Automatic + `Retry now` in Settings |
| OTP wrong | Re-enter |
| Session expired | Silent re-auth or graceful sign-out |
| Restore failed | Full retry from Settings |
| Storage full | Free space and retry |
| Uncaught exception | `Try again` + restart stack |

## Error Presentation Rules

- **One error at a time.** Never stack error snackbars.
- **Never modal for non-critical errors.** Reserve dialogs for blocking flows only.
- **Preserve user work.** Any form field, filter, or in-progress selection is preserved on error.
- **Match tone across languages.** Translations must feel equally calm — no exclamation marks, no dramatic verbs.
- **Give people a clear next step.** Every error message ends with what the user can do.

## Anti-Patterns

- Error codes shown to users.
- Alert dialogs for sync failures.
- Banners saying "You are offline" on Dashboard.
- Multiple snackbars stacked vertically.
- Uncaught exceptions crashing the app.
- Error messages in English when the UI is in another language.
- "Contact administrator" copy — there is no administrator.
- Vague messages ("Error", "Failed", "Try again later" without a retry action).

## Do's

- Categorize errors by tier before designing the response.
- Preserve user input on every error.
- Localize every error string.
- Test errors under airplane mode.
- Give a clear recovery for every error.

## Don'ts

- Don't blame the user.
- Don't leak error codes or stack traces.
- Don't require the user to leave the app to recover.
- Don't show more than one error per field at a time.
