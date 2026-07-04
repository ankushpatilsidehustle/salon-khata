# Design Tokens

Design tokens are the single source of truth for visual values.

## Token Naming

Use semantic names over raw color names.

Examples:

- `color.background.default`
- `color.surface.card`
- `color.text.primary`
- `space.4`
- `radius.md`
- `shadow.sm`
- `font.body`

## Color Tokens

```text
color.primary
color.primaryPressed
color.secondary
color.background.default
color.background.subtle
color.surface.default
color.surface.raised
color.text.primary
color.text.secondary
color.text.muted
color.border.subtle
color.success
color.warning
color.error
color.info
```

## Typography Tokens

```text
font.display
font.h1
font.h2
font.h3
font.body
font.caption
font.button
```

Each token should define:

- Font family
- Size
- Line height
- Weight
- Letter spacing, default `0`

## Spacing Tokens

Use an 8-point scale:

```text
space.0 = 0
space.1 = 4
space.2 = 8
space.3 = 12
space.4 = 16
space.5 = 24
space.6 = 32
space.7 = 40
space.8 = 48
space.9 = 64
```

## Radius Tokens

```text
radius.xs = 4
radius.sm = 8
radius.md = 12
radius.lg = 16
radius.xl = 24
radius.full = 999
```

Cards should generally use `radius.sm` or `radius.md`. Avoid very rounded cards unless the component is a pill, chip, or FAB.

## Shadow Tokens

```text
shadow.sm
shadow.md
shadow.lg
```

Shadows should be subtle. Prefer elevation only for surfaces that need hierarchy, such as bottom sheets and floating actions.

## Motion Tokens

```text
motion.duration.fast = 120ms
motion.duration.normal = 200ms
motion.duration.slow = 320ms
motion.easing.standard
motion.easing.exit
```

Motion should clarify state changes, not decorate every interaction.
