import { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useFocusEffect } from "@react-navigation/native";
import { setStatusBarStyle } from "expo-status-bar";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { AppBar } from "@/components/core/AppBar";
import { Button } from "@/components/core/Button";
import { EmptyState } from "@/components/core/EmptyState";
import { Fab } from "@/components/core/Fab";
import { SectionHeader } from "@/components/core/SectionHeader";
import { MoneyCard } from "@/components/domain/MoneyCard";
import { colors, spacing, typography } from "@/design-system/tokens";
import { calculateDailySummary } from "@/domain/report-service";
import { formatMoney } from "@/domain/money";
import { DEV_SALON_ID } from "@/constants/dev";
import { IncomeRepository } from "@/repositories/income-repository";
import type { IncomeTransactionSummary } from "@/repositories/income-repository";
import type { RootStackParamList } from "@/application/AppNavigator";

const incomeRepo = new IncomeRepository();

/** Local YYYY-MM-DD (matches `transaction_date` stored by IncomeEntryScreen). */
function toLocalISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function DashboardScreen() {
  const { t } = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [transactions, setTransactions] = useState<IncomeTransactionSummary[]>(
    []
  );

  const businessName = t("dashboard.businessNameFallback");
  const initials = businessName
    .split(" ")
    .map((word) => word.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();

  // Light status bar icons to contrast against the brand purple AppBar, and
  // reload today's transactions every time the tab is focused.
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle("light");
      const today = toLocalISODate(new Date());
      setTransactions(incomeRepo.listByDate(DEV_SALON_ID, today));
      return () => setStatusBarStyle("dark");
    }, [])
  );

  // Aggregate today's totals from real transactions. Expenses are still Wave 5.
  const todaySummary = calculateDailySummary({
    commissionAmounts: transactions.map((tx) => tx.commission_amount),
    expenseAmounts: [],
    // Net revenue to the salon = what customers actually paid (after discount).
    incomeAmounts: transactions.map((tx) => tx.net_amount)
  });

  const hasTransactions = transactions.length > 0;
  const visibleTransactions = transactions.slice(0, 5);
  const showViewAll = transactions.length > 5;

  return (
    <View style={styles.root}>
      <AppBar
        variant="brand"
        title={businessName}
        trailing={
          <View
            style={styles.avatar}
            accessible
            accessibilityRole="image"
            accessibilityLabel={t("common.profile")}
          >
            <Text style={styles.avatarInitials}>{initials}</Text>
          </View>
        }
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <MoneyCard
          variant="hero"
          label={t("dashboard.income.today")}
          amount={todaySummary.income}
          accessibilityLabel={t("dashboard.income.today")}
          testID="dash-hero-income"
        />

        <View style={styles.peerRow}>
          <MoneyCard
            style={styles.peerCard}
            label={t("dashboard.expenses.today")}
            amount={todaySummary.expenses}
            testID="dash-peer-expenses"
          />
          <MoneyCard
            style={styles.peerCard}
            label={t("dashboard.net.today")}
            amount={todaySummary.netCollection}
            testID="dash-peer-net"
          />
        </View>

        <View style={styles.ghostRow}>
          <Button
            variant="ghost"
            onPress={() => undefined}
            testID="dash-ghost-add-expense"
            accessibilityLabel={t("expense.add")}
          >
            {`+ ${t("expense.add")}`}
          </Button>
        </View>

        <SectionHeader
          title={t("dashboard.recent.title")}
          actionLabel={
            showViewAll
              ? t("dashboard.recent.viewAll", { count: transactions.length })
              : undefined
          }
          onAction={showViewAll ? () => undefined : undefined}
        />

        {hasTransactions ? (
          <View style={styles.transactionList}>
            {visibleTransactions.map((tx) => (
              <View key={tx.id} style={styles.transactionRow} testID={`dash-tx-${tx.id}`}>
                <View style={styles.transactionHeader}>
                  <Text style={styles.transactionName} numberOfLines={1}>
                    {tx.employees_summary || tx.employee_name_snapshot}
                  </Text>
                  <Text style={styles.transactionMode}>
                    {tx.payment_mode.toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.transactionServices} numberOfLines={1}>
                  {tx.services_summary || "—"}
                </Text>
                <View style={styles.transactionAmountRow}>
                  <Text style={styles.transactionAmount}>
                    {formatMoney(tx.net_amount)}
                  </Text>
                  {tx.commission_amount > 0 ? (
                    <Text style={styles.transactionCommission}>
                      {t("income.commissionShort", {
                        amount: formatMoney(tx.commission_amount)
                      })}
                    </Text>
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        ) : (
          <EmptyState
            icon={t("dashboard.empty.icon")}
            title={t("dashboard.empty.title")}
            body={t("dashboard.empty.body")}
            testID="dash-empty"
          />
        )}

        <View style={styles.syncLineWrapper}>
          <Text style={styles.syncLine} accessibilityLiveRegion="polite">
            {t("sync.line.neverSynced")}
          </Text>
        </View>
      </ScrollView>

      <Fab
        label={t("income.add")}
        onPress={() => navigation.navigate("IncomeEntry")}
        accessibilityLabel={t("income.add")}
        testID="dash-fab-add-income"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background.default
  },
  scrollContent: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[4],
    // Leave room for the FAB (56 dp) + 16 dp bottom inset + a little breathing.
    paddingBottom: spacing[9] + spacing[5]
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.2)"
  },
  avatarInitials: {
    ...typography.bodyEmphasis,
    color: colors.text.inverse
  },
  peerRow: {
    flexDirection: "row",
    gap: spacing[3],
    marginTop: spacing[3]
  },
  peerCard: {
    flex: 1
  },
  ghostRow: {
    marginTop: spacing[2],
    alignSelf: "flex-start"
  },
  transactionList: {
    gap: spacing[2]
  },
  transactionRow: {
    backgroundColor: colors.surface.default,
    borderRadius: 12,
    padding: spacing[4],
    gap: spacing[1]
  },
  transactionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  transactionName: {
    ...typography.bodyEmphasis,
    color: colors.text.primary
  },
  transactionMode: {
    ...typography.caption,
    color: colors.text.secondary
  },
  transactionServices: {
    ...typography.bodySmall,
    color: colors.text.secondary
  },
  transactionAmountRow: {
    alignItems: "flex-end"
  },
  transactionAmount: {
    ...typography.moneyBody,
    color: colors.text.primary
  },
  transactionCommission: {
    ...typography.caption,
    color: colors.text.muted
  },
  syncLineWrapper: {
    marginTop: spacing[5],
    alignItems: "center"
  },
  syncLine: {
    ...typography.bodySmall,
    color: colors.text.muted,
    textAlign: "center"
  }
});