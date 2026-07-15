# Sync Engine

Salon Khata is SQLite-first. Every user operation writes locally in one
transaction; the sync engine mirrors changes to Firestore in the
background. The app remains fully functional offline.

Two engines run today, side-by-side:

| Engine | Purpose | Trigger |
| --- | --- | --- |
| **Per-record sync engine** (`src/sync/`) | Primary. Push/pull each business row individually via Firestore. Handles multi-writer conflicts via last-write-wins. | Automatic — post-write debounce, app foreground/background, network reconnect, periodic 15 min, OS background task, manual button. |
| **Whole-DB file backup** (`src/backup/`, `src/cloud/`) | Disaster-recovery safety net. Snapshots the entire SQLite file → gzip → AES-GCM → Firebase Storage. | Manual only. User taps "Export snapshot" in `MoreScreen`. |

The rest of this doc describes the per-record engine unless noted.

## Goals

- Every CRUD op automatically participates in sync — no per-feature wiring.
- Only changed records travel over the wire. Payloads are small.
- Multi-writer safe via per-record optimistic-concurrency (OCC).
- Continues to work offline, resumes on reconnect.
- Batched Firestore ops keep round-trips low on slow mobile networks.
- Backend-agnostic — `SyncApi` interface lets a future NestJS/HTTP
  service replace Firestore without touching feature code.

## Data model

### Local (SQLite)

Every business table (11 total) carries these sync columns added by
migration 016:

- `sync_status` TEXT NOT NULL DEFAULT 'pending' — `pending | syncing | synced | failed | conflict`.
- `sync_version` INTEGER NOT NULL DEFAULT 0 — server-assigned monotonic rev. `0` = never pushed.
- `last_synced_at` TEXT NULL — ISO UTC of last successful cloud ack.
- `updated_by` TEXT NULL — `install_id` of the device that authored the current row state.
- `created_by` TEXT NULL — `install_id` of the device that first created the row.

Three infrastructure tables added by migrations 017 + 018:

- `sync_queue` — pending-changes ledger. UNIQUE `(salon_id, entity_type, entity_id)`
  so repeated writes to the same row naturally coalesce into a single
  entry. Payload is **not** stored — the push loop reads the live row
  at push time, so rapid successive edits collapse into one upload for
  free.
- `sync_state` — key/value cursors, one per entity type
  (`cursor:{entityType}` stores Firestore `serverUpdatedAt` as JSON
  `{seconds, nanoseconds}`).
- `conflict_log` — local-only audit trail of every resolver decision
  (capped at 500 rows).
- `sync_history` — local diagnostic ledger, capped at 500 rows per salon,
  powers the Sync Status screen.

### Cloud (Firestore)

Per-record docs live under:

```
/salons/{salonId}/entities/{entityType}/records/{docId}
```

Each doc carries the flattened business columns plus `_sync` metadata:

```
{
  <business columns...>,
  items?: [...],              // only for income_transactions (aggregate root)
  _sync: {
    version: number,           // monotonic per-doc revision
    authoredBy: string | null, // install_id of authoring device
    createdBy:  string | null,
    authoredAt: string,        // client updated_at (ISO UTC)
    tombstone:  boolean,       // deleted_at IS NOT NULL
    serverUpdatedAt: Timestamp // Firestore serverTimestamp; drives pull cursor
  }
}
```

The top-level `/salons/{sid}` doc carries `owner_uid` + `member_uids: string[]`
(the ACL that Security Rules consult) plus `backup_index` (used by the
DR backup pipeline).

### Sync entities (10 total)

Push/pull participants:

`salons`, `services`, `service_categories`, `employees`,
`commission_rules`, `income_transactions` (embeds
`income_transaction_items` as an aggregate root),
`expense_categories`, `expenses`, `customers`, `employee_advances`.

`income_transaction_items` is intentionally NOT its own sync entity —
items ride embedded in the parent transaction's payload. This mirrors
the aggregate boundary in the domain: a bill is one atomic unit.

## Architecture

```
Screens / Features
  └─ Repository Layer  ──►  markDirty()  +  trackChange()  ← same SQLite tx
                                         │
                                         ▼
                                    sync_queue
                                         │
       ┌────────────────── SyncService ─────────────────────┐
       │  QueueManager → pushOnce()  →  SyncApi.pushBatch() │
       │  SyncStateStore → pullOnce() ← SyncApi.pullChanges()│
       │  ConflictResolver (LWW, both directions)           │
       └────────────────────────────────────────────────────┘
                                         │
                                         ▼
                                    SyncApi
                                    │       │
                             FirestoreSyncApi   (future: NestJS/HTTP impl)
```

Components:

- **`ChangeTracker`** (`src/sync/change-tracker.ts`) — `trackChange({ entityType, entityId, salonId, operation? })` runs 2 SQL statements inside the caller's `runInTransaction`: stamps the row with `sync_status='pending' + updated_by + created_by`, and upserts into `sync_queue` (delete op is sticky against subsequent upserts). Every repo write calls it once, paired 1:1 with `markDirty()`.
- **`QueueManager`** (`src/sync/queue-manager.ts`) — `claimNext(salonId, 50)` atomically SELECT + UPDATE-to-processing inside a tx; `markSuccess`, `markFailure` (7-step backoff: 5s → 15s → 60s → 5m → 15m → 60m → 6h with ±20% jitter, `dead` after MAX_ATTEMPTS or non-transient error), `reopenWithFreshBase` (for resolver's "local wins" path), `resetOrphanedProcessing` (for crash recovery).
- **`SyncApi`** (`src/sync/sync-api.ts`) — cloud-agnostic contract. Never throws; every failure surfaces as a typed `PushResult` / `PullPage`. Implementations must run each push op under OCC.
- **`FirestoreSyncApi`** (`src/sync/firestore-sync-api.ts`) — runs each push op in its own Firestore transaction that checks `_sync.version === baseVersion` before writing (OCC-safe for multi-writer). Pull uses `.orderBy('_sync.serverUpdatedAt', 'asc').limit(pageSize)` with optional `.where('>', cursor)`.
- **`SyncService`** (`src/sync/sync-service.ts`) — orchestrator. `pushOnce(salonId)` and `pullOnce(salonId)` are pure primitives; each has an in-flight guard. `pullOnce` iterates entities in `ENTITY_PULL_ORDER` (parents first) and applies each page inside `runInTransaction`.
- **`ConflictResolver`** (`src/sync/conflict-resolver.ts`) — 3-rule LWW policy. Invoked from both push (on OCC conflict) and pull (when the incoming record has a pending local queue row). Every decision recorded to `conflict_log`.
- **`SyncStateStore`** (`src/sync/sync-state-store.ts`) — key/value wrapper over `sync_state`; owns per-entity pull cursors and full-sync timestamps.
- **`SyncScheduler`** (`src/sync/sync-scheduler.ts`) — lifecycle. Subscribes to `AppState`, `db:dirty`, `network:changed`; owns the periodic timer; coalesces triggers.
- **`SyncHistoryRepository`** (`src/sync/sync-history-repo.ts`) — records every meaningful attempt to `sync_history`, prunes to 500 rows, never throws.

Reusable:

- `NetworkManager` (`src/network/network-manager.ts`) — cached
  connectivity + `waitForOnline`.
- `DeviceIdentity` (`src/device/device-identity.ts`) — provides the
  `install_id` used as `updated_by` / `created_by`.
- `EventBus` (`src/application/event-bus.ts`) — publishes `sync:*` events.

## Sync statuses

Business-row `sync_status`:

- `pending` — local write not yet pushed.
- `syncing` — queue processor is currently pushing (reserved; only briefly held).
- `synced` — cloud acked the current local state.
- `failed` — push exceeded retry budget.
- `conflict` — remote had a newer version that overwrote local (resolver decision).

Queue-row `status`:

- `queued` — waiting for the next push cycle.
- `processing` — currently being pushed.
- `failed` — last attempt errored but retries remain.
- `dead` — exceeded retry budget; awaits manual Retry / Discard in Sync Status UI.

## Push flow

1. Trigger fires → `SyncScheduler.attempt(trigger)`.
2. `syncService.pushOnce(salonId)`:
   a. `queueManager.claimNext(salonId, 50)` atomically flips up to 50 rows to `processing`.
   b. Group by `entity_type`.
   c. For each group, `buildOp()` reads the live row + calls `serializeRow()` (embeds `items[]` for `income_transactions`). Rows that vanished between enqueue and push return null and their queue entry is deleted silently.
   d. `syncApi.pushBatch({ salonId, entityType, ops })` runs one Firestore transaction per doc. Each tx reads current `_sync.version`, compares to `baseVersion`, and either writes with `version+1` (applied) or returns a `conflict` with the current `RemoteRecord`.
3. Per-op reconciliation:
   - `applied` → stamp local row `sync_status='synced' + sync_version=newVersion + last_synced_at=now`; delete queue row.
   - `conflict` → `handlePushConflict()` runs `ConflictResolver`:
     - Local wins: bump `sync_version = remote.version` and `queueManager.reopenWithFreshBase(id)` so the next cycle retries with the fresh baseline.
     - Remote wins: `applyRemoteRow()` overwrites local; drop queue row.
     - `remoteRecord === null` (server hard-deleted): hard-delete local row and drop queue row.
   - `error` → `queueManager.markFailure({code, message, transient})`. Transient errors get a scheduled retry; non-transient or exhausted attempts move to `dead`.
4. If `push.hasMore`, scheduler immediately re-attempts (`drain` trigger), up to `MAX_DRAIN=5` cycles per burst before yielding.

## Pull flow

1. Trigger fires (excludes `post-write-debounce` and `app-background` —
   see `PULL_TRIGGERS`).
2. `syncService.pullOnce(salonId)`:
   a. For each entity in `ENTITY_PULL_ORDER` (salons → categories → services → employees → customers → commission_rules → expenses → advances → income_transactions):
      - Load cursor from `syncStateStore`.
      - Loop: `syncApi.pullChanges({ cursor, pageSize: 200 })` →
        apply the page inside `runInTransaction`.
      - Per record: if a pending queue row exists for the same
        `(entity_type, entity_id)`, run `ConflictResolver`; otherwise
        `applyRemoteRow()` wholesale (INSERT OR REPLACE filtered by
        `PRAGMA table_info` columns).
      - Advance cursor to `page.nextCursor` after each successful page.
      - Continue until `hasMore=false`.
   b. Per-entity errors caught + logged so one bad entity doesn't block
      the others.
   c. `syncStateStore.markFullSyncCompleted()` on completion.

## Conflict resolution (LWW)

The `ConflictResolver` runs identical logic on both sides — push OCC
conflicts and pull-with-pending-local-write conflicts. Rules:

1. **Delete beats update** (either side). A soft-delete wipes an update. Motivation: for a salon owner, "close that account" is stronger signal than an incidental edit.
2. **LWW on client `updated_at`**. Newer wins.
3. **Tie-break lexicographic on `updated_by`** (`install_id`). Deterministic across devices; no coordinator required.

Losing local writes are:

- **Local wins**: `sync_version` bumped to `remote.version` (adopts OCC line without changing content) + queue row `reopenWithFreshBase()` so the next push OCC succeeds.
- **Remote wins**: `applyRemoteRow()` overwrites local + queue row deleted.

Every decision is recorded to `conflict_log` and emitted via
`eventBus.emit('sync:conflict', ...)`.

## Triggers

`SyncScheduler` subscribes to:

| Trigger | Push? | Pull? |
| --- | --- | --- |
| Manual "Sync now" button | ✔ | ✔ |
| App → background | ✔ | ✘ (save before OS suspends) |
| App → foreground | ✔ | ✔ |
| `db:dirty` event (5 s debounce) | ✔ | ✘ (user just wrote) |
| `network:changed → online` | ✔ | ✔ |
| Periodic 15 min (foreground only) | ✔ | ✔ |
| OS background task (~hourly) | ✔ | ✔ |
| Internal `drain` (after `hasMore`) | ✔ | ✘ |

## Retry policy

Per-queue-row exponential backoff with jitter — the QueueManager owns
this; the scheduler has no separate error backoff.

| Attempt | Delay |
| --- | --- |
| 1 | 5 s |
| 2 | 15 s |
| 3 | 60 s |
| 4 | 5 m |
| 5 | 15 m |
| 6 | 60 m |
| 7 | 6 h |
| 8 | move to `dead` |

Non-transient errors (`permission-denied`, `unauthenticated`,
`invalid-argument`, `failed-precondition`) go straight to `dead`.

## Observability

- **Sync Status screen** (`src/features/sync/SyncStatusScreen.tsx`) —
  hero card with last full-sync + queue depth chips; "Sync now" button;
  conditional dead-letters list with Retry / Discard; recent conflicts
  (last 10 from `conflict_log`); recent activity (last 20 from
  `sync_history`). Pull-to-refresh.
- **`sync:*` events** on the event bus for third-party subscribers
  (`sync:push-started/completed`, `sync:pull-started/completed`,
  `sync:conflict`).

## Restore + new device

The per-record sync engine covers new-device provisioning by itself —
after sign-in on a new phone, `syncService.pullOnce()` pulls every
record for the salon and populates SQLite via `applyRemoteRow()`. No
separate "restore" flow is needed.

The whole-DB file backup exists as a safety net for catastrophic local
data loss / user-initiated destruction that per-record sync would
faithfully replicate. Restore is currently not wired to a UI — the
snapshot exists in Firebase Storage but must be manually pulled via
console for now.

## Security

- **App Check** (`src/firebase/app-check.ts`) is initialized before
  the AuthProvider mounts. Firestore Security Rules require it
  globally.
- **Firestore Security Rules** (`firestore.rules`) allow
  `authed() = isSignedIn() && hasAppCheck()` and either
  `resource.data.owner_uid == uid` or `uid in resource.data.member_uids`.
  The top-level `/salons/{sid}` doc is set up by
  `ensureSalonMembership()` on every sign-in resolution.

## Backend abstraction

`SyncApi` is a plain interface. `FirestoreSyncApi` is the only
implementation today. A future NestJS or Supabase adapter can drop in
without touching the rest of the sync engine — `SyncService`,
`QueueManager`, `ConflictResolver`, `SyncStateStore` all consume the
interface, not the concrete class.

## Tombstone GC

A scheduled Cloud Function (`functions/src/index.ts::tombstoneGc`) runs
nightly (`0 3 * * *` UTC) and hard-deletes cloud records with
`_sync.tombstone === true` and `serverUpdatedAt < now - 90 days`. A
device offline longer than the retention window will resurrect deleted
records on next sync — for those cases the manual snapshot restore is
the correct recovery path.

## Failure UX

- Never blocks bill entry / expense entry / customer creation.
- Snackbar messages for user-initiated actions (Sync Now, Export
  snapshot).
- Per-record `sync_status` visible in row detail sheets (future
  enhancement — hook exists, UI not built).
- Dead-letters visible in Sync Status screen with Retry / Discard
  actions.
