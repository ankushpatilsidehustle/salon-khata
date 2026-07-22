import { useMemo } from "react";
import {
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
import type { RootStackParamList } from "@/application/AppNavigator";
import { SubscriptionPlanRepository } from "@/repositories/subscription-plan-repository";
import {
  useRefreshEntitlementsOnFocus,
  useSubscription
} from "./SubscriptionProvider";

const planRepo = new SubscriptionPlanRepository();

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function SubscriptionScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const { entitlements, referralCode, refresh } = useSubscription();
  useRefreshEntitlementsOnFocus();

  const plans = useMemo(() => planRepo.listPurchaseable(), []);

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
        </View>

        <Text style={styles.sectionTitle}>{t("subscription.plansTitle")}</Text>
        <Text style={styles.plansHint}>{t("subscription.paymentsComingSoon")}</Text>
        {plans.map((plan) => (
          <View key={plan.id} style={styles.planRow}>
            <View style={styles.planText}>
              <Text style={styles.planName}>{plan.name}</Text>
              <Text style={styles.planMeta}>
                {t("subscription.planDuration", { days: plan.duration_days })}
              </Text>
            </View>
            <Text style={styles.planPrice}>
              {formatMoney(plan.price_paise)}
            </Text>
          </View>
        ))}

        <Pressable onPress={refresh} style={styles.refresh}>
          <Text style={styles.refreshText}>{t("subscription.refresh")}</Text>
        </Pressable>
      </ScrollView>
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
  planRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.subtle
  },
  planText: {
    flex: 1,
    gap: 2
  },
  planName: {
    ...typography.body,
    color: colors.text.primary
  },
  planMeta: {
    ...typography.caption,
    color: colors.text.muted
  },
  planPrice: {
    ...typography.body,
    color: colors.text.primary,
    fontVariant: ["tabular-nums"]
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
