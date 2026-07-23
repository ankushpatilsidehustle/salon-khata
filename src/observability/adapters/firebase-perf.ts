import { logger } from "@/observability/logging/logger";

export type PerfTraceHandle = {
  stop(): Promise<void>;
  putAttribute(key: string, value: string): void;
  putMetric(key: string, value: number): void;
};

export type PerfAdapter = {
  startTrace(name: string): Promise<PerfTraceHandle>;
};

const noopTrace: PerfTraceHandle = {
  async stop() {},
  putAttribute() {},
  putMetric() {}
};

const consolePerfAdapter: PerfAdapter = {
  async startTrace(name) {
    const started = Date.now();
    return {
      async stop() {
        logger.debug(`perf trace ${name}`, {
          category: "perf",
          duration_ms: Date.now() - started
        });
      },
      putAttribute() {},
      putMetric() {}
    };
  }
};

let cached: PerfAdapter | null = null;

export function getFirebasePerfAdapter(): PerfAdapter {
  if (cached) return cached;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const perf = require("@react-native-firebase/perf").default as () => {
      startTrace: (name: string) => Promise<{
        stop: () => Promise<void>;
        putAttribute: (k: string, v: string) => void;
        putMetric: (k: string, v: number) => void;
      }>;
    };

    cached = {
      async startTrace(name) {
        try {
          const trace = await perf().startTrace(name);
          return {
            async stop() {
              await trace.stop();
            },
            putAttribute(key, value) {
              try {
                trace.putAttribute(key, value.slice(0, 100));
              } catch {
                /* ignore */
              }
            },
            putMetric(key, value) {
              try {
                trace.putMetric(key, value);
              } catch {
                /* ignore */
              }
            }
          };
        } catch {
          return noopTrace;
        }
      }
    };
    return cached;
  } catch (err) {
    logger.warn("Firebase Perf unavailable; using console adapter", {
      category: "perf",
      err_code: "native_module"
    });
    void err;
    cached = consolePerfAdapter;
    return cached;
  }
}
