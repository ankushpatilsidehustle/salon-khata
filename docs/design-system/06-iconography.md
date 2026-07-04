# 06 · Iconography

Icons in Salon Khata are functional, not decorative. They aid recognition and save space; they do not exist to fill a screen.

## Icon Library

**Recommended**: [`lucide-react-native`](https://lucide.dev) — MIT licensed, tree-shakeable, ~1000 icons, consistent 24 dp base grid, matches our humanist type feel.

**Alternate**: `phosphor-icons/react-native` (also good; heavier bundle).

**Do not** use Material Icons or Font Awesome for this product — the visual weight and metaphors do not fit the calm, warm feel.

## Style

- **Stroke**: outline icons at 1.5 dp stroke.
- **Corners**: rounded (built into Lucide).
- **Base grid**: 24 dp.
- **Optical size**: single size only — do not use "small size" or "large size" variants from the library.

## Sizes

| Token | Size (dp) | Use |
| --- | --- | --- |
| `size.icon.xs` | 12 | Inside chips, inline with 12–13 pt text |
| `size.icon.sm` | 16 | Inline with body text (16 pt) |
| `size.icon.md` | 20 | Buttons, inputs, list-row trailing |
| `size.icon.lg` | 24 | App bar, bottom nav, primary controls |
| `size.icon.xl` | 32 | Empty state hero icons |

## Filled vs Outlined

The system uses **outline by default**. Filled icons are reserved for **selected states only**.

Examples:

- Bottom navigation tab: outline when inactive, filled when active.
- Chip: outline icon when unselected, filled icon when selected.
- Toggle-like control: outline off, filled on.

Rules:

- Never mix filled and outline icons at the same visual level.
- Never use filled icons for decoration.

## Color Rules

Icons inherit the color of the text they accompany.

| Context | Icon color |
| --- | --- |
| App bar | `text.primary` |
| Primary button | `text.inverse` |
| Secondary button | `text.primary` |
| Chip (unselected) | `text.secondary` |
| Chip (selected) | `text.inverse` on `brand.primary` |
| Empty state | `text.muted` |
| Status badge | matches badge status color |
| Destructive action | `status.danger` |

Do not tint icons with brand color unless they represent a selected state.

## Semantic Icon Map

To keep the app recognizable, the following icons are canonical for their concepts. Do not substitute.

| Concept | Icon (Lucide name) |
| --- | --- |
| Add | `plus` |
| Edit | `pencil` |
| Delete | `trash-2` |
| Save | none — button labels only |
| Search | `search` |
| Filter | `sliders-horizontal` |
| Sort | `arrow-up-down` |
| More | `more-vertical` |
| Back | `arrow-left` |
| Close | `x` |
| Check / done | `check` |
| Employee | `user-round` |
| Service | `scissors` |
| Income | `arrow-down-to-line` |
| Expense | `arrow-up-from-line` |
| Commission | `percent` |
| Cash | `banknote` |
| UPI | `smartphone-nfc` (or brand mark) |
| Card | `credit-card` |
| Reports | `bar-chart-3` |
| Settings | `settings` |
| Sync ok | `cloud-check` |
| Sync pending | `cloud-upload` |
| Sync failed | `cloud-alert` |
| Offline | `cloud-off` |
| Language | `languages` |
| Backup | `download` |
| Restore | `upload` |
| Success (toast) | `check-circle-2` |
| Warning | `alert-triangle` |
| Error | `alert-circle` |
| Info | `info` |
| Chevron right | `chevron-right` |
| Empty box | `inbox` |

## Icon-Only Buttons

Icon-only buttons must:

- Have a **48 dp touch target** minimum, even if the icon is smaller.
- Include an accessible label (`accessibilityLabel="t('common.back')"`).
- Be limited to universally understood actions (back, close, more, search). Rarely-used actions must always be labeled.

## Icons In Lists

- Use a leading icon or avatar, never both.
- If a row has a leading icon, it aligns with the top of the primary text, not the visual center.
- Trailing chevrons (`chevron-right`) are used only when the row navigates. Do not use them on rows that open a bottom sheet.

## Do's

- Use one icon per concept, everywhere.
- Keep stroke weight consistent (1.5 dp).
- Pair icons with text whenever the action is not universally known.
- Give icon-only buttons an accessible label.

## Don'ts

- Don't use emoji as icons.
- Don't use two different icon libraries in the same build.
- Don't rotate or recolor icons for decoration.
- Don't use icons smaller than 12 dp.
- Don't use color-only icons for status — always pair with a label.
