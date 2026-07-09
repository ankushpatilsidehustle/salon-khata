import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, SectionList, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useIsFocused } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import { AppBar } from "@/components/core/AppBar";
import { EmptyState } from "@/components/core/EmptyState";
import { Fab } from "@/components/core/Fab";
import { ListItem } from "@/components/core/ListItem";
import { useSnackbar } from "@/components/core/SnackbarProvider";
import { colors, radius, spacing, typography } from "@/design-system/tokens";
import { DEV_SALON_ID } from "@/constants/dev";
import { EmployeeRepository } from "@/repositories/employee-repository";
import type { EmployeeRecord } from "@/repositories/employee-repository";
import type { EntriesStackParamList } from "@/features/entries/EntriesNavigator";
import { CommissionRulesSheet } from "./CommissionRulesSheet";
import { EmployeeFormSheet } from "./EmployeeFormSheet";

type Props = NativeStackScreenProps<EntriesStackParamList, "Employees">;

type Section = { title: string; data: EmployeeRecord[] };

const repo = new EmployeeRepository();

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
  const [sections, setSections] = useState<Section[]>([]);
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
          renderItem={({ item }) => (
            <ListItem
              title={item.name}
              subtitle={item.mobile_number ?? undefined}
              leading={<InitialsAvatar name={item.name} />}
              trailing={
                <View style={styles.rowActions}>
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
          )}
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
  }
});
