import { database } from "@/database/sqlite-client";

import type { SyncEntityType } from "@/sync/types";

/**
 * Row → Firestore payload serialization.
 *
 * Two responsibilities:
 *   1. Strip local-only sync bookkeeping columns (`sync_status`,
 *      `sync_version`, `last_synced_at`, `updated_by`, `created_by`) —
 *      those live under the Firestore doc's `_sync` metadata written by
 *      the API adapter, not on the business payload.
 *   2. For aggregate roots (currently only `income_transactions`), embed
 *      child rows so the parent doc carries the full aggregate. The
 *      sync engine treats items as embedded children — they are never
 *      pushed as independent Firestore docs.
 *
 * Uses plain `Record<string, unknown>` for payloads because each entity
 * has a different column shape. Typing is preserved at the repository
 * layer; the sync engine is intentionally schema-agnostic so a new
 * business table can join the sync engine without touching this file
 * (add its name to `SyncEntityType` and it just works).
 */

/** Columns stripped from every serialized payload. */
const LOCAL_SYNC_COLUMNS = [
  "sync_status",
  "sync_version",
  "last_synced_at",
  "updated_by",
  "created_by"
] as const;

/**
 * Serialize a live business row for upload. Reads embedded children where
 * needed (see `income_transactions`). Never mutates the input row.
 */
export function serializeRow(
  entityType: SyncEntityType,
  row: Record<string, unknown>
): Record<string, unknown> {
  const base = stripLocal(row);

  if (entityType === "income_transactions") {
    const items = database
      .getAllSync<Record<string, unknown>>(
        `SELECT * FROM income_transaction_items
         WHERE transaction_id = ?
         ORDER BY created_at ASC`,
        [String(row.id)]
      )
      .map(stripLocal);
    return { ...base, items };
  }

  return base;
}

function stripLocal(
  row: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...row };
  for (const col of LOCAL_SYNC_COLUMNS) delete out[col];
  return out;
}
