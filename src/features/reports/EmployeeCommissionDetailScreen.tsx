// Per-employee, per-period breakdown of services performed and commission
// earned. Reached from CommissionSummaryScreen (which passes the period) and
// from the Reports TopEmployees screen. Rows show either time-of-day only
// (when the period is a single day) or "13 Jul · 10:24" for longer ranges.

import { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";

import { AppBar } from "@/components/core/AppBar";
import { EmptyState } from "@/components/core/EmptyState";
import { MoneyCard } from "@/components/domain/MoneyCard";
import { PeriodSelector } from "@/components/domain/PeriodSelector";
import { colors, radius, spacing, typography } from "@/design-system/tokens";
import { DEV_SALON_ID } from "@/constants/dev";
import { formatMoney } from "@/domain/money";
import type { Period } from "@/domain/period";
import { IncomeRepository } from "@/repositories/income-repository";
import type { RootStackParamList } from "@/application/AppNavigator";
import { normalizeReportPeriod } from "./period-params";

const incomeRepo = new IncomeRepository();

type Props = NativeStackScreenProps<
  RootStackParamList,
  "EmployeeCommissionDetail"
>;

type Row = ReturnType<
  IncomeRepository["listItemsByEmployeeAndDateRange"]
>[number];

/** Format a bps-style percentage (4000 → "40"). */
function formatPercent(bps: number): string {
  const p = bps / 100;
  return Number.isInteger(p) ? String(p) : p.toFixed(2);
}

/** Format an HH:mm from a UTC ISO timestamp (created_at). */
function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return "";
  }
}

/** Format "13 Jul" from a local YYYY-MM-DD (transaction_date). */
function formatShortDate(iso: string): string {
  const [y, m, d] = iso.split("-").map((n) => parseInt(n, 10));
  const date = new Date(y, (m ?? 1) - 1, d ?? 1);
  return date.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short"
  });
}

export function EmployeeCommissionDetailScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const { employeeId, employeeName } = route.params;

  const initialPeriod = useMemo(
    () => normalizeReportPeriod(route.params),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  const [period, setPeriod] = useState<Period>(initialPeriod);
  const showDate = period.start !== period.end;

  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);

  const reload = useCallback(() => {
    const items = incomeRepo.listItemsByEmployeeAndDateRange(
      DEV_SALON_ID,
      employeeId,
      period.start,
      period.end
    );
    setRows(items);
    setTotal(items.reduce((sum, r) => sum + r.commission_amount, 0));
  }, [employeeId, period.start, period.end]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  const isEmpty = rows.length === 0;

  return (
    <View style={styles.root}>
      <AppBar
        title={t("employeeCommissionDetail.title", { name: employeeName })}
        leading={
          <Pressable
            onPress={() => navigation.goBack()}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t("common.back")}
          >
            <Ionicons
              name="chevron-back"
              size={24}
              color={colors.text.primary}
            />
          </Pressable>
        }
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <PeriodSelector value={period} onChange={setPeriod} />

        {isEmpty ? (
          <EmptyState
            icon="💇"
            title={t("employeeCommissionDetail.empty.title")}
            body={t("employeeCommissionDetail.empty.body")}
          />
        ) : (
          <>
            <MoneyCard
              variant="hero"
              label={t("employeeCommissionDetail.totalLabel", {
                name: employeeName
              })}
              amount={total}
              testID="emp-commission-total"
            />

            <Text style={styles.sectionHeader}>
              {t("employeeCommissionDetail.servicesSection")}
            </Text>

            <View style={styles.list}>
              {rows.map((row) => (
                <ServiceRow
                  key={row.id}
                  row={row}
                  showDate={showDate}
                  onPress={() =>
                    navigation.navigate("IncomeEntry", {
                      transactionId: row.transaction_id
                    })
                  }
                />
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

// ─── Row ─────────────────────────────────────────────────────────────────────

function ServiceRow({
  onPress,
  row,
  showDate
}: {
  row: Row;
  showDate: boolean;
  onPress: () => void;
}) {
  const { t } = useTranslation();

  const ruleType = row.commission_rule_type_snapshot;
  const ruleValue = row.commission_rule_value_snapshot;

  /** One-liner explaining how the commission was derived. */
  const ruleExplainer = (() => {
    if (ruleType == null || ruleValue == null) {
      return t("employeeCommissionDetail.ruleNone");
    }
    if (ruleType === "fixed") {
      return t("employeeCommissionDetail.ruleFixed", {
        amount: formatMoney(ruleValue)
      });
    }
    // Percentage rule. If a product cost snapshot > 0 is on the line, show
    // the labor-only split so the number matches the actual commission.
    const productTotal = (row.product_cost_snapshot ?? 0) * row.quantity;
    if (productTotal > 0) {
      const net = Math.max(0, row.line_amount - productTotal);
      return t("employeeCommissionDetail.rulePercentWithProduct", {
        percent: formatPercent(ruleValue),
        lineAmount: formatMoney(row.line_amount),
        netAmount: formatMoney(net),
        productCost: formatMoney(productTotal)
      });
    }
    return t("employeeCommissionDetail.rulePercent", {
      percent: formatPercent(ruleValue),
      lineAmount: formatMoney(row.line_amount)
    });
  })();

  const customerLabel = row.customer_name_snapshot
    ? t("employeeCommissionDetail.customerLabel", {
        name: row.customer_name_snapshot
      })
    : t("employeeCommissionDetail.noCustomer");

  const timeLabel = formatTime(row.transaction_created_at);
  const dateLabel = formatShortDate(row.transaction_date);
  const trailingLabel = showDate
    ? timeLabel
      ? `${dateLabel} · ${timeLabel}`
      : dateLabel
    : timeLabel;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      accessibilityRole="button"
      accessibilityLabel={row.service_name_snapshot}
    >
      <View style={styles.rowHeader}>
        <Text style={styles.serviceName} numberOfLines={1}>
          {row.service_name_snapshot}
          {row.quantity > 1
            ? ` ${t("employeeCommissionDetail.quantityMultiplier", {
                quantity: row.quantity
              })}`
            : ""}
        </Text>
        <Text style={styles.commission}>
          {formatMoney(row.commission_amount)}
        </Text>
      </View>

      <Text style={styles.ruleText} numberOfLines={2}>
        {ruleExplainer}
      </Text>

      <View style={styles.metaRow}>
        <Text style={styles.metaText} numberOfLines={1}>
          {customerLabel}
        </Text>
        {trailingLabel ? (
          <Text style={styles.metaText}>{trailingLabel}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

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
  sectionHeader: {
    ...typography.overline,
    color: colors.text.secondary,
    marginTop: spacing[2]
  },
  list: {
    backgroundColor: colors.surface.default,
    borderRadius: radius.lg,
    overflow: "hidden"
  },
  row: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
    gap: spacing[1]
  },
  rowPressed: {
    backgroundColor: colors.interactive.selected
  },
  rowHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing[2]
  },
  serviceName: {
    ...typography.bodyEmphasis,
    color: colors.text.primary,
    flex: 1
  },
  commission: {
    ...typography.moneyBody,
    color: colors.text.primary
  },
  ruleText: {
    ...typography.caption,
    color: colors.text.secondary
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing[2]
  },
  metaText: {
    ...typography.caption,
    color: colors.text.muted
  }
});
