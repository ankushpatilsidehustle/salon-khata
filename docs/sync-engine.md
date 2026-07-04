# Sync Engine

Salon Khata is SQLite-first. Synchronization is a background reliability feature, not a requirement for daily use.

## Goals

- Queue-based sync
- Background synchronization
- Retry mechanism
- Conflict handling
- Restore from cloud
- Incremental sync
- Full offline operation
- Low server cost

## Core Rule

Every user operation writes to SQLite and `sync_queue` in one local transaction before any cloud request is attempted.

## Architecture

```text
React Native App
SQLite Database
Repository Layer
Business Logic
Sync Engine
Firebase-backed Cloud API
Cloud Database
```

The app reads active state from SQLite. The sync engine pushes and pulls changes when network and app lifecycle conditions allow.

## Sync Statuses

Record `sync_status` values:

- `pending`: local change not fully synced
- `synced`: local record matches last accepted cloud state
- `failed`: sync failed after retry attempt
- `conflict`: local and cloud state required conflict resolution

Queue `status` values:

- `queued`
- `processing`
- `synced`
- `failed`

## Push Flow

1. Read oldest eligible `sync_queue` item.
2. Mark item `processing`.
3. Send payload to cloud with stable `operation_id` equal to queue item ID.
4. Cloud applies operation idempotently.
5. App marks queue item `synced` and entity `sync_status` as `synced`.
6. On failure, increment `attempt_count`, store error, and schedule `next_attempt_at`.

## Pull Flow

1. Read `sync_state.last_pulled_at`.
2. Request cloud changes for the salon after that cursor.
3. Apply changes in SQLite transaction order.
4. Preserve local pending changes unless conflict rules choose cloud value.
5. Update `sync_state.last_pulled_at` after successful apply.

## Retry Policy

- Retry automatically on network and transient server errors.
- Use exponential backoff with jitter.
- Keep queue items durable across app restarts.
- Do not block local usage because sync failed.

Recommended backoff:

- Attempt 1: immediate
- Attempt 2: 15 seconds
- Attempt 3: 1 minute
- Attempt 4: 5 minutes
- Attempt 5 and later: 15 minutes

## Conflict Handling

MVP policy: last write wins plus audit log.

Rules:

- Compare `updated_at` timestamps and cloud revision metadata.
- The newest accepted write becomes current state.
- Store conflict details in `audit_logs`.
- Mark losing queue item as synced if cloud accepted a newer version.
- Do not show manual conflict UI in MVP.

Why this is acceptable:

- MVP has one owner and typically one primary device.
- Manual conflict review would add complexity to a product meant to replace a notebook.
- Audit logs preserve support visibility.

## Restore

Restore is used when:

- User installs app on a new phone.
- Local data is lost.
- User explicitly chooses restore in settings.

Restore flow:

1. Verify OTP and salon identity.
2. Ask for confirmation if local data already exists.
3. Download salon records from cloud.
4. Upsert records into SQLite by stable UUID.
5. Rebuild indexes and report state naturally from tables.
6. Update `sync_state.restore_completed_at`.

Restore must be idempotent. Running restore twice must not duplicate records.

## Incremental Sync

Cloud records should expose:

- `id`
- `salon_id`
- `updated_at`
- `deleted_at`
- `device_id`
- `revision` or equivalent server version

The app pulls records changed after the last cursor.

## Background Sync

Use Expo-compatible background task capabilities where reliable. Because mobile OS background execution is limited, sync must also run:

- On app launch
- On app foreground
- After save operations
- When connectivity returns
- When user taps backup

## Firebase Note

Firestore offline cache is not the app's source of truth. Salon Khata still writes to SQLite first and uses Firebase as cloud sync infrastructure.

## Failure UX

- Do not alarm users for temporary sync failures.
- Show subtle sync status in settings.
- Show clear recovery action for repeated failures, such as `t("retryBackup")`.
- Never block income or expense entry because sync is unavailable.
