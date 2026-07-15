import firestore, {
  FirebaseFirestoreTypes
} from "@react-native-firebase/firestore";

import type {
  PullPage,
  PushResult,
  RemoteRecord,
  SyncApi,
  SyncOp
} from "@/sync/sync-api";
import type { SyncCursor } from "@/sync/sync-state-store";
import type { SyncEntityType } from "@/sync/types";

/**
 * Firestore-backed `SyncApi` implementation.
 *
 * Document layout:
 *
 *   /salons/{sid}/entities/{entityType}/records/{docId}
 *
 * Fields on every doc:
 *   - <flattened business columns...>
 *   - items[]  (only for income_transactions — embedded child rows)
 *   - _sync: {
 *       version           : int         — monotonic per-doc revision.
 *       authoredBy        : string|null — install_id that wrote this state.
 *       createdBy         : string|null — install_id that first created row.
 *       authoredAt        : string      — client updated_at (ISO UTC).
 *       tombstone         : bool        — deleted_at IS NOT NULL.
 *       serverUpdatedAt   : Timestamp   — Firestore serverTimestamp, used
 *                                          as the pull cursor.
 *     }
 *
 * Each op runs in its own Firestore transaction so OCC checks are atomic
 * against concurrent writers — this is what future-proofs the design for
 * multi-writer even though today's app only writes from one device.
 * Batches are fanned out with `Promise.all`; Firestore's SDK internally
 * multiplexes on a single HTTP/2 connection so the round-trip cost is
 * amortized.
 *
 * Error classification is centralized in `classifyFirestoreError()` so
 * the QueueManager's retry policy can trust the `transient` flag.
 */

const SALONS_COLLECTION = "salons";
const ENTITIES_SUBCOLLECTION = "entities";
const RECORDS_SUBCOLLECTION = "records";

export class FirestoreSyncApi implements SyncApi {
  async pushBatch(params: {
    salonId: string;
    entityType: SyncEntityType;
    ops: SyncOp[];
  }): Promise<PushResult[]> {
    const { salonId, entityType, ops } = params;
    if (ops.length === 0) return [];

    return Promise.all(
      ops.map((op) => this.pushOne(salonId, entityType, op))
    );
  }

  /**
   * Fetch the next page of remote changes for `entityType` newer than
   * `cursor`. Ordered ascending by `_sync.serverUpdatedAt` so the caller
   * can advance the cursor to the last record's timestamp and resume.
   *
   * Query shape:
   *   `.where('_sync.serverUpdatedAt', '>', cursor)`  — omitted on the
   *      very first call when `cursor` is null.
   *   `.orderBy('_sync.serverUpdatedAt', 'asc')`
   *   `.limit(pageSize)`
   *
   * `hasMore` is true when the page filled to `pageSize` — the classic
   * "there might be more" heuristic. False-positives are cheap (one
   * extra empty page next call).
   */
  async pullChanges(params: {
    salonId: string;
    entityType: SyncEntityType;
    cursor: SyncCursor | null;
    pageSize: number;
  }): Promise<PullPage> {
    const { salonId, entityType, cursor, pageSize } = params;

    const baseRef = firestore()
      .collection(SALONS_COLLECTION)
      .doc(salonId)
      .collection(ENTITIES_SUBCOLLECTION)
      .doc(entityType)
      .collection(RECORDS_SUBCOLLECTION);

    let query: FirebaseFirestoreTypes.Query = baseRef
      .orderBy("_sync.serverUpdatedAt", "asc")
      .limit(pageSize);
    if (cursor) {
      query = query.where(
        "_sync.serverUpdatedAt",
        ">",
        new firestore.Timestamp(cursor.seconds, cursor.nanoseconds)
      );
    }

    const snap = await query.get();
    const records: RemoteRecord[] = [];
    for (const doc of snap.docs) {
      const rec = docToRemoteRecord(doc.id, doc.data());
      // Skip docs that lack a server timestamp — they were written by a
      // pre-sync-engine legacy path and would confuse cursor advancement.
      if (!rec.serverUpdatedAt) continue;
      records.push(rec);
    }

    const nextCursor =
      records.length > 0
        ? records[records.length - 1].serverUpdatedAt
        : cursor;

    return {
      hasMore: records.length === pageSize,
      nextCursor,
      records
    };
  }

  private async pushOne(
    salonId: string,
    entityType: SyncEntityType,
    op: SyncOp
  ): Promise<PushResult> {
    const ref = firestore()
      .collection(SALONS_COLLECTION)
      .doc(salonId)
      .collection(ENTITIES_SUBCOLLECTION)
      .doc(entityType)
      .collection(RECORDS_SUBCOLLECTION)
      .doc(op.entityId);

    try {
      const outcome = await firestore().runTransaction(async (tx) =>
        this.runOccWrite(tx, ref, op)
      );

      if (outcome.kind === "conflict") {
        return {
          entityId: op.entityId,
          remoteRecord: outcome.remoteRecord,
          serverVersion: outcome.serverVersion,
          status: "conflict"
        };
      }
      return {
        entityId: op.entityId,
        newVersion: outcome.newVersion,
        status: "applied"
      };
    } catch (err) {
      const { code, transient, message } = classifyFirestoreError(err);
      return {
        code,
        entityId: op.entityId,
        message,
        status: "error",
        transient
      };
    }
  }

  /**
   * Runs inside a Firestore transaction. Reads the current doc, validates
   * `baseVersion`, and either writes the new state (with an incremented
   * `_sync.version` and a fresh `serverTimestamp`) or returns a conflict.
   *
   * On conflict the current remote doc is materialized into a
   * `RemoteRecord` so the caller's ConflictResolver can decide without a
   * second round-trip.
   *
   * OCC rules:
   *   - Doc exists AND `_sync.version === baseVersion` → apply.
   *   - Doc exists AND `_sync.version !== baseVersion` → conflict (with remote).
   *   - Doc missing AND `baseVersion === 0`            → apply (first push).
   *   - Doc missing AND `baseVersion  >  0`            → conflict (remote=null;
   *                                                     hard-deleted server-side).
   */
  private async runOccWrite(
    tx: FirebaseFirestoreTypes.Transaction,
    ref: FirebaseFirestoreTypes.DocumentReference,
    op: SyncOp
  ): Promise<
    | { kind: "applied"; newVersion: number }
    | {
        kind: "conflict";
        serverVersion: number;
        remoteRecord: RemoteRecord | null;
      }
  > {
    const snap = await tx.get(ref);
    const exists = snap.exists();

    if (exists) {
      const data = snap.data() ?? {};
      const remoteVersion = readVersion(data);
      if (remoteVersion !== op.baseVersion) {
        return {
          kind: "conflict",
          remoteRecord: docToRemoteRecord(op.entityId, data),
          serverVersion: remoteVersion
        };
      }
    } else if (op.baseVersion !== 0) {
      // Server has no doc but the client thinks it's on a non-zero rev —
      // the doc was hard-deleted server-side. Surface as conflict; the
      // resolver decides to recreate (local wins) or drop (remote wins).
      return {
        kind: "conflict",
        remoteRecord: null,
        serverVersion: 0
      };
    }

    const newVersion = op.baseVersion + 1;

    if (op.operation === "delete") {
      // Reserved path — the current codebase never enqueues 'delete'
      // (soft-deletes ride as `upsert` with tombstone=true). Kept for
      // symmetry so a future feature can hard-delete without a new API.
      tx.delete(ref);
      return { kind: "applied", newVersion };
    }

    tx.set(ref, {
      ...op.payload,
      _sync: {
        authoredAt: op.authoredAt,
        authoredBy: op.authoredBy,
        createdBy: op.createdBy,
        serverUpdatedAt: firestore.FieldValue.serverTimestamp(),
        tombstone: op.tombstone,
        version: newVersion
      }
    });
    return { kind: "applied", newVersion };
  }
}

/**
 * Read `_sync.version` from a doc payload, defaulting to 0 for legacy docs
 * written before the sync engine (e.g. hand-created records in the
 * Firebase console during dev). Never throws.
 */
function readVersion(data: FirebaseFirestoreTypes.DocumentData): number {
  const sync = data._sync as { version?: unknown } | undefined;
  const v = sync?.version;
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

/**
 * Convert a raw Firestore doc into a `RemoteRecord`. Extracts `_sync`
 * metadata and the business payload separately so callers don't need to
 * understand the Firestore doc shape.
 *
 * Handles two edge cases quietly:
 *   - `_sync.serverUpdatedAt` may be a Firestore `Timestamp` or `null`
 *     (during the pending window between local write reflection and
 *     server ack). Null propagates so the pull cursor is not advanced
 *     past a not-yet-acked doc.
 *   - Legacy docs without `_sync` are treated as version 0, tombstone=false.
 */
function docToRemoteRecord(
  entityId: string,
  data: FirebaseFirestoreTypes.DocumentData
): RemoteRecord {
  const sync = (data._sync ?? {}) as {
    version?: unknown;
    authoredAt?: unknown;
    authoredBy?: unknown;
    createdBy?: unknown;
    tombstone?: unknown;
    serverUpdatedAt?: unknown;
  };

  const payload: Record<string, unknown> = { ...data };
  delete (payload as { _sync?: unknown })._sync;

  return {
    authoredAt: typeof sync.authoredAt === "string" ? sync.authoredAt : "",
    authoredBy: typeof sync.authoredBy === "string" ? sync.authoredBy : null,
    createdBy: typeof sync.createdBy === "string" ? sync.createdBy : null,
    entityId,
    payload,
    serverUpdatedAt: readTimestamp(sync.serverUpdatedAt),
    tombstone: sync.tombstone === true,
    version:
      typeof sync.version === "number" && Number.isFinite(sync.version)
        ? sync.version
        : 0
  };
}

/**
 * Extract seconds/nanoseconds from a Firestore Timestamp-like value. Also
 * accepts the plain object shape (`{seconds, nanoseconds}`) that some
 * SDK versions return for cached docs. Returns null when the value is
 * missing or not shaped like a timestamp.
 */
function readTimestamp(value: unknown): SyncCursor | null {
  if (!value || typeof value !== "object") return null;
  const v = value as { seconds?: unknown; nanoseconds?: unknown };
  if (
    typeof v.seconds === "number" &&
    typeof v.nanoseconds === "number" &&
    Number.isFinite(v.seconds) &&
    Number.isFinite(v.nanoseconds)
  ) {
    return { nanoseconds: v.nanoseconds, seconds: v.seconds };
  }
  return null;
}

/**
 * Map any thrown Firestore error to the shape the QueueManager expects.
 *
 * Transient codes trigger exponential backoff retry. Fatal codes (auth,
 * permission, malformed) short-circuit to the dead-letter queue so the
 * user can see them in the Sync Status screen (Phase 5).
 */
function classifyFirestoreError(err: unknown): {
  code: string;
  transient: boolean;
  message: string;
} {
  const message = err instanceof Error ? err.message : String(err);
  const raw = (err as { code?: unknown })?.code;
  const code = typeof raw === "string" ? raw : "unknown";

  // Firestore error codes are namespaced `firestore/xxx` on RN Firebase
  // and plain xxx on the JS SDK. Normalize.
  const bare = code.startsWith("firestore/")
    ? code.slice("firestore/".length)
    : code;

  const transient = TRANSIENT_CODES.has(bare);
  return { code: bare, message, transient };
}

/**
 * Firestore error codes that are safe to retry with backoff. Everything
 * else is fatal for this operation (though possibly resolvable later —
 * e.g. re-auth after `unauthenticated`, which the caller handles at a
 * higher level via the AuthProvider).
 */
const TRANSIENT_CODES = new Set<string>([
  "unavailable",
  "deadline-exceeded",
  "resource-exhausted",
  "internal",
  "aborted",
  "cancelled",
  "network-request-failed"
]);
