# Database Schema

Salon Khata uses SQLite as the local source of truth. All normal operations read and write local SQLite first.

## Shared Columns

Every mutable business table must include:

| Column | Type | Notes |
| --- | --- | --- |
| `id` | TEXT | UUID generated on device |
| `created_at` | TEXT | ISO 8601 UTC timestamp |
| `updated_at` | TEXT | ISO 8601 UTC timestamp |
| `deleted_at` | TEXT NULL | Soft delete timestamp |
| `sync_status` | TEXT | `pending`, `syncing`, `synced`, `failed`, `conflict` (added by migration 016) |
| `sync_version` | INTEGER | Server-assigned monotonic revision, `0` = never pushed (migration 016) |
| `last_synced_at` | TEXT NULL | ISO UTC of last successful cloud ack (migration 016) |
| `updated_by` | TEXT NULL | `install_id` of the device that authored the current row (migration 016) |
| `created_by` | TEXT NULL | `install_id` of the device that first created the row (migration 016) |

See [sync-engine.md](sync-engine.md) for the semantics of the sync columns.

> **Historical note**: earlier iterations carried a `device_id` column on
> every table. It was dropped in migration 014 and superseded by
> `updated_by` / `created_by` in migration 016.

## Tables

### salons

Stores one salon profile for the authenticated mobile number.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | TEXT | UUID |
| `business_name` | TEXT | Required |
| `owner_name` | TEXT | Required |
| `mobile_number` | TEXT | Required, unique in cloud |
| `currency` | TEXT | Default `INR` |
| `language` | TEXT | Default `en` |
| shared columns | | Required |

### devices

Tracks installations used for sync and restore.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | TEXT | Device UUID |
| `salon_id` | TEXT | FK to `salons.id` |
| `platform` | TEXT | `ios`, `android` |
| `app_version` | TEXT | Current app version |
| `last_seen_at` | TEXT | Last sync time |
| shared columns | | Required |

### services

| Column | Type | Notes |
| --- | --- | --- |
| `id` | TEXT | UUID |
| `salon_id` | TEXT | FK to `salons.id` |
| `name` | TEXT | Required |
| `price` | INTEGER | Minor currency units, e.g. paise |
| `is_active` | INTEGER | `1` active, `0` inactive |
| `sort_order` | INTEGER | For custom ordering |
| shared columns | | Required |

Indexes:

- `idx_services_salon_active` on `salon_id`, `is_active`, `deleted_at`
- Unique local validation for non-deleted `salon_id` and normalized `name`

### employees

| Column | Type | Notes |
| --- | --- | --- |
| `id` | TEXT | UUID |
| `salon_id` | TEXT | FK to `salons.id` |
| `name` | TEXT | Required |
| `mobile_number` | TEXT NULL | Optional in MVP |
| `is_active` | INTEGER | `1` active, `0` inactive |
| `sort_order` | INTEGER | For custom ordering |
| shared columns | | Required |

Indexes:

- `idx_employees_salon_active` on `salon_id`, `is_active`, `deleted_at`

### commission_rules

Commission rules are per employee and service.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | TEXT | UUID |
| `salon_id` | TEXT | FK to `salons.id` |
| `employee_id` | TEXT | FK to `employees.id` |
| `service_id` | TEXT | FK to `services.id` |
| `rule_type` | TEXT | `percentage` or `fixed` |
| `value` | INTEGER | Basis points for percentage, minor units for fixed |
| `is_active` | INTEGER | `1` active, `0` inactive |
| shared columns | | Required |

Rules:

- One active rule per employee-service pair.
- Missing rule means zero commission.
- Transaction items store snapshots so old reports do not change.

### income_transactions

Header record for one saved income entry.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | TEXT | UUID |
| `salon_id` | TEXT | FK to `salons.id` |
| `employee_id` | TEXT | FK to `employees.id` |
| `employee_name_snapshot` | TEXT | Required |
| `transaction_date` | TEXT | Local business date |
| `payment_mode` | TEXT | `cash`, `upi`, `card`, `other` |
| `gross_amount` | INTEGER | Sum of service amounts |
| `commission_amount` | INTEGER | Sum of calculated commission |
| `net_amount` | INTEGER | Gross minus commission |
| `remarks` | TEXT NULL | Optional future-safe field |
| shared columns | | Required |

Indexes:

- `idx_income_salon_date` on `salon_id`, `transaction_date`, `deleted_at`
- `idx_income_employee_date` on `employee_id`, `transaction_date`, `deleted_at`

### income_transaction_items

Stores selected services and calculation snapshots.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | TEXT | UUID |
| `salon_id` | TEXT | FK to `salons.id` |
| `transaction_id` | TEXT | FK to `income_transactions.id` |
| `service_id` | TEXT | FK to `services.id` |
| `service_name_snapshot` | TEXT | Required |
| `service_price_snapshot` | INTEGER | Minor units |
| `quantity` | INTEGER | Default `1` |
| `line_amount` | INTEGER | Price times quantity |
| `commission_rule_type_snapshot` | TEXT NULL | `percentage`, `fixed`, or null |
| `commission_rule_value_snapshot` | INTEGER | Value at time of save |
| `commission_amount` | INTEGER | Calculated line commission |
| shared columns | | Required |

### expense_categories

| Column | Type | Notes |
| --- | --- | --- |
| `id` | TEXT | UUID |
| `salon_id` | TEXT | FK to `salons.id` |
| `name` | TEXT | Translation key for defaults, custom text for user categories |
| `is_system` | INTEGER | `1` default, `0` custom |
| `is_active` | INTEGER | `1` active, `0` inactive |
| shared columns | | Required |

### expenses

| Column | Type | Notes |
| --- | --- | --- |
| `id` | TEXT | UUID |
| `salon_id` | TEXT | FK to `salons.id` |
| `category_id` | TEXT | FK to `expense_categories.id` |
| `category_name_snapshot` | TEXT | Required |
| `amount` | INTEGER | Minor currency units |
| `remarks` | TEXT NULL | Optional |
| `expense_date` | TEXT | Local business date |
| shared columns | | Required |

Indexes:

- `idx_expenses_salon_date` on `salon_id`, `expense_date`, `deleted_at`

### app_settings

Stores local settings that affect behavior.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | TEXT | UUID |
| `salon_id` | TEXT | FK to `salons.id` |
| `key` | TEXT | Setting key |
| `value` | TEXT | JSON-encoded value when needed |
| shared columns | | Required |

### sync_queue

Pending-changes ledger consumed by the per-record push loop. The queue
never stores payloads — the push loop reads the live row at push time,
so repeated writes to the same `(salon_id, entity_type, entity_id)`
naturally coalesce via the unique index. See [sync-engine.md](sync-engine.md).

| Column | Type | Notes |
| --- | --- | --- |
| `id` | TEXT | UUID for the queue row itself |
| `salon_id` | TEXT | Scope for security-rule shard |
| `entity_type` | TEXT | Table name (e.g. `services`) |
| `entity_id` | TEXT | The row's UUID |
| `operation` | TEXT | `upsert` or `delete` (delete is sticky) |
| `status` | TEXT | `queued`, `processing`, `failed`, `dead` |
| `attempt_count` | INTEGER | Retry counter |
| `last_attempt_at` | TEXT NULL | Retry tracking |
| `next_attempt_at` | TEXT NULL | Backoff scheduling |
| `error_code` | TEXT NULL | Last failure code (e.g. `unavailable`) |
| `error_message` | TEXT NULL | Last failure message |
| `created_at` | TEXT | Row created |
| `updated_at` | TEXT | Row last touched |

Indexes:

- UNIQUE `(salon_id, entity_type, entity_id)` — drives natural coalescing.
- `(salon_id, status, next_attempt_at)` — dequeue hot path.

### sync_state

Key/value store for per-entity pull cursors and one-off sync metadata.

| Column | Type | Notes |
| --- | --- | --- |
| `key` | TEXT PK | Well-known keys: `cursor:{entityType}`, `last_pull_at:{entityType}`, `last_full_sync_at` |
| `value` | TEXT NULL | JSON blob for cursor entries (`{seconds, nanoseconds}`) or plain ISO strings |

### audit_logs

Stores important changes and conflict decisions.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | TEXT | UUID |
| `salon_id` | TEXT | FK to `salons.id` |
| `entity_type` | TEXT | Changed entity |
| `entity_id` | TEXT | Changed entity ID |
| `action` | TEXT | `create`, `update`, `delete`, `restore`, `conflict_resolved` |
| `before_payload` | TEXT NULL | JSON |
| `after_payload` | TEXT NULL | JSON |
| `source_device_id` | TEXT | Origin device |
| `created_at` | TEXT | Required |

## Money Storage

Store all money values as integers in minor currency units. For INR, store paise. Display formatting belongs in presentation utilities.

## Date Handling

- Store timestamps in UTC ISO 8601.
- Store business dates as local date strings in `YYYY-MM-DD`.
- Reports use business dates, not sync timestamps.

## Soft Delete Rules

- Delete sets `deleted_at` and updates `updated_at`.
- Soft-deleted records are hidden from normal lists and reports.
- Sync pushes soft deletes to cloud.
- Restore preserves soft-deleted records unless a retention policy is introduced later.
