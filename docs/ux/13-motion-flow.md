# 13 · Motion Flow

Motion in Salon Khata serves usability. Every animation communicates a state change, nothing decorative.

Cross-reference: visual motion tokens in [../design-system/09-motion-system.md](../design-system/09-motion-system.md).

## Principles

1. **Motion communicates causality.** Tap → response, in ≤ 200 ms.
2. **Motion respects the OS.** Reduced motion is honored everywhere.
3. **Motion never delays.** Nothing longer than 320 ms except deliberate entrances.
4. **Motion is consistent.** The same interaction uses the same motion everywhere.

## Duration Ladder

| Duration | Use |
| --- | --- |
| 80 ms | Pressed states, ripples |
| 120 ms | Icon swaps, small state changes |
| 200 ms | Sheet open/close, screen transition, snackbar in/out |
| 320 ms | First render of a screen, hero card entrance |
| 480 ms | Skeleton shimmer loop (not for user actions) |

## Screen Transitions

| Transition | Motion | Duration |
| --- | --- | --- |
| Push (deeper) | Slide from right + cross-fade | 200 ms |
| Pop (back) | Slide to right + cross-fade | 200 ms |
| Tab switch | Instant cross-fade | 120 ms |
| Modal open (full-screen) | Slide from bottom + scrim fade | 200 ms |
| Modal close | Slide to bottom + scrim fade | 200 ms |
| Auth root → Main tabs | Cross-fade | 200 ms |
| Splash → next screen | Cross-fade | 200 ms |

**Rule**: back never re-plays the forward transition — it uses the reverse.

## Bottom Sheets

- **Open**: slide up from bottom + scrim fade in. 200 ms. `enter` easing.
- **Close**: slide down + scrim fade out. 200 ms. `exit` easing.
- **Swipe-to-dismiss**: sheet follows the finger 1:1; snaps closed or back based on velocity or 40% travel threshold.
- **Handle bar**: subtle idle presence, no animation.

**Rule**: nested bottom sheets are forbidden. The inline-create pattern **replaces** the current sheet with a new one — no visible stack.

## Dialogs

- **Open**: fade + slight scale (0.96 → 1.0) + scrim fade. 200 ms. `standard` easing.
- **Close**: fade + scale (1.0 → 0.96) + scrim fade. 200 ms. `standard` easing.
- **Rule**: never bounce or overshoot on a dialog.

## FAB

- **First appear on screen**: scale 0.8 → 1.0 + opacity 0 → 1. 200 ms.
- **Pressed state**: scale 1.0 → 0.94 → 1.0. 80 ms in, 80 ms out.
- **Hide on scroll down**: scale 1.0 → 0 + fade. 120 ms.
- **Show on scroll up**: scale 0 → 1.0 + fade. 120 ms.
- **Extended FAB label collapse** (post-MVP): label fades out on scroll, chip contracts to icon-only.

## Lists

### Row insert (new entry)

- New row fades in + slides up 8 dp. 200 ms.
- The new row is inserted at the correct sorted position, not at the top of the visible list unless that is where it belongs.

### Row remove (delete)

- Row cross-fades out (opacity 1 → 0) + collapses height. 200 ms.
- Undo snackbar animates in simultaneously (do not stagger).

### Row edit (updated in place)

- Brief pulse of `interactive.selected` background, then fade back to default. 200 ms.
- Do not slide or reorder unless the sort order changes.

### Reorder (post-MVP)

- Not in MVP.

## Cards

### Money Card first appear (Dashboard)

- Fade in + slide up 8 dp. 320 ms. Staggered by 40 ms per card.
- Hero card first, peers second.

### Money Card value change (after sync)

- Cross-fade the number. 120 ms.
- Do not animate a digit rolling.

### Card press

- Scale 1.0 → 0.98 → 1.0. 80 ms.
- Only if the card is tappable (Transaction Card, Employee Card in select).

## Loading

### Skeletons

- Shimmer sweep left-to-right. 480 ms loop with 200 ms pause.
- Skeleton block replaces itself with the real content via cross-fade. 200 ms.
- Under reduced motion: static pulse (opacity 0.4 ↔ 0.7) at 480 ms cadence.

### Button loading

- Label fades out. 120 ms.
- Circular indicator fades in. 120 ms.
- Button width does not change — reserve label width from the start.

### Progress bar (restore)

- Determinate progress moves smoothly, updating on every 1% change.
- Under reduced motion: still animates smoothly (progress needs to be visible).

## Success

### Snackbar in

- Slides up from below + fade in. 200 ms. `enter` easing.

### Snackbar out

- Slides down + fade out. 200 ms. `exit` easing.

### Snackbar check icon

- Brief scale bump (1.0 → 1.1 → 1.0) once when the snackbar appears. 120 ms.
- Under reduced motion: no bump.

## Delete

- Row: cross-fade + collapse height. 200 ms.
- Snackbar with `Undo`: slides in simultaneously.
- On `Undo`: row cross-fades back in + expands height. 200 ms.

## Navigation

### Tab switch

- The active tab icon swaps outline → filled instantly.
- Underline dot (if used) fades in. 120 ms.
- The screen cross-fades. 120 ms.

### App bar shadow

- Shadow fades in when scroll offset > 4 dp. 120 ms.

## Filter / Search Entry

- Search bar reveal: slides down + fades in below app bar. 200 ms.
- Filter chip row (when filters applied): fades in. 200 ms.
- Filter chip removal: slides out + list re-flows via layout animation. 200 ms.

## Payment Mode Chip Selection

- Selected chip: background fills over 120 ms, text color inverts instantly.
- Deselected chip: background empties over 120 ms.

## Segmented Control

- Selection pill slides between segments. 200 ms. `standard` easing.

## Reduced Motion Behavior

When `prefers-reduced-motion` is enabled:

| Standard motion | Reduced motion equivalent |
| --- | --- |
| Slide + fade | Cross-fade only, same duration |
| Scale (bounce or ease) | Instant + cross-fade |
| Shimmer | Static opacity pulse |
| FAB scale-in | Fade in only |
| Snackbar check bump | Skipped |
| Card first-appear stagger | All cards fade in together |

Rule: durations stay the same to preserve rhythm; only motion type simplifies.

## Motion + Latency Budget

Motion runs alongside a strict latency budget:

| Interaction | Time to visible feedback |
| --- | --- |
| Tap → pressed state | ≤ 50 ms |
| Tap → screen transition start | ≤ 100 ms |
| Save → snackbar visible | ≤ 300 ms |
| List filter → updated list | ≤ 200 ms |
| Search keystroke → filtered result | ≤ 200 ms (with 200 ms debounce) |
| Restore start → progress visible | ≤ 100 ms |

If the app cannot hit these budgets, the motion looks wrong — treat as a bug.

## Motion Sequencing

When multiple motions overlap:

- **Snackbar + row-remove**: run in parallel (both 200 ms).
- **Sheet open + backdrop fade**: run in parallel.
- **Screen transition + FAB hide**: FAB hides *before* the transition starts (120 ms), so it does not disappear mid-flight.
- **Tab switch + FAB visibility**: FAB fades out during tab switch, new tab's FAB fades in on arrival.

## First Launch Sequence

```
Splash (1.5 s) → cross-fade → Language Picker
                → tap Continue → screen push → Mobile Number
                → tap Send OTP → screen push → OTP
                → auto-verify → screen push → Business Setup
                → tap Continue → cross-fade to Main Tabs
                → Dashboard first render:
                    · Hero card fade+slide (320 ms)
                    · Peers fade+slide (staggered 40 ms)
                    · Recent tx / sync line follow (200 ms)
                    · FAB scale-in (200 ms)
```

## Anti-Patterns

- Bouncing / spring physics on buttons.
- Parallax on scroll.
- Animated backgrounds.
- Motion longer than 320 ms for state changes.
- Two competing animations on the same element.
- Motion that delays the user from the next action.
- Full-screen animated transitions (e.g., page flip, cube rotate).
- Confetti or celebration animations.
- Animated illustrations that require attention.

## Do's

- Keep motion short and purposeful.
- Reinforce cause and effect.
- Respect reduced motion.
- Match motion patterns to interaction types (open = enter easing, close = exit easing).

## Don'ts

- Don't animate for the sake of animating.
- Don't use spring physics with overshoot.
- Don't chain more than 2 animations sequentially.
- Don't animate layout on every data change.
