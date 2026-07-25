/**
 * Minimal Razorpay REST client (no SDK) using Basic auth.
 */

import { assertRazorpayConfigured } from "./config";

const RAZORPAY_API = "https://api.razorpay.com/v1";

export class RazorpayApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: unknown
  ) {
    super(message);
    this.name = "RazorpayApiError";
  }
}

async function razorpayFetch<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const { keyId, keySecret } = assertRazorpayConfigured();
  const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
  const response = await fetch(`${RAZORPAY_API}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
      Authorization: `Basic ${auth}`
    }
  });

  const text = await response.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  if (!response.ok) {
    const description =
      typeof body === "object" &&
      body !== null &&
      "error" in body &&
      typeof (body as { error?: { description?: string } }).error
        ?.description === "string"
        ? (body as { error: { description: string } }).error.description
        : `Razorpay HTTP ${response.status}`;
    throw new RazorpayApiError(description, response.status, body);
  }

  return body as T;
}

export type RazorpayPlan = {
  id: string;
  period: string;
  interval: number;
  item: { name: string; amount: number; currency: string };
};

export type RazorpaySubscription = {
  id: string;
  plan_id: string;
  status: string;
  short_url?: string | null;
  current_start?: number | null;
  current_end?: number | null;
  charge_at?: number | null;
  notes?: Record<string, string>;
};

export type CreatePlanInput = {
  period: "monthly" | "yearly";
  interval: number;
  name: string;
  amountPaise: number;
  currency: string;
  description?: string;
};

export async function createRazorpayPlan(
  input: CreatePlanInput
): Promise<RazorpayPlan> {
  return razorpayFetch<RazorpayPlan>("/plans", {
    method: "POST",
    body: JSON.stringify({
      period: input.period,
      interval: input.interval,
      item: {
        name: input.name,
        amount: input.amountPaise,
        currency: input.currency,
        description: input.description ?? input.name
      }
    })
  });
}

export type CreateSubscriptionInput = {
  planId: string;
  totalCount: number;
  customerNotify?: boolean;
  notes?: Record<string, string>;
};

export async function createRazorpaySubscription(
  input: CreateSubscriptionInput
): Promise<RazorpaySubscription> {
  return razorpayFetch<RazorpaySubscription>("/subscriptions", {
    method: "POST",
    body: JSON.stringify({
      plan_id: input.planId,
      total_count: input.totalCount,
      customer_notify: input.customerNotify === false ? 0 : 1,
      notes: input.notes ?? {}
    })
  });
}

export async function fetchRazorpaySubscription(
  subscriptionId: string
): Promise<RazorpaySubscription> {
  return razorpayFetch<RazorpaySubscription>(
    `/subscriptions/${encodeURIComponent(subscriptionId)}`
  );
}

export async function cancelRazorpaySubscription(
  subscriptionId: string,
  cancelAtCycleEnd = true
): Promise<RazorpaySubscription> {
  return razorpayFetch<RazorpaySubscription>(
    `/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`,
    {
      method: "POST",
      body: JSON.stringify({ cancel_at_cycle_end: cancelAtCycleEnd ? 1 : 0 })
    }
  );
}
