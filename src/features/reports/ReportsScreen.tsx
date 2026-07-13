// Reports tab — numeric-first business report with a Day / Week / Month /
// Custom period selector at the top and the following sections:
//   1. Hero Income (net)
//   2. Expenses + Net collection row
//   3. Commission (tap → CommissionSummary with the same period)
//   4. Bill stats — count + avg
//   5. Top employees (top 3 + "View all")
//   6. Top services   (top 3 + "View all")
//   7. Payment split (bars for cash / upi / card / credit / other)
//   8. Customers — new vs repeat + walk-in bill count
//   9. Transactions — chronological list, tap → IncomeEntry for edit
// A single empty state replaces sections 2-9 when the period has no bills
// AND no expenses (so a range with only expenses still renders normally).

import { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";

import { AppBar } from "@/components/core/AppBar";
import { EmptyState } from "@/components/core/EmptyState";
import { MoneyCard } from "@/components/domain/MoneyCard";
import { PeriodSelector } from "@/components/domain/PeriodSelector";
import { colors, radius, spacing, typography } from "@/design-system/tokens";
import { DEV_SALON_ID } from "@/constants/dev";
import { formatMoney } from "@/domain/money";
import { makeDayPeriod, type Period } from "@/domain/period";
import {
  IncomeRepository,
  type EmployeeRevenueTotal,
  type IncomeTransactionSummary,
  type NewVsRepeatCounts,
  type PaymentModeTotals,
  type ServiceRevenueTotal
} from "@/repositories/income-repository";
import { ExpenseRepository } from "@/repositories/expense-repository";
import type { RootStackParamList } from "@/application/AppNavigator";

const incomeRepo = new IncomeRepository();
const expenseRepo = new ExpenseRepository();

// ─── Screen ──────────────────────────────────────────────────────────────────

export function ReportsScreen() {
  const { t } = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [period, setPeriod] = useState<Period>(makeDayPeriod(new Date()));

  const [income, setIncome] = useState(0);
  const [expenses, setExpenses] = useState(0);
  const [commission, setCommission] = useState(0);
  const [billCount, setBillCount] = useState(0);
  const [avgBill, setAvgBill] = useState(0);
  const [topEmps, setTopEmps] = useState<EmployeeRevenueTotal[]>([]);
  const [topSvcs, setTopSvcs] = useState<ServiceRevenueTotal[]>([]);
  const [paySplit, setPaySplit] = useState<PaymentModeTotals>({});
  const [custCounts, setCustCounts] = useState<NewVsRepeatCounts>({
    newCustomers: 0,
    repeatCustomers: 0,
    walkIns: 0
  });
  const [bills, setBills] = useState<IncomeTransactionSummary[]>([]);

  const reload = useCallback(() => {
    const start = period.start;
    const end = period.end;
    setIncome(incomeRepo.sumIncomeBetween(DEV_SALON_ID, start, end));
    setExpenses(expenseRepo.sumBetween(DEV_SALON_ID, start, end));
    const commissionRows = incomeRepo.sumCommissionByEmployee(
      DEV_SALON_ID,
      start,
      end
    );
    setCommission(
      commissionRows.reduce((s, r) => s + r.commission_amount, 0)
    );
    const stats = incomeRepo.countBillsBetween(DEV_SALON_ID, start, end);
    setBillCount(stats.count);
    setAvgBill(stats.avg);
    setTopEmps(incomeRepo.topEmployeesByRevenue(DEV_SALON_ID, start, end, 3));
    setTopSvcs(incomeRepo.topServicesByRevenue(DEV_SALON_ID, start, end, 3));
    setPaySplit(incomeRepo.paymentModeSplit(DEV_SALON_ID, start, end));
    setCustCounts(incomeRepo.newVsRepeatCounts(DEV_SALON_ID, start, end));
    setBills(incomeRepo.listBillsBetween(DEV_SALON_ID, start, end));
  }, [period.start, period.end]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  const net = income - expenses - commission;
  const hasAnyActivity = billCount > 0 || expenses > 0;

  const goCommission = () =>
    navigation.navigate("CommissionSummary", {
      start: period.start,
      end: period.end,
      mode: period.mode
    });

  const goTopEmployees = () =>
    navigation.navigate("TopEmployees", {
      start: period.start,
      end: period.end,
      mode: period.mode
    });

  const goTopServices = () =>
    navigation.navigate("TopServices", {
      start: period.start,
      end: period.end,
      mode: period.mode
    });

  return (
    <View style={styles.root}>
      <AppBar title={t("reports.title")} />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <PeriodSelector value={period} onChange={setPeriod} />

        {!hasAnyActivity ? (
          <EmptyState
            icon="📊"
            title={t("reports.empty.title")}
            body={t("reports.empty.body")}
            actionLabel={t("reports.empty.cta")}
            onAction={() => navigation.navigate("IncomeEntry")}
          />
        ) : (
          <>
            <MoneyCard
              variant="hero"
              label={t("reports.metrics.income")}
              amount={income}
              testID="reports-hero-income"
            />

            <View style={styles.peerRow}>
              <MoneyCard
                style={styles.peerCard}
                label={t("reports.metrics.expenses")}
                amount={expenses}
                testID="reports-expenses"
              />
              <MoneyCard
                style={styles.peerCard}
                label={t("reports.metrics.net")}
                amount={net}
                testID="reports-net"
              />
            </View>
            <Text style={styles.formulaHint}>
              {t("reports.metrics.netFormula")}
            </Text>

            <Pressable
              onPress={goCommission}
              accessibilityRole="button"
              accessibilityLabel={t("reports.metrics.commission")}
              accessibilityHint={t("reports.metrics.commissionHint")}
              testID="reports-commission"
            >
              <MoneyCard
                label={t("reports.metrics.commission")}
                amount={commission}
              />
              <Text style={styles.tapHint} numberOfLines={1}>
                {t("reports.metrics.commissionHint")}
              </Text>
            </Pressable>

            <BillStatsCard billCount={billCount} avgBill={avgBill} />

            <TopEmployeesCard
              rows={topEmps}
              onViewAll={goTopEmployees}
              total={topEmps.reduce((s, r) => s + r.revenue, 0)}
            />

            <TopServicesCard
              rows={topSvcs}
              onViewAll={goTopServices}
              total={topSvcs.reduce((s, r) => s + r.revenue, 0)}
            />

            <PaymentSplitCard split={paySplit} total={income} />

            <CustomersCard counts={custCounts} />

            <TransactionsCard
              bills={bills}
              onOpen={(tx) =>
                navigation.navigate("IncomeEntry", { transactionId: tx.id })
              }
            />
          </>
        )}
      </ScrollView>
    </View>
  );
}

// ─── Cards ───────────────────────────────────────────────────────────────────

function BillStatsCard({
  avgBill,
  billCount
}: {
  billCount: number;
  avgBill: number;
}) {
  const { t } = useTranslation();
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{t("reports.metrics.billStats")}</Text>
      <View style={styles.statPair}>
        <View style={styles.statCell}>
          <Text style={styles.statLabel}>
            {t("reports.metrics.billCount")}
          </Text>
          <Text style={styles.statValue}>{billCount}</Text>
        </View>
        <View style={styles.statCell}>
          <Text style={styles.statLabel}>{t("reports.metrics.avgBill")}</Text>
          <Text style={styles.statValue}>{formatMoney(avgBill)}</Text>
        </View>
      </View>
    </View>
  );
}

function TopEmployeesCard({
  onViewAll,
  rows,
  total
}: {
  rows: EmployeeRevenueTotal[];
  total: number;
  onViewAll: () => void;
}) {
  const { t } = useTranslation();
  if (rows.length === 0) return null;
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>
          {t("reports.metrics.topEmployees")}
        </Text>
        <Pressable
          onPress={onViewAll}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t("reports.metrics.viewAll")}
        >
          <Text style={styles.viewAll}>
            {t("reports.metrics.viewAll")} ›
          </Text>
        </Pressable>
      </View>
      <View style={styles.miniList}>
        {rows.map((row) => {
          const share = total > 0 ? row.revenue / total : 0;
          return (
            <ShareBarRow
              key={row.employee_id}
              label={row.employee_name || "—"}
              value={formatMoney(row.revenue)}
              share={share}
              color={colors.brand.primary}
              meta={t("reports.metrics.billCountLabel", {
                count: row.bill_count
              })}
            />
          );
        })}
      </View>
    </View>
  );
}

function TopServicesCard({
  onViewAll,
  rows,
  total
}: {
  rows: ServiceRevenueTotal[];
  total: number;
  onViewAll: () => void;
}) {
  const { t } = useTranslation();
  if (rows.length === 0) return null;
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{t("reports.metrics.topServices")}</Text>
        <Pressable
          onPress={onViewAll}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t("reports.metrics.viewAll")}
        >
          <Text style={styles.viewAll}>
            {t("reports.metrics.viewAll")} ›
          </Text>
        </Pressable>
      </View>
      <View style={styles.miniList}>
        {rows.map((row) => {
          const share = total > 0 ? row.revenue / total : 0;
          return (
            <ShareBarRow
              key={`${row.service_id}-${row.service_name}`}
              label={row.service_name}
              value={formatMoney(row.revenue)}
              share={share}
              color={colors.brand.accent}
              meta={t("reports.metrics.qtyLabel", { count: row.quantity })}
            />
          );
        })}
      </View>
    </View>
  );
}

function PaymentSplitCard({
  split,
  total
}: {
  split: PaymentModeTotals;
  total: number;
}) {
  const { t } = useTranslation();
  const ORDER = ["cash", "upi", "card", "credit", "other"] as const;
  const entries = ORDER.filter((mode) => (split[mode] ?? 0) > 0).map(
    (mode) => ({
      mode,
      amount: split[mode] ?? 0
    })
  );
  if (entries.length === 0) return null;
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{t("reports.metrics.paymentSplit")}</Text>
      <View style={styles.miniList}>
        {entries.map(({ amount, mode }) => {
          const share = total > 0 ? amount / total : 0;
          return (
            <ShareBarRow
              key={mode}
              label={t(`reports.metrics.${mode}`)}
              value={formatMoney(amount)}
              share={share}
              color={PAYMENT_COLORS[mode]}
            />
          );
        })}
      </View>
    </View>
  );
}

function CustomersCard({ counts }: { counts: NewVsRepeatCounts }) {
  const { t } = useTranslation();
  const { newCustomers, repeatCustomers, walkIns } = counts;
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{t("reports.metrics.newVsRepeat")}</Text>
      <View style={styles.statTriple}>
        <View style={styles.statCell}>
          <Text style={styles.statLabel}>
            {t("reports.metrics.newCustomer")}
          </Text>
          <Text style={styles.statValue}>{newCustomers}</Text>
        </View>
        <View style={styles.statCell}>
          <Text style={styles.statLabel}>
            {t("reports.metrics.repeatCustomer")}
          </Text>
          <Text style={styles.statValue}>{repeatCustomers}</Text>
        </View>
        <View style={styles.statCell}>
          <Text style={styles.statLabel}>
            {t("reports.metrics.walkIn")}
          </Text>
          <Text style={styles.statValue}>{walkIns}</Text>
        </View>
      </View>
    </View>
  );
}

function TransactionsCard({
  bills,
  onOpen
}: {
  bills: IncomeTransactionSummary[];
  onOpen: (tx: IncomeTransactionSummary) => void;
}) {
  const { t } = useTranslation();
  if (bills.length === 0) return null;
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>
        {t("reports.metrics.transactions")}
        {` · ${bills.length}`}
      </Text>
      <View style={styles.txList}>
        {bills.map((tx) => (
          <Pressable
            key={tx.id}
            onPress={() => onOpen(tx)}
            style={({ pressed }) => [
              styles.txRow,
              pressed && styles.txRowPressed
            ]}
            accessibilityRole="button"
            accessibilityLabel={tx.services_summary || tx.employees_summary}
          >
            <View style={styles.txHeader}>
              <Text style={styles.txPrimary} numberOfLines={1}>
                {tx.employees_summary || tx.employee_name_snapshot}
              </Text>
              <View style={styles.txRight}>
                <Text style={styles.txAmount}>
                  {formatMoney(tx.net_amount)}
                </Text>
                <Text style={styles.txMode}>
                  {tx.payment_mode.toUpperCase()}
                </Text>
              </View>
            </View>
            <Text style={styles.txSecondary} numberOfLines={1}>
              {tx.services_summary || "—"}
              {tx.customer_name_snapshot
                ? ` · ${tx.customer_name_snapshot}`
                : ""}
            </Text>
            <Text style={styles.txDate}>{formatTxDate(tx.transaction_date)}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function ShareBarRow({
  color,
  label,
  meta,
  share,
  value
}: {
  label: string;
  value: string;
  /** 0…1 */
  share: number;
  color: string;
  meta?: string;
}) {
  const sharePct = Math.round(share * 100);
  return (
    <View style={styles.shareRow}>
      <View style={styles.shareHeader}>
        <Text style={styles.shareLabel} numberOfLines={1}>
          {label}
        </Text>
        <Text style={styles.shareValue}>{value}</Text>
      </View>
      <View style={styles.bar}>
        <View
          style={[
            styles.barFill,
            { width: `${Math.max(2, sharePct)}%`, backgroundColor: color }
          ]}
        />
      </View>
      <Text style={styles.shareMeta}>
        {sharePct}%
        {meta ? ` · ${meta}` : ""}
      </Text>
    </View>
  );
}

// ─── helpers ─────────────────────────────────────────────────────────────────

const PAYMENT_COLORS: Record<string, string> = {
  cash: colors.status.success,
  upi: colors.status.info,
  card: colors.brand.accent,
  credit: colors.status.warning,
  other: colors.text.muted
};

function formatTxDate(iso: string): string {
  const [y, m, d] = iso.split("-").map((n) => parseInt(n, 10));
  const date = new Date(y, (m ?? 1) - 1, d ?? 1);
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    day: "2-digit",
    month: "short"
  });
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background.default
  },
  scroll: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[4],
    paddingBottom: spacing[6],
    gap: spacing[3]
  },
  peerRow: {
    flexDirection: "row",
    gap: spacing[3]
  },
  peerCard: {
    flex: 1
  },
  formulaHint: {
    ...typography.caption,
    color: colors.text.muted,
    marginTop: -spacing[2]
  },
  tapHint: {
    ...typography.caption,
    color: colors.text.muted,
    marginTop: spacing[1]
  },
  card: {
    backgroundColor: colors.surface.default,
    borderRadius: radius.lg,
    padding: spacing[4],
    gap: spacing[3]
  },
  cardHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  cardTitle: {
    ...typography.bodyEmphasis,
    color: colors.text.primary
  },
  viewAll: {
    ...typography.bodySmall,
    color: colors.brand.primary,
    fontWeight: "700"
  },
  miniList: {
    gap: spacing[3]
  },
  statPair: {
    flexDirection: "row",
    gap: spacing[4]
  },
  statTriple: {
    flexDirection: "row",
    gap: spacing[3]
  },
  statCell: {
    flex: 1
  },
  statLabel: {
    ...typography.caption,
    color: colors.text.secondary
  },
  statValue: {
    ...typography.moneyMedium,
    color: colors.text.primary
  },
  shareRow: {
    gap: spacing[1]
  },
  shareHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[2],
    justifyContent: "space-between"
  },
  shareLabel: {
    ...typography.body,
    color: colors.text.primary,
    flex: 1
  },
  shareValue: {
    ...typography.moneyBody,
    color: colors.text.primary
  },
  shareMeta: {
    ...typography.caption,
    color: colors.text.secondary
  },
  bar: {
    backgroundColor: colors.surface.sunken,
    borderRadius: radius.full,
    height: 6,
    overflow: "hidden"
  },
  barFill: {
    height: "100%"
  },
  txList: {
    gap: spacing[2]
  },
  txRow: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    padding: spacing[3],
    gap: spacing[1]
  },
  txRowPressed: {
    backgroundColor: colors.interactive.selected
  },
  txHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[2],
    justifyContent: "space-between"
  },
  txPrimary: {
    ...typography.bodyEmphasis,
    color: colors.text.primary,
    flex: 1
  },
  txRight: {
    alignItems: "flex-end"
  },
  txAmount: {
    ...typography.moneyBody,
    color: colors.text.primary
  },
  txMode: {
    ...typography.caption,
    color: colors.text.muted
  },
  txSecondary: {
    ...typography.caption,
    color: colors.text.secondary
  },
  txDate: {
    ...typography.caption,
    color: colors.text.muted
  }
});
