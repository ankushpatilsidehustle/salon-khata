import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import { useFocusEffect } from "@react-navigation/native";

import { eventBus } from "@/application/event-bus";
import {
  lockedEntitlements,
  type Entitlements
} from "@/domain/subscription";
import {
  ensureSalonBillingBootstrap,
  getEntitlementsForSalon
} from "@/repositories/subscription-bootstrap";
import { ReferralRepository } from "@/repositories/referral-repository";
import type { ReferralCodeRecord } from "@/repositories/referral-repository";
import { useAuth } from "@/features/auth/AuthProvider";
import { applyEntitlementProperties, setCrashAttributes } from "@/observability";

type SubscriptionContextValue = {
  entitlements: Entitlements;
  referralCode: ReferralCodeRecord | null;
  refresh: () => void;
};

const SubscriptionContext = createContext<SubscriptionContextValue | null>(
  null
);

const referralRepo = new ReferralRepository();

type Props = {
  children: ReactNode;
};

/**
 * App-wide subscription entitlements. Mount under AuthProvider once the
 * user is signed in with a salon (see AppRoot).
 */
export function SubscriptionProvider({ children }: Props) {
  const { salonId, status } = useAuth();
  const [entitlements, setEntitlements] = useState<Entitlements>(
    lockedEntitlements
  );
  const [referralCode, setReferralCode] = useState<ReferralCodeRecord | null>(
    null
  );

  const refresh = useCallback(() => {
    if (!salonId || status !== "signed-in") {
      setEntitlements(lockedEntitlements());
      setReferralCode(null);
      return;
    }
    ensureSalonBillingBootstrap(salonId);
    const next = getEntitlementsForSalon(salonId);
    setEntitlements(next);
    setReferralCode(referralRepo.getCodeForSalon(salonId));
    applyEntitlementProperties(next);
    setCrashAttributes({
      subscription_plan: next.planCode ?? next.lifecycle,
      trial_status: next.isOnTrial
        ? "active"
        : next.isSubscriptionActive
          ? "converted"
          : next.isExpired
            ? "expired"
            : "none"
    });
  }, [salonId, status]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    return eventBus.on("db:dirty", () => {
      refresh();
    });
  }, [refresh]);

  const value = useMemo(
    () => ({ entitlements, referralCode, refresh }),
    [entitlements, referralCode, refresh]
  );

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription(): SubscriptionContextValue {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) {
    throw new Error("useSubscription() called outside <SubscriptionProvider>");
  }
  return ctx;
}

/** Safe optional hook for screens that may render outside the provider. */
export function useSubscriptionOptional(): SubscriptionContextValue | null {
  return useContext(SubscriptionContext);
}

/** Refresh entitlements whenever a screen regains focus. */
export function useRefreshEntitlementsOnFocus(): void {
  const { refresh } = useSubscription();
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );
}
