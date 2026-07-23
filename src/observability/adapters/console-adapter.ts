import { logger } from "@/observability/logging/logger";
import { redactParams } from "@/observability/logging/redaction";
import type { AnalyticsParams } from "@/observability/events/catalog";

export type AnalyticsAdapter = {
  logEvent(name: string, params?: AnalyticsParams): Promise<void>;
  logScreenView(screenName: string, params?: AnalyticsParams): Promise<void>;
  setUserId(userId: string | null): Promise<void>;
  setUserProperty(name: string, value: string | null): Promise<void>;
  setAnalyticsCollectionEnabled(enabled: boolean): Promise<void>;
};

/** Dev / fallback sink — never throws. */
export const consoleAnalyticsAdapter: AnalyticsAdapter = {
  async logEvent(name, params) {
    logger.debug(`analytics event ${name}`, {
      category: "analytics",
      ...redactParams(params as Record<string, unknown>)
    });
  },
  async logScreenView(screenName, params) {
    logger.debug(`screen_view ${screenName}`, {
      category: "navigation",
      ...redactParams(params as Record<string, unknown>)
    });
  },
  async setUserId(userId) {
    logger.debug("setUserId", {
      category: "analytics",
      has_user: userId != null
    });
  },
  async setUserProperty(name, value) {
    logger.debug(`setUserProperty ${name}`, {
      category: "analytics",
      has_value: value != null
    });
  },
  async setAnalyticsCollectionEnabled(enabled) {
    logger.debug("setAnalyticsCollectionEnabled", {
      category: "analytics",
      enabled
    });
  }
};
