import { database } from "@/database/sqlite-client";
import { getUtcTimestamp } from "@/domain/dates";

import type { RemoteRecord } from "@/sync/sync-api";
import type { SyncEntityType } from "@/sync/types";

/**
 * Deserializer — writes a `RemoteRecord` back into SQLite.
 *
 * Two responsibilities:
 *   1. UPSERT the business row via `INSERT OR REPLACE`, filtered to the
 *      table's actual columns so a remote payload from a newer schema
 *      version (unknown fields) doesn't error out. Sync-metadata columns
 *      (`sync_status`, `sync_version`, `last_synced_at`, `updated_by`,
 *      `created_by`) are ALWAYS overwritten from the remote record so
 *      the row's local OCC baseline matches the cloud.
 *   2. For aggregate roots (currently only `income_transactions`),
 *      replace the child rows in one shot: `DELETE` all existing items
 *      for the transaction, then bulk-insert whatever came in the
 *      remote `items[]`.
 *
 * The caller is expected to invoke this from inside a `runInTransaction`
 * so a partial pull cannot leave the aggregate half-updated.
 */

/** Lazy cache of `PRAGMA table_info(t).name` per table. */
const columnsCache = new Map<string, Set<string>>();

/**
 * Apply a pulled `RemoteRecord` to the local DB. Overwrites the local row
 * — the caller is responsible for having already run the ConflictResolver
 * when a pending local write exists for the same entity.
 */
export function applyRemoteRow(
  entityType: SyncEntityType,
  remote: RemoteRecord
): void {
  const now = getUtcTimestamp();
  const cols = getTableColumns(entityType);

  const row: Record<string, unknown> = {};
  // Business columns — keep only those the local table knows about.
  for (const [key, value] of Object.entries(remote.payload)) {
    if (key === "items") continue; // Aggregate child, handled below.
    if (cols.has(key)) row[key] = value;
  }
  // Identity + sync metadata are authoritative from the remote record.
  row.id = remote.entityId;
  row.sync_status = "synced";
  row.sync_version = remote.version;
  row.last_synced_at = now;
  row.updated_by = remote.authoredBy;
  row.created_by = remote.createdBy;

  writeRow(entityType, row);

  // Aggregate children — currently only income_transactions carries `items`.
  if (entityType === "income_transactions") {
    const items = Array.isArray(remote.payload.items)
      ? (remote.payload.items as Array<Record<string, unknown>>)
      : [];
    replaceItems(remote.entityId, items, {
      authoredAt: remote.authoredAt,
      authoredBy: remote.authoredBy,
      createdBy: remote.createdBy,
      now,
      version: remote.version
    });
  }
}

/**
 * Wipe every item for a parent transaction and re-insert the fresh set.
 * `INSERT OR REPLACE` on the parent row cascades nothing (we don't use
 * FK), so items must be handled explicitly.
 */
function replaceItems(
  transactionId: string,
  items: Array<Record<string, unknown>>,
  meta: {
    version: number;
    authoredBy: string | null;
    createdBy: string | null;
    authoredAt: string;
    now: string;
  }
): void {
  database.runSync(
    `DELETE FROM income_transaction_items WHERE transaction_id = ?`,
    [transactionId]
  );

  if (items.length === 0) return;

  const cols = getTableColumns("income_transaction_items");
  for (const item of items) {
    const row: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(item)) {
      if (cols.has(key)) row[key] = value;
    }
    // Force parent linkage in case the remote payload omitted it.
    row.transaction_id = transactionId;
    // Items share the parent's sync bookkeeping — they don't have their
    // own OCC lifecycle.
    row.sync_status = "synced";
    row.sync_version = meta.version;
    row.last_synced_at = meta.now;
    row.updated_by = meta.authoredBy;
    row.created_by = meta.createdBy;

    writeRow("income_transaction_items", row);
  }
}

/**
 * Emit `INSERT OR REPLACE INTO {table} (…) VALUES (…)` for the given row
 * map. Columns are taken from the map's keys — the caller is responsible
 * for having pre-filtered against the table schema.
 */
function writeRow(table: string, row: Record<string, unknown>): void {
  const keys = Object.keys(row);
  if (keys.length === 0) return;
  const placeholders = keys.map(() => "?").join(", ");
  const values = keys.map((k) => row[k] as string | number | null);
  database.runSync(
    `INSERT OR REPLACE INTO ${table} (${keys.join(", ")}) VALUES (${placeholders})`,
    values
  );
}

/**
 * Lazily populate + cache the set of columns for a table. Called on
 * every applyRemoteRow — cheap after the first call.
 */
function getTableColumns(table: string): Set<string> {
  let cached = columnsCache.get(table);
  if (cached) return cached;
  const rows = database.getAllSync<{ name: string }>(
    `PRAGMA table_info(${table})`
  );
  cached = new Set(rows.map((r) => r.name));
  columnsCache.set(table, cached);
  return cached;
}

/**
 * Test-only — clear the schema cache. Used by migration tests that add
 * columns at runtime.
 * @internal
 */
export function __resetColumnsCacheForTests(): void {
  columnsCache.clear();
}
