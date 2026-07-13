// Small normalization helper for report screens. Route params may carry a
// legacy single `date`, an explicit `{ start, end, mode }` range, or nothing
// at all — this collapses all three shapes into a canonical `Period`.

import {
  makeDayPeriod,
  makeMonthPeriod,
  makeWeekPeriod,
  toISODate,
  type Period,
  type PeriodMode
} from "@/domain/period";

export type ReportRouteParams = {
  date?: string;
  start?: string;
  end?: string;
  mode?: PeriodMode;
};

/**
 * Convert route params into a `Period`. Precedence:
 *  1. Explicit `start` + `end` (+ optional `mode`).
 *  2. Legacy `date` → single-day period.
 *  3. Default: today.
 */
export function normalizeReportPeriod(
  params: ReportRouteParams | undefined
): Period {
  if (params?.start && params?.end) {
    return {
      mode: params.mode ?? "custom",
      start: params.start,
      end: params.end
    };
  }
  if (params?.date) {
    return { mode: "day", start: params.date, end: params.date };
  }
  return makeDayPeriod(new Date());
}

/** Convenience: today as YYYY-MM-DD. Kept here so screens don't reimplement it. */
export function todayISO(): string {
  return toISODate(new Date());
}

/** Rebuild a fresh period with today as the anchor for the given mode. */
export function makePeriodForMode(mode: PeriodMode): Period {
  const now = new Date();
  switch (mode) {
    case "day":
      return makeDayPeriod(now);
    case "week":
      return makeWeekPeriod(now);
    case "month":
      return makeMonthPeriod(now);
    case "custom":
    default:
      return makeDayPeriod(now);
  }
}
