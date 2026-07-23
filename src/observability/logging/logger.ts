import { redactMessage, redactParams } from "@/observability/logging/redaction";

export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogCategory =
  | "api"
  | "firestore"
  | "sqlite"
  | "sync"
  | "backup"
  | "auth"
  | "navigation"
  | "error"
  | "background"
  | "analytics"
  | "perf"
  | "general";

export type LogFields = {
  category?: LogCategory;
  err_code?: string;
  duration_ms?: number;
  [key: string]: unknown;
};

type LogRecord = {
  level: LogLevel;
  category: LogCategory;
  message: string;
  ts: string;
  session_id?: string;
  salon_id?: string;
  screen?: string;
  err_code?: string;
  duration_ms?: number;
};

function safeSessionId(): string | undefined {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getSessionId } = require("@/observability/analytics/session-manager") as {
      getSessionId: () => string;
    };
    return getSessionId();
  } catch {
    return undefined;
  }
}

function safeScreen(): string | undefined {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getCurrentScreen } = require("@/observability/analytics/screen-tracker") as {
      getCurrentScreen: () => string | null;
    };
    return getCurrentScreen() ?? undefined;
  } catch {
    return undefined;
  }
}

function safeSalonId(): string | undefined {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getCurrentSalonIdSafe } = require("@/observability/internal/salon-id") as {
      getCurrentSalonIdSafe: () => string | null;
    };
    return getCurrentSalonIdSafe() ?? undefined;
  } catch {
    return undefined;
  }
}

function buildRecord(
  level: LogLevel,
  message: string,
  fields?: LogFields
): LogRecord {
  const category = fields?.category ?? "general";
  const { category: _c, err_code, duration_ms, ...rest } = fields ?? {};
  const redacted = redactParams(rest);
  return {
    level,
    category,
    message: redactMessage(message),
    ts: new Date().toISOString(),
    session_id: safeSessionId(),
    salon_id: safeSalonId(),
    screen: safeScreen(),
    err_code,
    duration_ms,
    ...redacted
  };
}

function emit(record: LogRecord): void {
  const line = `[${record.category}] ${record.message}`;
  if (record.level === "debug") {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.debug(line, record);
    }
    return;
  }
  if (record.level === "info") {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.info(line, record);
    }
    return;
  }
  if (record.level === "warn") {
    // eslint-disable-next-line no-console
    console.warn(line, record);
    return;
  }
  // eslint-disable-next-line no-console
  console.error(line, record);
}

export const logger = {
  debug(message: string, fields?: LogFields): void {
    emit(buildRecord("debug", message, fields));
  },
  info(message: string, fields?: LogFields): void {
    emit(buildRecord("info", message, fields));
  },
  warn(message: string, fields?: LogFields): void {
    emit(buildRecord("warn", message, fields));
  },
  error(message: string, fields?: LogFields): void {
    emit(buildRecord("error", message, fields));
  }
};
