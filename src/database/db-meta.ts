import { database } from "@/database/sqlite-client";
import { getUtcTimestamp } from "@/domain/dates";
import { eventBus } from "@/application/event-bus";

/**
 * Access layer for the `db_meta` singleton key/value table introduced in
 * migration 014.
 *
 * Two well-known keys drive the file-sync backup engine:
 *   - `dirty_since` — ISO UTC timestamp of the first write since the last
 *     successful backup, or NULL when the local DB is in sync with the
 *     latest cloud snapshot.
 *   - `change_count` — monotonically increasing counter used both for
 *     backup-trigger thresholds and for optimistic-concurrency when the
 *     backup pipeline clears the dirty flag.
 *
 * All writes are single-row UPSERTs; callers are expected to invoke
 * `markDirty()` from inside their existing `runInTransaction` so the
 * business row commit and the dirty flag flip atomically.
 */

export type DirtyState = {
  /** ISO UTC timestamp of the oldest unsynced change, or null when clean. */
  dirtySince: string | null;
  /** Monotonic counter of writes since app install. */
  changeCount: number;
};

/** Raw get. Returns `null` for both "unset" and "explicitly NULL". */
export function getMeta(key: string): string | null {
  const row = database.getFirstSync<{ value: string | null }>(
    `SELECT value FROM db_meta WHERE key = ? LIMIT 1`,
    [key]
  );
  return row?.value ?? null;
}

/** Upsert a value for `key`. Pass `null` to explicitly clear it. */
export function setMeta(key: string, value: string | null): void {
  database.runSync(
    `INSERT INTO db_meta (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, value]
  );
}

/**
 * Flag the DB as containing unsynced changes.
 *
 * - Sets `dirty_since` to the current UTC timestamp if it's currently NULL
 *   (preserves the oldest unsynced timestamp across a burst of writes).
 * - Increments `change_count` on every call so the scheduler can debounce
 *   by count and the backup pipeline can detect concurrent writes.
 * - Emits `db:dirty` on the event bus so the BackupScheduler can react
 *   without polling.
 *
 * Must be called from within a `runInTransaction` block so the flag flip is
 * atomic with the business row commit.
 */
export function markDirty(): void {
  const now = getUtcTimestamp();
  database.runSync(
    `UPDATE db_meta
     SET value = ?
     WHERE key = 'dirty_since' AND value IS NULL`,
    [now]
  );
  database.runSync(
    `UPDATE db_meta
     SET value = CAST(COALESCE(CAST(value AS INTEGER), 0) + 1 AS TEXT)
     WHERE key = 'change_count'`
  );
  // Read back the new counter so subscribers don't have to hit SQLite again.
  const changeCount = Number(getMeta("change_count") ?? "0");
  eventBus.emit("db:dirty", { changeCount });
}

/**
 * Read the current dirty state. Returns `{ dirtySince: null, changeCount: 0 }`
 * on a fresh install where migration 014 has run but no writes have occurred.
 */
export function readDirtyState(): DirtyState {
  const rows = database.getAllSync<{ key: string; value: string | null }>(
    `SELECT key, value FROM db_meta WHERE key IN ('dirty_since', 'change_count')`
  );
  const map = new Map(rows.map((r) => [r.key, r.value]));
  return {
    dirtySince: map.get("dirty_since") ?? null,
    changeCount: Number(map.get("change_count") ?? "0")
  };
}

/**
 * Clear the dirty flag after a successful backup, iff no writes have
 * happened since the caller captured `changeCountAtStart`. Returns `true`
 * when cleared, `false` when a concurrent write bumped the counter and the
 * caller should schedule another backup. On success emits `db:clean`.
 */
export function clearDirtyIfUnchanged(changeCountAtStart: number): boolean {
  const current = readDirtyState().changeCount;
  if (current !== changeCountAtStart) return false;
  const at = getUtcTimestamp();
  setMeta("dirty_since", null);
  eventBus.emit("db:clean", { at });
  return true;
}
