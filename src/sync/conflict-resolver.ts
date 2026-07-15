import { newId } from "@/domain/id";
import { database } from "@/database/sqlite-client";
import { getUtcTimestamp } from "@/domain/dates";

import type { SyncEntityType } from "@/sync/types";

/**
 * ConflictResolver — decides who wins when a local write and a remote
 * write for the same row race.
 *
 * Default policy: **last-write-wins by client-authored `updated_at`**,
 * with two documented tweaks:
 *   1. **Delete beats update.** A soft-delete on either side always wins
 *      over a live update. Rationale: for a salon business ("I closed
 *      that customer's account"), an intentional delete is stronger
 *      signal than an incidental edit.
 *   2. **Tie-break on `updated_by`.** When two writes carry the exact
 *      same `updated_at` (rare — same-millisecond edit on two devices),
 *      the higher lexicographic `install_id` wins. Deterministic across
 *      devices without needing a coordinator.
 *
 * Every resolution is recorded to `conflict_log` for support/audit. The
 * log is local-only, never uploaded, and Phase 5 will cap it at 500
 * rows.
 *
 * Extension point: `resolve()` is invoked with the full `ConflictContext`
 * so a per-entity strategy table can be layered in later (e.g.
 * `income_transactions` might prefer update-beats-delete because
 * accidentally deleting a bill is worse than accidentally editing one).
 * Not implemented in Phase 3; the hook is here.
 */

/** Local side of a conflict, materialized from SQLite. */
export type LocalRowState = {
  /** Client-authored ISO UTC — the source of truth for LWW comparisons. */
  updated_at: string;
  /** `install_id` of the device that authored the current local state. */
  updated_by: string | null;
  /** OCC baseline — the sync_version currently on the local row. */
  sync_version: number;
  /** ISO UTC when this row was soft-deleted locally, or null. */
  deleted_at: string | null;
};

/** Remote side of a conflict, materialized from a Firestore doc. */
export type RemoteRowState = {
  /** Server-side monotonic version. */
  version: number;
  /** Client-authored ISO UTC from the winning device. */
  authoredAt: string;
  /** `install_id` of the device that authored the remote state. */
  authoredBy: string | null;
  /** True when the remote doc represents a tombstone. */
  tombstone: boolean;
};

export type ConflictContext = {
  entityType: SyncEntityType;
  entityId: string;
  local: LocalRowState;
  remote: RemoteRowState;
};

/** Outcome of a resolver decision. */
export type ConflictDecision = {
  /**
   * `local`  — keep local row; re-queue the push with a fresh
   *            `baseVersion = remote.version`.
   * `remote` — apply remote row; drop the pending queue entry.
   */
  winner: "local" | "remote";
  /** Short machine-readable reason, persisted to `conflict_log`. */
  reason:
    | "delete-beats-update"
    | "lww-local-newer"
    | "lww-remote-newer"
    | "lww-tie-break-local"
    | "lww-tie-break-remote";
};

export class ConflictResolver {
  /**
   * Apply the default LWW policy. See file-level docstring for the
   * decision matrix.
   */
  resolve(context: ConflictContext): ConflictDecision {
    const { local, remote } = context;
    const localDeleted = local.deleted_at !== null;

    // Rule 1 — delete beats update.
    if (remote.tombstone && !localDeleted) {
      return { reason: "delete-beats-update", winner: "remote" };
    }
    if (localDeleted && !remote.tombstone) {
      return { reason: "delete-beats-update", winner: "local" };
    }

    // Rule 2 — LWW by client-authored timestamp.
    if (local.updated_at > remote.authoredAt) {
      return { reason: "lww-local-newer", winner: "local" };
    }
    if (remote.authoredAt > local.updated_at) {
      return { reason: "lww-remote-newer", winner: "remote" };
    }

    // Rule 3 — deterministic tie-break on updated_by.
    const localBy = local.updated_by ?? "";
    const remoteBy = remote.authoredBy ?? "";
    return localBy > remoteBy
      ? { reason: "lww-tie-break-local", winner: "local" }
      : { reason: "lww-tie-break-remote", winner: "remote" };
  }
}

/** Singleton — resolver is stateless. */
export const conflictResolver = new ConflictResolver();

/**
 * Persist a conflict decision to `conflict_log`. Never blocks the caller
 * — swallow any SQL error to keep the sync path resilient.
 */
export function logConflict(params: {
  context: ConflictContext;
  decision: ConflictDecision;
  localPayload: Record<string, unknown> | null;
  remotePayload: Record<string, unknown> | null;
}): void {
  const { context, decision, localPayload, remotePayload } = params;
  try {
    database.runSync(
      `INSERT INTO conflict_log
         (id, salon_id, entity_type, entity_id,
          local_payload, remote_payload,
          resolution, reason, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newId(),
        // salon_id lives on most business rows; fall back to '' if the
        // caller didn't have it handy (only 'salons' rows).
        String(localPayload?.salon_id ?? localPayload?.id ?? ""),
        context.entityType,
        context.entityId,
        localPayload ? JSON.stringify(localPayload) : null,
        remotePayload ? JSON.stringify(remotePayload) : null,
        decision.winner === "local" ? "local-won" : "remote-won",
        decision.reason,
        getUtcTimestamp()
      ]
    );
  } catch {
    // Diagnostic table failure must never break sync.
  }
}
