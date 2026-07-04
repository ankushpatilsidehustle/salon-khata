import { useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";

import { BottomSheet } from "@/components/core/BottomSheet";
import { colors, radius, spacing, typography } from "@/design-system/tokens";
import { AddCategorySheet } from "./AddCategorySheet";
import type { ServiceCategoryRecord } from "@/repositories/service-category-repository";

type CategoryPickerSheetProps = {
  visible: boolean;
  onClose: () => void;
  categories: ServiceCategoryRecord[];
  selectedId: string | null;
  onSelect: (categoryId: string) => void;
  /** Called after a new category is created so the parent can refresh its list. */
  onCategoryCreated: (category: ServiceCategoryRecord) => void;
};

/**
 * Bottom sheet that lists active categories and offers a top row for creating
 * a new one. Only active categories are shown (creating a new inactive one
 * is unusual, but the caller controls the seed list).
 */
export function CategoryPickerSheet({
  categories,
  onCategoryCreated,
  onClose,
  onSelect,
  selectedId,
  visible
}: CategoryPickerSheetProps) {
  const { t } = useTranslation();
  const [addOpen, setAddOpen] = useState(false);

  const activeCategories = categories.filter((c) => c.is_active === 1);

  const handleCreated = (category: ServiceCategoryRecord) => {
    setAddOpen(false);
    onCategoryCreated(category);
    // Auto-select the newly created category to speed up the flow.
    onSelect(category.id);
  };

  return (
    <>
      <BottomSheet
        visible={visible}
        onClose={onClose}
        title={t("categories.pick")}
      >
        <FlatList
          data={activeCategories}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <Pressable
              onPress={() => setAddOpen(true)}
              style={({ pressed }) => [
                styles.addRow,
                pressed && styles.rowPressed
              ]}
              accessibilityRole="button"
              accessibilityLabel={t("categories.add")}
            >
              <View style={styles.addIconWrap}>
                <Ionicons name="add" size={20} color={colors.brand.primary} />
              </View>
              <Text style={styles.addLabel}>{t("categories.add")}</Text>
            </Pressable>
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          renderItem={({ item }) => {
            const isSelected = item.id === selectedId;
            return (
              <Pressable
                onPress={() => onSelect(item.id)}
                style={({ pressed }) => [
                  styles.row,
                  pressed && styles.rowPressed
                ]}
                accessibilityRole="button"
              >
                <Text style={styles.rowLabel}>{item.name}</Text>
                {isSelected ? (
                  <Ionicons
                    name="checkmark"
                    size={20}
                    color={colors.brand.primary}
                  />
                ) : null}
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>{t("categories.empty")}</Text>
            </View>
          }
        />
      </BottomSheet>

      <AddCategorySheet
        visible={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={handleCreated}
      />
    </>
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingBottom: spacing[3]
  },
  addRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    gap: spacing[3]
  },
  addIconWrap: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: colors.interactive.selected,
    alignItems: "center",
    justifyContent: "center"
  },
  addLabel: {
    ...typography.bodyEmphasis,
    color: colors.brand.primary
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    minHeight: 52
  },
  rowPressed: {
    backgroundColor: colors.interactive.pressed
  },
  rowLabel: {
    ...typography.body,
    color: colors.text.primary,
    flex: 1
  },
  separator: {
    height: 1,
    backgroundColor: colors.divider,
    marginLeft: spacing[4]
  },
  empty: {
    padding: spacing[6],
    alignItems: "center"
  },
  emptyText: {
    ...typography.bodySmall,
    color: colors.text.secondary
  }
});
