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
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";

import { AppBar } from "@/components/core/AppBar";
import { Button } from "@/components/core/Button";
import { EmptyState } from "@/components/core/EmptyState";
import { SectionHeader } from "@/components/core/SectionHeader";
import { SegmentedControl } from "@/components/core/SegmentedControl";
import { MoneyCard } from "@/components/domain/MoneyCard";
import { colors, radius, spacing, typography } from "@/design-system/tokens";
import { calculateDailySummary } from "@/domain/report-service";
import { formatMoney } from "@/domain/money";
import { getUtcTimestamp } from "@/domain/dates";
import { DEV_SALON_ID } from "@/constants/dev";
import { IncomeRepository } from "@/repositories/income-repository";
import type { IncomeTransactionSummary } from "@/repositories/income-repository";
import { ExpenseRepository } from "@/repositories/expense-repository";
import type { ExpenseRecord } from "@/repositories/expense-repository";
import { SalonRepository } from "@/repositories/salon-repository";
import type { RootStackParamList } from "@/application/AppNavigator";
import { TransactionDetailSheet } from "@/features/income/TransactionDetailSheet";
import { ExpenseDetailSheet } from "@/features/expenses/ExpenseDetailSheet";

const incomeRepo = new IncomeRepository();
const expenseRepo = new ExpenseRepository();
const salonRepo = new SalonRepository();

/** Local YYYY-MM-DD (matches `transaction_date` stored by IncomeEntryScreen). */
function toLocalISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDisplayDate(d: Date, locale: string): string {
  return d.toLocaleDateString(locale.startsWith("hi") ? "hi-IN" : "en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short"
  });
}

type ActivityTab = "income" | "expenses";

export function DashboardScreen() {
  const { t, i18n } = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [transactions, setTransactions] = useState<IncomeTransactionSummary[]>(
    []
  );
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [creditOwed, setCreditOwed] = useState(0);
  const [businessName, setBusinessName] = useState(
    t("dashboard.businessNameFallback")
  );
  const [detailTxId, setDetailTxId] = useState<string | null>(null);
  const [detailExpenseId, setDetailExpenseId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ActivityTab>("income");

  const reloadToday = useCallback(() => {
    const today = toLocalISODate(new Date());
    setTransactions(incomeRepo.listByDate(DEV_SALON_ID, today));
    setExpenses(expenseRepo.listByDate(DEV_SALON_ID, today));
    setCreditOwed(expenseRepo.totalCreditOutstanding(DEV_SALON_ID));
    const salon = salonRepo.getById(DEV_SALON_ID);
    setBusinessName(
      salon?.business_name?.trim() || t("dashboard.businessNameFallback")
    );
  }, [t]);

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
                  getUtcTimestamp()
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

  useFocusEffect(
    useCallback(() => {
      reloadToday();
    }, [reloadToday])
  );

  const todaySummary = calculateDailySummary({
    commissionAmounts: transactions.map((tx) => tx.commission_amount),
    expenseAmounts: expenses.map((e) => e.amount),
    incomeAmounts: transactions.map((tx) => tx.net_amount)
  });

  const initials = businessName
    .split(" ")
    .map((word) => word.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const hasTransactions = transactions.length > 0;
  const visibleTransactions = transactions.slice(0, 5);
  const hasExpenses = expenses.length > 0;
  const visibleExpenses = expenses.slice(0, 5);
  const todayLabel = formatDisplayDate(new Date(), i18n.language);

  return (
    <View style={styles.root}>
      <AppBar
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
        <View style={styles.snapshotHeader}>
          <Text style={styles.snapshotLabel}>{t("dashboard.snapshotLabel")}</Text>
          <Text style={styles.snapshotDate}>{todayLabel}</Text>
        </View>

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

        <View style={styles.netBlock}>
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

        <SectionHeader title={t("dashboard.activityLabel")} />

        <SegmentedControl
          value={activeTab}
          onChange={setActiveTab}
          options={[
            { value: "income", label: t("dashboard.tabIncome") },
            { value: "expenses", label: t("dashboard.tabExpenses") }
          ]}
          testID="dash-activity-tabs"
        />

        <View style={styles.activityBody}>
          {activeTab === "income" ? (
            hasTransactions ? (
              <View style={styles.listCard}>
                {visibleTransactions.map((tx, index) => (
                  <Pressable
                    key={tx.id}
                    style={({ pressed }) => [
                      styles.row,
                      index > 0 && styles.rowBorder,
                      pressed && styles.rowPressed
                    ]}
                    onPress={() => setDetailTxId(tx.id)}
                    accessibilityRole="button"
                    accessibilityLabel={tx.services_summary}
                    testID={`dash-tx-${tx.id}`}
                  >
                    <View style={styles.rowMain}>
                      <Text style={styles.rowTitle} numberOfLines={1}>
                        {tx.employees_summary || tx.employee_name_snapshot}
                      </Text>
                      <Text style={styles.rowAmount}>
                        {formatMoney(tx.net_amount)}
                      </Text>
                    </View>
                    <View style={styles.rowSub}>
                      <Text style={styles.rowMeta} numberOfLines={1}>
                        {tx.services_summary || "—"}
                      </Text>
                      <Text style={styles.rowMeta}>
                        {tx.payment_mode.toUpperCase()}
                      </Text>
                    </View>
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

          {activeTab === "expenses" ? (
            hasExpenses ? (
              <View style={styles.listCard}>
                {visibleExpenses.map((exp, index) => (
                  <Pressable
                    key={exp.id}
                    style={({ pressed }) => [
                      styles.row,
                      index > 0 && styles.rowBorder,
                      pressed && styles.rowPressed
                    ]}
                    onPress={() => setDetailExpenseId(exp.id)}
                    accessibilityRole="button"
                    accessibilityLabel={exp.category_name_snapshot}
                    testID={`dash-exp-${exp.id}`}
                  >
                    <View style={styles.rowMain}>
                      <Text style={styles.rowTitle} numberOfLines={1}>
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
                    <View style={styles.rowSub}>
                      {exp.remarks ? (
                        <Text style={styles.rowMeta} numberOfLines={1}>
                          {exp.remarks}
                        </Text>
                      ) : (
                        <View style={styles.rowMetaSpacer} />
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
        </View>

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
        onEdit={(id) =>
          navigation.navigate("IncomeEntry", { transactionId: id })
        }
      />

      <ExpenseDetailSheet
        visible={detailExpenseId !== null}
        expenseId={detailExpenseId}
        onClose={() => setDetailExpenseId(null)}
        onDeleted={reloadToday}
        onEdit={(id) =>
          navigation.navigate("ExpenseEntry", { expenseId: id })
        }
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
    backgroundColor: colors.interactive.selected
  },
  avatarInitials: {
    ...typography.bodyEmphasis,
    color: colors.brand.primary
  },
  snapshotHeader: {
    marginBottom: spacing[3],
    gap: spacing[1]
  },
  snapshotLabel: {
    ...typography.overline,
    color: colors.text.secondary
  },
  snapshotDate: {
    ...typography.h3,
    color: colors.text.primary
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
  netBlock: {
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
  activityBody: {
    marginTop: spacing[3]
  },
  listCard: {
    backgroundColor: colors.surface.default,
    borderRadius: radius.md,
    overflow: "hidden"
  },
  row: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    gap: spacing[1]
  },
  rowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border.subtle
  },
  rowPressed: {
    backgroundColor: colors.interactive.pressed
  },
  rowMain: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing[3]
  },
  rowTitle: {
    ...typography.bodyEmphasis,
    color: colors.text.primary,
    flex: 1
  },
  rowAmount: {
    ...typography.moneyBody,
    color: colors.text.primary
  },
  rowSub: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2]
  },
  rowMeta: {
    ...typography.caption,
    color: colors.text.muted,
    flexShrink: 1
  },
  rowMetaSpacer: {
    flex: 1
  },
  expenseAmount: {
    ...typography.moneyBody,
    color: colors.status.danger
  },
  expenseAmountCredit: {
    color: colors.status.warning
  },
  creditPill: {
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    borderRadius: radius.full,
    backgroundColor: colors.status.dangerBg
  },
  creditPillText: {
    ...typography.overline,
    color: colors.status.danger,
    letterSpacing: 0.4
  },
  paidPill: {
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    borderRadius: radius.full,
    backgroundColor: colors.status.successBg
  },
  paidPillText: {
    ...typography.overline,
    color: colors.status.success,
    letterSpacing: 0.4
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
    marginTop: spacing[3],
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
