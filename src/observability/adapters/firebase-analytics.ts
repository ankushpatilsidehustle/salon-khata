import { logger } from "@/observability/logging/logger";
import { redactParams } from "@/observability/logging/redaction";
import { consoleAnalyticsAdapter, type AnalyticsAdapter } from "@/observability/adapters/console-adapter";
import type { AnalyticsParams } from "@/observability/events/catalog";

function sanitize(params?: AnalyticsParams): Record<string, string | number> {
  const redacted = redactParams(params as Record<string, unknown> | undefined);
  const out: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(redacted)) {
    if (typeof v === "string" || typeof v === "number") {
      out[k] = v;
    } else if (typeof v === "boolean") {
      out[k] = v ? 1 : 0;
    }
  }
  return out;
}

let cached: AnalyticsAdapter | null = null;

/**
 * Lazy Firebase Analytics adapter. Falls back to console when the native
 * module is unavailable (e.g. before a rebuild with the new plugins).
 */
export function getFirebaseAnalyticsAdapter(): AnalyticsAdapter {
  if (cached) return cached;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const analytics = require("@react-native-firebase/analytics").default as () => {
      logEvent: (name: string, params?: Record<string, unknown>) => Promise<void>;
      logScreenView: (args: {
        screen_name: string;
        screen_class?: string;
        [key: string]: unknown;
      }) => Promise<void>;
      setUserId: (id: string | null) => Promise<void>;
      setUserProperty: (name: string, value: string | null) => Promise<void>;
      setAnalyticsCollectionEnabled: (enabled: boolean) => Promise<void>;
    };

    cached = {
      async logEvent(name, params) {
        await analytics().logEvent(name, sanitize(params));
      },
      async logScreenView(screenName, params) {
        await analytics().logScreenView({
          screen_name: screenName,
          screen_class: screenName,
          ...sanitize(params)
        });
      },
      async setUserId(userId) {
        await analytics().setUserId(userId);
      },
      async setUserProperty(name, value) {
        await analytics().setUserProperty(name, value);
      },
      async setAnalyticsCollectionEnabled(enabled) {
        await analytics().setAnalyticsCollectionEnabled(enabled);
      }
    };
    return cached;
  } catch (err) {
    logger.warn("Firebase Analytics unavailable; using console adapter", {
      category: "analytics",
      err_code: "native_module"
    });
    void err;
    cached = consoleAnalyticsAdapter;
    return cached;
  }
}
