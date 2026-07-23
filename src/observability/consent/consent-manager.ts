import AsyncStorage from "@react-native-async-storage/async-storage";

import { logger } from "@/observability/logging/logger";

const STORAGE_KEY = "salon-khata.analytics_consent";

/**
 * Consent model (plan):
 * - Crash reporting stays enabled for stability (always on once bootstrapped).
 * - Analytics (behavioral events + screen views) is opt-out; default ON.
 */
export type ConsentState = {
  /** Behavioral analytics + screen tracking. */
  analyticsEnabled: boolean;
  /** Crash collection — always true after bootstrap; reserved for future. */
  crashEnabled: boolean;
  updatedAt: string | null;
};

const DEFAULT_CONSENT: ConsentState = {
  analyticsEnabled: true,
  crashEnabled: true,
  updatedAt: null
};

let cached: ConsentState = { ...DEFAULT_CONSENT };
let hydrated = false;
const listeners = new Set<(state: ConsentState) => void>();

export function getConsent(): ConsentState {
  return cached;
}

export function isAnalyticsEnabled(): boolean {
  return cached.analyticsEnabled;
}

export function isCrashEnabled(): boolean {
  return cached.crashEnabled;
}

export function onConsentChanged(
  handler: (state: ConsentState) => void
): () => void {
  listeners.add(handler);
  return () => {
    listeners.delete(handler);
  };
}

function notify(): void {
  for (const handler of listeners) {
    try {
      handler(cached);
    } catch (err) {
      logger.warn("consent listener threw", {
        category: "analytics",
        err_code: "listener"
      });
      void err;
    }
  }
}

/** Load persisted preference. Safe to call multiple times. */
export async function loadConsent(): Promise<ConsentState> {
  if (hydrated) return cached;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ConsentState>;
      cached = {
        analyticsEnabled:
          typeof parsed.analyticsEnabled === "boolean"
            ? parsed.analyticsEnabled
            : DEFAULT_CONSENT.analyticsEnabled,
        // Crash stays on regardless of stored value.
        crashEnabled: true,
        updatedAt: parsed.updatedAt ?? null
      };
    }
  } catch {
    logger.warn("failed to load analytics consent", { category: "analytics" });
  }
  hydrated = true;
  return cached;
}

/** Persist analytics opt-in/out. Crash remains enabled. */
export async function setAnalyticsEnabled(enabled: boolean): Promise<void> {
  cached = {
    analyticsEnabled: enabled,
    crashEnabled: true,
    updatedAt: new Date().toISOString()
  };
  hydrated = true;
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cached));
  } catch {
    logger.warn("failed to persist analytics consent", {
      category: "analytics"
    });
  }
  notify();
}
