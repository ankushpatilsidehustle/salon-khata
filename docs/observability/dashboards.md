# Observability dashboards & KPIs

Use **Firebase Analytics**, **Crashlytics**, and (optionally) **BigQuery export**
to power these views. Event names live in `src/observability/events/catalog.ts`.

## Recommended dashboards

| Dashboard | KPIs | Primary events / sources |
| --- | --- | --- |
| Acquisition & auth | OTP success rate, time-to-verify, Phone→OTP drop-off | `auth_*` |
| Activation | Onboarding completion, time-to-first-bill | `onboarding_*`, `first_bill_created` |
| Engagement | DAU / MAU, session duration, bills/day | `screen_open`, `bill_created` |
| Feature usage | Module funnels; least-used features | domain events + screen views |
| Stability | Crash-free users %, crash rate, non-fatals by category | Crashlytics + `error_category` |
| Screens | Top / exit screens, onboarding step exits | `screen_view`, `screen_open` |
| Sync health | Push/pull success, conflict rate, p50/p95 duration | `sync_*` via event-bus bridge |
| Backup | Success/fail by trigger + `error_code` | `backup_*` |
| Monetization | Trial→paid, referral claim success, soft-lock→action | `subscription_*`, `referral_*` |
| Retention | D1 / D7 / D30 by `salon_type`, `preferred_language` | Analytics retention + user props |

## BigQuery (Phase 3)

1. Enable Analytics → BigQuery linking in Firebase console.
2. Export daily events; build Looker Studio / Data Studio reports from the table above.
3. Join Crashlytics exports on `user_id` / `install_id` for stability cohorts.

## NestJS correlation (future)

When an HTTP backend exists, register `registerNestAdapter(...)` and forward
`install_id`, `salon_id`, `session_id`, `request_id` on every span. See
`src/observability/adapters/nestjs-otel-adapter.ts`.

## Reserved namespaces

Do **not** fire until modules ship:

- `appointment_*` — appointments
- `inventory_*` — inventory
