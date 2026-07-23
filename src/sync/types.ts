/**
 * Shared type surface for the per-record sync engine (Phase 1).
 *
 * Kept in a single file so every layer (change tracker, queue manager,
 * conflict resolver, Firestore adapter) references the same union
 * definitions and no drift is possible.
 *
 * Later phases (2+) will add push/pull-related types (`SyncOpRow`,
 * `PushResult`, `PullPage`, `ConflictContext`) alongside these.
 */

/**
 * Business tables that participate in per-record sync. `income_transaction_items`
 * is intentionally omitted: items ride as an embedded array on the parent
 * `income_transactions` push payload, so they never need their own queue
 * entries. Their local `sync_status`/`sync_version` columns exist for
 * schema consistency only.
 */
export type SyncEntityType =
  | "salons"
  | "services"
  | "service_categories"
  | "employees"
  | "commission_rules"
  | "income_transactions"
  | "expense_categories"
  | "expenses"
  | "customers"
  | "employee_advances"
  | "salon_subscriptions"
  | "subscription_payments"
  | "referral_codes"
  | "referrals";

/**
 * Per-row sync lifecycle state stored on every business row.
 *   - `pending`  : local write not yet pushed. Set by ChangeTracker.
 *   - `syncing`  : queue processor has picked the row up (Phase 2).
 *   - `synced`   : cloud acked the current local state (Phase 2/3).
 *   - `failed`   : push exceeded retry budget (Phase 2).
 *   - `conflict` : concurrent write detected; resolver deferred (Phase 3).
 */
export type SyncStatus =
  | "pending"
  | "syncing"
  | "synced"
  | "failed"
  | "conflict";

/**
 * The operation the queue row represents.
 *   - `upsert` : create or update the cloud doc from the current local row.
 *                Soft-deletes are `upsert` — the row still exists in SQLite
 *                with `deleted_at` set, which the cloud interprets as a
 *                tombstone.
 *   - `delete` : hard-delete the cloud doc. Reserved for future use; the
 *                current codebase only ever soft-deletes.
 */
export type SyncOperation = "upsert" | "delete";

/**
 * Per-queue-row lifecycle state (distinct from per-business-row `SyncStatus`).
 *   - `queued`     : waiting for the next push cycle.
 *   - `processing` : currently being pushed (Phase 2).
 *   - `failed`     : last attempt failed but retries remain.
 *   - `dead`       : exceeded retry budget; awaits manual action.
 */
export type SyncQueueStatus = "queued" | "processing" | "failed" | "dead";

/**
 * Columns added to every business table by migration 016. Not folded into
 * `SharedColumns` on purpose — feature code that doesn't care about sync
 * doesn't need to see these fields.
 */
export type SyncColumns = {
  sync_status: SyncStatus;
  sync_version: number;
  last_synced_at: string | null;
  updated_by: string | null;
  created_by: string | null;
};

/** Shape of a `sync_queue` row. */
export type SyncQueueRow = {
  id: string;
  salon_id: string;
  entity_type: SyncEntityType;
  entity_id: string;
  operation: SyncOperation;
  status: SyncQueueStatus;
  attempt_count: number;
  last_attempt_at: string | null;
  next_attempt_at: string | null;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

/** Shape of a `conflict_log` row. */
export type ConflictLogRow = {
  id: string;
  salon_id: string;
  entity_type: SyncEntityType;
  entity_id: string;
  local_payload: string | null;
  remote_payload: string | null;
  resolution: "local-won" | "remote-won" | "merged";
  reason: string | null;
  created_at: string;
};
