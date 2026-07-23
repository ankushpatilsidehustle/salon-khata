import { eventBus } from "@/application/event-bus";
import { track } from "@/observability/analytics/analytics-service";
import { SyncEvents } from "@/observability/events/catalog";
import { setCrashAttributes, recordNonFatal } from "@/observability/crash/crash-reporter";
import { recordDuration } from "@/observability/performance/performance-monitor";
import { logger } from "@/observability/logging/logger";
import { getNetworkState } from "@/network/network-manager";

let installed = false;

function networkStateLabel(): string {
  const n = getNetworkState();
  if (!n.isOnline) return "offline";
  if (n.isWifi) return "wifi";
  if (n.isMetered) return "metered";
  return "online";
}

/**
 * Single subscriber that maps sync/backup/network bus events → analytics,
 * crash context, and perf traces. Avoids duplicate emits from feature UI.
 */
export function startEventBusBridge(): () => void {
  if (installed) {
    return () => {};
  }
  installed = true;

  const disposers = [
    eventBus.on("network:changed", (payload) => {
      const label = !payload.isOnline
        ? "offline"
        : payload.isWifi
          ? "wifi"
          : payload.isMetered
            ? "metered"
            : "online";
      setCrashAttributes({ network_state: label });
    }),

    eventBus.on("sync:push-completed", (payload) => {
      track(
        SyncEvents.pushCompleted,
        {
          pushed: payload.pushed,
          conflicts: payload.conflicts,
          errors: payload.errors,
          has_more: payload.hasMore ? 1 : 0,
          duration_ms: payload.durationMs,
          network_state: networkStateLabel()
        },
        { critical: true }
      );
      recordDuration("sync_push", payload.durationMs, {
        errors: String(payload.errors)
      });
      if (payload.errors > 0 && payload.pushed === 0) {
        recordNonFatal(
          new Error(`sync push failed errors=${payload.errors}`),
          "sync",
          { extra: { errors: String(payload.errors) } }
        );
      }
    }),

    eventBus.on("sync:pull-completed", (payload) => {
      track(
        SyncEvents.pullCompleted,
        {
          applied: payload.applied,
          conflicts: payload.conflicts,
          errors: payload.errors,
          duration_ms: payload.durationMs,
          network_state: networkStateLabel()
        },
        { critical: true }
      );
      recordDuration("sync_pull", payload.durationMs, {
        errors: String(payload.errors)
      });
      if (payload.errors > 0 && payload.applied === 0) {
        recordNonFatal(
          new Error(`sync pull failed errors=${payload.errors}`),
          "sync"
        );
      }
    }),

    eventBus.on("sync:conflict", (payload) => {
      track(SyncEvents.conflict, {
        entity_type: payload.entityType,
        winner: payload.winner,
        reason: payload.reason.slice(0, 80)
      });
    }),

    eventBus.on("backup:succeeded", (payload) => {
      track(
        SyncEvents.backupSucceeded,
        {
          bytes_uploaded: payload.bytesUploaded,
          duration_ms: payload.durationMs
        },
        { critical: true }
      );
      recordDuration("backup_upload", payload.durationMs);
    }),

    eventBus.on("backup:failed", (payload) => {
      track(
        SyncEvents.backupFailed,
        {
          trigger: payload.trigger,
          error_code: payload.errorCode
        },
        { critical: true }
      );
      recordNonFatal(new Error(payload.message), "backup", {
        extra: { error_code: payload.errorCode, trigger: payload.trigger }
      });
      logger.warn("backup failed", {
        category: "backup",
        err_code: payload.errorCode
      });
    }),

    eventBus.on("lock:changed", (payload) => {
      track(SyncEvents.lockChanged, {
        mine: payload.mine ? 1 : 0
      });
      setCrashAttributes({
        lock_mine: payload.mine ? "1" : "0"
      });
    })
  ];

  // Seed network crash key immediately.
  setCrashAttributes({ network_state: networkStateLabel() });

  return () => {
    for (const d of disposers) d();
    installed = false;
  };
}
