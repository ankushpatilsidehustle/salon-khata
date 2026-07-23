/**
 * Future NestJS / OpenTelemetry sink adapter.
 *
 * When an HTTP backend exists, implement `NestObservabilityAdapter` and
 * register it from bootstrap. Feature call sites keep using `@/observability`
 * unchanged — no rewrite required.
 *
 * Correlation fields to forward on every span/log:
 *   install_id, salon_id, session_id, request_id, app_version, platform
 */

import type { AnalyticsParams } from "@/observability/events/catalog";
import type { AnalyticsAdapter } from "@/observability/adapters/console-adapter";
import { logger } from "@/observability/logging/logger";

export type NestObservabilityAdapter = AnalyticsAdapter & {
  /** OpenTelemetry-style span around an HTTP / business operation. */
  startSpan(
    name: string,
    attrs?: Record<string, string | number>
  ): {
    end(status?: "ok" | "error"): void;
    setAttribute(key: string, value: string | number): void;
  };
  /** Structured API request log (request_id correlation). */
  logApiCall(input: {
    method: string;
    path: string;
    status?: number;
    duration_ms?: number;
    request_id?: string;
    err_code?: string;
  }): void;
};

/** Placeholder no-op Nest adapter — swap for a real HTTP/OTel client later. */
export const noopNestAdapter: NestObservabilityAdapter = {
  async logEvent(name, params) {
    logger.debug(`nest sink (noop) event ${name}`, {
      category: "api",
      ...(params as Record<string, unknown>)
    });
  },
  async logScreenView() {},
  async setUserId() {},
  async setUserProperty() {},
  async setAnalyticsCollectionEnabled() {},
  startSpan(name) {
    const started = Date.now();
    return {
      end() {
        logger.debug(`nest span ${name}`, {
          category: "api",
          duration_ms: Date.now() - started
        });
      },
      setAttribute() {}
    };
  },
  logApiCall(input) {
    logger.info("api call", {
      category: "api",
      ...input
    } as AnalyticsParams & { category: "api" });
  }
};

let activeNest: NestObservabilityAdapter | null = null;

/** Register a NestJS/OTel adapter when the backend ships. */
export function registerNestAdapter(adapter: NestObservabilityAdapter): void {
  activeNest = adapter;
}

export function getNestAdapter(): NestObservabilityAdapter | null {
  return activeNest;
}
