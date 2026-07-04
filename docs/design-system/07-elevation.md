# 07 · Elevation

Elevation communicates hierarchy through depth. Salon Khata uses **restrained** elevation — shadows are subtle and meaningful, never decorative.

## Philosophy

- Elevation is a layering system, not a visual effect.
- Prefer **surface contrast** and **spacing** over elevation for grouping.
- A screen should have at most 2 elevation levels visible at rest.
- Never stack elevated surfaces (elevated card inside an elevated card).

## Elevation Levels

| Level | Token | Shadow | Use |
| --- | --- | --- | --- |
| 0 | `elevation.0` | none | Flush surfaces, screen background, dividers |
| 1 | `elevation.1` | `shadow.sm` | Resting cards |
| 2 | `elevation.2` | `shadow.md` | Cards during scroll, sticky app bar shadow |
| 3 | `elevation.3` | `shadow.md` | Dropdowns, menus, popovers |
| 4 | `elevation.4` | `shadow.lg` | Bottom sheets, dialogs |
| 5 | `elevation.5` | `shadow.xl` | FAB, snackbars, toasts |

## Shadow Tokens

```
shadow.sm       0 1 4 0 rgba(23,26,23,0.08)
shadow.md       0 4 10 0 rgba(23,26,23,0.10)
shadow.lg       0 8 18 0 rgba(23,26,23,0.12)
shadow.xl       0 16 32 0 rgba(23,26,23,0.14)
```

Rules:

- Shadows are always cast **downward** (positive Y offset).
- Never colorize shadows (no green or blue shadows).
- Never stack multiple shadows on the same element.

## Elevation By Component

| Component | Rest | Pressed | Notes |
| --- | --- | --- | --- |
| Card | `elevation.1` | `elevation.0` | Press "pushes down" |
| Money card | `elevation.1` | `elevation.0` | |
| Primary button | `elevation.1` | `elevation.0` | Optional; can be flat |
| Secondary button | `elevation.0` | `elevation.0` | Always flat |
| FAB | `elevation.5` | `elevation.4` | Always visible |
| App bar (default) | `elevation.0` | — | Flat by default |
| App bar (scrolled) | `elevation.2` | — | Shadow appears when list is scrolled |
| Bottom navigation | `elevation.2` | — | Subtle shadow above |
| Bottom sheet | `elevation.4` | — | Scrim below, no shadow on sheet body |
| Dialog | `elevation.4` | — | Scrim below |
| Dropdown / menu | `elevation.3` | — | |
| Toast / snackbar | `elevation.5` | — | |
| Chip | `elevation.0` | `elevation.0` | Always flat |
| Input field | `elevation.0` | `elevation.0` | Always flat |
| List row | `elevation.0` | — | Elevation belongs to the container, not the row |

## Elevated Surfaces On Elevated Surfaces

Do not do this. If a dialog needs to show a card, that card should be `elevation.0` inside the dialog. The dialog carries the elevation.

Exception: FAB may overlap an elevated bottom navigation.

## Elevation + Border

Never combine strong border + shadow on the same element.

Rules:

- Use shadow to raise a surface above the page (cards, dialogs).
- Use border to define a control at rest (inputs).
- If you need both, remove the border.

## Elevation On Scroll

- The app bar and bottom navigation adopt `elevation.2` when the scrollable content is not at the top.
- Transition duration: `motion.duration.fast` (120 ms).
- Never animate the shadow on cards during scroll — only on framing chrome.

## Overlay & Scrim

Scrims sit visually at elevation level between the base screen and the elevated surface above.

| Overlay | Behind | Value |
| --- | --- | --- |
| Sheet scrim | Bottom sheet | `color.overlay.sheet` |
| Dialog scrim | Dialog | `color.overlay.scrim` |
| Image scrim | Text on image (rare) | `color.overlay.image` |

- Scrims fade in over `motion.duration.normal` (200 ms).
- Tap on scrim dismisses non-critical sheets and dialogs.

## Do's & Don'ts

**Do**

- Use `elevation.1` as the default for cards.
- Use elevation to communicate temporary/floating states (sheets, dialogs, FAB).
- Fade elevation on scroll transitions for the app bar.

**Don't**

- Don't apply shadows to inputs.
- Don't nest elevated surfaces.
- Don't use elevation as decoration.
- Don't use large shadows (`shadow.xl`) on frequently visible components — they add visual weight and reduce calm.
