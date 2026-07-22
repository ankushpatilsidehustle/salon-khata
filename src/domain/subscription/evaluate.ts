import type {
  SubscriptionLifecycle,
  SubscriptionStatus
} from "./types";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type EvaluableSubscription = {
  id: string;
  status: SubscriptionStatus;
  start_at: string;
  end_at: string;
  grace_end_at: string | null;
};

export type EvaluatedSubscription = {
  lifecycle: SubscriptionLifecycle;
  /** Prefer this over the stored status column when gating features. */
  effectiveStatus: SubscriptionStatus | "none";
  remainingDays: number;
  isInAccessWindow: boolean;
  endAt: string | null;
  graceEndAt: string | null;
  subscriptionId: string | null;
};

/**
 * Derive lifecycle from timestamps. Stored `status` is only a hint —
 * clocks and renewals can race a background status updater.
 */
export function evaluateSubscription(
  sub: EvaluableSubscription | null | undefined,
  now: Date = new Date()
): EvaluatedSubscription {
  if (!sub) {
    return {
      lifecycle: "none",
      effectiveStatus: "none",
      remainingDays: 0,
      isInAccessWindow: false,
      endAt: null,
      graceEndAt: null,
      subscriptionId: null
    };
  }

  const nowMs = now.getTime();
  const endMs = Date.parse(sub.end_at);
  const graceEndMs = sub.grace_end_at ? Date.parse(sub.grace_end_at) : endMs;

  // Paid-through cancelled: still usable until end_at / grace.
  const cancelled = sub.status === "cancelled";

  if (Number.isFinite(endMs) && nowMs < endMs) {
    const lifecycle: SubscriptionLifecycle =
      sub.status === "trial" && !cancelled ? "trial" : "active";
    return {
      lifecycle,
      effectiveStatus: cancelled ? "cancelled" : lifecycle === "trial" ? "trial" : "active",
      remainingDays: daysRemaining(endMs, nowMs),
      isInAccessWindow: true,
      endAt: sub.end_at,
      graceEndAt: sub.grace_end_at,
      subscriptionId: sub.id
    };
  }

  if (Number.isFinite(graceEndMs) && nowMs < graceEndMs) {
    return {
      lifecycle: "grace",
      effectiveStatus: "grace",
      remainingDays: daysRemaining(graceEndMs, nowMs),
      isInAccessWindow: true,
      endAt: sub.end_at,
      graceEndAt: sub.grace_end_at,
      subscriptionId: sub.id
    };
  }

  return {
    lifecycle: "expired",
    effectiveStatus: "expired",
    remainingDays: 0,
    isInAccessWindow: false,
    endAt: sub.end_at,
    graceEndAt: sub.grace_end_at,
    subscriptionId: sub.id
  };
}

export function addDaysIso(startIso: string, days: number): string {
  const ms = Date.parse(startIso);
  const base = Number.isFinite(ms) ? ms : Date.now();
  return new Date(base + days * MS_PER_DAY).toISOString();
}

export function daysBetween(startIso: string, endIso: string): number {
  const a = Date.parse(startIso);
  const b = Date.parse(endIso);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.max(0, Math.ceil((b - a) / MS_PER_DAY));
}

function daysRemaining(endMs: number, nowMs: number): number {
  if (!Number.isFinite(endMs)) return 0;
  return Math.max(0, Math.ceil((endMs - nowMs) / MS_PER_DAY));
}
