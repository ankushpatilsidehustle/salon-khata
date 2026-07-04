# 15 · Accessibility

Salon Khata must be usable by people with low vision, low literacy, motor impairments, and people using the app in bright sunlight or on the move.

## Standards

- WCAG 2.1 **Level AA** across all screens.
- Meets Google Play accessibility guidelines.
- Meets Apple Human Interface Guidelines accessibility section.

## Touch Targets

| Element | Minimum size |
| --- | --- |
| Any tappable element | **48 × 48 dp** |
| Primary CTA (button) | 52 dp height |
| FAB | 56 dp diameter |
| Icon buttons (compact bars) | 44 dp, with 4 dp padding to reach 48 dp effective |

Rules:

- The visible element may be smaller (e.g., a 24 dp checkbox), but the touch target must be 48 dp — extend the target with padding.
- No two tappable elements less than 8 dp apart.
- Bottom-row spacing accounts for safe area to avoid the home indicator area.

## Color Contrast

All text and functional icons meet WCAG AA contrast:

- Body text (16 sp and above): **4.5:1** minimum.
- Small text (< 16 sp): **4.5:1** minimum.
- Large text (18 sp bold or 24 sp regular): **3:1** minimum.
- Functional icons and UI elements: **3:1** against background.

Verified pairs are listed in [03-color-system.md](03-color-system.md#accessibility-verified-pairs).

Do not rely on color alone:

- Sync status uses icon + text, not color alone.
- Errors use icon + text + color.
- Success uses icon + text.

## Dynamic Text

- App respects OS text size settings.
- Type scale ramps proportionally to user's preferred size.
- Test up to **200%** OS text size.
- No text is hard-coded in pixels; all sizes come from the type scale.
- Layouts avoid fixed-height text containers — use `minHeight` and let text grow.

## Screen Readers

- **Every interactive element** has an `accessibilityLabel` from a translation key.
- **Every image, icon-only button, and avatar** has a label.
- Grouped controls (e.g., a card with title + value + button) use `accessibilityLabel` at the group level with a compound description.
- `accessibilityRole` is set:
  - `button` on all buttons and tappable rows.
  - `header` on section headers and titles.
  - `text` on read-only text.
  - `image` on avatars.
- `accessibilityHint` used sparingly — only when the action is not obvious from the label.
- Announce dynamic changes with `AccessibilityInfo.announceForAccessibility` (e.g., "Income saved").

## Focus Order

- Follows visual reading order: top-left → bottom-right.
- App bar back button is always first.
- Primary CTA is last in the focus order for the screen.
- Modals trap focus while open; on dismiss, focus returns to the triggering element.

## Errors & Announcements

- Form errors are announced by the screen reader when they appear.
- Snackbars are announced with `accessibilityLiveRegion="polite"`.
- Success messages are announced.
- Loading spinners have `accessibilityLabel` (`t("common.loading")`).

## Voice Accessibility

Salon Khata targets users with **low literacy** and **hands-busy** contexts (haircut in progress).

- All screens work with Google Assistant / Siri Shortcuts (post-MVP).
- Voice-friendly labels: prefer full words over abbreviations.
- Never rely on visual cues alone — every state has a textual announcement.

## Haptics

- Light haptic on primary action success (Save, Delete confirmation).
- Medium haptic on error (form submit failure).
- No haptics on scroll or minor UI changes.
- Respect the OS haptic setting.

## Motion & Reduced Motion

See [09-motion-system.md](09-motion-system.md).

- Detect `AccessibilityInfo.isReduceMotionEnabled`.
- Replace slide/scale animations with cross-fades.
- Disable shimmer skeletons; use static pulse.
- Never remove necessary state-change feedback — just simplify it.

## Contrast Themes

- Light theme ships in MVP.
- Dark theme reserved (see [03-color-system.md](03-color-system.md)) — no color choices that would break in dark theme.
- High-contrast theme reserved for post-MVP.

## Language & Literacy

- Words are simple, short, direct — see [04-typography.md](04-typography.md) voice section.
- Never require the user to interpret an abbreviation.
- Icons always paired with labels for non-standard actions.
- Numeric input uses the numeric keyboard, always.

## Input & Motor Accessibility

- No time-limited actions (except OTP expiry which has a resend affordance).
- No drag-and-drop for critical flows.
- No pinch-to-zoom required for content (though allowed).
- Long press does nothing (see [12-lists.md](12-lists.md)).
- Actions reachable with one thumb — primary CTAs live at the bottom.

## Landscape Orientation

- App is **portrait-only** in MVP.
- Rationale: single-handed use, POS-style entry, avoids layout complexity across two orientations.

## Testing Checklist Per Screen

- [ ] All tappable elements are 48 dp minimum.
- [ ] All text has ≥ 4.5:1 contrast.
- [ ] All icons and images have accessibility labels.
- [ ] Screen reader can traverse in logical order.
- [ ] Screen works at 200% OS text size without truncation.
- [ ] All states communicate with more than color.
- [ ] Reduced motion setting is respected.
- [ ] Errors and success are announced.
- [ ] No time-critical interactions.

## Do's

- Use system-standard components where possible.
- Label every icon.
- Announce dynamic content.
- Extend touch targets with padding.
- Respect OS accessibility settings.

## Don'ts

- Don't use color as the sole signal.
- Don't require gestures for critical flows.
- Don't lock text at pixel sizes.
- Don't remove focus outlines.
- Don't use icon-only buttons for uncommon actions.
