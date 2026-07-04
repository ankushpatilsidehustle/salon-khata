# 02 · Design Tokens

Tokens are the single source of truth for every visual value. Screens and components read tokens; they never hard-code values.

## Naming Convention

`category.subcategory.variant.state`

Examples:

- `color.text.primary`
- `color.surface.raised`
- `space.4`
- `radius.md`
- `motion.duration.fast`

Rules:

- Semantic names only (`color.text.primary`, not `color.ink900`).
- Lowercase with dots.
- Never encode hex or px into a name.
- Never add tokens for a single use case; generalize first.

## Color Tokens

Full list in [03-color-system.md](03-color-system.md). Summary:

```
color.brand.primary            #0F5F4A
color.brand.primaryPressed     #0A4536
color.brand.secondary          #C58A2A

color.background.default       #F7F5F0
color.background.subtle        #EFEAE0

color.surface.default          #FFFFFF
color.surface.raised           #FFFCF6
color.surface.sunken           #F1EEE7

color.text.primary             #171A17
color.text.secondary           #5D665F
color.text.muted               #89918B
color.text.inverse             #FFFFFF
color.text.link                #0F5F4A

color.border.subtle            #E4E0D7
color.border.strong            #C7C1B2
color.divider                  #EDE9DF

color.status.success           #168A50
color.status.warning           #B7791F
color.status.danger            #C24135
color.status.info              #2B6CB0

color.interactive.hover        rgba(15,95,74,0.06)
color.interactive.pressed      rgba(15,95,74,0.12)
color.interactive.selected     rgba(15,95,74,0.10)
color.interactive.focus        #0F5F4A (2px outline)
color.interactive.disabled     #C7C1B2

color.overlay.scrim            rgba(23,26,23,0.48)
color.overlay.sheet            rgba(23,26,23,0.32)
```

## Typography Tokens

Full details in [04-typography.md](04-typography.md).

```
font.family.sans               Manrope, "Anek Latin", system-ui
font.family.mono               "JetBrains Mono", ui-monospace

font.weight.regular            400
font.weight.medium             500
font.weight.semibold           600
font.weight.bold               700

font.size.display              32
font.size.h1                   24
font.size.h2                   20
font.size.h3                   18
font.size.body                 16
font.size.bodySmall            14
font.size.caption              13
font.size.overline             11

font.lineHeight.tight          1.15
font.lineHeight.normal         1.4
font.lineHeight.relaxed        1.6

font.letterSpacing.tight       -0.2
font.letterSpacing.normal      0
font.letterSpacing.wide        0.4
```

## Spacing Tokens

8-point scale. Full guidance in [05-spacing-system.md](05-spacing-system.md).

```
space.0    0
space.1    4
space.2    8
space.3    12
space.4    16
space.5    24
space.6    32
space.7    40
space.8    48
space.9    64
space.10   80
```

## Radius Tokens

```
radius.none    0
radius.xs      4     // inline chips, small badges
radius.sm      8     // inputs, small buttons
radius.md      12    // primary buttons, list items, cards
radius.lg      16    // large cards, modals
radius.xl      24    // bottom sheets (top corners only)
radius.full    999   // avatars, pills, FAB
```

## Elevation & Shadow Tokens

Full guidance in [07-elevation.md](07-elevation.md).

```
elevation.0    flat surface, no shadow
elevation.1    resting card
elevation.2    raised card on scroll
elevation.3    dropdown, menu
elevation.4    bottom sheet, dialog
elevation.5    snackbar, FAB

shadow.sm      0 1 4 rgba(23,26,23,0.08)
shadow.md      0 4 10 rgba(23,26,23,0.10)
shadow.lg      0 8 18 rgba(23,26,23,0.12)
shadow.xl      0 16 32 rgba(23,26,23,0.14)
```

## Opacity Tokens

```
opacity.disabled       0.38
opacity.muted          0.60
opacity.emphasis       0.87
opacity.overlay.light  0.32
opacity.overlay.heavy  0.48
```

## Motion Tokens

Full guidance in [09-motion-system.md](09-motion-system.md).

```
motion.duration.instant   80ms
motion.duration.fast      120ms
motion.duration.normal    200ms
motion.duration.slow      320ms
motion.duration.deliberate 480ms

motion.easing.standard    cubic-bezier(0.2, 0, 0, 1)
motion.easing.enter       cubic-bezier(0, 0, 0, 1)
motion.easing.exit        cubic-bezier(0.4, 0, 1, 1)
motion.easing.emphasized  cubic-bezier(0.2, 0, 0, 1.4)
```

## Grid

Mobile-first vertical stack. No multi-column grid on phone.

```
grid.columns       4 (compact), 6 (tablet)
grid.gutter        space.4 (16)
grid.margin        space.4 (16) horizontal screen padding
```

## Breakpoints

Salon Khata is mobile-first. Tablet is a stretch goal, not MVP.

```
breakpoint.sm      360    (baseline low-end Android)
breakpoint.md      414    (standard modern phone)
breakpoint.lg      768    (small tablet, future)
breakpoint.xl      1024   (tablet landscape, future)
```

## Sizing Scale

```
size.control.sm    36    // dense controls
size.control.md    44    // minimum interactive size
size.control.lg    52    // primary buttons
size.control.xl    64    // FAB, hero controls

size.icon.xs       12
size.icon.sm       16
size.icon.md       20
size.icon.lg       24
size.icon.xl       32

size.avatar.sm     32
size.avatar.md     40
size.avatar.lg     56
size.avatar.xl     80
```

## Touch Targets

```
target.min         44 x 44     // absolute minimum
target.default     48 x 48     // default for all interactive elements
target.primary     52 x 52     // primary action buttons
target.spacing     8           // minimum gap between adjacent targets
```

## Z-Index Scale

```
z.base           0
z.raised         10
z.sticky         20
z.appBar         30
z.dropdown       40
z.overlay        50
z.sheet          60
z.dialog         70
z.toast          80
z.tooltip        90
```

## Token Update Rules

1. Every token change is a design system version bump.
2. Removing a token requires a migration note.
3. Adding a semantic layer (e.g. `color.income.positive`) is preferred over adding a raw variant.
4. If two tokens have the same value, keep both if they mean different things.
