import type { SyncCursor } from "@/sync/sync-state-store";
import type { SyncEntityType, SyncOperation } from "@/sync/types";

/**
 * `SyncApi` — cloud-agnostic contract the per-record sync engine talks to.
 *
 * The Firestore implementation in `firestore-sync-api.ts` is the first
 * concrete provider. A future NestJS/HTTP backend can plug in by
 * implementing the same interface without any change to `SyncService`,
 * `QueueManager`, or repository code.
 *
 * Contract rules every implementation must uphold:
 *   - Each `pushBatch` operation is checked with OCC against `baseVersion`.
 *     A mismatch returns `conflict` (never silently overwrites).
 *   - `applied` results carry the new server version — the caller stamps
 *     it onto the local row so the next push uses the fresh baseline.
 *   - `conflict` results carry the current `RemoteRecord` so the
 *     ConflictResolver can decide without a second round-trip.
 *   - Errors are typed and classified `transient` so the caller can decide
 *     whether to retry (transient) or dead-letter (permanent).
 *   - Implementations MUST NOT throw from `pushBatch` or `pullChanges`;
 *     every failure is surfaced as a typed result. This keeps the
 *     orchestrator's control flow exhaustive.
 */
export interface SyncApi {
  /**
   * Push a batch of upsert/delete operations for a single entity type.
   * All ops in a batch share the same `entityType` so the implementation
   * can co-locate them in one collection.
   *
   * Batches should stay ≤ 500 ops to keep well inside Firestore's atomic
   * batch limit even though this API uses per-doc transactions rather
   * than a single batched write.
   */
  pushBatch(params: {
    salonId: string;
    entityType: SyncEntityType;
    ops: SyncOp[];
  }): Promise<PushResult[]>;

  /**
   * Fetch the next page of changes for `entityType` newer than `cursor`.
   * Pages are ordered ascending by server timestamp so the caller can
   * advance the cursor to the last record's timestamp and resume.
   *
   * Includes tombstones — records with `tombstone: true` and populated
   * `deleted_at`. The caller applies them as soft-deletes.
   */
  pullChanges(params: {
    salonId: string;
    entityType: SyncEntityType;
    cursor: SyncCursor | null;
    pageSize: number;
  }): Promise<PullPage>;
}

/**
 * A single record fetched from the cloud. Used both as the payload of a
 * successful `pullChanges` page and as the `remoteRecord` attached to a
 * `PushResult.conflict` outcome — the ConflictResolver treats both
 * uniformly.
 */
export type RemoteRecord = {
  /** Primary key — matches the local row's `id` and Firestore doc id. */
  entityId: string;
  /** Server-side monotonic version at the time of the read. */
  version: number;
  /** Client-authored `updated_at` from the winning device. */
  authoredAt: string;
  /** `install_id` of the device that authored the current cloud state. */
  authoredBy: string | null;
  /** `install_id` of the device that first created the record. */
  createdBy: string | null;
  /** True when the cloud doc represents a soft-delete. */
  tombstone: boolean;
  /** Full business payload — every business column, plus `items` when the entity is an aggregate root. */
  payload: Record<string, unknown>;
  /**
   * Firestore serverUpdatedAt — the caller uses this to advance the
   * pull cursor. Null for records that predate the sync engine (should
   * not happen in practice).
   */
  serverUpdatedAt: SyncCursor | null;
};

/** Result of a single `pullChanges` call. */
export type PullPage = {
  records: RemoteRecord[];
  /**
   * Cursor to feed into the next `pullChanges` call. Equals the
   * `serverUpdatedAt` of the last record when the page is non-empty; a
   * copy of the input cursor when the page is empty.
   */
  nextCursor: SyncCursor | null;
  /**
   * Hint from the implementation that more records are available past
   * `nextCursor`. Consumers should keep calling `pullChanges` until this
   * turns false. Equivalent to `records.length === pageSize` for the
   * Firestore adapter.
   */
  hasMore: boolean;
};

/**
 * One push operation. Built by `SyncService.buildOp` from the live row +
 * its matching queue row. The queue itself never stores this payload —
 * it is materialized fresh at push time so rapid successive edits collapse
 * into a single upload.
 */
export type SyncOp = {
  /** Primary key of the business row. Matches the Firestore doc id. */
  entityId: string;
  /**
   * `upsert` — write the payload as the new cloud state.
   * `delete` — hard-delete the cloud doc. Reserved; the codebase only
   *            soft-deletes today (soft-delete rides as `upsert` with
   *            `tombstone = true`).
   */
  operation: SyncOperation;
  /**
   * The local row's `sync_version` before this write. The server compares
   * it to the doc's stored version and rejects the op on mismatch.
   * `0` for rows that have never been pushed.
   */
  baseVersion: number;
  /** Serialized business row + optional embedded children (e.g. items). */
  payload: Record<string, unknown>;
  /** `install_id` of the device that authored the current local state. */
  authoredBy: string | null;
  /** `install_id` of the device that first created the row. */
  createdBy: string | null;
  /** Client-authored `updated_at` timestamp (ISO UTC). Used for LWW. */
  authoredAt: string;
  /** True when the row is soft-deleted (`deleted_at IS NOT NULL`). */
  tombstone: boolean;
};

/**
 * Per-op outcome returned from `pushBatch`, in the same order as the
 * input `ops` array.
 */
export type PushResult =
  | {
      entityId: string;
      status: "applied";
      /** New server version after the write. Stamped onto the local row. */
      newVersion: number;
    }
  | {
      entityId: string;
      status: "conflict";
      /** Server-side version at the time of the failed OCC check. */
      serverVersion: number;
      /**
       * Current cloud state for this record — fed into the
       * ConflictResolver so the decision can be made without a second
       * round-trip. `null` when the server doc no longer exists (remote
       * was hard-deleted while local held a stale rev).
       */
      remoteRecord: RemoteRecord | null;
    }
  | {
      entityId: string;
      status: "error";
      /** Short machine-readable code (`unavailable`, `permission-denied`, …). */
      code: string;
      /** Human-readable message; safe to log, unsafe to show to end users. */
      message: string;
      /**
       * Whether the caller should retry with backoff. `false` → dead-letter
       * (auth/permission failures, malformed payloads).
       */
      transient: boolean;
    };

/**
 * Aggregate outcome of a single `SyncService.pushOnce()` invocation.
 * Consumed by the Phase 4 scheduler for retry-backoff decisions and by
 * the Phase 5 Sync Status UI.
 */
export type PushSummary = {
  /** Number of ops that returned `applied`. */
  pushed: number;
  /** Number of ops that returned `conflict`. */
  conflicts: number;
  /** Number of ops that returned `error`. */
  errors: number;
  /** Whether the queue still has more rows waiting after this batch. */
  hasMore: boolean;
  /** Wall-clock milliseconds spent inside `pushOnce`. */
  durationMs: number;
};

/**
 * Aggregate outcome of a single `SyncService.pullOnce()` invocation.
 * Consumed by the Phase 4 scheduler and Phase 5 UI.
 */
export type PullSummary = {
  /** Total records pulled and applied wholesale (no local conflict). */
  applied: number;
  /** Total conflicts detected against pending local writes. */
  conflicts: number;
  /**
   * Per-entity count of records processed (applied + conflicts). Empty
   * entries are omitted for compactness in the Sync Status UI.
   */
  byEntity: Partial<Record<SyncEntityType, number>>;
  /** Number of entities whose pull page returned an error mid-cycle. */
  errors: number;
  /** Wall-clock milliseconds spent inside `pullOnce`. */
  durationMs: number;
};
