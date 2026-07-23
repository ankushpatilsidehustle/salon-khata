import { Platform } from "react-native";
import * as Application from "expo-application";

import { getFirebaseAnalyticsAdapter } from "@/observability/adapters/firebase-analytics";
import { setCrashAttribute, setCrashUserId } from "@/observability/crash/crash-reporter";
import { logger } from "@/observability/logging/logger";
import type { Entitlements } from "@/domain/subscription";

export type UserPropertySnapshot = {
  userId?: string | null;
  salonId?: string | null;
  installId?: string | null;
  userRole?: string;
  subscriptionPlan?: string | null;
  trialStatus?: string;
  salonType?: string | null;
  staffCount?: number;
  preferredLanguage?: string | null;
  country?: string | null;
  platform?: string | null;
};

function staffCountBucket(count: number): string {
  if (count <= 0) return "0";
  if (count === 1) return "1";
  if (count <= 5) return "2-5";
  return "6+";
}

function trialStatusFrom(entitlements: Entitlements): string {
  if (entitlements.isOnTrial) return "active";
  if (entitlements.isSubscriptionActive) return "converted";
  if (entitlements.isExpired) return "expired";
  return "none";
}

function fireAndForget(task: () => Promise<void>): void {
  void task().catch((err) => {
    logger.warn("user property update failed", {
      category: "analytics",
      err_code: err instanceof Error ? err.message.slice(0, 80) : "unknown"
    });
  });
}

async function setProperty(name: string, value: string | null): Promise<void> {
  await getFirebaseAnalyticsAdapter().setUserProperty(name, value);
  if (value != null) {
    setCrashAttribute(name, value);
  }
}

/** Identify the signed-in user across Analytics + Crashlytics. */
export function identifyUser(userId: string | null): void {
  fireAndForget(async () => {
    await getFirebaseAnalyticsAdapter().setUserId(userId);
    await setCrashUserId(userId);
  });
}

/** Apply a batch of user properties. Safe to call frequently (debounced at call sites). */
export function setUserProperties(snapshot: UserPropertySnapshot): void {
  fireAndForget(async () => {
    if (snapshot.userId !== undefined) {
      await getFirebaseAnalyticsAdapter().setUserId(snapshot.userId);
      await setCrashUserId(snapshot.userId);
    }

    const appVersion =
      Application.nativeApplicationVersion ??
      Application.applicationId ??
      "unknown";

    const entries: Array<[string, string | null]> = [
      ["user_role", snapshot.userRole ?? "owner"],
      ["subscription_plan", snapshot.subscriptionPlan ?? null],
      ["trial_status", snapshot.trialStatus ?? null],
      ["salon_type", snapshot.salonType ?? null],
      [
        "staff_count_bucket",
        snapshot.staffCount != null
          ? staffCountBucket(snapshot.staffCount)
          : null
      ],
      ["app_version", appVersion],
      ["preferred_language", snapshot.preferredLanguage ?? null],
      ["country", snapshot.country ?? null],
      ["platform", snapshot.platform ?? Platform.OS],
      ["install_id", snapshot.installId ?? null],
      ["salon_id", snapshot.salonId ?? null]
    ];

    for (const [name, value] of entries) {
      if (value == null) continue;
      await setProperty(name, value);
    }
  });
}

export function applyEntitlementProperties(entitlements: Entitlements): void {
  setUserProperties({
    subscriptionPlan: entitlements.planCode ?? entitlements.lifecycle,
    trialStatus: trialStatusFrom(entitlements)
  });
}

export { trialStatusFrom, staffCountBucket };
