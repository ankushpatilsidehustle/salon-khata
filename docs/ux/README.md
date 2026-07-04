# Salon Khata · UX Bible

This directory is the **UX specification** for Salon Khata. It defines *how* users interact with the app — every tap, every screen, every state, every recovery path.

It does **not** redefine visual design (that lives in [../design-system/](../design-system/README.md)) and it does **not** define product scope (that lives in [../](../vision.md)).

## Prime Directive

> A salon owner can record one customer transaction in **≤ 10 seconds** on their own phone, in their own language, offline, without hesitation.

Every decision in this document is judged against that sentence.

## Design Attitude

Think like the team behind PhonePe and Google Pay. Every screen is:

- **Predictable** — the user should never wonder what will happen next.
- **Fast** — every core action is one FAB tap and one bottom sheet away.
- **Forgiving** — every destructive action is undoable.
- **Local-first** — the app works offline the same way it works online.
- **Respectful** — no forced tutorials, no upsell overlays, no confirmations without reason.

## Table of Contents

| # | Document | Purpose |
| --- | --- | --- |
| 01 | [User Journey](01-user-journeys.md) | End-to-end journeys from first launch to daily use |
| 02 | [Navigation Architecture](02-navigation-architecture.md) | Tabs, stacks, sheets, modals, back behavior |
| 03 | [Screen Inventory](03-screen-inventory.md) | Every screen and state, indexed |
| 04 | [Screen Flow](04-screen-flows.md) | Flow diagrams for every major workflow |
| 05 | [Information Hierarchy](05-information-hierarchy.md) | Per-screen priority, reading order, interaction order |
| 06 | [Form UX](06-form-ux.md) | Add / edit / delete / validate rules |
| 07 | [List UX](07-list-ux.md) | Search, filter, group, swipe, refresh, paginate |
| 08 | [Dashboard UX](08-dashboard-ux.md) | Home screen behavior and priorities |
| 09 | [Empty States](09-empty-states.md) | Every empty state, per module |
| 10 | [Error UX](10-error-ux.md) | Validation, offline, network, sync, auth, permission |
| 11 | [Success UX](11-success-ux.md) | Consistent success feedback |
| 12 | [Offline UX](12-offline-ux.md) | Offline-first behavior end-to-end |
| 13 | [Motion Flow](13-motion-flow.md) | Motion between screens and states, mapped to UX |
| 14 | [Accessibility Flow](14-accessibility-flow.md) | One-hand, thumb-reach, screen reader, dynamic text |
| 15 | [UX Principles](15-ux-principles.md) | The 20 rules every screen must follow |
| 16 | [UX Review Checklist](16-ux-review-checklist.md) | Pass/fail checklist for every new screen |

## How To Use This Document

- **Designing a new screen?** Read [15](15-ux-principles.md), pick a template from the [design system](../design-system/17-screen-templates.md), then pass [16](16-ux-review-checklist.md).
- **Adding a new flow?** Draft it in [04](04-screen-flows.md); check it against [01](01-user-journeys.md); confirm reachability in [02](02-navigation-architecture.md).
- **Reviewing a PR?** Run [16](16-ux-review-checklist.md).
- **Investigating a bug?** Look up the intended behavior in [10](10-error-ux.md), [11](11-success-ux.md), or [12](12-offline-ux.md).

## Cross-References

- Visual language: [../design-system/](../design-system/README.md)
- Product principles: [../product-principles.md](../product-principles.md)
- Data model: [../database-schema.md](../database-schema.md)
- Sync engine: [../sync-engine.md](../sync-engine.md)
