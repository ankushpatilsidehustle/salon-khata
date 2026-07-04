# 14 · Accessibility Flow

Accessibility for Salon Khata is not compliance — it is the primary usability requirement. The core persona is a busy owner using one hand, in imperfect light, in their own language, with limited technical comfort.

Cross-reference: [../design-system/15-accessibility.md](../design-system/15-accessibility.md) for visual/technical standards.

## One-Handed Operation

The single most important accessibility rule: **every core flow completes with one thumb**.

### Reachability

The comfortable thumb zone on a modern phone (5.5"–6.5") is the bottom half of the screen and the middle third horizontally.

- **Primary actions** (FAB, Save, Continue) live in the bottom third.
- **Bottom navigation** is thumb-native.
- **Bottom sheets** put the primary CTA at the bottom.
- **App bar actions** (back, close, search) are only for infrequent navigation — the user does not need them mid-flow.

### Thumb reach test

Every screen must pass:

- Can I open the app, tap the FAB, complete a save, and dismiss the snackbar — all with the right thumb, phone held vertically, without shifting grip?

If a step forces a grip shift, the screen is redesigned.

## Large Touch Targets

- **Minimum**: 48 × 48 dp for any tappable element.
- **Primary CTA**: 52 dp height.
- **FAB**: 56 dp.
- **Bottom nav**: 64 dp with icon + label.
- **Icon buttons**: 44 dp visible + 4 dp padding = 48 dp effective target.
- **List rows**: 56 dp single-line, 72 dp two-line — extend the touch to the full row.
- **Chips**: 36 dp visible, 48 dp with padding.

**Rule**: no two tappable elements less than 8 dp apart.

## Thumb Reach Map (Portrait)

```
┌──────────────────────────┐
│ App bar (rarely tapped)  │  ← reach zone: uncomfortable
├──────────────────────────┤
│                          │
│                          │
│ Content (scroll)         │  ← reach zone: reach with thumb bend
│                          │
│                          │
├──────────────────────────┤
│ Primary CTA / FAB        │  ← reach zone: natural
│ Bottom nav               │  ← reach zone: natural
└──────────────────────────┘
```

Design rule: everything the user must tap during a common flow lives in the bottom third.

## Older Users

The persona includes owners aged 40+ with reading glasses. Design must accommodate:

- **Larger default text.** Body is 16 sp, headings 20+ sp. See [../design-system/04-typography.md](../design-system/04-typography.md).
- **Respect OS dynamic text scaling** up to 200%.
- **Never use text smaller than Caption (12 sp)** in interactive contexts.
- **High-contrast text** by default (verified 4.5:1 for body, 3:1 for large text).
- **Simple layouts** — no dense grids.
- **Explicit labels** — never assume icon recognition.
- **Slower motion allowed** — do not race the user.

## Regional Language Users

Salon Khata ships in 7 languages (see [../design-system/14-localization.md](../design-system/14-localization.md)). Accessibility for regional-language users means:

- **Font that renders their script correctly.** Anek covers Devanagari, Gujarati, Kannada, Tamil, Telugu. Manrope for Latin.
- **Line-height that respects tall glyphs.** Indic scripts stack taller — use `lineHeight.relaxed` for body text in Indic locales.
- **Longer strings.** Design mockups tested with the longest translation, not English.
- **Language picker visible everywhere it matters** — first launch, Settings, and post-restore.
- **Language name in its own script** on the picker (Hindi as `हिन्दी`, not `Hindi`).
- **No language switch confirmation.** Instant.
- **No English fallback in the UI.** If a translation key is missing, log a warning in dev — never render English to a Kannada-speaking user in production.

## Low Technical Confidence

The primary persona has never used a spreadsheet. Design implications:

- **No jargon.** No "sync", "queue", "conflict", "OAuth", "session".
- **No configurable options that don't matter.** Do not surface a "Sync every X minutes" setting — hardcode the behavior.
- **No developer artifacts.** No error codes, no stack traces, no crash reports shown to the user.
- **No hidden features.** Everything the user needs is reachable via bottom nav in ≤ 3 taps.
- **No feature discovery tooltips.** Icons + labels teach; tooltips are a crutch.
- **No optional wizards.** Onboarding is inline via empty states.
- **No modal ads or announcements.**

## Screen Readers

Both platforms:

- **iOS**: VoiceOver.
- **Android**: TalkBack.

Requirements per screen:

- Every interactive element has an `accessibilityLabel` from a translation key.
- Every icon-only button has a label (`t("common.back")`, `t("common.search")`, etc.).
- Every image / avatar has a label.
- Grouped controls (card = title + value + button) use a compound `accessibilityLabel` at the group level.
- `accessibilityRole` set (`button`, `header`, `text`, `image`).
- `accessibilityHint` used sparingly — only when the action is non-obvious.
- Dynamic changes announced via `AccessibilityInfo.announceForAccessibility` (e.g., `Income saved`).
- Snackbars use `accessibilityLiveRegion="polite"`.
- Errors announced when they appear.

Focus order follows visual reading order: top-left → bottom-right. On modal dismissal, focus returns to the triggering element.

## Dynamic Text

- App respects OS text size settings.
- All text sizes come from the type scale — no fixed pixel values.
- Layouts avoid fixed-height text containers — use `minHeight` and let text grow.
- Test target: 200% OS scaling, no truncation of critical values (money, employee name in header, primary CTA label).
- If a layout breaks at 200%, redesign — do not cap text scaling.

## Reduced Motion

- Detect `AccessibilityInfo.isReduceMotionEnabled` on app launch and on OS setting change.
- Replace slide/scale animations with cross-fades (same duration).
- Disable shimmer skeletons; use static pulse.
- Do not remove necessary feedback — just simplify it.

## Color Blindness

- No color-only meaning.
- Sync status: icon + text (not color alone).
- Errors: icon + text + color.
- Success: icon + text + color.
- Payment mode chips: labeled with the mode (`Cash`, `UPI`) not just tinted.

Design tested against the four common color-blindness profiles (protanopia, deuteranopia, tritanopia, achromatopsia).

## Haptics

- Light haptic on save success.
- Light haptic on delete success.
- Medium haptic on form submit failure.
- No haptics on scroll, tab switch, or minor UI changes.
- Respect OS haptic setting.

## Voice Accessibility (post-MVP)

- Post-MVP: consider Google Assistant Shortcuts for `Add income for Ravi 300 cash`.
- MVP: no voice input UI; native keyboard voice input is available via OS-level microphone key.

## Time-Limited Interactions

- **None** in MVP.
- OTP expires but has a resend affordance — the timer is not a fail state.
- No countdown timers on any user action.

## Landscape / Rotation

- **Portrait-only** in MVP.
- Rationale: single-handed use, POS-style entry, layout complexity.
- Rotation intent captured but not honored — the app stays portrait.

## Bright Sunlight Use

Salons often operate near street-facing windows. Design implications:

- **High-contrast light theme** by default (verified pairs from [../design-system/03-color-system.md](../design-system/03-color-system.md)).
- **No thin fonts** — minimum 400 weight for body, 600 for money.
- **No pastel-on-pastel** combinations.
- **No decorative gradients on functional surfaces.**

## Noisy / Distracting Environments

Salons have music, hair dryers, and clients talking. Design implications:

- **No audio feedback.**
- **Rely on visual + haptic** for confirmation.
- **Never require the user to hear a notification** to complete a flow.
- **Snackbars visible long enough** for a distracted glance (3–8 s).

## Interruption Handling

The user is interrupted constantly. The app must recover gracefully:

- **Every form auto-preserves input** on backgrounding.
- **Every open sheet re-opens** on app resume within 30 s (post-MVP).
- **Every write commits to SQLite before showing feedback** — a phone reboot mid-save never loses data.
- **Tab state persists** across app lifecycle.

## Accessibility Testing Per Screen

Every screen passes the checklist in [16-ux-review-checklist.md](16-ux-review-checklist.md) plus:

- [ ] All tappable elements ≥ 48 dp effective.
- [ ] Screen reader traversal is logical (no invisible focus traps).
- [ ] Screen at 200% text without truncating critical values.
- [ ] No color-only meaning.
- [ ] Reduced motion tested.
- [ ] Bright-sunlight test on physical device.
- [ ] One-handed thumb reach test passes.

## Anti-Patterns

- Small icon-only buttons for uncommon actions.
- Interactive elements < 48 dp.
- Text below 12 sp in interactive contexts.
- Locked text sizes.
- Time-critical interactions.
- Modal wizards on core flows.
- Feature tours or spotlight tooltips.
- Requiring rotation for a feature.
- English error messages in a non-English UI.
- Audio-only feedback.

## Do's

- Design bottom-up (put the CTA in the thumb zone first).
- Label every icon.
- Announce dynamic changes.
- Test at 200% text.
- Test in bright sunlight.
- Test one-handed.

## Don'ts

- Don't rely on color alone.
- Don't require gestures for critical actions.
- Don't gate features behind permissions.
- Don't add features that the primary persona doesn't need.
