// Period helpers for report screens. Pure functions with no RN imports so
// they stay unit-testable. All dates are local YYYY-MM-DD strings — the same
// format `transaction_date` / `expense_date` use in SQLite, which lets the
// results feed straight into repository BETWEEN queries.

export type PeriodMode = "day" | "week" | "month" | "custom";

export type Period = {
  mode: PeriodMode;
  /** Inclusive local YYYY-MM-DD. */
  start: string;
  /** Inclusive local YYYY-MM-DD. */
  end: string;
};

// ─── ISO date <-> Date helpers ───────────────────────────────────────────────

/** Local YYYY-MM-DD (no timezone shift). */
export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Parse a local YYYY-MM-DD into a Date anchored at 00:00 local time. */
export function fromISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map((n) => parseInt(n, 10));
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

// ─── Period constructors ─────────────────────────────────────────────────────

export function makeDayPeriod(anchor: Date = new Date()): Period {
  const iso = toISODate(anchor);
  return { mode: "day", start: iso, end: iso };
}

/**
 * Monday-anchored ISO week containing `anchor`. Sunday is treated as the last
 * day of the previous week (matches how most Indian salon owners think about
 * weekly totals — Mon…Sun).
 */
export function makeWeekPeriod(anchor: Date = new Date()): Period {
  const d = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
  // 0=Sun … 6=Sat → shift so Monday = 0.
  const dayIdx = (d.getDay() + 6) % 7;
  const monday = new Date(d);
  monday.setDate(d.getDate() - dayIdx);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { mode: "week", start: toISODate(monday), end: toISODate(sunday) };
}

export function makeMonthPeriod(anchor: Date = new Date()): Period {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
  return { mode: "month", start: toISODate(first), end: toISODate(last) };
}

export function makeCustomPeriod(start: Date, end: Date): Period {
  const a = start <= end ? start : end;
  const b = start <= end ? end : start;
  return { mode: "custom", start: toISODate(a), end: toISODate(b) };
}

// ─── Stepping (prev/next arrows) ─────────────────────────────────────────────

/**
 * Step a period forward/backward by one unit of its mode. Custom periods are
 * returned unchanged — the UI should disable arrows in custom mode.
 */
export function stepPeriod(period: Period, delta: -1 | 1): Period {
  switch (period.mode) {
    case "day": {
      const anchor = fromISODate(period.start);
      anchor.setDate(anchor.getDate() + delta);
      return makeDayPeriod(anchor);
    }
    case "week": {
      const anchor = fromISODate(period.start);
      anchor.setDate(anchor.getDate() + delta * 7);
      return makeWeekPeriod(anchor);
    }
    case "month": {
      const anchor = fromISODate(period.start);
      anchor.setMonth(anchor.getMonth() + delta);
      return makeMonthPeriod(anchor);
    }
    case "custom":
    default:
      return period;
  }
}

// ─── Formatting ──────────────────────────────────────────────────────────────

/** e.g. "Mon 13 Jul". */
function formatDayLabel(iso: string): string {
  const d = fromISODate(iso);
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    day: "2-digit",
    month: "short"
  });
}

/** e.g. "13 Jul" (no weekday). */
function formatShortDate(iso: string): string {
  const d = fromISODate(iso);
  return d.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short"
  });
}

/** e.g. "Jul 2026". */
function formatMonthLabel(iso: string): string {
  const d = fromISODate(iso);
  return d.toLocaleDateString(undefined, {
    month: "short",
    year: "numeric"
  });
}

/**
 * Center-label for the period stepper. Day / Week / Month get compact labels;
 * Custom shows "1 Jun – 13 Jul" (same year) or "10 Dec 2025 – 4 Jan 2026".
 */
export function formatPeriodLabel(period: Period): string {
  switch (period.mode) {
    case "day":
      return formatDayLabel(period.start);
    case "week":
      return `${formatShortDate(period.start)} – ${formatShortDate(period.end)}`;
    case "month":
      return formatMonthLabel(period.start);
    case "custom": {
      const startD = fromISODate(period.start);
      const endD = fromISODate(period.end);
      const sameYear = startD.getFullYear() === endD.getFullYear();
      if (sameYear) {
        return `${formatShortDate(period.start)} – ${formatShortDate(period.end)}`;
      }
      const startLong = startD.toLocaleDateString(undefined, {
        day: "2-digit",
        month: "short",
        year: "numeric"
      });
      const endLong = endD.toLocaleDateString(undefined, {
        day: "2-digit",
        month: "short",
        year: "numeric"
      });
      return `${startLong} – ${endLong}`;
    }
  }
}

/** Convenience: is stepping enabled in this mode? */
export function canStepPeriod(period: Period): boolean {
  return period.mode !== "custom";
}
