# Product Principles

## Offline First

Every normal operation writes to SQLite first. Internet availability must never block income, expense, service, employee, commission, or report workflows.

## Mobile First

Design for phone screens first. Desktop-style tables, dense forms, and tiny controls are not acceptable for MVP flows.

## Speed Over Complexity

Daily actions should complete in 10 to 15 seconds. If a workflow cannot meet that target, reduce steps before adding features.

## Simple Over Feature Rich

The MVP should do fewer things extremely well. Avoid ERP behavior, accounting terminology, and admin-heavy setup.

## Minimum Typing

Prefer chips, cards, recent selections, defaults, steppers, and bottom sheets over free text inputs.

## Consistent Interactions

The same interaction pattern should be reused for selection, creation, editing, deletion, confirmation, filtering, loading, and empty states.

## Premium But Familiar

The product should feel polished like a modern consumer app. Premium means calm spacing, confident hierarchy, clean motion, and fewer visual distractions.

## Local Truth

The local SQLite database is the active source of truth for the app. Firebase is used for authentication, backup, restore, and sync transport.

## Explicit Future Boundary

Do not add future features unless they protect the MVP architecture. Future capability should not make current screens slower or harder to understand.

## Translation Ready

All visible text must use translation keys such as `t("save")`. New screens are incomplete until their strings are represented in translation resources.
