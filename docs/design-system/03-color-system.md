# 03 · Color System

Color in Salon Khata is **semantic** — every color has a meaning and a job. Colors are never chosen for decoration.

## Philosophy

- The app should be readable in bright shop light and dim evening light.
- The primary color is used only for actions and identity, never as background flood.
- Status colors (success, warning, danger) are reserved for status. Do not use `success` green as a decorative highlight.
- Neutrals do the visual heavy lifting. Color is a spice, not a base.

## Palette Overview

| Family | Purpose |
| --- | --- |
| Brand | Identity, primary actions, selected states |
| Surface | Backgrounds for content containers |
| Background | Screen-level backgrounds |
| Text | Foreground text at four emphasis levels |
| Border / Divider | Structure between elements |
| Status | Success, warning, danger, info |
| Interactive | Hover, pressed, selected, focus, disabled |
| Overlay | Scrims behind sheets, dialogs |

## Brand

| Token | Hex | Use |
| --- | --- | --- |
| `color.brand.primary` | `#0F5F4A` | Primary buttons, active tab, selected state, brand marks |
| `color.brand.primaryPressed` | `#0A4536` | Pressed state of primary buttons |
| `color.brand.secondary` | `#C58A2A` | Premium accents (rare — max 1 per screen) |
| `color.brand.secondaryPressed` | `#9E6D1E` | Pressed state of secondary accents |

Rules:

- Never use `brand.secondary` as a background flood.
- Never place `brand.primary` text on a `brand.primary` background.
- Brand color must not exceed ~10% of any screen's pixel area.

## Surface

| Token | Hex | Use |
| --- | --- | --- |
| `color.surface.default` | `#FFFFFF` | Cards, inputs, list rows on default background |
| `color.surface.raised` | `#FFFCF6` | Elevated surfaces (bottom sheets, dialogs) |
| `color.surface.sunken` | `#F1EEE7` | Inset regions, disabled fields |

## Background

| Token | Hex | Use |
| --- | --- | --- |
| `color.background.default` | `#F7F5F0` | Screen background |
| `color.background.subtle` | `#EFEAE0` | Section separators, empty state background |

## Text

| Token | Hex | Contrast on default surface | Use |
| --- | --- | --- | --- |
| `color.text.primary` | `#171A17` | 16.4:1 | Headings, values, primary body text |
| `color.text.secondary` | `#5D665F` | 6.6:1 | Descriptions, metadata |
| `color.text.muted` | `#89918B` | 3.9:1 | Placeholders, disabled labels, timestamps |
| `color.text.inverse` | `#FFFFFF` | on brand.primary: 8.9:1 | Text on brand primary and dark surfaces |
| `color.text.link` | `#0F5F4A` | 8.9:1 | Inline links (rare in app) |

## Border & Divider

| Token | Hex | Use |
| --- | --- | --- |
| `color.border.subtle` | `#E4E0D7` | Card outlines, input outlines at rest |
| `color.border.strong` | `#C7C1B2` | Focused input outlines, emphasis |
| `color.divider` | `#EDE9DF` | Horizontal dividers between list rows |

Rules:

- Prefer spacing and surface contrast over borders. Borders are the last resort for hierarchy.
- Never combine heavy border + heavy shadow on the same element.

## Status

| Token | Hex | Use |
| --- | --- | --- |
| `color.status.success` | `#168A50` | Save confirmations, positive deltas, "synced" badge |
| `color.status.warning` | `#B7791F` | Unsynced items, "attention" states |
| `color.status.danger` | `#C24135` | Destructive actions, validation errors, "failed" sync |
| `color.status.info` | `#2B6CB0` | Neutral information, tips |

Subtle backgrounds (for badges, alerts, banners):

| Token | Hex | Pairs with |
| --- | --- | --- |
| `color.status.successBg` | `#E6F4EC` | `status.success` text |
| `color.status.warningBg` | `#FBF1E1` | `status.warning` text |
| `color.status.dangerBg` | `#F8E3E0` | `status.danger` text |
| `color.status.infoBg` | `#E3EDF7` | `status.info` text |

Rules:

- **Never rely on color alone** to convey status. Always include an icon or label.
- Do not use `status.success` for revenue itself — revenue is `text.primary`. Success is for confirmations.
- `status.danger` is reserved. Do not use it as a UI accent.

## Interactive States

| Token | Value | Applies to |
| --- | --- | --- |
| `color.interactive.hover` | `rgba(15,95,74,0.06)` | Web/hover devices only |
| `color.interactive.pressed` | `rgba(15,95,74,0.12)` | Touch feedback overlay |
| `color.interactive.selected` | `rgba(15,95,74,0.10)` | Selected list rows, chips |
| `color.interactive.focus` | `#0F5F4A` (2px outline, 2px offset) | Keyboard focus ring |
| `color.interactive.disabled` | `#C7C1B2` | Disabled control background |
| `color.interactive.disabledText` | `#89918B` | Disabled control label |

## Overlays

| Token | Value | Use |
| --- | --- | --- |
| `color.overlay.scrim` | `rgba(23,26,23,0.48)` | Behind dialogs |
| `color.overlay.sheet` | `rgba(23,26,23,0.32)` | Behind bottom sheets |
| `color.overlay.image` | `rgba(23,26,23,0.24)` | On image thumbnails for text legibility |

## Selection

| Token | Value | Use |
| --- | --- | --- |
| `color.selection.background` | `rgba(15,95,74,0.16)` | Text selection background |
| `color.selection.text` | `#171A17` | Text selection foreground |

## Payment Mode Tints

Subtle, non-competing tints for payment mode chips.

| Mode | Background | Text |
| --- | --- | --- |
| Cash | `#EFEAE0` | `#171A17` |
| UPI | `#E6F4EC` | `#0F5F4A` |
| Card | `#E3EDF7` | `#2B6CB0` |
| Other | `#F1EEE7` | `#5D665F` |

Rules:

- Payment mode tints must never compete with primary CTAs on the same screen.
- Never restyle these ad hoc per screen; use the tokens.

## Dark Mode (Reserved)

Dark mode is not in MVP. Token names are already dark-mode-safe (semantic rather than literal). When dark mode ships:

| Semantic | Light | Dark (planned) |
| --- | --- | --- |
| `color.background.default` | `#F7F5F0` | `#0F1210` |
| `color.surface.default` | `#FFFFFF` | `#171A17` |
| `color.surface.raised` | `#FFFCF6` | `#20241F` |
| `color.text.primary` | `#171A17` | `#F7F5F0` |
| `color.text.secondary` | `#5D665F` | `#B4BAB5` |
| `color.brand.primary` | `#0F5F4A` | `#3EB187` |

Do not implement dark mode in MVP. Do not preview it. Do reserve the tokens.

## High Contrast Mode (Reserved)

Planned adjustments:

- `text.secondary` snaps to `text.primary`.
- `border.subtle` snaps to `border.strong`.
- Focus ring width increases from 2px to 3px.
- Payment mode tints darken by ~15% for stronger contrast.

## Contrast Requirements

All text/surface combinations must meet WCAG AA:

- Body text: ≥ 4.5:1
- Large text (≥ 18px bold or ≥ 24px regular): ≥ 3:1
- Interactive controls: ≥ 3:1 against adjacent color

Verified pairings (do not need re-checking):

- `text.primary` on `surface.default` — 16.4:1 ✓
- `text.secondary` on `surface.default` — 6.6:1 ✓
- `text.inverse` on `brand.primary` — 8.9:1 ✓
- `status.danger` on `surface.default` — 5.1:1 ✓

## When To Use What

| Situation | Color |
| --- | --- |
| Primary CTA (Save, Add Income) | `brand.primary` |
| Cancel / secondary action | `surface.default` + `border.subtle` + `text.primary` |
| Destructive action | `text.inverse` on `status.danger` |
| Positive number (net collection) | `text.primary` (never green — that would signal "success", not "amount") |
| Delta indicator (+₹200 today vs yesterday) | `status.success` (positive) or `status.danger` (negative) with icon |
| Unsynced badge | `status.warning` label + icon |
| Selected chip | `brand.primary` background, `text.inverse` label |
| Disabled button | `interactive.disabled` background, `interactive.disabledText` label |

## Do's & Don'ts

**Do**

- Use `text.primary` for money amounts.
- Use status colors sparingly and always with icon + label.
- Use `background.default` for screen background, `surface.default` for cards.
- Test every color pair for contrast.

**Don't**

- Don't use `brand.primary` as a background flood.
- Don't use `status.success` green for income amounts.
- Don't use `status.danger` red for expense amounts (expenses are neutral).
- Don't invent new colors per screen.
- Don't use pure black (`#000`) or pure white for screen backgrounds.
