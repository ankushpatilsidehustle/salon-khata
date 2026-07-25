import { useMemo } from "react";

import {
  buildSubscriptionGuard,
  type SubscriptionGuard
} from "@/domain/subscription";

import { useSubscription } from "./SubscriptionProvider";

/**
 * Hook for screens that need subscription access questions.
 * Backed by SubscriptionProvider entitlements (local SQLite).
 */
export function useSubscriptionGuard(): SubscriptionGuard {
  const { entitlements } = useSubscription();
  return useMemo(() => buildSubscriptionGuard(entitlements), [entitlements]);
}
