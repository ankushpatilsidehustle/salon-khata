/**
 * Public observability API — features import from `@/observability` only.
 */

export { Events, type EventName, type ErrorCategory, type AnalyticsParams } from "@/observability/events";

export { track, trackFeature, setAnalyticsCollectionEnabled } from "@/observability/analytics/analytics-service";
export {
  onNavigationStateChange,
  getActiveRouteName,
  getCurrentScreen,
  trackSheet
} from "@/observability/analytics/screen-tracker";
export {
  identifyUser,
  setUserProperties,
  applyEntitlementProperties
} from "@/observability/analytics/user-properties";
export {
  getSessionId,
  getSessionSnapshot,
  startSession
} from "@/observability/analytics/session-manager";

export {
  recordNonFatal,
  setCrashAttribute,
  setCrashAttributes,
  crashLog
} from "@/observability/crash/crash-reporter";
export { ObservabilityErrorBoundary } from "@/observability/crash/error-boundary";

export {
  startTrace,
  measureAsync,
  recordDuration
} from "@/observability/performance/performance-monitor";

export { logger } from "@/observability/logging/logger";

export {
  getConsent,
  isAnalyticsEnabled,
  setAnalyticsEnabled,
  loadConsent,
  onConsentChanged
} from "@/observability/consent/consent-manager";

export {
  bootstrapObservability,
  beginStartupTrace,
  endStartupTrace
} from "@/observability/bootstrap";

export { startEventBusBridge } from "@/observability/bridge/event-bus-bridge";
export { flushEventQueue } from "@/observability/offline/event-queue";
export {
  registerNestAdapter,
  getNestAdapter,
  noopNestAdapter
} from "@/observability/adapters/nestjs-otel-adapter";
