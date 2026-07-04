# 09 · Motion System

Motion in Salon Khata is **functional**. It shows what happened, what is loading, and what comes next. Motion never decorates.

## Motion Principles

1. **Purposeful** — every animation communicates a state change.
2. **Fast** — most transitions are 120–200 ms. Nothing exceeds 320 ms except deliberate entrances.
3. **Restrained** — no bounces, no confetti, no gratuitous parallax.
4. **Consistent** — the same interaction uses the same motion everywhere.
5. **Accessible** — respect `prefers-reduced-motion` (cross-fade instead of transform).

## Duration Tokens

| Token | Value | Use |
| --- | --- | --- |
| `motion.duration.instant` | 80 ms | Button ripple, pressed state |
| `motion.duration.fast` | 120 ms | Small state changes, icon swaps |
| `motion.duration.normal` | 200 ms | Sheets opening, screen transitions, snackbars |
| `motion.duration.slow` | 320 ms | Complex entrances (dashboard skeleton → data) |
| `motion.duration.deliberate` | 480 ms | Skeleton shimmer loop, restore progress |

## Easing Tokens

| Token | Curve | Use |
| --- | --- | --- |
| `motion.easing.standard` | `cubic-bezier(0.2, 0, 0, 1)` | Default in/out — 90% of the app |
| `motion.easing.enter` | `cubic-bezier(0, 0, 0, 1)` | Entrance animations (sheets, dialogs sliding up) |
| `motion.easing.exit` | `cubic-bezier(0.4, 0, 1, 1)` | Exit animations (sheets closing) |
| `motion.easing.emphasized` | `cubic-bezier(0.2, 0, 0, 1.4)` | Success feedback (subtle overshoot) — use rarely |

## Screen Transitions

| Direction | Motion | Duration | Easing |
| --- | --- | --- | --- |
| Push (forward) | Slide from right, cross-fade | 200 ms | standard |
| Pop (back) | Slide to right, cross-fade | 200 ms | standard |
| Modal (bottom sheet) | Slide up + scrim fade | 200 ms | enter (open) / exit (close) |
| Modal (dialog) | Fade + slight scale (0.96 → 1.0) + scrim fade | 200 ms | standard |
| Tab switch | Instant cross-fade | 120 ms | standard |

## Bottom Sheet

- Handle bar barely animates.
- Sheet slides up from bottom over `motion.duration.normal` with `enter` easing.
- Scrim fades in over the same duration.
- On dismiss, sheet slides down + scrim fades out over `motion.duration.normal` with `exit` easing.
- On swipe-to-dismiss, sheet follows the finger 1:1; snap-back or dismiss on release based on velocity or threshold (> 40% travel).

## FAB Animation

- **Appear**: scale from 0.8 → 1.0 with opacity 0 → 1 over `motion.duration.normal`.
- **Press**: scale 1.0 → 0.94, then release back to 1.0 over `motion.duration.instant`.
- **Hide on scroll**: scale to 0 + fade out over `motion.duration.fast` when list scrolls down; reverse on scroll up.

## Card & List Animation

- **Insert (new row)**: fade in + slide up 8 dp over `motion.duration.normal`.
- **Remove (soft delete)**: cross-fade out + collapse height over `motion.duration.normal`.
- **Reorder**: skip in MVP.

## Success Animation

- Save toast slides in from bottom over `motion.duration.normal`, holds 3 s, slides out.
- Never a full-screen check overlay.
- Icon animation: brief scale bump 1.0 → 1.1 → 1.0 over `motion.duration.fast` on the toast's check icon (opt-in, respects reduced motion).

## Delete Animation

- Row cross-fades out and collapses over `motion.duration.normal`.
- Undo snackbar appears simultaneously.
- If the user taps Undo, row cross-fades back in over `motion.duration.normal`.

## Loading Animation

**Skeleton shimmer**

- Linear gradient sweeps left-to-right over `motion.duration.deliberate` (480 ms), loops with 200 ms delay between sweeps.
- Gradient color: `background.subtle` → `surface.raised` → `background.subtle`.
- Respect reduced motion: shimmer becomes a static pulse (opacity 0.4 → 0.7 → 0.4).

**Button loading**

- Label fades out over `motion.duration.fast`, circular indicator fades in.
- Never resize the button — reserve label width from the start.

## Pull To Refresh

- Standard platform pattern (RN `RefreshControl`).
- Refresh spinner uses `brand.primary`.
- Refresh triggers a sync attempt; success is silent, failure shows a subtle snackbar.

## List Updates

- Adding an item: new row animates in as described above.
- Editing an item: item briefly pulses `interactive.selected` background then fades back to default over `motion.duration.normal`.
- Sync status change: badge cross-fades over `motion.duration.fast`.

## App Bar & Bottom Nav

- Shadow appears when scroll offset > 4 dp, cross-fades over `motion.duration.fast`.
- Bottom nav active tab: icon swaps outline → filled instantly; underline dot fades in over `motion.duration.fast`.

## Reduced Motion

When the OS reports `prefers-reduced-motion`:

- Replace all slide/scale transitions with cross-fades of equal duration.
- Disable shimmer; use static skeletons at 0.5 opacity.
- Disable FAB scale-in; use opacity only.
- Keep durations the same to preserve rhythm.

## Motion Anti-Patterns

- Bouncing buttons on tap
- Parallax on scroll
- Animated backgrounds
- Motion longer than 320 ms for state changes
- Two competing animations on the same element
- Motion that delays the user from doing the next action

## Do's & Don'ts

**Do**

- Keep motion under 200 ms wherever possible.
- Use motion to reinforce cause and effect (tap → response).
- Respect reduced-motion setting.

**Don't**

- Don't animate for the sake of animating.
- Don't use spring physics with large overshoots.
- Don't animate every layout change.
