import { useMemo, useEffect, useState, useCallback } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View
} from "react-native";
import { useTranslation } from "react-i18next";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";

import { AppBar } from "@/components/core/AppBar";
import { Button } from "@/components/core/Button";
import { colors, radius, spacing, typography } from "@/design-system/tokens";
import { formatMoney } from "@/domain/money";
import {
  buildSubscriptionGuard,
  type Entitlements
} from "@/domain/subscription";
import type { RootStackParamList } from "@/application/AppNavigator";
import { SubscriptionPlanRepository } from "@/repositories/subscription-plan-repository";
import type { SubscriptionPlanRecord } from "@/repositories/subscription-plan-repository";
import {
  createBillingCheckout,
  verifyBillingPayment,
  type PurchaseablePlanCode
} from "@/cloud/razorpay-billing";
import { syncScheduler } from "@/sync/sync-scheduler";
import { useAuth } from "@/features/auth/AuthProvider";
import { Events, logger, track } from "@/observability";
import {
  useRefreshEntitlementsOnFocus,
  useSubscription
} from "./SubscriptionProvider";
import { openRazorpayCheckout } from "./razorpay-checkout";

const planRepo = new SubscriptionPlanRepository();

/** Days remaining at/below which we treat the trial as "expiring soon". */
const TRIAL_EXPIRING_DAYS = 7;

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function SubscriptionScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const { salonId } = useAuth();
  const { entitlements, referralCode, refresh } = useSubscription();
  useRefreshEntitlementsOnFocus();

  const [purchasingCode, setPurchasingCode] = useState<string | null>(null);
  const plans = useMemo(() => planRepo.listPurchaseable(), []);
  const guard = useMemo(
    () => buildSubscriptionGuard(entitlements),
    [entitlements]
  );

  useEffect(() => {
    track(Events.subscription.screenViewed, {
      lifecycle: entitlements.lifecycle,
      remaining_days: entitlements.remainingDays
    });
    if (entitlements.isExpired) {
      track(Events.subscription.softLockShown, {
        lifecycle: entitlements.lifecycle
      });
    } else if (
      entitlements.isOnTrial &&
      entitlements.remainingDays > 0 &&
      entitlements.remainingDays <= TRIAL_EXPIRING_DAYS
    ) {
      track(Events.subscription.trialExpiringShown, {
        remaining_days: entitlements.remainingDays
      });
    }
    // Fire once on mount for this screen visit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const statusLabel = (() => {
    switch (entitlements.lifecycle) {
      case "trial":
        return t("subscription.status.trial");
      case "active":
        return t("subscription.status.active");
      case "grace":
        return t("subscription.status.grace");
      case "expired":
        return t("subscription.status.expired");
      default:
        return t("subscription.status.none");
    }
  })();

  async function handleShareCode() {
    if (!referralCode) return;
    try {
      await Share.share({
        message: t("subscription.referral.shareMessage", {
          code: referralCode.code
        })
      });
    } catch {
      Alert.alert(t("subscription.referral.yourCode"), referralCode.code);
    }
  }

  const refreshAfterPurchase = useCallback(async () => {
    try {
      await syncScheduler.runNow();
    } catch (err) {
      logger.warn("subscription.sync_after_purchase_failed", {
        error: err instanceof Error ? err.message : String(err)
      });
    }
    refresh();
  }, [refresh]);

  async function handlePurchase(plan: SubscriptionPlanRecord) {
    if (!salonId) return;
    if (plan.code !== "monthly" && plan.code !== "yearly") return;
    if (purchasingCode) return;

    const planCode = plan.code as PurchaseablePlanCode;
    track(Events.subscription.planSelected, { plan_code: planCode });
    setPurchasingCode(planCode);

    try {
      const checkout = await createBillingCheckout({ salonId, planCode });
      if (!checkout.ok) {
        Alert.alert(
          t("subscription.purchase.failedTitle"),
          checkoutReasonMessage(t, checkout.reason, checkout.message)
        );
        return;
      }

      track(Events.subscription.checkoutStarted, {
        plan_code: planCode,
        subscription_id: checkout.subscriptionId
      });

      const payment = await openRazorpayCheckout({
        keyId: checkout.keyId,
        subscriptionId: checkout.subscriptionId,
        name: checkout.name,
        description: checkout.description,
        amountPaise: checkout.amountPaise,
        currency: checkout.currency,
        themeColor: checkout.themeColor,
        shortUrl: checkout.shortUrl
      });

      if (!payment.ok) {
        if (payment.error.code === "cancelled") {
          track(Events.subscription.checkoutCancelled, { plan_code: planCode });
          return;
        }
        if (payment.error.code === "unavailable") {
          Alert.alert(
            t("subscription.purchase.browserTitle"),
            t("subscription.purchase.browserBody")
          );
          return;
        }
        track(Events.subscription.checkoutFailed, {
          plan_code: planCode,
          reason: payment.error.description
        });
        Alert.alert(
          t("subscription.purchase.failedTitle"),
          payment.error.description || t("subscription.purchase.failedBody")
        );
        return;
      }

      const verified = await verifyBillingPayment({
        salonId,
        planCode,
        razorpayPaymentId: payment.data.razorpay_payment_id,
        razorpaySubscriptionId: payment.data.razorpay_subscription_id,
        razorpaySignature: payment.data.razorpay_signature
      });

      if (!verified.ok) {
        track(Events.subscription.checkoutFailed, {
          plan_code: planCode,
          reason: verified.reason
        });
        Alert.alert(
          t("subscription.purchase.verifyPendingTitle"),
          t("subscription.purchase.verifyPendingBody")
        );
        await refreshAfterPurchase();
        return;
      }

      track(Events.subscription.checkoutSucceeded, {
        plan_code: planCode,
        already_processed: verified.alreadyProcessed
      });
      await refreshAfterPurchase();
      Alert.alert(
        t("subscription.purchase.successTitle"),
        t("subscription.purchase.successBody")
      );
    } catch (err) {
      logger.error("subscription.purchase_unexpected", {
        error: err instanceof Error ? err.message : String(err)
      });
      Alert.alert(
        t("subscription.purchase.failedTitle"),
        t("subscription.purchase.failedBody")
      );
    } finally {
      setPurchasingCode(null);
    }
  }

  return (
    <View style={styles.root}>
      <AppBar
        title={t("subscription.title")}
        leading={
          <Pressable
            onPress={() => navigation.goBack()}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t("common.back")}
          >
            <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
          </Pressable>
        }
      />
      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <Text style={styles.heroLabel}>{t("subscription.currentPlan")}</Text>
          <Text style={styles.heroTitle}>
            {entitlements.planName ?? t("subscription.status.none")}
          </Text>
          <Text style={styles.heroStatus}>{statusLabel}</Text>
          {entitlements.remainingDays > 0 ? (
            <Text style={styles.heroDays}>
              {t("subscription.remainingDays", {
                count: entitlements.remainingDays
              })}
            </Text>
          ) : null}
          {entitlements.endAt ? (
            <Text style={styles.heroMeta}>
              {t("subscription.validUntil", {
                date: entitlements.endAt.slice(0, 10)
              })}
            </Text>
          ) : null}
        </View>

        {entitlements.isExpired ? (
          <View style={styles.banner}>
            <Ionicons
              name="lock-closed-outline"
              size={18}
              color={colors.status.warning}
            />
            <Text style={styles.bannerText}>
              {t("subscription.expiredBanner")}
            </Text>
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>{t("subscription.featuresTitle")}</Text>
        <FeatureRow
          ok={entitlements.assignStaffOnBill}
          label={t("subscription.features.assignStaff")}
        />
        <FeatureRow
          ok={entitlements.accessReports}
          label={t("subscription.features.reports")}
        />
        <FeatureRow
          ok={entitlements.manageStaff}
          label={t("subscription.features.manageStaff")}
        />
        <FeatureRow
          ok={entitlements.premiumFeatures}
          label={t("subscription.features.premium")}
        />

        <Text style={styles.sectionTitle}>{t("subscription.plansTitle")}</Text>
        <Text style={styles.plansHint}>{t("subscription.plansHint")}</Text>
        {plans.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            entitlements={entitlements}
            busy={purchasingCode === plan.code}
            disabled={purchasingCode != null}
            isCurrent={
              guard.planCode === plan.code &&
              (guard.isSubscriptionActive || guard.isOnTrial)
            }
            onPurchase={() => {
              void handlePurchase(plan);
            }}
            t={t}
          />
        ))}

        <Text style={styles.sectionTitle}>{t("subscription.referral.title")}</Text>
        <View style={styles.codeCard}>
          <Text style={styles.codeLabel}>{t("subscription.referral.yourCode")}</Text>
          <Text style={styles.codeValue}>
            {referralCode?.code ?? "—"}
          </Text>
          <Button
            variant="secondary"
            onPress={() => {
              if (!referralCode) return;
              void handleShareCode();
            }}
          >
            {t("subscription.referral.share")}
          </Button>
          <Text style={styles.codeHint}>{t("subscription.referral.hint")}</Text>
          <Text style={styles.codeHint}>
            {t("subscription.referral.rewardRule")}
          </Text>
        </View>

        <Pressable
          onPress={() => {
            void refreshAfterPurchase();
          }}
          style={styles.refresh}
        >
          <Text style={styles.refreshText}>{t("subscription.refresh")}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function PlanCard({
  plan,
  entitlements,
  busy,
  disabled,
  isCurrent,
  onPurchase,
  t
}: {
  plan: SubscriptionPlanRecord;
  entitlements: Entitlements;
  busy: boolean;
  disabled: boolean;
  isCurrent: boolean;
  onPurchase: () => void;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const cycleLabel =
    plan.billing_period === "year"
      ? t("subscription.billingCycle.yearly")
      : t("subscription.billingCycle.monthly");

  return (
    <View style={[styles.planCard, isCurrent && styles.planCardCurrent]}>
      <View style={styles.planHeader}>
        <View style={styles.planText}>
          <Text style={styles.planName}>{plan.name}</Text>
          <Text style={styles.planMeta}>{cycleLabel}</Text>
        </View>
        <Text style={styles.planPrice}>{formatMoney(plan.price_paise)}</Text>
      </View>

      <FeatureRow ok label={t("subscription.features.assignStaff")} />
      <FeatureRow ok label={t("subscription.features.reports")} />
      <FeatureRow ok label={t("subscription.features.manageStaff")} />
      <FeatureRow ok label={t("subscription.features.premium")} />

      {isCurrent && !entitlements.isExpired ? (
        <Text style={styles.currentBadge}>
          {t("subscription.purchase.currentPlanBadge")}
        </Text>
      ) : (
        <Pressable
          onPress={onPurchase}
          disabled={disabled}
          style={[styles.buyButton, disabled && styles.buyButtonDisabled]}
          accessibilityRole="button"
        >
          {busy ? (
            <ActivityIndicator color={colors.text.inverse} />
          ) : (
            <Text style={styles.buyButtonText}>
              {t("subscription.purchase.subscribe")}
            </Text>
          )}
        </Pressable>
      )}
    </View>
  );
}

function FeatureRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <View style={styles.featureRow}>
      <Ionicons
        name={ok ? "checkmark-circle" : "close-circle"}
        size={18}
        color={ok ? colors.status.success : colors.text.muted}
      />
      <Text style={styles.featureLabel}>{label}</Text>
    </View>
  );
}

function checkoutReasonMessage(
  t: (key: string, opts?: Record<string, unknown>) => string,
  reason: string,
  message?: string
): string {
  switch (reason) {
    case "offline":
      return t("subscription.purchase.offline");
    case "razorpay_not_configured":
      return t("subscription.purchase.notConfigured");
    case "timeout":
      return t("subscription.purchase.timeout");
    default:
      return message || t("subscription.purchase.failedBody");
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background.default
  },
  body: {
    padding: spacing[4],
    paddingBottom: spacing[8],
    gap: spacing[3]
  },
  hero: {
    backgroundColor: colors.surface.default,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    padding: spacing[4],
    gap: spacing[1]
  },
  heroLabel: {
    ...typography.overline,
    color: colors.text.secondary
  },
  heroTitle: {
    ...typography.h1,
    color: colors.text.primary
  },
  heroStatus: {
    ...typography.body,
    color: colors.brand.primary,
    marginTop: spacing[1]
  },
  heroDays: {
    ...typography.body,
    color: colors.text.primary
  },
  heroMeta: {
    ...typography.caption,
    color: colors.text.muted
  },
  banner: {
    flexDirection: "row",
    gap: spacing[2],
    alignItems: "flex-start",
    backgroundColor: colors.background.subtle,
    borderRadius: radius.md,
    padding: spacing[3]
  },
  bannerText: {
    ...typography.body,
    color: colors.text.secondary,
    flex: 1
  },
  sectionTitle: {
    ...typography.overline,
    color: colors.text.secondary,
    marginTop: spacing[3]
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2]
  },
  featureLabel: {
    ...typography.body,
    color: colors.text.primary
  },
  codeCard: {
    backgroundColor: colors.surface.default,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    padding: spacing[4],
    gap: spacing[2]
  },
  codeLabel: {
    ...typography.caption,
    color: colors.text.secondary
  },
  codeValue: {
    ...typography.h2,
    color: colors.text.primary,
    letterSpacing: 2
  },
  codeHint: {
    ...typography.caption,
    color: colors.text.muted
  },
  plansHint: {
    ...typography.caption,
    color: colors.text.muted
  },
  planCard: {
    backgroundColor: colors.surface.default,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    padding: spacing[4],
    gap: spacing[2]
  },
  planCardCurrent: {
    borderColor: colors.brand.primary
  },
  planHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing[1]
  },
  planText: {
    flex: 1,
    gap: 2
  },
  planName: {
    ...typography.h2,
    color: colors.text.primary
  },
  planMeta: {
    ...typography.caption,
    color: colors.text.muted
  },
  planPrice: {
    ...typography.h2,
    color: colors.text.primary,
    fontVariant: ["tabular-nums"]
  },
  currentBadge: {
    ...typography.caption,
    color: colors.brand.primary,
    marginTop: spacing[1]
  },
  buyButton: {
    marginTop: spacing[2],
    backgroundColor: colors.brand.primary,
    borderRadius: radius.md,
    paddingVertical: spacing[3],
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44
  },
  buyButtonDisabled: {
    opacity: 0.6
  },
  buyButtonText: {
    ...typography.body,
    color: colors.text.inverse,
    fontWeight: "600"
  },
  refresh: {
    alignSelf: "center",
    padding: spacing[3]
  },
  refreshText: {
    ...typography.caption,
    color: colors.brand.primary
  }
});
