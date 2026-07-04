# Spacing System

Salon Khata uses an 8-point spacing system.

## Scale

| Token | Value | Use |
| --- | --- | --- |
| `space.0` | 0 | Reset |
| `space.1` | 4 | Tight internal gaps |
| `space.2` | 8 | Small gaps |
| `space.3` | 12 | Compact component padding |
| `space.4` | 16 | Default screen padding |
| `space.5` | 24 | Section spacing |
| `space.6` | 32 | Large section spacing |
| `space.7` | 40 | Major layout gaps |
| `space.8` | 48 | Minimum large touch zone |
| `space.9` | 64 | Hero or empty-state spacing |

## Touch Targets

- Minimum target: 48 x 48 dp.
- Preferred primary action height: 52 to 56 dp.
- Chips should be easy to tap with one hand.
- Avoid controls near screen edges unless they are intentionally reachable.

## Layout Rules

- Use `space.4` as standard horizontal screen padding.
- Use `space.5` between major sections.
- Avoid squeezing more data into a screen by reducing spacing below readable limits.
- Bottom sheets should respect safe areas and thumb reach.

## Density

The app should feel quick, not sparse. Use compact cards for repeated items and larger visual emphasis only for high-value dashboard totals or primary flow actions.
