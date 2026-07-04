# 16 · UX Review Checklist

Every screen must pass this checklist before it ships. Every future screen, every future feature, every future release.

If a screen cannot check every applicable box, the screen is not ready.

## First-Time Understanding

- [ ] A new user can identify the primary action within 5 seconds.
- [ ] The screen's purpose is obvious without reading a title.
- [ ] No feature discovery tooltips required.
- [ ] Empty state (if applicable) teaches the next action.
- [ ] The user is never asked to interpret an icon they do not know.

## The 10-Second Test (for entry flows)

- [ ] Income entry completes in ≤ 10 seconds on repeat use.
- [ ] Expense entry completes in ≤ 10 seconds on repeat use.
- [ ] Add employee completes in ≤ 15 seconds.
- [ ] Add service completes in ≤ 15 seconds.
- [ ] Defaults reduce the number of taps required (payment mode, date, category).

## One-Handed Operation

- [ ] Primary CTA lives in the bottom third of the screen.
- [ ] FAB (if present) is bottom-right, within thumb reach.
- [ ] No critical action requires a grip shift.
- [ ] Bottom nav labels visible and reachable.
- [ ] App bar back button never required mid-flow (only for navigation).

## Empty State

- [ ] Every list has an empty state.
- [ ] Empty state has icon + title + body + primary action.
- [ ] Empty state copy is a translation key.
- [ ] Search-empty state exists where search is available.

## Loading State

- [ ] First-load skeleton matches final content layout.
- [ ] Skeleton respects reduced motion.
- [ ] Local reads are instant — no spinner.
- [ ] Tab return does not re-trigger a skeleton.
- [ ] Button loading state does not resize the button.

## Offline State

- [ ] Screen works with no network (no blocking overlays).
- [ ] No "You are offline" banner.
- [ ] Writes commit to SQLite immediately.
- [ ] Reads are served from SQLite.
- [ ] Sync state visible only in Settings → Sync Status.

## Error State

- [ ] Every failure has a defined tier (silent / subtle / blocking / fatal).
- [ ] Every error message says what happened and what to do.
- [ ] Every error preserves user input.
- [ ] Every error has a clear recovery path.
- [ ] No error code shown to the user.
- [ ] No user-blaming copy.

## Success State

- [ ] Success is a snackbar, not a modal.
- [ ] Success copy is one short sentence.
- [ ] `Add another` action provided for high-frequency flows.
- [ ] `Undo` action provided for reversible destruction.
- [ ] No "Success!" copy.
- [ ] No forced acknowledgement.

## Localization

- [ ] Every visible string uses a translation key.
- [ ] No hard-coded English.
- [ ] Screen tested with the longest translation (Hindi or Kannada).
- [ ] No truncation of critical values in any supported language.
- [ ] Currency and date formats follow locale.
- [ ] Language switch is instant.

## Design System

- [ ] All colors from color tokens.
- [ ] All typography from type tokens.
- [ ] All spacing from the 8-point scale.
- [ ] All radius, elevation, motion from tokens.
- [ ] No hex codes inline.
- [ ] No pixel values inline.

## Component Reuse

- [ ] Every component is from the component library.
- [ ] No one-off custom components.
- [ ] Component variant matches its purpose.
- [ ] Component states (default / pressed / disabled / loading) all covered.

## Accessibility

- [ ] All tappable elements ≥ 48 dp effective touch target.
- [ ] Elements ≥ 8 dp apart.
- [ ] All interactive elements have `accessibilityRole` and `accessibilityLabel` (from a translation key).
- [ ] All icon-only buttons have labels.
- [ ] Focus order matches visual reading order.
- [ ] Dynamic changes announced (`accessibilityLiveRegion` or `announceForAccessibility`).
- [ ] Screen works at 200% OS text size without truncating critical values.
- [ ] Reduced motion setting respected.
- [ ] No color-only meaning.
- [ ] Screen reader tested on iOS (VoiceOver).
- [ ] Screen reader tested on Android (TalkBack).
- [ ] Bright sunlight readability tested on physical device.
- [ ] One-handed thumb reach test passes.

## Navigation

- [ ] Back behavior follows the matrix in [02-navigation-architecture.md](02-navigation-architecture.md).
- [ ] Back never skips over a meaningful screen.
- [ ] Back never loses user input silently (discard-changes guard).
- [ ] Escape from any modal / sheet is obvious (close `x` or swipe down).
- [ ] Screen state persists across tab switches.
- [ ] Deep link routes to the correct tab and screen.

## Forms (if applicable)

- [ ] Field order matches user thinking, not database order.
- [ ] Every field has a visible label above the input.
- [ ] Correct keyboard type per field.
- [ ] Required fields not marked with asterisks; optional fields suffixed `(optional)`.
- [ ] Validation on blur, not on keystroke.
- [ ] First invalid field focused on submit failure.
- [ ] Save button never disabled based on empty fields.
- [ ] Discard-changes dialog on back with unsaved changes.
- [ ] Auto-focus only when it saves a tap and doesn't push CTA off-screen.

## Lists (if applicable)

- [ ] Row height consistent within a list.
- [ ] Consistent trailing element per list.
- [ ] Grouped by date or status where applicable.
- [ ] Search available (if list can grow beyond 20 items).
- [ ] Filter available (if list can span multiple dates).
- [ ] No swipe actions on core flows.
- [ ] No long-press actions on core flows.
- [ ] Pull-to-refresh triggers sync (silent success).
- [ ] No numbered pagination.

## Money Rendering

- [ ] Money values use Currency Display component.
- [ ] Tabular figures used for all money.
- [ ] Currency symbol matches locale.
- [ ] Grouping follows locale (`₹1,25,000` in India).
- [ ] Money stored in minor units (paise).
- [ ] Sign color inherited from context, not baked into the number.

## Motion

- [ ] Screen transitions use `motion.duration.normal` (200 ms) with `standard` easing.
- [ ] No animation exceeds 320 ms for state changes.
- [ ] Reduced motion respected.
- [ ] No bouncing / spring physics with overshoot.
- [ ] Motion supports usability, not decoration.
- [ ] Latency budgets met (see [13-motion-flow.md](13-motion-flow.md)).

## Data Trust

- [ ] Every write commits to SQLite before showing success.
- [ ] Every read is served from SQLite.
- [ ] Sync happens in the background.
- [ ] Data preserved on backgrounding, kill, or crash.
- [ ] Historical records are immutable (edits do not re-price past transactions).

## Interaction Patterns

- [ ] One primary action per screen.
- [ ] Delete uses undo pattern (except entities with history → dialog).
- [ ] Confirmation dialogs only for irreversible destructive actions.
- [ ] Selection uses bottom sheets, not new screens.
- [ ] FAB action is the most common creation action on the screen.
- [ ] Recent selections pinned to top in selection sheets.
- [ ] Defaults remembered across sessions where sensible.

## Content Quality

- [ ] Button labels are verbs (`Save`, `Add income` — never `OK`).
- [ ] Titles are nouns or questions (`Delete this service?` — never `Delete!`).
- [ ] Copy is short, direct, respectful.
- [ ] No jargon, no engineering terms surfaced to the user.
- [ ] No exclamation marks.
- [ ] No emoji.

## Performance

- [ ] Tap → pressed feedback ≤ 50 ms.
- [ ] Tap → screen transition start ≤ 100 ms.
- [ ] Save → snackbar visible ≤ 300 ms.
- [ ] Search keystroke → filtered result ≤ 200 ms.
- [ ] Screen initial render ≤ 500 ms on mid-range Android.
- [ ] No jank on scroll (60 fps target).

## Screen Reader Testing

- [ ] VoiceOver walkthrough of every state.
- [ ] TalkBack walkthrough of every state.
- [ ] Focus lands on the intended element on screen open.
- [ ] Focus returns to the trigger on modal dismissal.
- [ ] Dynamic content announces changes.

## Physical Device Testing

- [ ] iPhone (mid-range).
- [ ] Android budget device (< ₹15,000 range).
- [ ] Bright sunlight test.
- [ ] Airplane mode test (full flow).
- [ ] Reduced motion test.
- [ ] 200% text scale test.

## Cross-References

- [ ] Design system checklist passed ([../design-system/18-design-qa-checklist.md](../design-system/18-design-qa-checklist.md)).
- [ ] Accessibility rules honored ([14-accessibility-flow.md](14-accessibility-flow.md)).
- [ ] Localization complete ([../design-system/14-localization.md](../design-system/14-localization.md)).
- [ ] Component reuse verified ([../design-system/08-component-library.md](../design-system/08-component-library.md)).
- [ ] Screen listed in [03-screen-inventory.md](03-screen-inventory.md).
- [ ] Flow diagrammed in [04-screen-flows.md](04-screen-flows.md) (if a new flow).

## Ship-Ready Decision

A screen is ship-ready only when:

- [ ] All applicable checklist items above are checked.
- [ ] Screen name and template documented.
- [ ] All translation keys added to `en.json` and all supported languages.
- [ ] All states manually walked by QA (populated / empty / loading / error / offline).
- [ ] Motion tested with reduced-motion setting enabled.
- [ ] Accessibility audit passed on both platforms.
- [ ] One-handed thumb-reach test passed.
- [ ] 10-second target validated for entry flows.

## Reviewer Sign-Off

The reviewer signs off only after:

- [ ] Running the checklist above independently.
- [ ] Testing the screen on a physical Android budget device.
- [ ] Walking the flow in the longest translation.

## Anti-Patterns To Reject

If any of the following appear, the screen is rejected regardless of other merits:

- Full-screen "You are offline" state on a core screen.
- Modal for a success message.
- Confirmation dialog on save.
- Two primary buttons side by side.
- Hard-coded English text.
- Missing empty state on a list.
- Icon button without a label.
- Touch target < 48 dp.
- Long-press for a critical action.
- Numbered pagination.
- Pie / line / stacked chart.
- Hero-sized number below the fold.
- Feature discovery tooltip.
- Gamification of business events.

## Continuous Improvement

If a defect ships despite this checklist, **update the checklist**. The checklist grows to catch what slipped through.
