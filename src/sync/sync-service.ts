import { database, runInTransaction } from "@/database/sqlite-client";
import { getUtcTimestamp } from "@/domain/dates";
import { eventBus } from "@/application/event-bus";

import {
  conflictResolver,
  logConflict,
  type ConflictContext,
  type LocalRowState,
  type RemoteRowState
} from "@/sync/conflict-resolver";
import { applyRemoteRow } from "@/sync/deserializer";
import { ENTITY_PULL_ORDER } from "@/sync/entity-order";
import { FirestoreSyncApi } from "@/sync/firestore-sync-api";
import { queueManager, DEFAULT_BATCH_SIZE } from "@/sync/queue-manager";
import { serializeRow } from "@/sync/serializer";
import { syncStateStore } from "@/sync/sync-state-store";
import type {
  PullSummary,
  PushResult,
  PushSummary,
  RemoteRecord,
  SyncApi,
  SyncOp
} from "@/sync/sync-api";
import type { SyncEntityType, SyncQueueRow } from "@/sync/types";

/**
 * SyncService — orchestrator for the per-record sync engine.
 *
 * Phase 2 scope: `pushOnce()` — drain the local `sync_queue` up to the
 *                cloud, one batch per invocation.
 * Phase 3 scope: `pullOnce()` — pull the delta of each entity type down
 *                from the cloud into SQLite, running the
 *                ConflictResolver whenever a pending local write races
 *                the incoming record. `pushOnce` also routes OCC
 *                conflicts through the same resolver so a concurrent
 *                write on another device converges cleanly.
 *
 * Both operations are pure primitives — no timers, no lifecycle wiring,
 * no event listeners. The Phase 4 SyncScheduler will wrap them with
 * debouncing, app-state hooks, and retry-cadence logic.
 *
 * Concurrency contract:
 *   - A single in-flight `pushOnce` per process, guarded by `pushInFlight`.
 *   - A single in-flight `pullOnce` per process, guarded by `pullInFlight`.
 *   - Push and pull may run concurrently — they own disjoint mutations
 *     (push touches queue + business rows' sync_status; pull touches
 *     business rows via INSERT OR REPLACE + advances cursor).
 *   - `QueueManager.claimNext` uses SQLite transactions to atomically
 *     flip rows to `processing`, so two `pushOnce` calls couldn't push
 *     the same row twice even if the in-flight guard failed.
 *
 * Failure model:
 *   - The API adapter never throws; every op returns a typed result.
 *   - Per-op outcomes are dispatched to the QueueManager and the local
 *     row's `sync_status` is updated accordingly.
 *   - Whole-batch throws (e.g. auth-token refresh failure) bubble up so
 *     the caller sees it; queue rows stuck in `processing` are cleaned
 *     up by `queueManager.resetOrphanedProcessing()` on next `start()`.
 */
export class SyncService {
  private pushInFlight = false;
  private pullInFlight = false;

  constructor(private readonly api: SyncApi = new FirestoreSyncApi()) {}

  /**
   * Run one push cycle for `salonId`. Reads a batch of ready queue rows,
   * groups by entity type, materializes payloads from the live SQLite
   * state, delegates to `SyncApi.pushBatch`, then reconciles per-op
   * outcomes back into the queue and the business rows.
   *
   * Returns an empty summary (all zeros, `hasMore=false`) when:
   *   - The queue has no ready work.
   *   - Another `pushOnce` is already in flight.
   *
   * `hasMore=true` in the summary signals the scheduler to call again
   * immediately without waiting for the next trigger — used to drain
   * large backlogs on network reconnect.
   */
  async pushOnce(salonId: string): Promise<PushSummary> {
    if (this.pushInFlight) return emptyPushSummary();
    this.pushInFlight = true;
    const startedAt = Date.now();

    try {
      const claimed = queueManager.claimNext(salonId, DEFAULT_BATCH_SIZE);
      if (claimed.length === 0) {
        return { ...emptyPushSummary(), durationMs: Date.now() - startedAt };
      }

      eventBus.emit("sync:push-started", { batchSize: claimed.length });

      const groups = groupByEntity(claimed);
      let pushed = 0;
      let conflicts = 0;
      let errors = 0;

      for (const [entityType, rows] of groups) {
        // Build ops from live row state. Rows that vanished between
        // enqueue and push (e.g. hard-delete via a future admin tool)
        // yield null and are silently dropped — their queue entry is
        // deleted so we don't retry forever on a missing row.
        const ops: SyncOp[] = [];
        const rowsForOp: SyncQueueRow[] = [];
        for (const row of rows) {
          const op = buildOp(entityType, row);
          if (op === null) {
            queueManager.markSuccess(row.id);
            continue;
          }
          ops.push(op);
          rowsForOp.push(row);
        }
        if (ops.length === 0) continue;

        const results = await this.api.pushBatch({
          entityType,
          ops,
          salonId
        });

        // Zip results with queue rows and reconcile per outcome.
        for (let i = 0; i < results.length; i++) {
          const result = results[i];
          const queueRow = rowsForOp[i];
          const bucket = this.reconcile(entityType, queueRow, result);
          if (bucket === "applied") pushed++;
          else if (bucket === "conflict") conflicts++;
          else errors++;
        }
      }

      const summary: PushSummary = {
        conflicts,
        durationMs: Date.now() - startedAt,
        errors,
        hasMore: queueManager.hasReadyWork(salonId),
        pushed
      };
      eventBus.emit("sync:push-completed", summary);
      return summary;
    } finally {
      this.pushInFlight = false;
    }
  }

  /**
   * Run one full pull cycle for `salonId`. Iterates every entity type in
   * `ENTITY_PULL_ORDER` (parents before children), fetching pages until
   * the cursor is exhausted for each. Each page is applied inside a
   * single SQLite transaction so a partial pull cannot leave the DB
   * inconsistent.
   *
   * When a pending local write exists for an incoming record's id, the
   * `ConflictResolver` runs and either:
   *   - keeps local (bumps local `sync_version` to remote's version and
   *     re-queues the push), OR
   *   - accepts remote (overwrites local + drops queue entry).
   *
   * Rows with no pending local write are upserted wholesale.
   *
   * A per-entity error (e.g. permission-denied on one collection) is
   * logged and the loop continues with the next entity so a single
   * misconfigured rule doesn't block the whole pull.
   */
  async pullOnce(salonId: string): Promise<PullSummary> {
    if (this.pullInFlight) return emptyPullSummary();
    this.pullInFlight = true;
    const startedAt = Date.now();
    const byEntity: Partial<Record<SyncEntityType, number>> = {};
    let totalApplied = 0;
    let totalConflicts = 0;
    let errors = 0;

    try {
      eventBus.emit("sync:pull-started", {
        entityCount: ENTITY_PULL_ORDER.length
      });

      for (const entityType of ENTITY_PULL_ORDER) {
        try {
          const result = await this.pullEntity(salonId, entityType);
          byEntity[entityType] = result.applied + result.conflicts;
          totalApplied += result.applied;
          totalConflicts += result.conflicts;
        } catch (err) {
          errors++;
          // eslint-disable-next-line no-console
          console.warn(
            `[sync] pull failed for ${entityType}: ${
              err instanceof Error ? err.message : String(err)
            }`
          );
        }
      }

      syncStateStore.markFullSyncCompleted();

      const summary: PullSummary = {
        applied: totalApplied,
        byEntity,
        conflicts: totalConflicts,
        durationMs: Date.now() - startedAt,
        errors
      };
      eventBus.emit("sync:pull-completed", summary);
      return summary;
    } finally {
      this.pullInFlight = false;
    }
  }

  /**
   * Pull every page for a single entity type until the cursor is
   * exhausted. Returns per-entity counts for the aggregate `PullSummary`.
   */
  private async pullEntity(
    salonId: string,
    entityType: SyncEntityType
  ): Promise<{ applied: number; conflicts: number }> {
    let applied = 0;
    let conflicts = 0;
    let cursor = syncStateStore.getCursor(entityType);
    const pageSize = 200;

    while (true) {
      const page = await this.api.pullChanges({
        cursor,
        entityType,
        pageSize,
        salonId
      });
      if (page.records.length === 0) {
        // Even an empty page can advance the cursor if the caller
        // wants to mark a specific point in time — but the Firestore
        // adapter returns the input cursor unchanged in that case, so
        // no work needed here.
        break;
      }

      // Apply the entire page in one SQLite transaction so a partial
      // failure rolls back cleanly.
      runInTransaction(() => {
        for (const remote of page.records) {
          const result = this.applyRemote(salonId, entityType, remote);
          if (result === "applied") applied++;
          else if (result === "conflict") conflicts++;
        }
      });

      if (page.nextCursor) {
        syncStateStore.setCursor(entityType, page.nextCursor);
        cursor = page.nextCursor;
      }

      if (!page.hasMore) break;
    }

    syncStateStore.markPullCompleted(entityType);
    return { applied, conflicts };
  }

  /**
   * Reconcile a single incoming remote record with local state. Returns
   * the outcome bucket so the pull-page loop can tally the summary.
   *
   * Runs the ConflictResolver iff a pending queue row exists for this
   * `(entity_type, entity_id)` — otherwise applies the remote wholesale.
   */
  private applyRemote(
    salonId: string,
    entityType: SyncEntityType,
    remote: RemoteRecord
  ): "applied" | "conflict" {
    const pending = queueManager.findByEntity(
      salonId,
      entityType,
      remote.entityId
    );

    if (!pending) {
      applyRemoteRow(entityType, remote);
      return "applied";
    }

    // A local write is queued for this record — run the resolver.
    const localRow = database.getFirstSync<Record<string, unknown>>(
      `SELECT * FROM ${entityType} WHERE id = ?`,
      [remote.entityId]
    );
    if (!localRow) {
      // Local row vanished (very rare — hard-delete after enqueue). The
      // queue row is orphaned; accept remote and drop the queue entry.
      applyRemoteRow(entityType, remote);
      queueManager.markSuccess(pending.id);
      return "applied";
    }

    const context = buildConflictContext(
      entityType,
      remote.entityId,
      localRow,
      remote
    );
    const decision = conflictResolver.resolve(context);
    logConflict({
      context,
      decision,
      localPayload: localRow,
      remotePayload: remote.payload
    });
    eventBus.emit("sync:conflict", {
      entityId: remote.entityId,
      entityType,
      reason: decision.reason,
      winner: decision.winner
    });

    if (decision.winner === "remote") {
      applyRemoteRow(entityType, remote);
      queueManager.markSuccess(pending.id);
      return "conflict";
    }

    // Local wins — bump local `sync_version` to the remote version so the
    // next push OCC succeeds, then re-queue.
    database.runSync(
      `UPDATE ${entityType} SET sync_version = ? WHERE id = ?`,
      [remote.version, remote.entityId]
    );
    queueManager.reopenWithFreshBase(pending.id);
    return "conflict";
  }

  /**
   * Apply a single `PushResult` back into local state. Returns the
   * outcome bucket so `pushOnce` can tally the summary.
   */
  private reconcile(
    entityType: SyncEntityType,
    queueRow: SyncQueueRow,
    result: PushResult
  ): "applied" | "conflict" | "error" {
    if (result.status === "applied") {
      stampSynced(entityType, queueRow.entity_id, result.newVersion);
      queueManager.markSuccess(queueRow.id);
      return "applied";
    }
    if (result.status === "conflict") {
      return this.handlePushConflict(entityType, queueRow, result);
    }
    // status === 'error'
    stampFailed(entityType, queueRow.entity_id);
    queueManager.markFailure(queueRow.id, {
      code: result.code,
      message: result.message,
      transient: result.transient
    });
    return "error";
  }

  /**
   * OCC conflict during push — the server rejected our write because
   * another device (or this device on a previous unsynced run) updated
   * the doc first. Route through the ConflictResolver the same way
   * pull-side conflicts are handled.
   *
   * Special case: `remoteRecord === null` means the server hard-deleted
   * the doc. Since the codebase never hard-deletes, this indicates
   * either an admin console action or a future feature. Treat as
   * remote-wins (accept the delete) and drop the queue entry.
   */
  private handlePushConflict(
    entityType: SyncEntityType,
    queueRow: SyncQueueRow,
    result: Extract<PushResult, { status: "conflict" }>
  ): "conflict" {
    if (result.remoteRecord === null) {
      // Remote doc hard-deleted — cannot resolve without payload. Accept
      // the delete by hard-deleting the local row and clearing the queue.
      database.runSync(`DELETE FROM ${entityType} WHERE id = ?`, [
        queueRow.entity_id
      ]);
      queueManager.markSuccess(queueRow.id);
      return "conflict";
    }

    const localRow = database.getFirstSync<Record<string, unknown>>(
      `SELECT * FROM ${entityType} WHERE id = ?`,
      [queueRow.entity_id]
    );
    if (!localRow) {
      // Local row vanished between enqueue and push — accept remote.
      applyRemoteRow(entityType, result.remoteRecord);
      queueManager.markSuccess(queueRow.id);
      return "conflict";
    }

    const context = buildConflictContext(
      entityType,
      queueRow.entity_id,
      localRow,
      result.remoteRecord
    );
    const decision = conflictResolver.resolve(context);
    logConflict({
      context,
      decision,
      localPayload: localRow,
      remotePayload: result.remoteRecord.payload
    });
    eventBus.emit("sync:conflict", {
      entityId: queueRow.entity_id,
      entityType,
      reason: decision.reason,
      winner: decision.winner
    });

    if (decision.winner === "remote") {
      applyRemoteRow(entityType, result.remoteRecord);
      queueManager.markSuccess(queueRow.id);
      return "conflict";
    }

    // Local wins — bump baseline + re-queue for immediate next push.
    database.runSync(
      `UPDATE ${entityType} SET sync_version = ? WHERE id = ?`,
      [result.remoteRecord.version, queueRow.entity_id]
    );
    queueManager.reopenWithFreshBase(queueRow.id);
    return "conflict";
  }
}

/**
 * Build a `ConflictContext` from a live SQLite row and the incoming
 * remote record. Extracts just the fields the resolver cares about so
 * the resolver isn't coupled to the full row shape.
 */
function buildConflictContext(
  entityType: SyncEntityType,
  entityId: string,
  localRow: Record<string, unknown>,
  remote: RemoteRecord
): ConflictContext {
  const local: LocalRowState = {
    deleted_at: nullableString(localRow.deleted_at),
    sync_version: numberOr(localRow.sync_version, 0),
    updated_at: String(localRow.updated_at ?? ""),
    updated_by: nullableString(localRow.updated_by)
  };
  const remoteState: RemoteRowState = {
    authoredAt: remote.authoredAt,
    authoredBy: remote.authoredBy,
    tombstone: remote.tombstone,
    version: remote.version
  };
  return { entityId, entityType, local, remote: remoteState };
}

/**
 * Build a `SyncOp` from the live business row + queue row. Returns null
 * when the underlying row has been removed since it was enqueued (rare,
 * but must be handled — the caller drops the queue entry silently).
 */
function buildOp(
  entityType: SyncEntityType,
  queueRow: SyncQueueRow
): SyncOp | null {
  const row = database.getFirstSync<Record<string, unknown>>(
    `SELECT * FROM ${entityType} WHERE id = ?`,
    [queueRow.entity_id]
  );
  if (!row) return null;

  const payload = serializeRow(entityType, row);
  const baseVersion = numberOr(row.sync_version, 0);

  return {
    authoredAt: String(row.updated_at ?? ""),
    authoredBy: nullableString(row.updated_by),
    baseVersion,
    createdBy: nullableString(row.created_by),
    entityId: queueRow.entity_id,
    operation: queueRow.operation,
    payload,
    tombstone: row.deleted_at != null
  };
}

/**
 * Stamp a business row as `synced` and set its new `sync_version` +
 * `last_synced_at`. Runs OUTSIDE the caller's transaction — a stamped
 * update failing does not require rolling back a successful cloud write.
 */
function stampSynced(
  entityType: SyncEntityType,
  entityId: string,
  newVersion: number
): void {
  const now = getUtcTimestamp();
  database.runSync(
    `UPDATE ${entityType}
     SET sync_status    = 'synced',
         sync_version   = ?,
         last_synced_at = ?
     WHERE id = ?`,
    [newVersion, now, entityId]
  );
}

function stampFailed(entityType: SyncEntityType, entityId: string): void {
  database.runSync(
    `UPDATE ${entityType} SET sync_status = 'failed' WHERE id = ?`,
    [entityId]
  );
}

function groupByEntity(
  rows: SyncQueueRow[]
): Map<SyncEntityType, SyncQueueRow[]> {
  const out = new Map<SyncEntityType, SyncQueueRow[]>();
  for (const row of rows) {
    const list = out.get(row.entity_type) ?? [];
    list.push(row);
    out.set(row.entity_type, list);
  }
  return out;
}

function emptyPushSummary(): PushSummary {
  return {
    conflicts: 0,
    durationMs: 0,
    errors: 0,
    hasMore: false,
    pushed: 0
  };
}

function emptyPullSummary(): PullSummary {
  return {
    applied: 0,
    byEntity: {},
    conflicts: 0,
    durationMs: 0,
    errors: 0
  };
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

/** Singleton — one SyncService per process. */
export const syncService = new SyncService();
