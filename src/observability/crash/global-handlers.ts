import { recordNonFatal } from "@/observability/crash/crash-reporter";
import { logger } from "@/observability/logging/logger";

type GlobalErrorUtils = {
  getGlobalHandler: () => (error: Error, isFatal?: boolean) => void;
  setGlobalHandler: (
    handler: (error: Error, isFatal?: boolean) => void
  ) => void;
};

let installed = false;

/**
 * Install JS global exception + unhandled rejection handlers.
 * Idempotent. Must run after Crashlytics adapter is ready (bootstrap).
 */
export function installGlobalErrorHandlers(): void {
  if (installed) return;
  installed = true;

  const ErrorUtils = (
    globalThis as unknown as { ErrorUtils?: GlobalErrorUtils }
  ).ErrorUtils;

  if (ErrorUtils?.getGlobalHandler && ErrorUtils?.setGlobalHandler) {
    const previous = ErrorUtils.getGlobalHandler();
    ErrorUtils.setGlobalHandler((error, isFatal) => {
      logger.error(error?.message ?? "JS exception", {
        category: "error",
        err_code: isFatal ? "fatal" : "non_fatal"
      });
      recordNonFatal(error, "ui", {
        extra: { is_fatal: isFatal ? "1" : "0" }
      });
      previous?.(error, isFatal);
    });
  }

  // React Native may surface unhandled rejections via this event.
  const g = globalThis as unknown as {
    addEventListener?: (
      type: string,
      listener: (event: { reason?: unknown }) => void
    ) => void;
    onunhandledrejection?: ((event: { reason?: unknown }) => void) | null;
  };

  const onRejection = (reason: unknown): void => {
    logger.error("Unhandled promise rejection", {
      category: "error",
      err_code: "unhandled_rejection"
    });
    recordNonFatal(reason, "unknown", {
      extra: { kind: "unhandled_rejection" }
    });
  };

  if (typeof g.addEventListener === "function") {
    g.addEventListener("unhandledrejection", (event) => {
      onRejection(event?.reason);
    });
  } else if ("onunhandledrejection" in g) {
    g.onunhandledrejection = (event: { reason?: unknown }) => {
      onRejection(event?.reason);
    };
  }
}
