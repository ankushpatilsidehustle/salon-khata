import { useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  View
} from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";

import { BottomSheet } from "@/components/core/BottomSheet";
import { Button } from "@/components/core/Button";
import { colors, radius, spacing, typography } from "@/design-system/tokens";
import { DEV_SALON_ID } from "@/constants/dev";
import { formatMoney } from "@/domain/money";
import { ServiceRepository } from "@/repositories/service-repository";
import type { ServiceRecord } from "@/repositories/service-repository";
import { ServiceCategoryRepository } from "@/repositories/service-category-repository";
import type { EmployeeRecord } from "@/repositories/employee-repository";

type CustomerGender = "male" | "female" | null;

export type ServiceSelection = {
  service: ServiceRecord;
  /** Employee assigned to this service line; null means unassigned. */
  employeeId: string | null;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  /**
   * Called with the final selection (services + per-line employee assignments)
   * when the user taps Done. Sheet does not close itself — caller decides
   * after applying the change.
   */
  onDone: (selections: ServiceSelection[]) => void;
  /** Currently-selected service ids (pre-checks matching rows). */
  initialSelectedIds: string[];
  /** Existing per-line employee assignments keyed by service id. */
  initialEmployeeByServiceId: Record<string, string>;
  /** Determines which price to display next to each service. */
  customerGender: CustomerGender;
  /** Active employees available for assignment. */
  employees: EmployeeRecord[];
  /** Visit-level default employee applied when a service is newly checked. */
  defaultEmployeeId: string | null;
  /**
   * Optional fast-path callback. When provided (parent form is otherwise at
   * defaults), the footer button becomes "Save Bill (₹X)" and taps commit
   * the whole transaction in one gesture instead of just returning to the
   * parent screen.
   */
  onSaveAndClose?: (selections: ServiceSelection[]) => void;
};

type Section = { title: string; data: ServiceRecord[] };

const serviceRepo = new ServiceRepository();
const categoryRepo = new ServiceCategoryRepository();

const UNCATEGORIZED_KEY = "__uncategorized__";

/** Show whichever price is relevant, falling back to the other if 0. */
function displayPrice(svc: ServiceRecord, gender: CustomerGender): number {
  if (gender === "male") return svc.male_price || svc.female_price;
  if (gender === "female") return svc.female_price || svc.male_price;
  return svc.male_price || svc.female_price;
}

export function AddServicesSheet({
  customerGender,
  defaultEmployeeId,
  employees,
  initialEmployeeByServiceId,
  initialSelectedIds,
  onClose,
  onDone,
  onSaveAndClose,
  visible
}: Props) {
  const { t } = useTranslation();

  const [sections, setSections] = useState<Section[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [employeeByServiceId, setEmployeeByServiceId] = useState<
    Map<string, string>
  >(new Map());
  const [pickingEmployeeFor, setPickingEmployeeFor] = useState<string | null>(
    null
  );

  // Load categories + services and group them whenever the sheet opens.
  useEffect(() => {
    if (!visible) return;

    const categories = categoryRepo.listActive(DEV_SALON_ID);
    const services = serviceRepo.listActive(DEV_SALON_ID);

    // Bucket services by category id.
    const buckets = new Map<string, ServiceRecord[]>();
    for (const svc of services) {
      const key = svc.category_id ?? UNCATEGORIZED_KEY;
      const arr = buckets.get(key) ?? [];
      arr.push(svc);
      buckets.set(key, arr);
    }

    // Build sections in category sort order, uncategorized last.
    const result: Section[] = [];
    for (const cat of categories) {
      const rows = buckets.get(cat.id);
      if (rows && rows.length) result.push({ title: cat.name, data: rows });
    }
    const orphan = buckets.get(UNCATEGORIZED_KEY);
    if (orphan && orphan.length) {
      result.push({ title: t("services.uncategorized"), data: orphan });
    }

    setSections(result);
    setSelected(new Set(initialSelectedIds));
    setEmployeeByServiceId(new Map(Object.entries(initialEmployeeByServiceId)));
  }, [visible, initialSelectedIds, initialEmployeeByServiceId, t]);

  const totalSelected = selected.size;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        // Auto-assign visit-level default when newly checked.
        setEmployeeByServiceId((current) => {
          if (current.has(id) || !defaultEmployeeId) return current;
          const nextMap = new Map(current);
          nextMap.set(id, defaultEmployeeId);
          return nextMap;
        });
      }
      return next;
    });
  }

  function assignEmployee(serviceId: string, employeeId: string) {
    setEmployeeByServiceId((prev) => {
      const next = new Map(prev);
      next.set(serviceId, employeeId);
      return next;
    });
    // Selecting an employee also checks the row if it wasn't already.
    setSelected((prev) => {
      if (prev.has(serviceId)) return prev;
      const next = new Set(prev);
      next.add(serviceId);
      return next;
    });
    setPickingEmployeeFor(null);
  }

  function collectSelections(): ServiceSelection[] {
    const chosen: ServiceSelection[] = [];
    for (const sec of sections) {
      for (const svc of sec.data) {
        if (selected.has(svc.id)) {
          chosen.push({
            service: svc,
            employeeId: employeeByServiceId.get(svc.id) ?? null
          });
        }
      }
    }
    return chosen;
  }

  function handleDone() {
    onDone(collectSelections());
  }

  function handleSaveShortcut() {
    if (!onSaveAndClose) return;
    onSaveAndClose(collectSelections());
  }

  function employeeName(id: string | undefined): string {
    if (!id) return "";
    return employees.find((e) => e.id === id)?.name ?? "";
  }

  // Empty state: no services at all.
  const isEmpty = sections.length === 0;

  // Estimated total for the "Save Bill" shortcut label. Sums display price
  // (per gender) of every currently-selected service.
  const selectedServices: ServiceRecord[] = [];
  for (const sec of sections) {
    for (const svc of sec.data) {
      if (selected.has(svc.id)) selectedServices.push(svc);
    }
  }
  const estimatedTotal = selectedServices.reduce(
    (sum, svc) => sum + displayPrice(svc, customerGender),
    0
  );
  const allSelectedHaveEmployee =
    totalSelected > 0 &&
    (employees.length === 0 ||
      selectedServices.every((svc) => !!employeeByServiceId.get(svc.id)));
  const canUseSaveShortcut =
    !!onSaveAndClose && totalSelected > 0 && allSelectedHaveEmployee;

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={t("income.addServices")}
      size="tall"
      dismissOnBackdropPress={false}
      footer={
        canUseSaveShortcut ? (
          <View style={styles.footerRow}>
            <View style={styles.footerBtn}>
              <Button
                variant="secondary"
                onPress={handleDone}
                fullWidth
                style={styles.footerBtnHeight}
                accessibilityLabel={t("income.addSelected")}
              >
                {t("income.addSelectedCount", { count: totalSelected })}
              </Button>
            </View>
            <View style={styles.footerBtn}>
              <Button
                variant="primary"
                onPress={handleSaveShortcut}
                fullWidth
                style={styles.footerBtnHeight}
                accessibilityLabel={t("income.saveBill")}
              >
                {`${t("income.saveBill")} · ${formatMoney(estimatedTotal)}`}
              </Button>
            </View>
          </View>
        ) : (
          <Button
            onPress={handleDone}
            fullWidth
            accessibilityLabel={t("income.addSelected")}
          >
            {totalSelected > 0
              ? t("income.addSelectedCount", { count: totalSelected })
              : t("common.done")}
          </Button>
        )
      }
    >
      {isEmpty ? (
        <View style={styles.empty}>
          <Ionicons
            name="cut-outline"
            size={40}
            color={colors.text.muted}
            style={{ marginBottom: spacing[3] }}
          />
          <Text style={styles.emptyTitle}>{t("income.noServicesTitle")}</Text>
          <Text style={styles.emptyBody}>{t("income.noServicesBody")}</Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          stickySectionHeadersEnabled
          contentContainerStyle={styles.listContent}
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionHeaderText}>{section.title}</Text>
            </View>
          )}
          renderItem={({ item }) => {
            const isChecked = selected.has(item.id);
            const price = displayPrice(item, customerGender);
            const assignedId = employeeByServiceId.get(item.id);
            const assignedName = employeeName(assignedId);
            return (
              <Pressable
                style={({ pressed }) => [
                  styles.row,
                  pressed && styles.rowPressed
                ]}
                onPress={() => toggle(item.id)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isChecked }}
              >
                {/* Left column: name (top) + price (bottom) */}
                <View style={styles.rowLeft}>
                  <Text style={styles.rowName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.rowPrice}>
                    {price > 0 ? formatMoney(price) : "—"}
                  </Text>
                </View>

                {/* Right area: employee chip + checkbox */}
                <View style={styles.rowRight}>
                  {isChecked && (
                    <Pressable
                      onPress={(e) => {
                        e.stopPropagation();
                        if (employees.length === 0) return;
                        setPickingEmployeeFor(item.id);
                      }}
                      hitSlop={6}
                      style={styles.employeeChip}
                      accessibilityRole="button"
                      accessibilityLabel={t("income.changeEmployee")}
                    >
                      <Ionicons
                        name="person-outline"
                        size={12}
                        color={colors.brand.primary}
                      />
                      <Text
                        style={styles.employeeChipText}
                        numberOfLines={1}
                      >
                        {assignedName || t("income.selectEmployee")}
                      </Text>
                    </Pressable>
                  )}
                  <View
                    style={[
                      styles.checkbox,
                      isChecked && styles.checkboxChecked
                    ]}
                  >
                    {isChecked && (
                      <Ionicons
                        name="checkmark"
                        size={16}
                        color={colors.text.inverse}
                      />
                    )}
                  </View>
                </View>
              </Pressable>
            );
          }}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}

      {/* Per-line employee picker */}
      <Modal
        visible={pickingEmployeeFor !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPickingEmployeeFor(null)}
      >
        <Pressable
          style={styles.pickerScrim}
          onPress={() => setPickingEmployeeFor(null)}
        >
          <Pressable style={styles.pickerCard} onPress={() => {}}>
            <Text style={styles.pickerTitle}>
              {t("income.changeEmployee")}
            </Text>
            <ScrollView
              style={styles.pickerList}
              contentContainerStyle={styles.pickerListContent}
            >
              {employees.map((emp) => {
                const current =
                  pickingEmployeeFor !== null &&
                  employeeByServiceId.get(pickingEmployeeFor) === emp.id;
                return (
                  <Pressable
                    key={emp.id}
                    style={[
                      styles.pickerRow,
                      current && styles.pickerRowActive
                    ]}
                    onPress={() => {
                      if (pickingEmployeeFor) {
                        assignEmployee(pickingEmployeeFor, emp.id);
                      }
                    }}
                  >
                    <Text
                      style={[
                        styles.pickerRowText,
                        current && styles.pickerRowTextActive
                      ]}
                      numberOfLines={1}
                    >
                      {emp.name}
                    </Text>
                    {current && (
                      <Ionicons
                        name="checkmark"
                        size={18}
                        color={colors.brand.primary}
                      />
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </BottomSheet>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  listContent: {
    paddingBottom: spacing[3]
  },
  footerRow: {
    flexDirection: "row",
    gap: spacing[2]
  },
  footerBtn: {
    flex: 1
  },
  footerBtnHeight: {
    minHeight: 52
  },
  sectionHeader: {
    backgroundColor: colors.surface.default,
    borderBottomColor: colors.divider,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2]
  },
  sectionHeaderText: {
    ...typography.overline,
    color: colors.brand.primary
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[3],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3]
  },
  rowPressed: {
    backgroundColor: colors.interactive.pressed
  },
  rowLeft: {
    flex: 1,
    gap: spacing[1] / 2
  },
  rowRight: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[2]
  },
  rowName: {
    ...typography.body,
    color: colors.text.primary
  },
  rowPrice: {
    ...typography.bodySmall,
    color: colors.text.secondary
  },
  employeeChip: {
    alignItems: "center",
    backgroundColor: colors.brand.accentLight,
    borderRadius: radius.full,
    flexDirection: "row",
    gap: spacing[1],
    maxWidth: 130,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1] / 2
  },
  employeeChipText: {
    ...typography.caption,
    color: colors.brand.primary,
    fontWeight: "600"
  },
  checkbox: {
    alignItems: "center",
    borderColor: colors.border.strong,
    borderRadius: radius.xs,
    borderWidth: 2,
    height: 22,
    justifyContent: "center",
    width: 22
  },
  checkboxChecked: {
    backgroundColor: colors.brand.primary,
    borderColor: colors.brand.primary
  },
  separator: {
    backgroundColor: colors.divider,
    height: StyleSheet.hairlineWidth,
    marginHorizontal: spacing[4]
  },
  empty: {
    alignItems: "center",
    padding: spacing[6]
  },
  emptyTitle: {
    ...typography.h3,
    color: colors.text.primary,
    marginBottom: spacing[1],
    textAlign: "center"
  },
  emptyBody: {
    ...typography.bodySmall,
    color: colors.text.secondary,
    textAlign: "center"
  },
  // Employee picker modal
  pickerScrim: {
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    flex: 1,
    justifyContent: "center",
    padding: spacing[4]
  },
  pickerCard: {
    backgroundColor: colors.surface.default,
    borderRadius: radius.lg,
    maxHeight: "70%",
    padding: spacing[4],
    width: "100%"
  },
  pickerTitle: {
    ...typography.h3,
    color: colors.text.primary,
    marginBottom: spacing[3]
  },
  pickerList: {
    flexGrow: 0
  },
  pickerListContent: {
    gap: spacing[1]
  },
  pickerRow: {
    alignItems: "center",
    borderRadius: radius.md,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3]
  },
  pickerRowActive: {
    backgroundColor: colors.interactive.selected
  },
  pickerRowText: {
    ...typography.body,
    color: colors.text.primary,
    flex: 1
  },
  pickerRowTextActive: {
    color: colors.brand.primary,
    fontWeight: "600"
  }
});
