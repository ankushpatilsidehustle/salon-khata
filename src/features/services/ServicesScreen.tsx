import { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useIsFocused } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import { AppBar } from "@/components/core/AppBar";
import { EmptyState } from "@/components/core/EmptyState";
import { Fab } from "@/components/core/Fab";
import { ListItem } from "@/components/core/ListItem";
import { colors, radius, spacing, typography } from "@/design-system/tokens";
import { DEV_SALON_ID } from "@/constants/dev";
import { ServiceRepository } from "@/repositories/service-repository";
import type {
  ServiceCategoryFilter,
  ServiceRecord
} from "@/repositories/service-repository";
import { ServiceCategoryRepository } from "@/repositories/service-category-repository";
import type { ServiceCategoryRecord } from "@/repositories/service-category-repository";
import type { EntriesStackParamList } from "@/features/entries/EntriesNavigator";
import { ServiceFormSheet } from "./ServiceFormSheet";

type Props = NativeStackScreenProps<EntriesStackParamList, "Services">;

const serviceRepo = new ServiceRepository();
const categoryRepo = new ServiceCategoryRepository();

export function ServicesScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const isFocused = useIsFocused();

  const [filter, setFilter] = useState<ServiceCategoryFilter>("all");
  const [services, setServices] = useState<ServiceRecord[]>([]);
  const [categories, setCategories] = useState<ServiceCategoryRecord[]>([]);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const loadCategories = useCallback(() => {
    // Seed defaults on first launch, then read the full list.
    categoryRepo.ensureDefaults(DEV_SALON_ID);
    setCategories(categoryRepo.listAll(DEV_SALON_ID));
  }, []);

  const loadServices = useCallback((f: ServiceCategoryFilter) => {
    setServices(serviceRepo.listAll(DEV_SALON_ID, f));
  }, []);

  useEffect(() => {
    if (isFocused) loadCategories();
  }, [isFocused, loadCategories]);

  useEffect(() => {
    if (isFocused) loadServices(filter);
  }, [isFocused, filter, loadServices]);

  const openAdd = () => {
    setEditingId(null);
    setSheetOpen(true);
  };

  const openEdit = (id: string) => {
    setEditingId(id);
    setSheetOpen(true);
  };

  const closeSheet = () => setSheetOpen(false);

  const handleSaved = () => {
    loadServices(filter);
  };

  return (
    <View style={styles.root}>
      <AppBar
        title={t("services.title")}
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

      {/* Category filter chips */}
      <CategoryFilterBar
        categories={categories}
        selected={filter}
        onSelect={setFilter}
        allLabel={t("services.filter.all")}
      />

      {services.length === 0 ? (
        <EmptyState
          icon={t("services.empty.icon")}
          title={t("services.empty.title")}
          body={t("services.empty.body")}
          actionLabel={t("services.add")}
          onAction={openAdd}
        />
      ) : (
        <FlatList
          data={services}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          renderItem={({ item }) => (
            <ListItem
              title={item.name}
              subtitle={buildSubtitle(item, categories, t("common.inactive"))}
              trailing={<PriceTag service={item} />}
              showChevron={false}
              onPress={() => openEdit(item.id)}
            />
          )}
        />
      )}

      <Fab
        onPress={openAdd}
        label={t("services.add")}
        accessibilityLabel={t("services.add")}
      />

      <ServiceFormSheet
        visible={sheetOpen}
        onClose={closeSheet}
        onSaved={handleSaved}
        serviceId={editingId}
        categories={categories}
        onCategoriesChanged={loadCategories}
      />
    </View>
  );
}

// ─── Filter chips ────────────────────────────────────────────────────────────

type FilterBarProps = {
  categories: ServiceCategoryRecord[];
  selected: ServiceCategoryFilter;
  onSelect: (value: ServiceCategoryFilter) => void;
  allLabel: string;
};

function CategoryFilterBar({
  allLabel,
  categories,
  onSelect,
  selected
}: FilterBarProps) {
  const activeCategories = categories.filter((c) => c.is_active === 1);
  const chips: { key: string; label: string; value: ServiceCategoryFilter }[] = [
    { key: "all", label: allLabel, value: "all" },
    ...activeCategories.map((c) => ({ key: c.id, label: c.name, value: c.id }))
  ];

  return (
    <View style={filterStyles.wrapper}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={filterStyles.content}
      >
        {chips.map((chip) => {
          const isActive = chip.value === selected;
          return (
            <Pressable
              key={chip.key}
              onPress={() => onSelect(chip.value)}
              style={({ pressed }) => [
                filterStyles.chip,
                isActive ? filterStyles.chipActive : filterStyles.chipIdle,
                pressed && !isActive && filterStyles.chipPressed
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={chip.label}
            >
              <Text
                style={[
                  filterStyles.chipLabel,
                  isActive && filterStyles.chipLabelActive
                ]}
                numberOfLines={1}
              >
                {chip.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ─── Row bits ────────────────────────────────────────────────────────────────

function buildSubtitle(
  service: ServiceRecord,
  categories: ServiceCategoryRecord[],
  inactiveLabel: string
): string | undefined {
  const parts: string[] = [];
  const cat = service.category_id
    ? categories.find((c) => c.id === service.category_id)
    : null;
  if (cat) parts.push(cat.name);
  if (service.is_active === 0) parts.push(inactiveLabel);
  return parts.length > 0 ? parts.join(" · ") : undefined;
}

function PriceTag({ service }: { service: ServiceRecord }) {
  const male = service.male_price;
  const female = service.female_price;

  if (male > 0 && female > 0) {
    return (
      <View style={priceStyle.stack}>
        <PriceLine icon="male" value={male} />
        <PriceLine icon="female" value={female} />
      </View>
    );
  }
  if (male > 0) return <PriceLine icon="male" value={male} solo />;
  if (female > 0) return <PriceLine icon="female" value={female} solo />;
  return <Text style={priceStyle.dash}>—</Text>;
}

function PriceLine({
  icon,
  solo = false,
  value
}: {
  icon: "male" | "female";
  value: number;
  solo?: boolean;
}) {
  const rupees = value / 100;
  const label = Number.isInteger(rupees) ? `₹${rupees}` : `₹${rupees.toFixed(2)}`;
  const color = icon === "male" ? colors.status.info : colors.brand.accent;
  return (
    <View style={priceStyle.line}>
      <Ionicons name={icon} size={12} color={color} />
      <Text style={[priceStyle.text, solo && priceStyle.textSolo]}>{label}</Text>
    </View>
  );
}

const priceStyle = StyleSheet.create({
  stack: {
    alignItems: "flex-end",
    gap: 2
  },
  line: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[1]
  },
  text: {
    ...typography.bodySmall,
    color: colors.text.primary,
    fontWeight: "600"
  },
  textSolo: {
    ...typography.bodyEmphasis
  },
  dash: {
    ...typography.bodySmall,
    color: colors.text.muted
  }
});

const filterStyles = StyleSheet.create({
  wrapper: {
    backgroundColor: colors.background.default,
    paddingVertical: spacing[3]
  },
  content: {
    paddingHorizontal: spacing[4],
    gap: spacing[2]
  },
  chip: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: radius.full,
    minHeight: 36,
    justifyContent: "center"
  },
  chipIdle: {
    backgroundColor: colors.surface.default,
    borderWidth: 1,
    borderColor: colors.border.subtle
  },
  chipActive: {
    backgroundColor: colors.brand.primary
  },
  chipPressed: {
    backgroundColor: colors.interactive.pressed
  },
  chipLabel: {
    ...typography.bodySmall,
    color: colors.text.primary,
    fontWeight: "600"
  },
  chipLabelActive: {
    color: colors.text.inverse
  }
});

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background.default
  },
  listContent: {
    paddingBottom: spacing[9] + spacing[4]
  },
  separator: {
    height: 1,
    backgroundColor: colors.divider,
    marginLeft: spacing[4]
  }
});
