# Salon Khata Design System

The single source of truth for how Salon Khata looks, feels, and behaves.

This system exists so that any designer, engineer, or AI agent can build a screen without making subjective design decisions. If a screen deviates from this system, the system is wrong — not the screen. Update the system first, then the screen.

## How To Use This

1. Start with [01-design-philosophy.md](01-design-philosophy.md) to understand the product personality.
2. Read [02-design-tokens.md](02-design-tokens.md) for the canonical values.
3. Use [08-component-library.md](08-component-library.md) as the parts catalogue.
4. Use [17-screen-templates.md](17-screen-templates.md) to compose screens.
5. Ship only after passing [18-design-qa-checklist.md](18-design-qa-checklist.md).

## Index

| # | Document | Purpose |
| --- | --- | --- |
| 01 | [Design Philosophy](01-design-philosophy.md) | Values, personality, principles |
| 02 | [Design Tokens](02-design-tokens.md) | Canonical values for everything |
| 03 | [Color System](03-color-system.md) | Semantic colors and usage |
| 04 | [Typography](04-typography.md) | Type scale and text rules |
| 05 | [Spacing System](05-spacing-system.md) | 8-point spacing and layout |
| 06 | [Iconography](06-iconography.md) | Icon library and usage |
| 07 | [Elevation](07-elevation.md) | Depth and layering |
| 08 | [Component Library](08-component-library.md) | Reusable UI parts |
| 09 | [Motion System](09-motion-system.md) | Animation and transitions |
| 10 | [Forms](10-forms.md) | Input, validation, keyboards |
| 11 | [Navigation](11-navigation.md) | App structure and flow |
| 12 | [Lists](12-lists.md) | Collections and browsing |
| 13 | [Data Visualization](13-data-visualization.md) | Numbers, charts, summaries |
| 14 | [Localization](14-localization.md) | Multi-language readiness |
| 15 | [Accessibility](15-accessibility.md) | Inclusive design rules |
| 16 | [UX Guidelines](16-ux-guidelines.md) | Interaction consistency |
| 17 | [Screen Templates](17-screen-templates.md) | Reusable layouts |
| 18 | [Design QA Checklist](18-design-qa-checklist.md) | Ship-readiness gate |

## Relationship To Phase 1 Docs

Phase 1 documents at `docs/` (vision, personas, business workflows, database, sync engine) define **what** the product does. This design system defines **how** it looks and feels. When the two conflict, Phase 1 wins on scope and Phase 2 wins on presentation.

## Versioning

This system is v1.0 — the MVP baseline. Additions are welcome. Breaking changes require a migration note and a version bump.
