// Full ranked list of employees by revenue for the selected period. Reached
// from the Reports screen "View all" on the Top employees card. Tapping a
// row opens EmployeeCommissionDetail scoped to the same period so the owner
// can see exactly which services drove that revenue.

import { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";

import { AppBar } from "@/components/core/AppBar";
import { EmptyState } from "@/components/core/EmptyState";
import { PeriodSelector } from "@/components/domain/PeriodSelector";
import { colors, radius, spacing, typography } from "@/design-system/tokens";
import { DEV_SALON_ID } from "@/constants/dev";
import { formatMoney } from "@/domain/money";
import type { Period } from "@/domain/period";
import {
  IncomeRepository,
  type EmployeeRevenueTotal
} from "@/repositories/income-repository";
import type { RootStackParamList } from "@/application/AppNavigator";
import { normalizeReportPeriod } from "./period-params";
import { Events, track } from "@/observability";

const incomeRepo = new IncomeRepository();
/** Effectively-unlimited for a family salon; keeps a hard ceiling for safety. */
const MAX_ROWS = 200;

type Props = NativeStackScreenProps<RootStackParamList, "TopEmployees">;

function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((w) => w[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function TopEmployeesScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const initialPeriod = useMemo(
    () => normalizeReportPeriod(route.params),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  const [period, setPeriod] = useState<Period>(initialPeriod);

  const [rows, setRows] = useState<EmployeeRevenueTotal[]>([]);
  const [total, setTotal] = useState(0);

  const reload = useCallback(() => {
    const data = incomeRepo.topEmployeesByRevenue(
      DEV_SALON_ID,
      period.start,
      period.end,
      MAX_ROWS
    );
    setRows(data);
    setTotal(data.reduce((sum, r) => sum + r.revenue, 0));
  }, [period.start, period.end]);

  useFocusEffect(
    useCallback(() => {
      reload();
      track(Events.report.topEmployeesOpened, { period_mode: period.mode });
    }, [reload, period.mode])
  );

  const isEmpty = rows.length === 0;

  return (
    <View style={styles.root}>
      <AppBar
        title={t("reports.topEmployeesScreen.title")}
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
            icon="🏆"
            title={t("reports.topEmployeesScreen.empty.title")}
            body={t("reports.topEmployeesScreen.empty.body")}
          />
        ) : (
          <View style={styles.list}>
            {rows.map((row) => {
              const share = total > 0 ? row.revenue / total : 0;
              const sharePct = Math.round(share * 100);
              return (
                <Pressable
                  key={row.employee_id}
                  onPress={() =>
                    navigation.navigate("EmployeeCommissionDetail", {
                      employeeId: row.employee_id,
                      employeeName: row.employee_name || "—",
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
                  accessibilityLabel={row.employee_name}
                >
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {initialsOf(row.employee_name || "??")}
                    </Text>
                  </View>
                  <View style={styles.rowBody}>
                    <View style={styles.rowHeader}>
                      <Text style={styles.rowName} numberOfLines={1}>
                        {row.employee_name || "—"}
                      </Text>
                      <Text style={styles.rowAmount}>
                        {formatMoney(row.revenue)}
                      </Text>
                    </View>
                    <View style={styles.bar}>
                      <View
                        style={[
                          styles.barFill,
                          { width: `${Math.max(2, sharePct)}%` }
                        ]}
                      />
                    </View>
                    <Text style={styles.rowMeta}>
                      {t("reports.metrics.billCountLabel", {
                        count: row.bill_count
                      })}
                      {` · ${sharePct}%`}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
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
  list: {
    backgroundColor: colors.surface.default,
    borderRadius: radius.lg,
    overflow: "hidden"
  },
  row: {
    alignItems: "flex-start",
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
  rowBody: {
    flex: 1,
    gap: spacing[1]
  },
  rowHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[2],
    justifyContent: "space-between"
  },
  rowName: {
    ...typography.body,
    color: colors.text.primary,
    flex: 1
  },
  rowAmount: {
    ...typography.moneyBody,
    color: colors.text.primary
  },
  bar: {
    backgroundColor: colors.surface.sunken,
    borderRadius: radius.full,
    height: 6,
    overflow: "hidden"
  },
  barFill: {
    backgroundColor: colors.brand.primary,
    height: "100%"
  },
  rowMeta: {
    ...typography.caption,
    color: colors.text.secondary
  }
});
