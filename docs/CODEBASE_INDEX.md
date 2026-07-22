# Codebase Index

Machine-oriented map for humans and agents. Start at [`../AGENTS.md`](../AGENTS.md).

## Authority

| Priority | Document | Use for |
| ---: | --- | --- |
| 1 | Code under `src/` | Actual behavior |
| 2 | [`implementation-status.md`](implementation-status.md) | What is shipped |
| 3 | [`sync-engine-implementation.md`](sync-engine-implementation.md) | Sync/backup how-to |
| 4 | [`database-schema.md`](database-schema.md) | Tables/columns |
| 5 | [`coding-standards.md`](coding-standards.md) | Layer rules |
| — | [`api-contract.md`](api-contract.md), [`folder-structure.md`](folder-structure.md) | Stale / aspirational |

## Product

- [vision.md](vision.md) — promise, MVP, non-goals
- [product-principles.md](product-principles.md)
- [personas.md](personas.md)
- [business-workflows.md](business-workflows.md)
- [roadmap.md](roadmap.md) / [future-features.md](future-features.md) — not built

## Architecture & data

- [sync-engine.md](sync-engine.md) — design
- [sync-engine-implementation.md](sync-engine-implementation.md) — shipped
- [database-schema.md](database-schema.md)
- [service-engine.md](service-engine.md)
- [coding-standards.md](coding-standards.md)

## UX & screens

- [ux/](ux/) — journeys, nav, forms, offline, a11y
- [screens/](screens/) — per-screen specs
- [navigation.md](navigation.md), [screen-flow.md](screen-flow.md), [ux-guidelines.md](ux-guidelines.md)

## Design system

- [design-system/](design-system/) — tokens through component QA
- [design-system.md](design-system.md), [design-tokens.md](design-tokens.md), [color-system.md](color-system.md), [typography.md](typography.md), [spacing-system.md](spacing-system.md), [component-library.md](component-library.md)

## Source tree (src/)

| Path | Role |
| --- | --- |
| `application/` | Boot, navigators, event-bus |
| `features/*` | Screens by domain |
| `components/{core,domain}` | Shared UI |
| `design-system/` | Tokens |
| `domain/` | Pure business logic |
| `repositories/` | SQLite access |
| `database/` | Client + migrations |
| `sync/` | Per-record Firestore sync |
| `backup/` + `cloud/` | Encrypted DR file backup |
| `firebase/` | Auth, App Check |
| `session/` | Current salon + lock |
| `device/` + `security/` | Install id + DEK vault |
| `network/` | Connectivity |
| `i18n/` | Locales |

## Cursor rules

| Rule | Scope |
| --- | --- |
| `.cursor/rules/architecture.mdc` | Always |
| `.cursor/rules/sync-and-db.mdc` | sync/backup/db/repos |
| `.cursor/rules/ui-features.mdc` | features/components/DS |
