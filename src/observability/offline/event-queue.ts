/**
 * Durable offline queue for critical analytics events (Phase 2).
 *
 * Firebase Analytics already buffers while offline. This queue adds
 * event_id dedup + a local audit trail for activation / monetization /
 * sync outcomes. Flush is best-effort when connectivity returns.
 *
 * Storage: AsyncStorage JSON ring buffer (avoids a new SQLite migration
 * and keeps observability out of the business DB). Cap = 200 events.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

import { getFirebaseAnalyticsAdapter } from "@/observability/adapters/firebase-analytics";
import { isAnalyticsEnabled } from "@/observability/consent/consent-manager";
import { logger } from "@/observability/logging/logger";
import { eventBus } from "@/application/event-bus";
import type { AnalyticsParams } from "@/observability/events/catalog";

const STORAGE_KEY = "salon-khata.analytics_event_queue";
const MAX_QUEUE = 200;

type QueuedEvent = {
  event_id: string;
  name: string;
  params: AnalyticsParams;
  created_at: string;
};

let memory: QueuedEvent[] = [];
let hydrated = false;
let flushing = false;
let bridgeInstalled = false;

async function hydrate(): Promise<void> {
  if (hydrated) return;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as QueuedEvent[];
      if (Array.isArray(parsed)) memory = parsed;
    }
  } catch {
    memory = [];
  }
  hydrated = true;
}

async function persist(): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(memory));
  } catch {
    logger.warn("analytics queue persist failed", { category: "analytics" });
  }
}

/** Enqueue a critical event; drops oldest when over capacity. Dedupes by event_id. */
export function enqueueCriticalEvent(
  name: string,
  params: AnalyticsParams,
  eventId: string
): void {
  void (async () => {
    await hydrate();
    if (memory.some((e) => e.event_id === eventId)) return;
    memory.push({
      event_id: eventId,
      name,
      params,
      created_at: new Date().toISOString()
    });
    if (memory.length > MAX_QUEUE) {
      memory = memory.slice(memory.length - MAX_QUEUE);
    }
    await persist();
  })();
}

/** Flush queued events to Firebase Analytics. Idempotent via event_id. */
export async function flushEventQueue(): Promise<number> {
  if (!isAnalyticsEnabled()) return 0;
  if (flushing) return 0;
  flushing = true;
  try {
    await hydrate();
    if (memory.length === 0) return 0;
    const adapter = getFirebaseAnalyticsAdapter();
    const remaining: QueuedEvent[] = [];
    let sent = 0;
    for (const item of memory) {
      try {
        await adapter.logEvent(item.name, {
          ...item.params,
          event_id: item.event_id,
          queued: 1
        });
        sent += 1;
      } catch {
        remaining.push(item);
      }
    }
    memory = remaining;
    await persist();
    return sent;
  } finally {
    flushing = false;
  }
}

/** Subscribe to network reconnect to drain the queue. Idempotent. */
export function startOfflineQueueBridge(): void {
  if (bridgeInstalled) return;
  bridgeInstalled = true;
  void hydrate();
  eventBus.on("network:changed", (payload) => {
    if (payload.isOnline) {
      void flushEventQueue();
    }
  });
}
