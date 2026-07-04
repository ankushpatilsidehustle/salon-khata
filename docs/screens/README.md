# Salon Khata · Screen Planning

This directory is the **implementation blueprint** for every screen in Salon Khata. It sits between the Product Foundation (`docs/*.md`), the [Design System](../design-system/README.md), and the [UX Specification](../ux/README.md).

If a screen is not documented here, it does not exist. If an engineer or designer must make a per-screen decision that this folder does not answer, this folder is incomplete — update it, then build.

## What This Folder Answers

- Which screens exist, in which surface (screen / sheet / dialog / snackbar / state).
- What each screen is for (purpose) and why it earns space (business goal).
- What the primary and secondary CTAs are.
- Every entry point that can reach the screen, and every exit point that can leave it.
- Which Design System components a screen must compose from.
- How every screen behaves in each of five state variants: loading, empty, offline, success, error.
- Which screens depend on which, so build order is not guesswork.
- In what order screens are implemented.

## What This Folder Does Not Answer

| Question | Where the answer lives |
| --- | --- |
| What does the product do? | [../vision.md](../vision.md), [../product-principles.md](../product-principles.md) |
| Who are the users? | [../personas.md](../personas.md) |
| What is a Button / Money Card / Bottom Sheet? | [../design-system/08-component-library.md](../design-system/08-component-library.md) |
| What are the exact colors, spacing, motion values? | [../design-system/](../design-system/README.md) |
| What is the empty-state copy for Employees? | [../ux/09-empty-states.md](../ux/09-empty-states.md) |
| How does sync work internally? | [../sync-engine.md](../sync-engine.md) |
| What tables/columns back the screen? | [../database-schema.md](../database-schema.md) |

This folder **references** those documents; it never duplicates them.

## Table Of Contents

| # | Document | Purpose |
| --- | --- | --- |
| 00 | [Screen Map](00-screen-map.md) | Master inventory of every surface with ID, template, MVP phase, dependencies |
| 01 | [Navigation Flow](01-navigation-flow.md) | Mermaid diagrams for root tabs, auth, golden path, per-feature stacks, deep links |
| 02 | [Screen Spec Template](02-screen-spec-template.md) | The canonical per-screen spec format every feature file follows |
| 03 | [Auth & Onboarding](03-auth-onboarding.md) | Splash, Language, Mobile, OTP, Business Setup, Restore Prompt |
| 04 | [Dashboard](04-dashboard.md) | Dashboard hub, hero, recent transactions, extended FAB |
| 05 | [Income Entry](05-income-entry.md) | Golden path full-screen modal, select-employee sheet, select-services sheet, discard dialog |
| 06 | [Entries Hub](06-entries-hub.md) | Entries tab root and shared list/search conventions |
| 07 | [Employees](07-employees.md) | Employees list, add sheet, edit screen, detail sheet, search |
| 08 | [Services](08-services.md) | Services list, add sheet, edit screen, detail sheet, search |
| 09 | [Commission Rules](09-commission-rules.md) | Commission employees list, per-service rule setup, edit rule sheet |
| 10 | [Expenses](10-expenses.md) | Expenses list, add sheet, edit sheet, detail sheet, category selector |
| 11 | [Reports](11-reports.md) | Reports root, daily, monthly, employee/service performance, filters |
| 12 | [More & Settings](12-more-settings.md) | More hub, business profile, backup & restore, sync diagnostics |
| 13 | [Global Overlays](13-global-overlays.md) | Snackbars, dialogs, skeletons, offline behavior |
| 14 | [Implementation Order](14-implementation-order.md) | Phased build waves aligned with roadmap |
| 15 | [Dependency Matrix](15-dependency-matrix.md) | Screen × predecessor table |

## Glossary

Surface types are used consistently across every file:

| Type | Meaning | Design System reference |
| --- | --- | --- |
| **Screen (S)** | Full-page view inside a tab stack | [Templates 1–5, 7](../design-system/17-screen-templates.md) |
| **Full-screen Modal (M)** | Full page above the stack with `x` close | [Template 3](../design-system/17-screen-templates.md#template-3-form-full-screen) |
| **Bottom Sheet (BS)** | Focused decision or quick edit | [Template 6](../design-system/17-screen-templates.md#template-6-bottom-sheet) |
| **Dialog (D)** | Blocking confirmation | [Component: Dialog](../design-system/08-component-library.md#dialog) |
| **State** | A visual state variant of a parent screen | [Templates 8](../design-system/17-screen-templates.md#template-8-empty), UX §09/10/11/12 |
| **Overlay** | Non-blocking system feedback (Snackbar, Toast) | [Component: Snackbar](../design-system/08-component-library.md#snackbar--toast) |

## How To Read A Feature File

Every feature file (`03` through `13`) is structured identically:

1. **Feature summary** — what this feature is and its role.
2. **Feature-level navigation diagram** — Mermaid, scoped to this feature.
3. **Screens** — one section per screen, using the [02-screen-spec-template.md](02-screen-spec-template.md).
4. **Cross-feature dependencies** — what this feature needs from others.

## How To Add A New Screen

1. Confirm the screen is in scope (see [../roadmap.md](../roadmap.md), [../vision.md](../vision.md)). Post-MVP surfaces belong on the roadmap, not here.
2. Register the screen in [00-screen-map.md](00-screen-map.md) with a new or extended ID from the same prefix family.
3. Add the screen to the correct feature file (`03–13`) using [02-screen-spec-template.md](02-screen-spec-template.md).
4. Update [01-navigation-flow.md](01-navigation-flow.md) so every entry and exit is reachable.
5. If the screen changes dependency order, update [14-implementation-order.md](14-implementation-order.md) and [15-dependency-matrix.md](15-dependency-matrix.md).
6. Run the [UX Review Checklist](../ux/16-ux-review-checklist.md) and [Design QA Checklist](../design-system/18-design-qa-checklist.md).

## Non-Negotiables

Every screen in this folder is bound by:

- The [Product Principles](../product-principles.md) — Offline First, Mobile First, Speed Over Complexity, Minimum Typing, Local Truth, Translation Ready.
- The Prime Directive from [../ux/README.md](../ux/README.md): *A salon owner can record one customer transaction in ≤ 10 seconds on their own phone, in their own language, offline, without hesitation.*
- The eight templates in [../design-system/17-screen-templates.md](../design-system/17-screen-templates.md). No custom layouts.
- The four-tab structure in [../ux/02-navigation-architecture.md](../ux/02-navigation-architecture.md). No hamburger, no drawer, no nested tabs.

## Screen ID Convention

Screen IDs are reused verbatim from [../ux/03-screen-inventory.md](../ux/03-screen-inventory.md). Extensions use the same prefix family:

| Prefix | Feature |
| --- | --- |
| `AUTH-` | Auth & Onboarding |
| `DASH-` | Dashboard |
| `ENT-` | Entries hub |
| `EMP-` | Employees |
| `SRV-` | Services |
| `COM-` | Commission rules |
| `EXP-` | Expenses |
| `REP-` | Reports |
| `INC-` | Income Entry |
| `MORE-` | More hub |
| `SET-` | Settings |
| `DIAG-` | Diagnostics |
| `GLB-` | Global overlays (Snackbar, Toast, Discard, Delete, Error dialog) |
