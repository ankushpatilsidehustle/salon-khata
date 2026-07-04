# Coding Standards

These standards apply when application implementation begins.

## Stack Direction

- Expo managed React Native
- TypeScript
- SQLite local database
- Repository layer for data access
- Business logic in application services
- Firebase for phone OTP, cloud sync, backup, and restore
- i18n from day one

## TypeScript

- Use strict TypeScript.
- Avoid `any` unless isolated and justified.
- Model domain types explicitly.
- Use UUID strings for IDs.
- Store money as integer minor units.

## Architecture Boundaries

Presentation layer:

- Screens
- Reusable components
- Navigation
- Translation usage

Business logic layer:

- Commission calculations
- Report calculations
- Validation rules
- Workflow orchestration

Repository layer:

- SQLite reads and writes
- Local transactions
- Query mapping

Sync layer:

- Sync queue processing
- Push and pull
- Retry handling
- Conflict audit logging

The UI must not call SQLite directly.

## Offline-First Rules

- Save operations commit locally before network calls.
- Network failure cannot fail normal daily operations.
- Reports compute from local data.
- Sync state is visible but non-blocking.

## i18n Rules

- No hardcoded visible strings.
- Use keys such as `t("save")` and `t("income.selectService")`.
- Keep keys stable and semantic.
- Avoid building translated sentences by concatenating fragments.

## Naming

- Files use kebab-case unless framework conventions require otherwise.
- Components use PascalCase.
- Hooks use `use` prefix.
- Repositories use `EntityRepository` naming.
- Services use `DomainService` naming.

## Error Handling

- Validate user input before local transaction.
- Convert technical errors to user-safe messages.
- Log sync failures with enough detail for debugging.
- Do not swallow repository or sync errors silently.

## Testing Expectations

Minimum test coverage for MVP implementation:

- Commission calculation unit tests
- Report calculation unit tests
- Repository integration tests for local writes
- Sync queue unit tests
- i18n smoke test for visible strings
- Critical income entry flow test

## Performance

- Prefer local queries with proper indexes.
- Avoid expensive calculations during render.
- Keep dashboard queries targeted.
- Test on low-end Android before release.
