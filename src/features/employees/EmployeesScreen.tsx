import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, SectionList, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { NativeStackScreenProps, NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useIsFocused, useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import { AppBar } from "@/components/core/AppBar";
import { EmptyState } from "@/components/core/EmptyState";
import { Fab } from "@/components/core/Fab";
import { ListItem } from "@/components/core/ListItem";
import { useSnackbar } from "@/components/core/SnackbarProvider";
import { colors, radius, spacing, typography } from "@/design-system/tokens";
import { DEV_SALON_ID } from "@/constants/dev";
import { formatMoney } from "@/domain/money";
import { EmployeeRepository } from "@/repositories/employee-repository";
import type { EmployeeRecord } from "@/repositories/employee-repository";
import { EmployeeAdvanceRepository } from "@/repositories/employee-advance-repository";
import type { EntriesStackParamList } from "@/features/entries/EntriesNavigator";
import type { RootStackParamList } from "@/application/AppNavigator";
import { CommissionRulesSheet } from "./CommissionRulesSheet";
import { EmployeeFormSheet } from "./EmployeeFormSheet";
import { Events, track } from "@/observability";

type Props = NativeStackScreenProps<EntriesStackParamList, "Employees">;

type Section = { title: string; data: EmployeeRecord[] };

const repo = new EmployeeRepository();
const advanceRepo = new EmployeeAdvanceRepository();

// ─── Avatar ──────────────────────────────────────────────────────────────────

function InitialsAvatar({ name }: { name: string }) {
  const initials = name
    .trim()
    .split(/\s+/)
    .map((w) => w[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <View style={styles.avatar}>
      <Text style={styles.avatarText}>{initials}</Text>
    </View>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export function EmployeesScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const isFocused = useIsFocused();
  const rootNavigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [sections, setSections] = useState<Section[]>([]);
  const [outstandingByEmp, setOutstandingByEmp] = useState<
    Record<string, number>
  >({});
  const { showSnackbar } = useSnackbar();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [commissionSheetOpen, setCommissionSheetOpen] = useState(false);
  const [commissionEmployee, setCommissionEmployee] = useState<{
    id: string;
    name: string;
  } | null>(null);

  // Reload whenever the screen is focused.
  const loadData = useCallback(() => {
    const all = repo.listAll(DEV_SALON_ID);
    const active = all.filter((e) => e.is_active === 1);
    const inactive = all.filter((e) => e.is_active === 0);
    const s: Section[] = [];
    if (active.length) s.push({ title: t("employees.active"), data: active });
    if (inactive.length) s.push({ title: t("employees.inactive"), data: inactive });
    setSections(s);

    const outstanding = advanceRepo.outstandingByEmployee(DEV_SALON_ID);
    const map: Record<string, number> = {};
    for (const row of outstanding) map[row.employee_id] = row.total;
    setOutstandingByEmp(map);
  }, [t]);

  useEffect(() => {
    if (isFocused) loadData();
  }, [isFocused, loadData]);

  const isEmpty = sections.length === 0;

  const openAdd = () => {
    setEditingId(null);
    setSheetOpen(true);
  };

  const openEdit = (id: string) => {
    setEditingId(id);
    setSheetOpen(true);
  };

  const closeSheet = () => setSheetOpen(false);

  const openCommission = (id: string, name: string) => {
    setCommissionEmployee({ id, name });
    setCommissionSheetOpen(true);
  };

  const handleDelete = (emp: EmployeeRecord) => {
    Alert.alert(
      t("employees.deleteConfirm.title"),
      t("employees.deleteConfirm.message"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.delete"),
          style: "destructive",
          onPress: () => {
            repo.softDelete(emp.id, DEV_SALON_ID);
            track(Events.staff.deleted);
            showSnackbar(t("employees.deleted"));
            loadData();
          }
        }
      ]
    );
  };

  return (
    <View style={styles.root}>
      <AppBar
        title={t("employees.title")}
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

      {isEmpty ? (
        <EmptyState
          icon={t("employees.empty.icon")}
          title={t("employees.empty.title")}
          body={t("employees.empty.body")}
          actionLabel={t("employees.add")}
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
            const outstanding = outstandingByEmp[item.id] ?? 0;
            const isOwner = item.is_owner === 1;
            return (
              <ListItem
                title={
                  isOwner ? (
                    <View style={styles.titleRow}>
                      <Text style={styles.titleText} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <View style={styles.ownerPill}>
                        <Ionicons
                          name="star"
                          size={10}
                          color={colors.brand.primary}
                        />
                        <Text style={styles.ownerPillText}>
                          {t("employees.ownerBadge")}
                        </Text>
                      </View>
                    </View>
                  ) : (
                    item.name
                  )
                }
                subtitle={item.mobile_number ?? undefined}
                leading={<InitialsAvatar name={item.name} />}
                trailing={
                  <View style={styles.rowActions}>
                    {outstanding > 0 ? (
                      <Pressable
                        onPress={() =>
                          rootNavigation.navigate("AdvancesList", {
                            employeeId: item.id
                          })
                        }
                        hitSlop={6}
                        style={styles.advancePill}
                        accessibilityRole="button"
                        accessibilityLabel={t("advances.outstandingTotal", {
                          amount: formatMoney(outstanding)
                        })}
                      >
                        <Ionicons
                          name="wallet-outline"
                          size={12}
                          color={colors.status.warning}
                        />
                        <Text style={styles.advancePillText}>
                          {formatMoney(outstanding)}
                        </Text>
                      </Pressable>
                    ) : null}
                    <Pressable
                      onPress={() => openCommission(item.id, item.name)}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={t("commission.setRules")}
                    >
                      <Ionicons
                        name="cash-outline"
                        size={20}
                        color={colors.brand.primary}
                      />
                    </Pressable>
                    <Pressable
                      onPress={() => handleDelete(item)}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={t("employees.deleteAction")}
                    >
                      <Ionicons
                        name="trash-outline"
                        size={20}
                        color={colors.text.muted}
                      />
                    </Pressable>
                  </View>
                }
                showChevron={false}
                onPress={() => openEdit(item.id)}
              />
            );
          }}
        />
      )}

      <Fab
        onPress={openAdd}
        label={t("employees.add")}
        accessibilityLabel={t("employees.add")}
      />

      <EmployeeFormSheet
        visible={sheetOpen}
        onClose={closeSheet}
        onSaved={loadData}
        employeeId={editingId}
      />

      {commissionEmployee && (
        <CommissionRulesSheet
          visible={commissionSheetOpen}
          onClose={() => setCommissionSheetOpen(false)}
          employeeId={commissionEmployee.id}
          employeeName={commissionEmployee.name}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background.default
  },
  listContent: {
    paddingBottom: spacing[9] + spacing[4] // room for FAB
  },
  sectionHeader: {
    ...typography.overline,
    color: colors.text.secondary,
    paddingHorizontal: spacing[4],
    paddingTop: spacing[4],
    paddingBottom: spacing[2],
    backgroundColor: colors.background.default
  },
  separator: {
    height: 1,
    backgroundColor: colors.divider,
    marginLeft: spacing[4] + 40 + spacing[3] // align with text (skip leading)
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: "rgba(103,57,183,0.12)",
    alignItems: "center",
    justifyContent: "center"
  },
  avatarText: {
    ...typography.caption,
    color: colors.brand.primary,
    fontWeight: "700"
  },
  rowActions: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[3]
  },
  advancePill: {
    alignItems: "center",
    backgroundColor: colors.status.warningBg,
    borderRadius: radius.full,
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: spacing[2],
    paddingVertical: 3
  },
  advancePillText: {
    ...typography.caption,
    color: colors.status.warning,
    fontWeight: "700"
  },
  titleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[2]
  },
  titleText: {
    ...typography.body,
    color: colors.text.primary,
    flexShrink: 1
  },
  ownerPill: {
    alignItems: "center",
    backgroundColor: "rgba(103,57,183,0.10)",
    borderRadius: radius.full,
    flexDirection: "row",
    gap: 3,
    paddingHorizontal: spacing[2],
    paddingVertical: 2
  },
  ownerPillText: {
    ...typography.caption,
    color: colors.brand.primary,
    fontSize: 10,
    fontWeight: "700"
  }
});