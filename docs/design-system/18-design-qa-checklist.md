# 18 · Design QA Checklist

Every screen must pass this checklist before it ships. Run this on both design mockups and built screens.

## Structure

- [ ] Screen uses one of the eight templates from [17-screen-templates.md](17-screen-templates.md).
- [ ] App bar height is 56 dp + safe area top.
- [ ] Bottom nav present on Dashboard, Entries, Reports, More (not on modals, auth, forms).
- [ ] Exactly one primary action per screen.
- [ ] Primary action is in the bottom third of the screen.

## Spacing

- [ ] All spacing values come from the 8-point scale.
- [ ] Screen horizontal padding is `space.4` (16).
- [ ] Card internal padding is `space.4`.
- [ ] Section header spacing: `space.5` above, `space.2` below.
- [ ] No arbitrary pixel values (23, 17, 11, etc.).

## Typography

- [ ] All text uses tokens from [04-typography.md](04-typography.md).
- [ ] Only Manrope and Anek fonts used.
- [ ] Only weights 400 / 600 / 700 used.
- [ ] Money values use Money scale + tabular figures.
- [ ] No hard-coded font sizes.
- [ ] Line-height respects Indic script requirements (relaxed for Devanagari/Tamil).

## Color

- [ ] All colors come from tokens in [03-color-system.md](03-color-system.md).
- [ ] No hex codes inline.
- [ ] Text has ≥ 4.5:1 contrast against its background.
- [ ] Functional icons have ≥ 3:1 contrast.
- [ ] No color-only meaning (state also communicated via icon or label).
- [ ] Payment mode tints only used in payment mode chips.

## Iconography

- [ ] All icons from Lucide-react-native.
- [ ] Icon stroke weight 1.5 dp for outline set.
- [ ] Filled variant only for selected states.
- [ ] Icons semantically mapped (see [06-iconography.md](06-iconography.md)).
- [ ] Icon size follows the icon scale (16, 20, 24, 32).
- [ ] Every icon-only button has an accessibility label.

## Elevation

- [ ] Elevation level matches the component's role.
- [ ] No nested elevated surfaces.
- [ ] Bottom nav elevated only when content scrolls beneath it.
- [ ] FAB uses `elevation.5`, dialogs `elevation.4`.

## Motion

- [ ] Screen transitions use `motion.duration.normal` (200 ms) with `standard` easing.
- [ ] No animation exceeds 320 ms.
- [ ] Reduced-motion setting respected.
- [ ] No bouncing / spring physics with overshoot.
- [ ] Skeleton shimmer respects reduced motion (static pulse fallback).

## Components

- [ ] Every component used is from [08-component-library.md](08-component-library.md).
- [ ] No one-off custom components.
- [ ] Component variant matches its purpose (e.g., destructive Button for delete).
- [ ] Component states covered: default, pressed, disabled, loading (where applicable).

## Forms

- [ ] Every field has a visible label above the input.
- [ ] Correct keyboard type per field.
- [ ] Required fields not marked with asterisks; optional fields suffixed with `(optional)`.
- [ ] Validation on blur, not on keystroke.
- [ ] First invalid field focused on submit failure.
- [ ] Discard-changes dialog on back with unsaved changes.
- [ ] Save writes to SQLite before showing feedback.

## Lists

- [ ] Row height consistent within a list.
- [ ] Grouping by date or status where applicable.
- [ ] Empty state present with icon + title + body + action.
- [ ] No swipe or long-press actions on core flows.
- [ ] Pull-to-refresh triggers sync (silent success).

## Navigation

- [ ] Bottom nav has exactly 4 tabs with labels visible.
- [ ] Back behavior follows the matrix in [11-navigation.md](11-navigation.md#back-behavior).
- [ ] FAB present only where defined; correct icon and behavior.
- [ ] No hamburger menu, drawer, or nested tabs.

## Data Visualization

- [ ] Money values formatted via Currency Display.
- [ ] Tabular figures used for all money.
- [ ] No pie / line / stacked charts.
- [ ] Bar list max 7 items visible.
- [ ] Empty visualizations use Empty State component.

## Localization

- [ ] Every visible string uses a translation key.
- [ ] No concatenated strings.
- [ ] Layout tested with longest-language variant (Kannada or Hindi).
- [ ] Dates and currency use locale formatting.
- [ ] Digits are Latin (0–9).
- [ ] Language row shows language name in its own script.

## Accessibility

- [ ] All tappable elements ≥ 48 dp effective touch target.
- [ ] Elements ≥ 8 dp apart.
- [ ] All interactive elements have `accessibilityRole` and `accessibilityLabel`.
- [ ] Screen traversable in logical reading order.
- [ ] Screen works at 200% OS text size without truncation of critical values.
- [ ] Dynamic changes announced (`accessibilityLiveRegion` or `announceForAccessibility`).
- [ ] No time-critical interactions (except OTP with resend).
- [ ] Portrait orientation only.
- [ ] Screen reader tested on iOS (VoiceOver) and Android (TalkBack).

## Offline & Loading

- [ ] Screen works with no network (no blocking overlays).
- [ ] No "You are offline" banner.
- [ ] Local reads are instant (no spinners).
- [ ] First load shows skeleton if > 300 ms.
- [ ] Subsequent tab returns do not show skeletons.

## States Covered

Every screen must handle these states:

- [ ] Loading (first load)
- [ ] Empty
- [ ] Populated
- [ ] Error (with retry)
- [ ] Offline (populated with cached data)
- [ ] Syncing (silent indicator)
- [ ] Success feedback (snackbar)

## Feedback

- [ ] Save shows snackbar (not a dialog).
- [ ] Delete uses undo pattern (not confirmation) except for entities with historical data.
- [ ] Errors describe what happened and what to do next.
- [ ] Only one snackbar visible at a time.
- [ ] No modal that requires a tap to dismiss a success message.

## Performance

- [ ] Tap → pressed feedback ≤ 50 ms.
- [ ] Tap → screen transition start ≤ 100 ms.
- [ ] Save → snackbar visible ≤ 300 ms.
- [ ] Search keystroke → filtered result ≤ 200 ms.
- [ ] Screen initial render ≤ 500 ms on mid-range Android.

## Responsive & Device

- [ ] Renders correctly on 360 × 640 dp (smallest supported).
- [ ] Renders correctly on 414 × 896 dp (typical iPhone).
- [ ] Safe area insets applied (top notch, bottom home indicator).
- [ ] Portrait only.

## Content

- [ ] Labels are verbs on buttons ("Save", "Add income" — not "OK").
- [ ] Titles are nouns or questions ("Delete this service?" — not "Delete!").
- [ ] Copy is short, direct, respectful.
- [ ] No jargon, no acronyms unfamiliar to the user.
- [ ] Localization keys use `feature.context.description` naming.

## Do's

- Run this checklist before every design handoff.
- Run this checklist before shipping a screen to production.
- Add missing items to this checklist if a defect ever slips through.

## Don'ts

- Don't skip items because "it's just a small screen".
- Don't rely on the developer to catch design-system violations.
- Don't approve any screen that fails accessibility items.

## Sign-off

Screen is ship-ready only when:

- [ ] All applicable checklist items above are checked.
- [ ] Screen name and template documented.
- [ ] Localization keys added to `en.json` and all supported languages.
- [ ] Accessibility audit passed on iOS and Android.
- [ ] QA has walked the screen against every state.
