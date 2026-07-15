# Sync Engine — Implementation Reference

Single-page reference for the per-record offline-first sync engine work
delivered across Phases 1–8 (2026-07-15).

For design + component walk-throughs, see [sync-engine.md](sync-engine.md).
This doc is the "what shipped, how to build, how to deploy" companion.

---

## 1. What was built

The app pivoted from a whole-DB file-backup engine to a **per-record
offline-first sync engine** backed by Firestore, with the file backup
kept alive as a **manual disaster-recovery** tool.

Key traits:

- SQLite is the source of truth. Every write commits locally first.
- Every business row participates in sync automatically — repos call one
  helper (`trackChange`) inside their existing transaction; no per-feature
  wiring needed.
- Only changed records travel over the wire. Payloads are small.
- Multi-writer safe via per-record OCC (`_sync.version`).
- Works fully offline; drains on reconnect.
- Backend abstracted behind a `SyncApi` interface — a future NestJS or
  Supabase adapter can drop in.
- Firestore Security Rules with App Check strict enforcement.
- Scheduled Cloud Function garbage-collects tombstones after 90 days.
- Sync Status screen with retry/discard for dead-letters + activity feed.

### Delivery by phase

| Phase | Delivered |
| --- | --- |
| **1** | Schema (migrations 016, 017) + `ChangeTracker`; all 11 repositories retrofitted (30 write sites) |
| **2** | `SyncApi` + `FirestoreSyncApi` + `QueueManager` + `SyncService.pushOnce` |
| **3** | `SyncService.pullOnce` + `ConflictResolver` (LWW, both push and pull paths) |
| **4** | `SyncScheduler` + `background-sync-task` + `AuthProvider` lifecycle + "Sync now" tile |
| **5** | Migration 018 + `SyncHistoryRepository` + `SyncStatusScreen` (retry / discard / history / conflicts) |
| **6** | `salon-membership` + `firestore.rules` + `firestore.indexes.json` + `firebase.json` + `functions/tombstoneGc` |
| **7** | File-backup engine demoted to manual-only "Export snapshot" |
| **8** | Docs finalized (this file + `sync-engine.md` + `database-schema.md`) |

---

## 2. Architecture at a glance

```
Screens / Features
  └─ Repository Layer  ──►  markDirty() + trackChange()  ← same SQLite tx
                                         │
                                         ▼
                                    sync_queue
                                         │
       ┌─────────────── SyncScheduler ───────────────┐
       │  triggers → SyncService                     │
       │             ├─ pushOnce() → SyncApi.push    │
       │             └─ pullOnce() → SyncApi.pull    │
       │  ConflictResolver (LWW, both directions)    │
       │  QueueManager (retry backoff, dead-letter)  │
       │  SyncStateStore (cursors)                   │
       │  SyncHistoryRepository (observability)      │
       └─────────────────────────────────────────────┘
                                         │
                                         ▼
                                    SyncApi
                                    │       │
                          FirestoreSyncApi  (future: NestJS/HTTP impl)
                                    │
                              Firestore
                                    │
                     Cloud Function: tombstoneGc (nightly)
```

**Sync entities (10 total)** — all wire up the same infrastructure:

`salons`, `services`, `service_categories`, `employees`,
`commission_rules`, `income_transactions` (embeds
`income_transaction_items` as aggregate root), `expense_categories`,
`expenses`, `customers`, `employee_advances`.

---

## 3. File map

### App code (`src/`)

**New module: `src/sync/` (11 files)**

| File | Role |
| --- | --- |
| `types.ts` | `SyncEntityType`, `SyncStatus`, `SyncOperation`, `SyncQueueStatus`, `SyncColumns`, `SyncQueueRow`, `ConflictLogRow` |
| `change-tracker.ts` | `trackChange({entityType, entityId, salonId, operation?})` — stamp + enqueue inside caller's tx |
| `entity-order.ts` | `ENTITY_PULL_ORDER` (parents-first list) |
| `serializer.ts` | `serializeRow()` — strip local sync cols; embed items for `income_transactions` |
| `deserializer.ts` | `applyRemoteRow()` — INSERT OR REPLACE filtered by `PRAGMA table_info` |
| `sync-api.ts` | `SyncApi` interface + `SyncOp`, `PushResult`, `PushSummary`, `RemoteRecord`, `PullPage`, `PullSummary` |
| `firestore-sync-api.ts` | `FirestoreSyncApi` — per-op Firestore txn for OCC-safe push; `orderBy + where + limit` for pull |
| `queue-manager.ts` | `claimNext`, `markSuccess`, `markFailure` (7-step backoff), `reopenWithFreshBase`, `resetOrphanedProcessing`, `findByEntity` |
| `conflict-resolver.ts` | 3-rule LWW: delete>update, then `updated_at`, tie-break `updated_by`. `logConflict()` |
| `sync-state-store.ts` | Per-entity cursor + last-pull timestamps |
| `sync-service.ts` | `pushOnce(salonId)` + `pullOnce(salonId)` — pure primitives |
| `sync-scheduler.ts` | Lifecycle singleton; subscribes to `AppState`, `db:dirty`, `network:changed`; periodic + drain |
| `background-sync-task.ts` | `expo-background-task` worker at `salon-khata.sync.periodic` |
| `sync-history-repo.ts` | `record()` + `listRecent()` + `latestSuccess()`; 500-row per-salon cap |

**New cloud helper: `src/cloud/salon-membership.ts`** — `ensureSalonMembership()` + `addMember` / `removeMember` / `listMembers` on the top-level `/salons/{sid}` doc.

**Modified:**

- All 11 repositories in `src/repositories/` — one `trackChange()` call added per write site (30 sites total), paired 1:1 with the existing `markDirty()`.
- `src/database/db-meta.ts` — unchanged; still consulted by DR backup pipeline.
- `src/application/AppRoot.tsx` — registers `background-sync-task` on boot; **no longer** registers the backup task.
- `src/application/event-bus.ts` — extended with `sync:push-started/completed`, `sync:pull-started/completed`, `sync:conflict`.
- `src/features/auth/AuthProvider.tsx` — starts/stops both schedulers; calls `ensureSalonMembership` on sign-in; defensively unregisters both bg tasks on sign-out.
- `src/features/more/MoreScreen.tsx` — three new tiles: "Sync now", "Sync status", "Export snapshot".
- `src/backup/backup-scheduler.ts` — rewritten to bare `start/stop/runNow/cancelInFlight` (no auto-triggers).
- `src/backup/background-task.ts` — no longer auto-registered; module still alive for defensive unregister.
- `src/application/AppNavigator.tsx` — new `SyncStatus` route.
- `src/database/migrations/index.ts` — registers migrations 016, 017, 018.

**New screen:**
- `src/features/sync/SyncStatusScreen.tsx` — hero card, sync-now button, dead-letters with retry/discard, recent conflicts, recent activity, pull-to-refresh.

### Migrations

| # | File | What it adds |
| --- | --- | --- |
| 016 | `src/database/migrations/016-sync-columns.ts` | 5 sync columns on all 11 business tables (idempotent via `PRAGMA table_info`) |
| 017 | `src/database/migrations/017-sync-queue.ts` | `sync_queue` (with UNIQUE + status index), `sync_state` (key/value), `conflict_log` |
| 018 | `src/database/migrations/018-sync-history.ts` | `sync_history` + `idx_sync_history_started` |

All idempotent — safe on every app start.

### Repo-root Firebase/Cloud Functions config

| File | Role |
| --- | --- |
| `firebase.json` | CLI config pointing at rules + indexes + functions codebase |
| `firestore.rules` | Security rules — App Check required, `owner_uid` or `member_uids` gating |
| `firestore.indexes.json` | Composite index for tombstone GC query |
| `functions/package.json` | Node 20, firebase-admin ^12.7 + firebase-functions ^6.1 |
| `functions/tsconfig.json` | Strict TS, outDir `lib/` |
| `functions/src/index.ts` | `tombstoneGc` scheduled function (nightly 03:00 UTC, 90-day retention) |
| `.gitignore` | Extended with `functions/lib/`, `functions/node_modules/`, `.firebase/` |

### Docs

- `docs/sync-engine.md` — architecture / design reference (rewritten in Phase 8).
- `docs/database-schema.md` — Shared Columns + sync_queue + sync_state sections updated.
- `docs/sync-engine-implementation.md` — this file.

### i18n

`en.json` + `hi.json` (hi is stub copy) both have:

- `more.syncNow`, `more.syncNowSub`
- `more.syncStatus`, `more.syncStatusSub`
- `more.exportSnapshot`, `more.exportSnapshotSub`
- `sync.result.*` — 5 outcome messages
- `syncStatus.*` — full screen strings + `time.*` relative-time keys + `trigger.*` labels + plural `_one`/`_other`
- `backup.export.*` — 8 keys for the DR flow

---

## 4. Build & verify locally

Everything runs in the standard Expo/RN loop. No extra scripts needed
for the sync engine.

### Typecheck

```bash
npm run typecheck
```

Should return zero diagnostics. Runs `tsc --noEmit` against `App.tsx +
src/**`. `functions/` is a separate TS project (its own `tsconfig.json`)
and is not covered by the app typecheck.

### Validate i18n JSON

```bash
python3 -c "import json; json.load(open('src/i18n/locales/en.json')); json.load(open('src/i18n/locales/hi.json')); print('ok')"
```

### Dependency check

```bash
CI=1 npx expo install --check
```

### Run the app (dev client required)

Because the app uses `@react-native-firebase/*` native modules, Expo Go
does **not** work. Use the dev client:

```bash
# One-time (or after native config changes):
npx expo prebuild --clean
npx expo run:android   # or run:ios

# Everyday:
npx expo start --dev-client
```

### Cloud Functions build (local)

```bash
cd functions
npm install
npm run build   # tsc → lib/
```

---

## 5. Deploy (user action)

The sync engine works end-to-end on-device against Firestore as soon as
security rules are deployed. Order:

### Firestore rules + indexes

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

- **Rules** ([firestore.rules](../firestore.rules)) — App Check strictly
  required globally. Owner or `member_uids` access.
- **Indexes** ([firestore.indexes.json](../firestore.indexes.json)) — one
  composite index for the tombstone GC query. Firestore auto-creates
  single-field indexes; explicit declaration only needed for the
  composite one.

### Tombstone GC Cloud Function

```bash
cd functions
npm install
firebase deploy --only functions:tombstoneGc
```

Runs nightly at `03:00 UTC`. Deletes cloud records where
`_sync.tombstone === true` and `_sync.serverUpdatedAt < now - 90 days`.
Configurable via `TOMBSTONE_RETENTION_DAYS` in
[functions/src/index.ts](../functions/src/index.ts).

### App Check debug tokens (dev builds)

Rules enforce App Check globally. Dev builds don't have Play Integrity /
DeviceCheck attestation — they must present a debug token. The token is
printed to console at boot by `initializeAppCheck()`.

1. Grab the token from adb / xcode logs the first time the app boots
   after `firebase deploy --only firestore:rules`.
2. Paste into **Firebase Console → App Check → Manage debug tokens**.
3. Restart the app. Firestore writes should now succeed.

Production builds attest via Play Integrity (Android) / DeviceCheck
(iOS) automatically — no debug token needed.

---

## 6. Manual multi-device testing playbook

The end-to-end acceptance test for the sync engine.

### Setup

- Two devices signed into the **same** Firebase account (same phone
  number → same `uid` → same salon).
- Both on the same LAN or good cellular.

### Test 1 — round-trip

1. On Device A: create a service, e.g. "Test service ₹500".
2. Wait 5–10 s (debounce + push).
3. On Device B: open Reports or Services list. **Expected**: service
   appears.

Under the hood: A's write → `trackChange` enqueues → 5 s debounce fires
→ `pushOnce` sends → Firestore `_sync.serverUpdatedAt` advances → B's
next trigger (foreground / manual / periodic) pulls the page.

### Test 2 — LWW conflict

1. Both A and B offline (airplane mode).
2. On A: edit "Test service" price to ₹600.
3. On B: edit "Test service" price to ₹700.
4. Bring **A** online first. Wait for push to complete (Sync Status →
   "Recent activity" shows a success).
5. Bring **B** online. Wait.

**Expected**: One of the two values wins by LWW on `updated_at`. Both
devices converge to the same value. Losing side has a `conflict_log`
row visible in Sync Status → "Recent conflicts".

### Test 3 — offline queue drain

1. Device A goes offline.
2. Create 20 records (e.g. 20 bills or 20 customers).
3. Bring A online.

**Expected**: within a minute all 20 records are on Firestore. Sync
Status shows queue depth = 0.

### Test 4 — dead-letter + retry

1. Temporarily add a Firestore rule that denies writes to `services`.
2. Deploy: `firebase deploy --only firestore:rules`.
3. On A, create a service. Wait for the 7 retry attempts to burn.
4. Sync Status → "Failed records (1)" should appear.
5. Revert the rule + redeploy.
6. Tap **Retry** on the dead-letter row.

**Expected**: retry succeeds, dead-letter clears.

### Test 5 — Export snapshot

1. MoreScreen → **Export snapshot** → confirm.
2. Wait for "Snapshot uploaded (X.X MB)" snackbar.
3. Firebase Console → Storage → verify a new blob under
   `salons/{uid}/backups/{versionId}.db.gz.enc`.

---

## 7. Known limitations & deferred items

### Not built yet (all documented in memory)

- **Restore-from-snapshot UI** — the DR backup exists in Storage but no
  in-app restore UI. Rationale: per-record sync on a new device pulls
  everything anyway. Add if a real DR need surfaces.
- **Member invite UI** — `addMember` / `removeMember` helpers exist
  (`src/cloud/salon-membership.ts`) but no screen to call them. Ship
  when multi-writer becomes a product requirement.
- **Row-level `sync_status` badges** — the columns exist and are
  maintained; UI hooks not built into row detail sheets.
- **`docs/api-contract.md` rewrite** — file describes HTTP endpoints
  that don't match the Firestore-native reality. Full rewrite deferred.

### Deferred by design

- **`db_meta.dirty_since` / `change_count` prune** — still consulted by
  the DR backup pipeline's optimistic-concurrency check. Removing
  would be a larger pipeline refactor for minimal user-facing gain.
- **Device-lock in DR backup** — kept intentionally. Two devices tapping
  Export snapshot simultaneously shouldn't race the same upload.
- **10k-row load test** — needs a synthetic seed harness. Belongs to a
  testing-focused iteration.

### Retention envelope

- Tombstones live 90 days in Firestore (see
  `TOMBSTONE_RETENTION_DAYS` in `functions/src/index.ts`).
- A device offline **longer than 90 days** will resurrect deleted rows
  on next sync. Recovery path for those cases = manual snapshot
  restore (not yet wired to UI).

---

## 8. Where to look when things break

| Symptom | Look here |
| --- | --- |
| Writes don't sync | Sync Status → dead-letters + activity. Check Firestore console for the doc under `/salons/{sid}/entities/{entityType}/records/{docId}` |
| "permission-denied" errors | App Check debug token missing/expired in Firebase Console → App Check → Manage debug tokens |
| Records missing after new-device install | Trigger a manual pull via Sync Status → Sync now. Check cursor state in `sync_state` table via dev tools |
| Duplicate rows | Should be impossible (UUIDs). If seen, check for two devices with same install_id — see `src/device/device-identity.ts` reconciliation logic |
| Snapshot upload fails | MoreScreen → Export snapshot shows the error in a snackbar. Full details in `backup_history` table |
| Tombstone survives past 90 days | Cloud Function may have hit `MAX_BATCHES_PER_RUN` (25k tombstones/night). Check `firebase functions:log --only tombstoneGc` |

---

## 9. Quick reference: developer entry points

```ts
// Every repo write already does this — no action needed for new features:
runInTransaction(() => {
  database.runSync(`INSERT INTO ...`);
  trackChange({ entityType: 'my_new_table', entityId: id, salonId });
  markDirty();
});

// Manually kick a sync cycle (rarely needed — scheduler handles it):
import { syncScheduler } from '@/sync/sync-scheduler';
const outcome = await syncScheduler.runNow();

// Read queue depth / dead-letter count:
import { queueManager } from '@/sync/queue-manager';
const counts = queueManager.countByStatus(salonId);

// Manually trigger a DR snapshot:
import { backupScheduler } from '@/backup/backup-scheduler';
const outcome = await backupScheduler.runNow();
```

To add a new sync entity:

1. Add the table + 5 sync columns via a new migration.
2. Add its name to `SyncEntityType` in `src/sync/types.ts`.
3. Add it to `ENTITY_PULL_ORDER` in `src/sync/entity-order.ts` (respect
   parent → child ordering).
4. In the repository, call `trackChange({ entityType, entityId, salonId })`
   inside every `runInTransaction` write.
5. (Optional) If the entity is an aggregate root with child rows, add a
   branch to `serializeRow()` and `applyRemoteRow()` for the embedded
   payload — see `income_transactions` for the pattern.

That's it — the scheduler, queue manager, conflict resolver, and status
UI all pick it up automatically.

---

_Last updated: 2026-07-15._
