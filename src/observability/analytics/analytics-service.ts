import { isAnalyticsEnabled } from "@/observability/consent/consent-manager";
import { getFirebaseAnalyticsAdapter } from "@/observability/adapters/firebase-analytics";
import { logger } from "@/observability/logging/logger";
import { newId } from "@/domain/id";
import { getSessionId } from "@/observability/analytics/session-manager";
import { getCurrentScreen } from "@/observability/analytics/screen-tracker";
import { enqueueCriticalEvent } from "@/observability/offline/event-queue";
import type {
  AnalyticsParams,
  EventName
} from "@/observability/events/catalog";

export type TrackOptions = {
  /**
   * Also enqueue in the durable SQLite offline queue (Phase 2).
   * Use for activation / monetization / sync outcome events.
   */
  critical?: boolean;
  /** Explicit event id for dedup; auto-generated when critical. */
  eventId?: string;
};

function fireAndForget(task: () => Promise<void>): void {
  void task().catch((err) => {
    logger.warn("analytics sink failed", {
      category: "analytics",
      err_code: err instanceof Error ? err.message.slice(0, 80) : "unknown"
    });
  });
}

/**
 * Track a typed catalog event. Never throws; never blocks UI.
 * Gated by analytics consent. Always attaches session_id + current_screen.
 */
export function track(
  event: EventName | string,
  params?: AnalyticsParams,
  options?: TrackOptions
): void {
  if (!isAnalyticsEnabled()) return;

  const eventId = options?.eventId ?? (options?.critical ? newId() : undefined);
  const enriched: AnalyticsParams = {
    ...params,
    session_id: getSessionId(),
    current_screen: getCurrentScreen(),
    ...(eventId ? { event_id: eventId } : {})
  };

  if (options?.critical && eventId) {
    enqueueCriticalEvent(event, enriched, eventId);
  }

  fireAndForget(async () => {
    await getFirebaseAnalyticsAdapter().logEvent(event, enriched);
  });
}

/** Feature usage helper — keeps call sites short. */
export function trackFeature(
  feature: string,
  action: string,
  params?: AnalyticsParams
): void {
  track(`${feature}_${action}`, params);
}

export function setAnalyticsCollectionEnabled(enabled: boolean): void {
  fireAndForget(async () => {
    await getFirebaseAnalyticsAdapter().setAnalyticsCollectionEnabled(enabled);
  });
}
