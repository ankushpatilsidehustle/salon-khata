import { Platform } from "react-native";
import * as Application from "expo-application";

import { loadConsent, isAnalyticsEnabled } from "@/observability/consent/consent-manager";
import { setAnalyticsCollectionEnabled } from "@/observability/analytics/analytics-service";
import { startSession } from "@/observability/analytics/session-manager";
import { setUserProperties } from "@/observability/analytics/user-properties";
import {
  setCrashCollectionEnabled,
  setCrashAttributes
} from "@/observability/crash/crash-reporter";
import { installGlobalErrorHandlers } from "@/observability/crash/global-handlers";
import { startEventBusBridge } from "@/observability/bridge/event-bus-bridge";
import { startOfflineQueueBridge, flushEventQueue } from "@/observability/offline/event-queue";
import { startTrace } from "@/observability/performance/performance-monitor";
import { logger } from "@/observability/logging/logger";
import { getDeviceIdentity } from "@/device/device-identity";

let bootstrapped = false;
let startupTrace: Awaited<ReturnType<typeof startTrace>> | null = null;

/** Begin the app_startup perf trace — call at the very start of AppRoot boot. */
export async function beginStartupTrace(): Promise<void> {
  startupTrace = await startTrace("app_startup");
}

/** End the app_startup perf trace once the UI is ready. */
export async function endStartupTrace(): Promise<void> {
  if (!startupTrace) return;
  const t = startupTrace;
  startupTrace = null;
  await t.stop();
}

/**
 * Initialize observability after migrations / device identity / network / App Check.
 * Idempotent.
 */
export async function bootstrapObservability(): Promise<void> {
  if (bootstrapped) return;
  bootstrapped = true;

  startSession();
  await loadConsent();

  const analyticsOn = isAnalyticsEnabled();
  setAnalyticsCollectionEnabled(analyticsOn);
  // Crash collection stays enabled for production stability.
  setCrashCollectionEnabled(true);

  installGlobalErrorHandlers();
  startEventBusBridge();
  startOfflineQueueBridge();
  void flushEventQueue();

  let installId: string | null = null;
  try {
    installId = getDeviceIdentity().installId;
  } catch {
    installId = null;
  }

  const appVersion =
    Application.nativeApplicationVersion ??
    Application.nativeBuildVersion ??
    "unknown";

  setCrashAttributes({
    app_version: appVersion,
    platform: Platform.OS,
    os_version: String(Platform.Version),
    device_model: getDeviceIdentitySafeLabel(),
    install_id: installId ?? "unknown",
    user_role: "owner"
  });

  setUserProperties({
    installId,
    userRole: "owner",
    preferredLanguage: null,
    country: "IN",
    platform: Platform.OS
  });

  logger.info("observability bootstrapped", {
    category: "analytics",
    analytics_enabled: analyticsOn
  });
}

function getDeviceIdentitySafeLabel(): string {
  try {
    return getDeviceIdentity().deviceLabel || "unknown";
  } catch {
    return "unknown";
  }
}
