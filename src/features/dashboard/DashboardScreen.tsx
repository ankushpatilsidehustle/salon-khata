import { useCallback, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { useTranslation } from "react-i18next";
import { useFocusEffect } from "@react-navigation/native";
import { setStatusBarStyle } from "expo-status-bar";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";

import { AppBar } from "@/components/core/AppBar";
import { Button } from "@/components/core/Button";
import { EmptyState } from "@/components/core/EmptyState";
import { MoneyCard } from "@/components/domain/MoneyCard";
import { colors, radius, spacing, typography } from "@/design-system/tokens";
import { calculateDailySummary } from "@/domain/report-service";
import { formatMoney } from "@/domain/money";
import { getUtcTimestamp } from "@/domain/dates";
import { DEV_DEVICE_ID, DEV_SALON_ID } from "@/constants/dev";
import { IncomeRepository } from "@/repositories/income-repository";
import type { IncomeTransactionSummary } from "@/repositories/income-repository";
import { ExpenseRepository } from "@/repositories/expense-repository";
import type { ExpenseRecord } from "@/repositories/expense-repository";
import type { RootStackParamList } from "@/application/AppNavigator";
import { TransactionDetailSheet } from "@/features/income/TransactionDetailSheet";
import { ExpenseDetailSheet } from "@/features/expenses/ExpenseDetailSheet";

const incomeRepo = new IncomeRepository();
const expenseRepo = new ExpenseRepository();

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
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [creditOwed, setCreditOwed] = useState<number>(0);
  const [detailTxId, setDetailTxId] = useState<string | null>(null);
  const [detailExpenseId, setDetailExpenseId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"income" | "expenses">("income");

  const reloadToday = useCallback(() => {
    const today = toLocalISODate(new Date());
    setTransactions(incomeRepo.listByDate(DEV_SALON_ID, today));
    setExpenses(expenseRepo.listByDate(DEV_SALON_ID, today));
    setCreditOwed(expenseRepo.totalCreditOutstanding(DEV_SALON_ID));
  }, []);

  /**
   * One-tap settle-up shortcut on credit rows. Confirms first, then marks
   * the expense as paid and refreshes today's list + credit-owed banner.
   */
  const handleMarkPaid = useCallback(
    (expense: ExpenseRecord) => {
      Alert.alert(
        t("expenses.markPaidConfirmTitle"),
        t("expenses.markPaidConfirmBody"),
        [
          { text: t("common.cancel"), style: "cancel" },
          {
            text: t("expenses.markPaidConfirmCta"),
            onPress: () => {
              try {
                expenseRepo.markCreditPaid(
                  DEV_SALON_ID,
                  expense.id,
                  getUtcTimestamp(),
                  DEV_DEVICE_ID
                );
                reloadToday();
              } catch (err) {
                const message =
                  err instanceof Error ? err.message : String(err);
                Alert.alert(t("expenses.markPaidFailed"), message);
              }
            }
          }
        ]
      );
    },
    [reloadToday, t]
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
      reloadToday();
      return () => setStatusBarStyle("dark");
    }, [reloadToday])
  );

  // Aggregate today's totals from real transactions + expenses.
  const todaySummary = calculateDailySummary({
    commissionAmounts: transactions.map((tx) => tx.commission_amount),
    expenseAmounts: expenses.map((e) => e.amount),
    // Net revenue to the salon = what customers actually paid (after discount).
    incomeAmounts: transactions.map((tx) => tx.net_amount)
  });

  const hasTransactions = transactions.length > 0;
  const visibleTransactions = transactions.slice(0, 5);

  const hasExpenses = expenses.length > 0;
  const visibleExpenses = expenses.slice(0, 5);

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
          <Pressable
            style={styles.peerCard}
            onPress={() => navigation.navigate("CommissionSummary")}
            accessibilityRole="button"
            accessibilityLabel={t("dashboard.commission.today")}
            accessibilityHint={t("dashboard.commission.hint")}
            testID="dash-peer-commission"
          >
            <MoneyCard
              label={t("dashboard.commission.today")}
              amount={todaySummary.commission}
            />
            <Text style={styles.tapHint} numberOfLines={1}>
              {t("dashboard.commission.hint")}
            </Text>
          </Pressable>
        </View>

        <View style={styles.netRow}>
          <MoneyCard
            label={t("dashboard.net.today")}
            amount={todaySummary.netCollection}
            testID="dash-net"
          />
          <Text style={styles.netFormula}>{t("dashboard.net.formula")}</Text>
        </View>

        <View style={styles.ghostRow}>
          <Button
            variant="ghost"
            onPress={() => navigation.navigate("ExpenseEntry")}
            testID="dash-ghost-add-expense"
            accessibilityLabel={t("expense.add")}
          >
            {`+ ${t("expense.add")}`}
          </Button>
        </View>

        {creditOwed > 0 ? (
          <View style={styles.creditBanner} testID="dash-credit-owed">
            <Ionicons
              name="time-outline"
              size={16}
              color={colors.status.danger}
            />
            <Text style={styles.creditBannerText}>
              {t("expenses.creditOwed", { amount: formatMoney(creditOwed) })}
            </Text>
          </View>
        ) : null}

        {/* ── Tabs ────────────────────────────────────────────────── */}
        <View style={styles.tabBar}>
          <Pressable
            style={[
              styles.tabItem,
              activeTab === "income" && styles.tabItemActive
            ]}
            onPress={() => setActiveTab("income")}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === "income" }}
          >
            <Text
              style={[
                styles.tabLabel,
                activeTab === "income" && styles.tabLabelActive
              ]}
            >
              {t("dashboard.recent.title")}
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.tabItem,
              activeTab === "expenses" && styles.tabItemActive
            ]}
            onPress={() => setActiveTab("expenses")}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === "expenses" }}
          >
            <Text
              style={[
                styles.tabLabel,
                activeTab === "expenses" && styles.tabLabelActive
              ]}
            >
              {t("expenses.todayList")}
            </Text>
          </Pressable>
        </View>

        {/* ── Income tab ──────────────────────────────────────────── */}
        {activeTab === "income" ? (
          hasTransactions ? (
            <View style={styles.transactionList}>
              {visibleTransactions.map((tx) => (
                <Pressable
                  key={tx.id}
                  style={({ pressed }) => [
                    styles.transactionRow,
                    pressed && styles.transactionRowPressed
                  ]}
                  onPress={() => setDetailTxId(tx.id)}
                  accessibilityRole="button"
                  accessibilityLabel={tx.services_summary}
                  testID={`dash-tx-${tx.id}`}
                >
                  <View style={styles.transactionHeader}>
                    <Text style={styles.transactionName} numberOfLines={1}>
                      {tx.employees_summary || tx.employee_name_snapshot}
                    </Text>
                    <View style={styles.transactionRight}>
                      <Text style={styles.transactionAmount}>
                        {formatMoney(tx.net_amount)}
                      </Text>
                      <Text style={styles.transactionMode}>
                        {tx.payment_mode.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.transactionServices} numberOfLines={1}>
                    {tx.services_summary || "—"}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : (
            <EmptyState
              icon={t("dashboard.empty.icon")}
              title={t("dashboard.empty.title")}
              body={t("dashboard.empty.body")}
              testID="dash-empty"
            />
          )
        ) : null}

        {/* ── Expenses tab ────────────────────────────────────────── */}
        {activeTab === "expenses" ? (
          hasExpenses ? (
            <View style={styles.transactionList}>
              {visibleExpenses.map((exp) => (
                <Pressable
                  key={exp.id}
                  style={({ pressed }) => [
                    styles.transactionRow,
                    pressed && styles.transactionRowPressed
                  ]}
                  onPress={() => setDetailExpenseId(exp.id)}
                  accessibilityRole="button"
                  accessibilityLabel={exp.category_name_snapshot}
                  testID={`dash-exp-${exp.id}`}
                >
                  <View style={styles.transactionHeader}>
                    <Text style={styles.transactionName} numberOfLines={1}>
                      {exp.category_name_snapshot}
                    </Text>
                    <Text
                      style={[
                        styles.expenseAmount,
                        exp.payment_mode === "credit" &&
                          exp.settled_at === null &&
                          styles.expenseAmountCredit
                      ]}
                    >
                      −{formatMoney(exp.amount)}
                    </Text>
                  </View>
                  <View style={styles.expenseSubRow}>
                    {exp.remarks ? (
                      <Text
                        style={styles.transactionServices}
                        numberOfLines={1}
                      >
                        {exp.remarks}
                      </Text>
                    ) : (
                      <View style={{ flex: 1 }} />
                    )}
                    {exp.payment_mode === "credit" &&
                    exp.settled_at === null ? (
                      <>
                        <View style={styles.creditPill}>
                          <Text style={styles.creditPillText}>
                            {t("expenses.creditBadge")}
                          </Text>
                        </View>
                        <Pressable
                          onPress={() => handleMarkPaid(exp)}
                          hitSlop={8}
                          style={({ pressed }) => [
                            styles.markPaidBtn,
                            pressed && styles.markPaidBtnPressed
                          ]}
                          accessibilityRole="button"
                          accessibilityLabel={t("expenses.markPaid")}
                          testID={`dash-exp-${exp.id}-mark-paid`}
                        >
                          <Ionicons
                            name="checkmark-circle-outline"
                            size={14}
                            color={colors.status.success}
                          />
                          <Text style={styles.markPaidBtnText}>
                            {t("expenses.markPaid")}
                          </Text>
                        </Pressable>
                      </>
                    ) : exp.payment_mode === "credit" &&
                      exp.settled_at !== null ? (
                      <View style={styles.paidPill}>
                        <Text style={styles.paidPillText}>
                          {t("expenses.paidBadge")}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </Pressable>
              ))}
            </View>
          ) : (
            <EmptyState
              icon="💸"
              title={t("expenses.todayNone")}
              body={t("expenses.noCategories")}
              testID="dash-expenses-empty"
            />
          )
        ) : null}

        <View style={styles.syncLineWrapper}>
          <Text style={styles.syncLine} accessibilityLiveRegion="polite">
            {t("sync.line.neverSynced")}
          </Text>
        </View>
      </ScrollView>

      <TransactionDetailSheet
        visible={detailTxId !== null}
        transactionId={detailTxId}
        onClose={() => setDetailTxId(null)}
        onDeleted={reloadToday}
        onEdit={(id) => navigation.navigate("IncomeEntry", { transactionId: id })}
      />

      <ExpenseDetailSheet
        visible={detailExpenseId !== null}
        expenseId={detailExpenseId}
        onClose={() => setDetailExpenseId(null)}
        onDeleted={reloadToday}
        onEdit={(id) => navigation.navigate("ExpenseEntry", { expenseId: id })}
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
    paddingBottom: spacing[6]
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
  tapHint: {
    ...typography.caption,
    color: colors.text.muted,
    marginTop: spacing[1],
    marginLeft: spacing[1]
  },
  netRow: {
    marginTop: spacing[3],
    gap: spacing[1]
  },
  netFormula: {
    ...typography.caption,
    color: colors.text.muted,
    marginLeft: spacing[1]
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
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    gap: 2
  },
  transactionRowPressed: {
    backgroundColor: colors.interactive.pressed
  },
  transactionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  transactionName: {
    ...typography.bodySmall,
    color: colors.text.primary,
    fontWeight: "600",
    flex: 1,
    marginRight: spacing[2]
  },
  transactionRight: {
    alignItems: "flex-end"
  },
  transactionAmount: {
    ...typography.moneyBody,
    color: colors.text.primary
  },
  transactionMode: {
    ...typography.caption,
    color: colors.text.muted
  },
  transactionServices: {
    ...typography.caption,
    color: colors.text.muted
  },
  tabBar: {
    flexDirection: "row",
    backgroundColor: colors.background.subtle,
    borderRadius: radius.md,
    padding: 3,
    marginBottom: spacing[3]
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: spacing[2],
    borderRadius: radius.md - 1
  },
  tabItemActive: {
    backgroundColor: colors.surface.default,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 2
  },
  tabLabel: {
    ...typography.bodySmall,
    color: colors.text.secondary
  },
  tabLabelActive: {
    color: colors.brand.primary,
    fontWeight: "700"
  },
  expenseAmount: {
    ...typography.moneyBody,
    color: colors.status.danger
  },
  expenseAmountCredit: {
    color: colors.status.warning
  },
  expenseSubRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2]
  },
  creditPill: {
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    borderRadius: radius.full,
    backgroundColor: colors.status.dangerBg,
    alignSelf: "flex-start"
  },
  creditPillText: {
    ...typography.caption,
    color: colors.status.danger,
    fontWeight: "700",
    letterSpacing: 0.5
  },
  paidPill: {
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    borderRadius: radius.full,
    backgroundColor: colors.status.successBg,
    alignSelf: "flex-start"
  },
  paidPillText: {
    ...typography.caption,
    color: colors.status.success,
    fontWeight: "700",
    letterSpacing: 0.5
  },
  markPaidBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing[2],
    paddingVertical: 4,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.status.success,
    backgroundColor: colors.surface.default
  },
  markPaidBtnPressed: {
    backgroundColor: colors.status.successBg
  },
  markPaidBtnText: {
    ...typography.caption,
    color: colors.status.success,
    fontWeight: "700"
  },
  creditBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
    padding: spacing[3],
    borderRadius: radius.md,
    backgroundColor: colors.status.dangerBg,
    borderWidth: 1,
    borderColor: colors.status.danger
  },
  creditBannerText: {
    ...typography.bodySmall,
    color: colors.status.danger,
    fontWeight: "600",
    flex: 1
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