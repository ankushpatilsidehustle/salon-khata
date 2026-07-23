# Observability naming standards

Single source of truth for event names: [`src/observability/events/catalog.ts`](../../src/observability/events/catalog.ts).

| Kind | Convention | Example |
| --- | --- | --- |
| Events | `snake_case`, `{domain}_{action}` | `bill_created` |
| Screens | PascalCase route id | `IncomeEntry`, `SyncStatus` |
| User properties | `snake_case` | `subscription_plan` |
| Params | `snake_case`, primitives / enums | `payment_method: cash\|upi\|credit` |
| Error categories | `sqlite`, `firestore`, `storage`, `sync`, `backup`, `auth`, `ui`, `background`, `network`, `unknown` | |
| Perf traces | `snake_case` | `app_startup`, `sync_push` |

## Rules

- Features import `@/observability` only — never `@react-native-firebase/analytics` directly.
- No PII in params (phone, name, OTP, free-text notes).
- Sync/backup outcomes: emit via the event bus; the bridge maps them once.
- Critical business events may pass `{ critical: true }` for durable offline queue + `event_id` dedup.
- Reserved: `appointment_*`, `inventory_*` until those modules ship.

## Consent

- Analytics: opt-out (More → Privacy).
- Crashlytics: always on for stability.
