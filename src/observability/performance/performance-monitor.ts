import { getFirebasePerfAdapter, type PerfTraceHandle } from "@/observability/adapters/firebase-perf";
import { logger } from "@/observability/logging/logger";

const SLOW_UI_MS = 2000;
const SLOW_SYNC_MS = 10000;

export type TraceName =
  | "app_startup"
  | "sync_push"
  | "sync_pull"
  | "backup_upload"
  | "screen_dashboard"
  | "screen_reports"
  | string;

/**
 * Start a custom performance trace. Returns a handle; always call stop().
 * Never throws.
 */
export async function startTrace(name: TraceName): Promise<PerfTraceHandle> {
  try {
    return await getFirebasePerfAdapter().startTrace(name);
  } catch {
    return {
      async stop() {},
      putAttribute() {},
      putMetric() {}
    };
  }
}

/** Measure an async operation and log if it exceeds the slow threshold. */
export async function measureAsync<T>(
  name: TraceName,
  work: () => Promise<T>,
  options?: { slowMs?: number }
): Promise<T> {
  const started = Date.now();
  const trace = await startTrace(name);
  try {
    return await work();
  } finally {
    const durationMs = Date.now() - started;
    const slowMs =
      options?.slowMs ??
      (name.startsWith("sync") || name.startsWith("backup")
        ? SLOW_SYNC_MS
        : SLOW_UI_MS);
    if (durationMs >= slowMs) {
      logger.warn(`slow operation ${name}`, {
        category: "perf",
        duration_ms: durationMs
      });
    }
    trace.putMetric("duration_ms", durationMs);
    await trace.stop();
  }
}

/** Record a known duration (e.g. from sync bus payload) as a short-lived trace. */
export function recordDuration(
  name: TraceName,
  durationMs: number,
  attrs?: Record<string, string>
): void {
  void (async () => {
    const trace = await startTrace(name);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        trace.putAttribute(k, v);
      }
    }
    trace.putMetric("duration_ms", durationMs);
    await trace.stop();
  })();
}
