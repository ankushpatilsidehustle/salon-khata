import { logger } from "@/observability/logging/logger";
import { redactMessage } from "@/observability/logging/redaction";
import type { ErrorCategory } from "@/observability/events/catalog";

export type CrashAdapter = {
  setUserId(userId: string | null): Promise<void>;
  setAttribute(key: string, value: string): Promise<void>;
  recordError(error: Error, context?: { category?: ErrorCategory }): Promise<void>;
  log(message: string): Promise<void>;
  setCrashlyticsCollectionEnabled(enabled: boolean): Promise<void>;
};

const consoleCrashAdapter: CrashAdapter = {
  async setUserId() {},
  async setAttribute(key, value) {
    logger.debug(`crashlytics attr ${key}=${value}`, { category: "error" });
  },
  async recordError(error, context) {
    logger.error(error.message, {
      category: "error",
      err_code: context?.category ?? "unknown"
    });
  },
  async log(message) {
    logger.debug(redactMessage(message), { category: "error" });
  },
  async setCrashlyticsCollectionEnabled() {}
};

let cached: CrashAdapter | null = null;

export function getFirebaseCrashlyticsAdapter(): CrashAdapter {
  if (cached) return cached;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const crashlytics = require("@react-native-firebase/crashlytics").default as () => {
      setUserId: (id: string) => Promise<void>;
      setAttribute: (key: string, value: string) => Promise<void>;
      recordError: (error: Error) => Promise<void>;
      log: (message: string) => void;
      setCrashlyticsCollectionEnabled: (enabled: boolean) => Promise<void>;
    };

    cached = {
      async setUserId(userId) {
        await crashlytics().setUserId(userId ?? "");
      },
      async setAttribute(key, value) {
        await crashlytics().setAttribute(key, value.slice(0, 1024));
      },
      async recordError(error) {
        await crashlytics().recordError(error);
      },
      async log(message) {
        crashlytics().log(redactMessage(message));
      },
      async setCrashlyticsCollectionEnabled(enabled) {
        await crashlytics().setCrashlyticsCollectionEnabled(enabled);
      }
    };
    return cached;
  } catch (err) {
    logger.warn("Firebase Crashlytics unavailable; using console adapter", {
      category: "error",
      err_code: "native_module"
    });
    void err;
    cached = consoleCrashAdapter;
    return cached;
  }
}
