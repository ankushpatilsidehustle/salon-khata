# Color System

The color system should feel premium, restrained, and useful. Color supports meaning; it should not make the app noisy.

## Palette Direction

Recommended MVP direction:

- Primary: deep ink green for trust and money-adjacent actions
- Secondary: warm gold accent used sparingly
- Background: soft neutral
- Surface: clean white or near-white
- Text: high contrast charcoal

## Core Tokens

| Token | Suggested Value | Use |
| --- | --- | --- |
| `color.primary` | `#0F5F4A` | Primary actions, selected states |
| `color.secondary` | `#C58A2A` | Limited accent, premium highlights |
| `color.background.default` | `#F7F5F0` | App background |
| `color.surface.default` | `#FFFFFF` | Cards, sheets, inputs |
| `color.surface.raised` | `#FFFCF6` | Elevated surfaces |
| `color.text.primary` | `#171A17` | Primary text |
| `color.text.secondary` | `#5D665F` | Secondary text |
| `color.text.muted` | `#89918B` | Low emphasis text |
| `color.border.subtle` | `#E4E0D7` | Dividers and subtle outlines |
| `color.success` | `#168A50` | Positive status |
| `color.warning` | `#B7791F` | Warning status |
| `color.error` | `#C24135` | Destructive/error status |
| `color.info` | `#2B6CB0` | Informational status |

## Rules

- Primary color is for action and selection, not decoration.
- Error color is reserved for destructive or invalid states.
- Success color is used for confirmation, not every income value.
- Avoid heavy borders; use spacing and surface contrast first.
- Check contrast for all text/surface combinations.

## Payment Mode Colors

Payment mode chips may use subtle tints, but they must remain legible and not dominate the income flow.

## Dark Mode

Dark mode is not required in MVP. Token names should allow adding it later without rewriting components.
