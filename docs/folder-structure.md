# Folder Structure

This is the proposed application structure for the implementation phase. Do not create source files until documentation is approved.

```text
src/
  application/
    navigation/
    providers/
  assets/
    fonts/
    images/
  components/
    core/
    feedback/
    forms/
    domain/
  design-system/
    colors.ts
    typography.ts
    spacing.ts
    radius.ts
    shadows.ts
    tokens.ts
  features/
    auth/
    dashboard/
    services/
    employees/
    commission/
    income/
    expenses/
    reports/
    settings/
  i18n/
    locales/
      en.json
    index.ts
  database/
    migrations/
    schema/
    sqlite-client.ts
  repositories/
    service-repository.ts
    employee-repository.ts
    commission-repository.ts
    income-repository.ts
    expense-repository.ts
    settings-repository.ts
  domain/
    commission-service.ts
    report-service.ts
    money.ts
    dates.ts
  sync/
    sync-engine.ts
    sync-queue.ts
    conflict-policy.ts
    restore-service.ts
  firebase/
    auth.ts
    sync-api.ts
  utils/
  tests/
```

## Boundary Rules

- `features` owns screens and feature-specific UI composition.
- `components` owns reusable components.
- `repositories` owns SQLite access.
- `domain` owns business calculations.
- `sync` owns queue processing and cloud exchange.
- `firebase` owns Firebase integration details.
- `i18n` owns translation resources and helpers.
- `application` owns app bootstrap, providers, and navigation shell.

## Import Direction

Allowed:

- Features import components, domain services, repositories through feature services.
- Domain imports utilities only.
- Repositories import database utilities only.
- Sync imports repositories and Firebase sync API.

Avoid:

- Components importing repositories.
- Repositories importing screens.
- Domain logic importing React.
- Firebase details leaking into UI screens.
