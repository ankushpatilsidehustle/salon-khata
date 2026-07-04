# 11 · Success UX

Success is quiet. Salon Khata never celebrates a save with confetti — the owner needs to record the next customer.

## Universal Rule

**Success is a Snackbar.** Never a modal. Never a full-screen state. Never a mandatory acknowledgement.

## Snackbar Anatomy

- Non-blocking, bottom-centered above the bottom nav.
- 48 dp min height, `radius.md`, `elevation.5`.
- Icon (24 dp) + label (Body) + optional action label (right-aligned, `brand.primary`).
- One snackbar visible at a time.
- Duration:
  - `3 s` — plain success.
  - `5 s` — success with an action (`Add another`).
  - `8 s` — undoable delete.
  - `8 s` — error with `Retry`.

## Copy Style

- One short sentence.
- Verb in past tense: `Saved`, `Updated`, `Deleted`, `Restored`.
- Localized via translation keys.
- Never exclamation marks.

Good: `Saved`
Good: `Deleted · Undo`
Bad: `Success!!!`
Bad: `Your income has been successfully saved to the local database.`

## Success Feedback Matrix

| Action | Snackbar | Action label | After |
| --- | --- | --- | --- |
| Add income | `Saved` | `Add another` | Return to Dashboard |
| Edit income | `Updated` | — | Return to previous |
| Delete income | `Deleted` | `Undo` | Row removed |
| Add expense | `Saved` | `Add another` | Return to Dashboard |
| Edit expense | `Updated` | — | Return to previous |
| Delete expense | `Deleted` | `Undo` | Row removed |
| Add employee | `Added` | `Add another` | Return to Employees list |
| Edit employee | `Updated` | — | Return to previous |
| Delete employee (fresh) | `Deleted` | `Undo` | Row removed |
| Delete employee (with history) | `Deleted` | — | Row removed (dialog served as confirm) |
| Add service | `Added` | `Add another` | Return to Services list |
| Edit service | `Updated` | — | Return to previous |
| Delete service (fresh) | `Deleted` | `Undo` | Row removed |
| Delete service (with history) | `Deleted` | — | Row removed |
| Set commission rule | `Saved` | — | Return to Employee Commission |
| Add category | `Added` | — | Return to selector |
| Backup now | `Backup complete` | — | Update timestamp |
| Restore | `Restored` | — | Dashboard refreshed |
| Language change | (none — instant) | — | UI updates |
| Business profile update | `Updated` | — | Return to Settings |
| Sign out | (none — screen change is the feedback) | — | Splash |
| Add another (from snackbar) | Re-opens form | — | Form pre-defaulted |

## `Add Another` Pattern

For high-frequency creation flows (Income, Expense, Employee, Service):

- After Save, the snackbar shows an `Add another` action.
- Tapping `Add another` re-opens the form with:
  - Structural defaults preserved (payment mode = last used; category = last used).
  - Content defaults cleared (amount, name, notes).
- The counter of consecutive `Add another` sessions is invisible — no gamification.

## `Undo` Pattern

For any soft delete on fresh entries (no history):

- Snackbar shows an `Undo` action, 8-second duration.
- Tapping `Undo` restores the row instantly (row cross-fades back in).
- If the user does nothing, the delete is committed to the sync queue at snackbar dismissal.
- Undo works only for the most recent delete — stacking undos is not supported.

## Icons

Success icons use Lucide, 20 dp, tinted `status.success`.

| Action | Icon |
| --- | --- |
| Save (any) | `check-circle-2` |
| Delete | `trash-2` (in neutral tint) |
| Backup | `cloud-upload` |
| Restore | `cloud-download` |
| Sync | `refresh-cw` |

## Haptics

- Light haptic on primary save success.
- Light haptic on delete success.
- No haptics on background sync completion.
- No haptics on navigation success.

## When Success Should Be Silent

- Language change (UI update is the feedback).
- Sign out (splash is the feedback).
- Tab switch (screen is the feedback).
- Auto-save (post-MVP — but no snackbar).
- Background sync completion.
- Filter apply (list update is the feedback).
- Search debounce completion.

## Success Screens (never)

Salon Khata does **not** have success screens.

- No "Thank you" pages.
- No "You're all set" pages.
- No "Success!" pages between the action and the next screen.

The one exception is **Restore Progress → complete**, which is a screen transition (not a success screen — it's the natural end state of a progress screen).

## Empty Success

For actions where nothing visually changes (e.g., re-triggering a sync that had no pending items), still show a snackbar: `Already up to date`.

## Success In Offline Mode

Success in offline mode is **identical** to online mode. The write went to SQLite; sync will happen later.

- No "Saved offline" label.
- No "Will sync when online" hint.
- The owner should never have to think about whether they're online.

## Success + Sync Failure

If a write succeeds locally but sync fails immediately after:

- Show only the success snackbar (`Saved`).
- Do not show a sync failure snackbar — sync will retry silently.
- The Settings → Sync Status view is the single source of truth for pending items.

## Success Animations

- Snackbar slides up from the bottom over `motion.duration.normal` (200 ms).
- Check icon on the snackbar does a brief scale bump (1.0 → 1.1 → 1.0) over `motion.duration.fast` (opt-out under reduced motion).
- Row-insert animation on lists after a save (see [13-motion-flow.md](13-motion-flow.md)).

## Success + Undo Coexistence

If a user rapidly performs multiple deletes:

- Only the **most recent** delete's snackbar is visible.
- Undo affects only the most recent delete.
- Previous deletes commit to the sync queue as their snackbars dismiss.

**Never** stack snackbars vertically.

## Anti-Patterns

- Modal success dialogs.
- "Success!" copy.
- Full-screen success animations.
- Confetti / gamification.
- Snackbar without a clear message.
- Repeated snackbars for the same event.
- Snackbars stacked or overlapping.
- Success feedback that blocks the CTA area.
- Long copy in a snackbar (> 60 chars).

## Do's

- Keep success short and quiet.
- Offer `Add another` for repeat flows.
- Offer `Undo` for reversible destruction.
- Localize every success string.
- Test snackbar visibility under FAB and bottom nav.

## Don'ts

- Don't make the user tap to acknowledge success.
- Don't celebrate — the owner has work to do.
- Don't add gamification hooks.
- Don't repeat the same snackbar for the same action.
