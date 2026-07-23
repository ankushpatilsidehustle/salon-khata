import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  View
} from "react-native";
import { useTranslation } from "react-i18next";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useIsFocused } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import { AppBar } from "@/components/core/AppBar";
import { EmptyState } from "@/components/core/EmptyState";
import { Fab } from "@/components/core/Fab";
import { colors, radius, spacing, typography } from "@/design-system/tokens";
import { DEV_SALON_ID } from "@/constants/dev";
import { formatMoney } from "@/domain/money";
import { EmployeeAdvanceRepository } from "@/repositories/employee-advance-repository";
import type { EmployeeAdvanceRecord } from "@/repositories/employee-advance-repository";
import type { RootStackParamList } from "@/application/AppNavigator";
import { Events, track } from "@/observability";
import { AdvanceDetailSheet } from "./AdvanceDetailSheet";

type Props = NativeStackScreenProps<RootStackParamList, "AdvancesList">;

type Section = { title: string; data: EmployeeAdvanceRecord[] };

const advanceRepo = new EmployeeAdvanceRepository();

export function AdvancesListScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const isFocused = useIsFocused();

  const employeeFilter = route.params?.employeeId ?? null;

  const [rows, setRows] = useState<EmployeeAdvanceRecord[]>([]);
  const [detailId, setDetailId] = useState<string | null>(null);

  const loadData = useCallback(() => {
    const all = employeeFilter
      ? advanceRepo.listByEmployee(DEV_SALON_ID, employeeFilter)
      : advanceRepo.listAll(DEV_SALON_ID);
    setRows(all);
  }, [employeeFilter]);

  useEffect(() => {
    if (isFocused) {
      loadData();
      track(Events.staff.advanceListViewed, {
        filtered_by_employee: employeeFilter ? 1 : 0
      });
    }
  }, [isFocused, loadData, employeeFilter]);

  const sections = useMemo<Section[]>(() => {
    const outstanding = rows.filter((r) => r.settled_at === null);
    const settled = rows.filter((r) => r.settled_at !== null);
    const s: Section[] = [];
    if (outstanding.length)
      s.push({ title: t("advances.sectionOutstanding"), data: outstanding });
    if (settled.length)
      s.push({ title: t("advances.sectionSettled"), data: settled });
    return s;
  }, [rows, t]);

  const totalOutstanding = useMemo(
    () =>
      rows
        .filter((r) => r.settled_at === null)
        .reduce((sum, r) => sum + r.amount, 0),
    [rows]
  );

  const headerTitle = employeeFilter
    ? rows[0]?.employee_name_snapshot ?? t("advances.title")
    : t("advances.title");

  const openAdd = () =>
    navigation.navigate("AdvanceEntry", {
      employeeId: employeeFilter ?? undefined
    });

  return (
    <View style={styles.root}>
      <AppBar
        title={headerTitle}
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

      {totalOutstanding > 0 ? (
        <View style={styles.banner}>
          <Ionicons
            name="time-outline"
            size={16}
            color={colors.status.warning}
          />
          <Text style={styles.bannerText}>
            {t("advances.outstandingTotal", {
              amount: formatMoney(totalOutstanding)
            })}
          </Text>
        </View>
      ) : null}

      {rows.length === 0 ? (
        <EmptyState
          icon="💵"
          title={t("advances.emptyTitle")}
          body={t("advances.emptyBody")}
          actionLabel={t("advances.add")}
          onAction={openAdd}
        />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => (
            <Text style={styles.sectionHeader}>{section.title}</Text>
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          renderItem={({ item }) => {
            const isSettled = item.settled_at !== null;
            return (
              <Pressable
                onPress={() => setDetailId(item.id)}
                style={({ pressed }) => [
                  styles.row,
                  pressed && styles.rowPressed
                ]}
                accessibilityRole="button"
                accessibilityLabel={item.employee_name_snapshot}
              >
                <View style={styles.rowMain}>
                  <View style={styles.rowLeft}>
                    <Text style={styles.rowName} numberOfLines={1}>
                      {item.employee_name_snapshot}
                    </Text>
                    <Text style={styles.rowMeta}>
                      {item.advance_date}
                      {item.remarks ? ` • ${item.remarks}` : ""}
                    </Text>
                  </View>
                  <View style={styles.rowRight}>
                    <Text
                      style={[
                        styles.rowAmount,
                        isSettled && styles.rowAmountSettled
                      ]}
                    >
                      {formatMoney(item.amount)}
                    </Text>
                    <View
                      style={[
                        styles.rowPill,
                        isSettled ? styles.rowPillPaid : styles.rowPillDue
                      ]}
                    >
                      <Text
                        style={[
                          styles.rowPillText,
                          isSettled
                            ? styles.rowPillTextPaid
                            : styles.rowPillTextDue
                        ]}
                      >
                        {isSettled
                          ? t("advances.paidBadge")
                          : t("advances.outstandingBadge")}
                      </Text>
                    </View>
                  </View>
                </View>
              </Pressable>
            );
          }}
        />
      )}

      <Fab
        onPress={openAdd}
        label={t("advances.add")}
        accessibilityLabel={t("advances.add")}
      />

      <AdvanceDetailSheet
        visible={detailId !== null}
        advanceId={detailId}
        onClose={() => setDetailId(null)}
        onChanged={loadData}
        onEdit={(id) => navigation.navigate("AdvanceEntry", { advanceId: id })}
      />
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    backgroundColor: colors.background.default,
    flex: 1
  },
  banner: {
    alignItems: "center",
    backgroundColor: colors.status.warningBg,
    borderColor: colors.status.warning,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing[2],
    marginHorizontal: spacing[4],
    marginTop: spacing[3],
    padding: spacing[3]
  },
  bannerText: {
    ...typography.bodySmall,
    color: colors.status.warning,
    flex: 1,
    fontWeight: "600"
  },
  listContent: {
    padding: spacing[4],
    paddingBottom: spacing[9]
  },
  sectionHeader: {
    ...typography.overline,
    color: colors.text.muted,
    marginBottom: spacing[2],
    marginTop: spacing[3]
  },
  separator: {
    height: spacing[2]
  },
  row: {
    backgroundColor: colors.surface.default,
    borderRadius: radius.md,
    padding: spacing[3]
  },
  rowPressed: {
    backgroundColor: colors.interactive.pressed
  },
  rowMain: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing[3],
    justifyContent: "space-between"
  },
  rowLeft: {
    flex: 1,
    gap: 2
  },
  rowName: {
    ...typography.bodyEmphasis,
    color: colors.text.primary
  },
  rowMeta: {
    ...typography.caption,
    color: colors.text.muted
  },
  rowRight: {
    alignItems: "flex-end",
    gap: spacing[1]
  },
  rowAmount: {
    ...typography.moneyBody,
    color: colors.status.warning
  },
  rowAmountSettled: {
    color: colors.text.muted
  },
  rowPill: {
    borderRadius: radius.full,
    paddingHorizontal: spacing[2],
    paddingVertical: 2
  },
  rowPillDue: {
    backgroundColor: colors.status.warningBg
  },
  rowPillPaid: {
    backgroundColor: colors.status.successBg
  },
  rowPillText: {
    ...typography.caption,
    fontWeight: "700",
    letterSpacing: 0.5
  },
  rowPillTextDue: {
    color: colors.status.warning
  },
  rowPillTextPaid: {
    color: colors.status.success
  }
});
