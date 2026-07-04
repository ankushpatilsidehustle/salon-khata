# 05 · Spacing System

Spacing is the invisible design language of Salon Khata. It carries hierarchy without visual noise.

## Foundation

The system is a strict **8-point scale** with a 4-point half-step for tight cases.

| Token | Value (dp) | Nickname | Where |
| --- | --- | --- | --- |
| `space.0` | 0 | Reset | Reset overrides |
| `space.1` | 4 | Micro | Icon-to-label gap, badge padding |
| `space.2` | 8 | Tight | Between related inline items |
| `space.3` | 12 | Compact | Compact component padding |
| `space.4` | 16 | Default | Standard screen padding, card padding |
| `space.5` | 24 | Comfortable | Between related sections |
| `space.6` | 32 | Section | Between unrelated sections |
| `space.7` | 40 | Large | Empty state internal spacing |
| `space.8` | 48 | XL | Hero areas, empty state top margin |
| `space.9` | 64 | Hero | Onboarding hero spacing |
| `space.10` | 80 | Extra Hero | Rarely used, reserved |

## Where To Use What

### Screen Padding

- Horizontal screen padding: **`space.4` (16)** on all edges.
- Extend to `space.5` (24) only for onboarding/hero screens.
- Never use `space.3` (12) or below for screen padding — the app will feel cramped.

### Card Padding

- Card internal padding: **`space.4` (16)**.
- Dense list-row card: `space.3` (12) vertical, `space.4` (16) horizontal.
- Hero money card: `space.5` (24) vertical.

### Between Elements

- Icon → label: `space.1` (4) or `space.2` (8).
- Label → value in a stat pair: `space.1` (4).
- Two related list items: `space.2` (8).
- Two related sections in a card: `space.4` (16).
- Two unrelated sections on a screen: `space.6` (32).

### Forms

- Label → input: `space.1` (4).
- Input → help text: `space.1` (4).
- Two form fields (stacked): `space.4` (16).
- Field group → next group: `space.5` (24).
- Form → primary CTA: `space.5` (24).

### Buttons

- Button horizontal padding: `space.4` (16).
- Button internal icon → label gap: `space.2` (8).
- Two stacked buttons: `space.3` (12).
- Two inline buttons: `space.3` (12).

### Bottom Sheets

- Top padding: `space.5` (24).
- Horizontal padding: `space.4` (16).
- Bottom padding: `space.5` (24) + safe area inset.
- Handle bar → title: `space.4` (16).
- Title → content: `space.4` (16).
- Content → primary action: `space.5` (24).

### App Bar

- Left / right edge padding: `space.4` (16).
- Title → icon actions: `space.3` (12).

### List Items

- Row vertical padding: `space.3` (12) or `space.4` (16) depending on density.
- Left/right padding: `space.4` (16).
- Leading icon/avatar → text: `space.3` (12).
- Text → trailing amount/icon: `space.4` (16).

### Dashboard Money Grid

- Between money cards: `space.3` (12).
- Money card group → next section: `space.5` (24).

## Vertical Rhythm

Salon Khata does not enforce a strict baseline grid but does follow rhythm rules:

- Every text block ends on a `space.2` (8) or `space.4` (16) boundary.
- Every card ends on a `space.4` (16) boundary.
- Section breaks always use `space.5` (24) or `space.6` (32).

## Safe Areas

- Always respect device safe area insets.
- Add safe area to top padding of app bar and bottom padding of bottom sheets.
- Do not double-count safe area — apply only at the outermost container.

## Density Modes

Salon Khata ships one density: **comfortable**. Do not add compact or dense modes in MVP.

## Touch Target Gap

- Minimum 8 dp gap between two adjacent touch targets.
- If two chips are adjacent, add `space.2` (8) gap.
- If two icon buttons are adjacent, add `space.3` (12) gap.

## Spacing Anti-Patterns

- Half-pixel or odd values (e.g., 7, 11, 15) — always use tokens.
- Negative margins to compensate for wrong spacing — fix the source.
- Inline styles overriding token spacing — always use the design system component.
- More than two consecutive `space.6` (32) or larger gaps on the same screen — likely indicates missing content.

## Do's & Don'ts

**Do**

- Use tokens exclusively.
- Prefer whitespace over dividers for separation.
- Group related content with tighter spacing than unrelated content.
- Give money and primary CTAs generous breathing room.

**Don't**

- Don't use custom pixel values.
- Don't reduce spacing to fit more data.
- Don't apply the same spacing everywhere — hierarchy comes from *contrast* in spacing.
