import { useEffect, useMemo, useState } from "react";
import {
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
import type { ServiceCategoryRecord } from "@/repositories/service-category-repository";

type CustomerGender = "male" | "female" | null;

type Props = {
  visible: boolean;
  onClose: () => void;
  /**
   * Called with the final selection when the user taps Done.
   * Sheet does not close itself — caller decides after applying the change.
   */
  onDone: (selectedServices: ServiceRecord[]) => void;
  /** Currently-selected service ids (pre-checks matching rows). */
  initialSelectedIds: string[];
  /** Determines which price to display next to each service. */
  customerGender: CustomerGender;
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
  initialSelectedIds,
  onClose,
  onDone,
  visible
}: Props) {
  const { t } = useTranslation();

  const [sections, setSections] = useState<Section[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Load categories + services and group them whenever the sheet opens.
  useEffect(() => {
    if (!visible) return;

    const categories = categoryRepo.listActive(DEV_SALON_ID);
    const services = serviceRepo.listActive(DEV_SALON_ID);

    const catNameById = new Map<string, string>();
    for (const c of categories) catNameById.set(c.id, c.name);

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
  }, [visible, initialSelectedIds, t]);

  const totalSelected = selected.size;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleDone() {
    // Flatten sections and filter to selected ids, preserving list order.
    const chosen: ServiceRecord[] = [];
    for (const sec of sections) {
      for (const svc of sec.data) {
        if (selected.has(svc.id)) chosen.push(svc);
      }
    }
    onDone(chosen);
  }

  // Empty state: no services at all.
  const isEmpty = sections.length === 0;

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={t("income.addServices")}
      size="tall"
      dismissOnBackdropPress={false}
      footer={
        <Button
          onPress={handleDone}
          fullWidth
          accessibilityLabel={t("income.addSelected")}
        >
          {totalSelected > 0
            ? t("income.addSelectedCount", { count: totalSelected })
            : t("common.done")}
        </Button>
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
                <View style={styles.rowText}>
                  <Text style={styles.rowName} numberOfLines={1}>
                    {item.name}
                  </Text>
                </View>
                <Text style={styles.rowPrice}>
                  {price > 0 ? formatMoney(price) : "—"}
                </Text>
              </Pressable>
            );
          }}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </BottomSheet>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  listContent: {
    paddingBottom: spacing[3]
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
  rowText: {
    flex: 1
  },
  rowName: {
    ...typography.body,
    color: colors.text.primary
  },
  rowPrice: {
    ...typography.bodyEmphasis,
    color: colors.text.primary
  },
  separator: {
    backgroundColor: colors.divider,
    height: StyleSheet.hairlineWidth,
    marginLeft: spacing[4] + 22 + spacing[3]
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
  }
});
