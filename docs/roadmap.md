# Roadmap

## Phase 1: Product Documentation

Create and review product, architecture, UX, design system, and engineering foundation docs.

Exit criteria:

- MVP scope is explicit.
- Offline-first architecture is documented.
- Design system is ready for implementation.
- Data and sync contracts are consistent.

## Phase 2: Business Rules

Finalize commission, income, expense, report, soft delete, and restore rules.

Exit criteria:

- Business rules can be tested without UI.
- Edge cases are documented.

## Phase 3: Database Design

Convert schema docs into migrations and repository contracts.

Exit criteria:

- SQLite schema supports all MVP workflows.
- Indexes support dashboard and reports.

## Phase 4: Offline Sync Design

Validate Firebase data model, sync queue, retry policy, restore flow, and conflict audit behavior.

Exit criteria:

- App can operate offline indefinitely.
- Sync can resume safely.

## Phase 5: Design System

Implement tokens and reusable base components.

Exit criteria:

- Screens do not use raw primitives for repeated UI.

## Phase 6: UX Guidelines

Translate guidelines into reusable interaction patterns.

Exit criteria:

- Bottom sheets, forms, search, feedback, and deletion are consistent.

## Phase 7: Wireframes

Create low-fidelity flows for all MVP screens.

Exit criteria:

- Income entry can plausibly complete under 10 seconds.

## Phase 8: High Fidelity UI

Create polished mobile UI based on tokens and components.

Exit criteria:

- Screens feel premium and simple.
- Long translations and small devices are considered.

## Phase 9: Component Library

Build reusable components and document usage.

Exit criteria:

- Components cover all MVP screen needs.

## Phase 10: Application Development

Build app modules in order:

1. Auth and local setup
2. Database and repositories
3. Services and employees
4. Commission rules
5. Income entry
6. Expense entry
7. Dashboard
8. Reports
9. Settings
10. Sync, backup, and restore

## Phase 11: Testing

Test business logic, local database behavior, sync behavior, and critical UI flows.

## Phase 12: Optimization

Optimize performance, startup, sync reliability, low-end Android behavior, and UX polish.
