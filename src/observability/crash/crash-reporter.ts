import { getFirebaseCrashlyticsAdapter } from "@/observability/adapters/firebase-crashlytics";
import { logger } from "@/observability/logging/logger";
import { redactMessage } from "@/observability/logging/redaction";
import { isCrashEnabled } from "@/observability/consent/consent-manager";
import type { ErrorCategory } from "@/observability/events/catalog";

function fireAndForget(task: () => Promise<void>): void {
  void task().catch(() => {
    /* swallow */
  });
}

export async function setCrashUserId(userId: string | null): Promise<void> {
  if (!isCrashEnabled()) return;
  await getFirebaseCrashlyticsAdapter().setUserId(userId);
}

export function setCrashAttribute(key: string, value: string): void {
  if (!isCrashEnabled()) return;
  fireAndForget(async () => {
    await getFirebaseCrashlyticsAdapter().setAttribute(key, value);
  });
}

export function setCrashAttributes(attrs: Record<string, string | null | undefined>): void {
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || value === "") continue;
    setCrashAttribute(key, String(value));
  }
}

export function crashLog(message: string): void {
  if (!isCrashEnabled()) return;
  fireAndForget(async () => {
    await getFirebaseCrashlyticsAdapter().log(redactMessage(message));
  });
}

/**
 * Record a non-fatal error with a taxonomy category.
 * Skips expected auth user errors when `skip` is true.
 */
export function recordNonFatal(
  error: unknown,
  category: ErrorCategory = "unknown",
  options?: { skip?: boolean; extra?: Record<string, string> }
): void {
  if (options?.skip) return;
  if (!isCrashEnabled()) return;

  const err =
    error instanceof Error
      ? error
      : new Error(typeof error === "string" ? error : "Unknown error");

  // Attach category as attribute before recording.
  setCrashAttribute("error_category", category);
  if (options?.extra) {
    setCrashAttributes(options.extra);
  }

  logger.error(err.message, { category: "error", err_code: category });
  crashLog(`[${category}] ${err.message}`);

  fireAndForget(async () => {
    await getFirebaseCrashlyticsAdapter().recordError(err, { category });
  });
}

export function setCrashCollectionEnabled(enabled: boolean): void {
  fireAndForget(async () => {
    await getFirebaseCrashlyticsAdapter().setCrashlyticsCollectionEnabled(
      enabled
    );
  });
}
