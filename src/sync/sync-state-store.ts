/**
 * SyncStateStore — persistent key/value scratchpad for the sync engine.
 *
 * Backed by the `sync_state` table (migration 017). Two families of keys
 * are consumed today:
 *
 *   - `cursor:{entityType}`      — Firestore serverUpdatedAt of the last
 *                                   record pulled for that entity type.
 *                                   Stored as JSON `{seconds, nanoseconds}`
 *                                   so full nanosecond precision survives
 *                                   round-trips (Firestore timestamps go
 *                                   below millisecond).
 *   - `last_pull_at:{entityType}` — ISO UTC timestamp of the most recent
 *                                   completed pull for that entity. Used
 *                                   only for the Sync Status screen.
 *
 * Also carries the singleton key `last_full_sync_at` — set after every
 * successful full pull cycle, again for observability.
 */

import { database } from "@/database/sqlite-client";
import { getUtcTimestamp } from "@/domain/dates";

import type { SyncEntityType } from "@/sync/types";

/**
 * Opaque cursor value. Firestore `Timestamp` under the hood, but we store
 * it as JSON so the SQLite layer stays SDK-agnostic and Phase 5 UI can
 * render "up to X" without importing Firestore types.
 */
export type SyncCursor = {
  seconds: number;
  nanoseconds: number;
};

const CURSOR_PREFIX = "cursor:";
const LAST_PULL_PREFIX = "last_pull_at:";
const LAST_FULL_SYNC_KEY = "last_full_sync_at";

export class SyncStateStore {
  /** Read the pull cursor for an entity type, or null if never pulled. */
  getCursor(entityType: SyncEntityType): SyncCursor | null {
    const raw = this.getRaw(cursorKey(entityType));
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as SyncCursor;
      if (
        typeof parsed.seconds === "number" &&
        typeof parsed.nanoseconds === "number"
      ) {
        return parsed;
      }
      return null;
    } catch {
      // Corrupt row (shouldn't happen — we own the writes). Treat as
      // fresh sync so the next pull will fetch everything and heal.
      return null;
    }
  }

  /** Write the pull cursor for an entity type. */
  setCursor(entityType: SyncEntityType, cursor: SyncCursor): void {
    this.setRaw(cursorKey(entityType), JSON.stringify(cursor));
  }

  /**
   * Stamp "we finished pulling {entityType} at ..." — surfaced in the
   * Sync Status UI (Phase 5). No effect on the sync algorithm itself.
   */
  markPullCompleted(entityType: SyncEntityType): void {
    this.setRaw(lastPullKey(entityType), getUtcTimestamp());
  }

  /** Read the last-completed-pull timestamp for an entity. */
  getLastPullAt(entityType: SyncEntityType): string | null {
    return this.getRaw(lastPullKey(entityType));
  }

  /** Stamp completion of a full pull cycle across every entity. */
  markFullSyncCompleted(): void {
    this.setRaw(LAST_FULL_SYNC_KEY, getUtcTimestamp());
  }

  /** Read the last-completed-full-sync timestamp. */
  getLastFullSyncAt(): string | null {
    return this.getRaw(LAST_FULL_SYNC_KEY);
  }

  // ── raw key/value helpers ────────────────────────────────────────────

  private getRaw(key: string): string | null {
    const row = database.getFirstSync<{ value: string | null }>(
      `SELECT value FROM sync_state WHERE key = ? LIMIT 1`,
      [key]
    );
    return row?.value ?? null;
  }

  private setRaw(key: string, value: string | null): void {
    database.runSync(
      `INSERT INTO sync_state (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [key, value]
    );
  }
}

/** Singleton — the store is stateless. */
export const syncStateStore = new SyncStateStore();

function cursorKey(entityType: SyncEntityType): string {
  return `${CURSOR_PREFIX}${entityType}`;
}

function lastPullKey(entityType: SyncEntityType): string {
  return `${LAST_PULL_PREFIX}${entityType}`;
}
