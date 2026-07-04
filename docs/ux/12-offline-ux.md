# 12 · Offline UX

Salon Khata is **offline-first**. Every core flow works with no network. The user should never be blocked, warned, or interrupted by connectivity.

## The Offline Contract

The app promises:

1. **Every write succeeds locally**, whether online or offline.
2. **Every read is instant**, served from SQLite.
3. **Sync happens in the background**, silently.
4. **Offline is not an error state.**
5. **Data is never lost** because of network state.

This contract is non-negotiable. Any UX pattern that violates it is rejected.

## Offline Operation

- Splash → Dashboard → any core flow works with no network.
- Writes go to SQLite immediately; a row is queued in the sync outbox.
- Reads use SQLite exclusively.
- The user sees no offline indicator on core screens.
- The FAB works. Forms save. Deletes commit. Undo works. Reports render.

**Non-negotiable exceptions** (network required):

| Feature | Reason |
| --- | --- |
| Send OTP | SMS gateway needs network |
| Verify OTP | Backend validation |
| Restore from cloud | Data lives in cloud |
| Manual `Backup now` | Cloud target |

Every other feature is fully offline.

## Sync States (user-visible)

There are exactly 5 sync states, and only one surfaces to the user's attention.

| State | Visible where | Meaning |
| --- | --- | --- |
| Idle | Dashboard sync line: `Last synced 2 min ago` | Nothing to sync |
| Syncing | Dashboard sync line: `Syncing…` | Active push/pull |
| Success | Dashboard sync line: `Last synced just now` | Completed |
| Pending | Settings → Sync Status: `12 pending items` | Waiting for network or backoff |
| Failed | Settings → Sync Status: `Retry now` button + timestamp | Backoff exhausted for now |

Only **Syncing** transitions animate on the Dashboard; other transitions are silent.

## Sync Pending

- **On Dashboard**: no visible indicator until pending > 24 h.
- **On Settings → Sync Status**: shows count of pending items and last attempt time.
- **In transaction rows**: MVP has no per-row sync badges. All local data is treated as valid.

Post-MVP: consider a small sync icon on rows that haven't synced in > 6 h.

## Sync Completed

- Silent.
- Dashboard sync line updates to `Last synced just now`.
- No snackbar.
- No haptic.

The one exception: after a **pull** that changed data the user is currently viewing, the list animates the changes in (row-insert / row-update motion from [13-motion-flow.md](13-motion-flow.md)). No banner.

## Sync Failed

- Auto-retry with exponential backoff (see [../sync-engine.md](../sync-engine.md)).
- Not shown to the user on the Dashboard until sync has been failing for > 24 h.
- After 24 h without a successful sync:
  - Dashboard sync line prepends a subtle badge: `Not synced · 26h ago`.
  - No modal. No popup. No push notification.
- **Settings → Sync Status** always shows the truth.

## Manual Retry

Only from **Settings → Sync Status**:

- `Retry now` button.
- Tap triggers an immediate sync attempt.
- Success: line updates to `Just synced`.
- Failure: snackbar `Still can't sync · Check your internet.` (Subtle tier, no dialog.)

**Also**: pull-to-refresh on any list triggers a sync attempt. Failure shows a subtle snackbar on that list.

## Conflict Resolution

Salon Khata uses **last-write-wins with audit log** (see [../sync-engine.md](../sync-engine.md)).

MVP behavior:

- Conflicts resolve silently.
- The losing edit is preserved in the audit log.
- No user-facing conflict UI.
- No `Which do you want to keep?` dialog.

Rationale: single-owner salons rarely edit the same record from two devices simultaneously. When it happens, the more recent edit is almost always the correct one.

Post-MVP: Settings → Data → History surfaces the audit log for the rare case someone needs to see it.

## Restore Flow

Restore is the one place the app takes over the screen for an offline-conscious operation.

- Triggered on:
  - First login on a new device (automatic if backup exists).
  - Manual: Settings → Backup & Restore → `Restore from cloud`.
- Manual restore requires network and shows a confirmation dialog (destructive).
- Restore screen shows a linear progress bar with a `Cancel` action.
- Data replacement is atomic — a failure mid-way leaves the previous local data intact.
- On completion: Dashboard reloads with restored data + snackbar `Restored`.

### Restore + no network

- Manual restore attempt with no network: dialog `You need internet to restore. Please connect and try again.`
- Never queue restore for later — it is user-initiated destructive.

## Backup

Backup is invisible to the user in the common case.

- Automatic in the background after each write, batched with a debounce.
- No progress bar. No snackbar.
- Timestamp of last successful backup shown in Settings → Backup & Restore.
- If backups have not succeeded in > 7 days: Settings row shows a subtle warning badge; no modal, no push.

Manual backup (`Backup now`) shows a progress bar only if the upload takes > 500 ms; otherwise, a snackbar `Backup complete`.

## What The User Should Always Understand

Given the offline-first philosophy, the user should always be able to answer:

| Question | Where the answer is |
| --- | --- |
| Was my last entry saved? | Snackbar on save |
| Is my data on the cloud? | Settings → Backup & Restore |
| Am I offline right now? | Settings → Sync Status |
| Are there pending items to sync? | Settings → Sync Status |
| When did the app last sync? | Dashboard sync line |
| Can I trust my data? | Yes, always — the app guarantees local durability |

## What The User Should Never See

- Full-screen "You are offline" states on Dashboard, Reports, or Entries.
- Banners across the top of the screen indicating connectivity.
- Modal dialogs about sync.
- Push notifications for sync events (MVP).
- Sync progress bars during background operations.
- Warnings when they try to save data while offline.
- The word "sync" on any screen except Settings → Sync Status (and the Dashboard sync line).

## Behavior On Airplane Mode

Test scenario: user enters airplane mode.

- App continues to function fully.
- No visual change on Dashboard.
- FAB works. Save works. Undo works. Reports render.
- New entries queue silently.
- Settings → Sync Status reflects the reality: `You're offline · X pending items`.

## Behavior On Reconnect

Test scenario: user leaves airplane mode after 4 hours.

- Sync begins automatically within 30 s of network detection.
- Dashboard sync line changes: `Syncing…` → `Last synced just now`.
- No snackbar.
- No haptic.
- If the sync pulls new data (rare for a single-owner shop), the current list updates via cross-fade.

## Behavior On Slow Network

- No difference in UX from offline — the app never blocks the user on network.
- Sync tries with a reasonable timeout; failure = retry later.
- If the user is on a captive portal, sync fails; the app treats it as offline.

## Behavior During Backup In Progress

- Fully interactive.
- No spinner.
- Writes continue during backup.
- Backup upload adjusts to include the new writes on the next batch.

## Behavior During Restore In Progress

- **Modal (blocking).** The app is not interactive during restore because the underlying data is being replaced.
- `Cancel` is available.
- If the user cancels: previous local data is intact, snackbar `Restore cancelled`.

## Offline UX Anti-Patterns

- Full-screen "No Internet" state on any core screen.
- Blocking modals for sync events.
- Push notifications for background sync.
- "Save may fail" warnings.
- Disabled buttons when offline.
- Requiring the user to know they are offline before they can act.
- Fetching data on tab focus that requires network.
- Sync progress bars on the Dashboard.

## Do's

- Trust SQLite as the source of truth.
- Keep sync noise in Settings.
- Preserve every user write.
- Retry silently with backoff.

## Don'ts

- Don't tell the user they are offline unless they are trying to do something that needs network.
- Don't gamify sync ("100% synced!").
- Don't add sync badges to every row.
- Don't design any core flow that assumes connectivity.
