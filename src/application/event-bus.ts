/**
 * Tiny typed publish/subscribe bus used by the backup engine to signal
 * cross-layer events (dirty state changed, backup started/succeeded/failed,
 * device lock changed, network state changed) without pulling in a full
 * state-management dependency.
 *
 * Consumers subscribe with `on(event, handler)` and receive a disposer.
 * Emitters call `emit(event, payload)`. Handlers run synchronously in
 * registration order; a throwing handler is logged and skipped so one bad
 * subscriber cannot break the chain.
 *
 * The event map is defined once here so every publisher and subscriber is
 * type-checked against the same payload shape.
 */

/** Discriminated union of every event the backup engine broadcasts. */
export type BackupEventMap = {
  /**
   * Emitted after every successful `markDirty()` write. Payload carries the
   * new `change_count` so subscribers can debounce or throttle without
   * re-reading the DB.
   */
  "db:dirty": { changeCount: number };

  /** Emitted after `clearDirtyIfUnchanged` succeeds — DB is now in sync. */
  "db:clean": { at: string };

  /** Fired when the backup pipeline begins uploading a snapshot. */
  "backup:started": { trigger: BackupTrigger };

  /** Fired on successful upload + metadata commit. */
  "backup:succeeded": {
    versionId: string;
    bytesUploaded: number;
    durationMs: number;
  };

  /** Fired when the backup pipeline gives up after retries. */
  "backup:failed": {
    trigger: BackupTrigger;
    errorCode: string;
    message: string;
  };

  /** Fired when the restore pipeline swaps the live DB. */
  "restore:completed": { versionId: string };

  /** Emitted whenever the network manager observes a connectivity change. */
  "network:changed": {
    isOnline: boolean;
    isWifi: boolean;
    isMetered: boolean;
  };

  /**
   * Emitted when the active-device lock owner changes. Payload's `mine` is
   * true when this device now owns the lock, false when it has been
   * revoked by another device.
   */
  "lock:changed": { mine: boolean; ownerInstallId: string | null };

  /**
   * Emitted at the start of every `SyncService.pushOnce()` cycle that
   * finds work to do. `batchSize` is the number of ops claimed from the
   * queue for this cycle.
   */
  "sync:push-started": { batchSize: number };

  /**
   * Emitted after `pushOnce()` finishes reconciling all per-op outcomes.
   * Consumers use this to update the Sync Status UI and drive the
   * scheduler's "drain more" decision when `hasMore` is true.
   */
  "sync:push-completed": {
    pushed: number;
    conflicts: number;
    errors: number;
    hasMore: boolean;
    durationMs: number;
  };

  /**
   * Emitted at the start of every `SyncService.pullOnce()` cycle.
   * `entityCount` = number of entity types about to be pulled (10 today).
   */
  "sync:pull-started": { entityCount: number };

  /**
   * Emitted after `pullOnce()` finishes iterating every entity type.
   * `applied` counts records upserted with no local conflict; `conflicts`
   * counts records where the resolver had to run; `errors` counts
   * entities whose page fetch failed (loop continues past those).
   */
  "sync:pull-completed": {
    applied: number;
    conflicts: number;
    errors: number;
    durationMs: number;
  };

  /**
   * Emitted once per resolver decision — from both push- and pull-side
   * conflict paths. Payload matches the row written to `conflict_log`
   * so subscribers (Sync Status UI, dev overlays) don't need to query
   * the DB just to render the notification.
   */
  "sync:conflict": {
    entityType: string;
    entityId: string;
    winner: "local" | "remote";
    reason: string;
  };
};

/** Explains why a backup was scheduled — used for observability. */
export type BackupTrigger =
  | "manual"
  | "app-background"
  | "app-foreground"
  | "post-write-debounce"
  | "periodic"
  | "network-reconnect"
  | "background-task";

type EventName = keyof BackupEventMap;
type Handler<E extends EventName> = (payload: BackupEventMap[E]) => void;

/** Disposer returned from `on()`. Idempotent — safe to call twice. */
export type Unsubscribe = () => void;

class EventBus {
  private readonly handlers = new Map<EventName, Set<Handler<EventName>>>();

  on<E extends EventName>(event: E, handler: Handler<E>): Unsubscribe {
    let bucket = this.handlers.get(event);
    if (!bucket) {
      bucket = new Set();
      this.handlers.set(event, bucket);
    }
    bucket.add(handler as Handler<EventName>);
    return () => {
      bucket?.delete(handler as Handler<EventName>);
    };
  }

  emit<E extends EventName>(event: E, payload: BackupEventMap[E]): void {
    const bucket = this.handlers.get(event);
    if (!bucket || bucket.size === 0) return;
    // Snapshot so a handler that unsubscribes mid-emit doesn't skip peers.
    const snapshot = Array.from(bucket);
    for (const handler of snapshot) {
      try {
        (handler as Handler<E>)(payload);
      } catch (err) {
        // Swallowing keeps the fan-out isolated; log for diagnostics.
        // eslint-disable-next-line no-console
        console.warn(`[event-bus] handler for "${event}" threw`, err);
      }
    }
  }

  /** Test-only: drop every registered handler. */
  clear(): void {
    this.handlers.clear();
  }
}

/** Process-wide singleton. */
export const eventBus = new EventBus();
