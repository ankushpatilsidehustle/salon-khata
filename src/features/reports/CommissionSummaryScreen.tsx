// Per-employee commission summary across a chosen period. Reached from:
//  • the Dashboard's "Staff commission" tile (defaults to today), and
//  • the Reports screen's Commission tile (passes the current report period).
// The screen owns its own `PeriodSelector`; incoming route params seed the
// initial period and stepping/switching from within the screen doesn't
// bounce back to the caller.

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
import { summarizeEmployeeCommission } from "@/domain/report-service";
import type { EmployeeCommissionRow } from "@/domain/report-service";
import type { Period } from "@/domain/period";
import { IncomeRepository } from "@/repositories/income-repository";
import type { RootStackParamList } from "@/application/AppNavigator";
import { normalizeReportPeriod } from "./period-params";
import { Events, track } from "@/observability";

const incomeRepo = new IncomeRepository();

type Props = NativeStackScreenProps<RootStackParamList, "CommissionSummary">;

/** Initials for the leading avatar — first letters of first two words. */
function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((w) => w[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function CommissionSummaryScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const initialPeriod = useMemo(
    () => normalizeReportPeriod(route.params),
    // Only compute once on mount — subsequent PeriodSelector edits win.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  const [period, setPeriod] = useState<Period>(initialPeriod);

  const [rows, setRows] = useState<EmployeeCommissionRow[]>([]);
  const [totalCommission, setTotalCommission] = useState(0);

  const reload = useCallback(() => {
    const totals = incomeRepo.sumCommissionByEmployee(
      DEV_SALON_ID,
      period.start,
      period.end
    );
    const summary = summarizeEmployeeCommission(totals);
    setRows(summary.rows);
    setTotalCommission(summary.totalCommission);
  }, [period.start, period.end]);

  useFocusEffect(
    useCallback(() => {
      reload();
      track(Events.report.commissionOpened, { period_mode: period.mode });
    }, [reload, period.mode])
  );

  const isEmpty = rows.length === 0;

  return (
    <View style={styles.root}>
      <AppBar
        title={t("commissionSummary.title")}
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
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <PeriodSelector value={period} onChange={setPeriod} />

        {isEmpty ? (
          <EmptyState
            icon="💸"
            title={t("commissionSummary.empty.title")}
            body={t("commissionSummary.empty.body")}
          />
        ) : (
          <>
            <MoneyCard
              variant="hero"
              label={t("commissionSummary.totalLabel")}
              amount={totalCommission}
              testID="commission-summary-total"
            />

            <Text style={styles.sectionHeader}>
              {t("commissionSummary.sectionPerEmployee")}
            </Text>

            <View style={styles.list}>
              {rows.map((row) => {
                const share =
                  totalCommission > 0
                    ? Math.round((row.commissionAmount / totalCommission) * 100)
                    : null;
                return (
                  <Pressable
                    key={row.employeeId}
                    onPress={() =>
                      navigation.navigate("EmployeeCommissionDetail", {
                        employeeId: row.employeeId,
                        employeeName: row.employeeName || "—",
                        start: period.start,
                        end: period.end,
                        mode: period.mode
                      })
                    }
                    style={({ pressed }) => [
                      styles.row,
                      pressed && styles.rowPressed
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={row.employeeName}
                  >
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>
                        {initialsOf(row.employeeName || "??")}
                      </Text>
                    </View>
                    <View style={styles.rowText}>
                      <Text style={styles.rowName} numberOfLines={1}>
                        {row.employeeName || "—"}
                      </Text>
                      <Text style={styles.rowMeta}>
                        {t("commissionSummary.lineCount", {
                          count: row.lineCount
                        })}
                        {share != null ? ` · ${share}%` : ""}
                      </Text>
                    </View>
                    <Text style={styles.rowAmount}>
                      {formatMoney(row.commissionAmount)}
                    </Text>
                    <Ionicons
                      name="chevron-forward"
                      size={18}
                      color={colors.text.muted}
                      style={styles.rowChevron}
                    />
                  </Pressable>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>
    </View>
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
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[3],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider
  },
  rowPressed: {
    backgroundColor: colors.interactive.selected
  },
  rowChevron: {
    marginLeft: spacing[1]
  },
  avatar: {
    alignItems: "center",
    backgroundColor: "rgba(103,57,183,0.12)",
    borderRadius: radius.full,
    height: 40,
    justifyContent: "center",
    width: 40
  },
  avatarText: {
    ...typography.bodyEmphasis,
    color: colors.brand.primary
  },
  rowText: {
    flex: 1,
    gap: 2
  },
  rowName: {
    ...typography.body,
    color: colors.text.primary
  },
  rowMeta: {
    ...typography.caption,
    color: colors.text.secondary
  },
  rowAmount: {
    ...typography.moneyBody,
    color: colors.text.primary
  }
});
