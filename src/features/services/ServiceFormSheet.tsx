import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";

import { BottomSheet } from "@/components/core/BottomSheet";
import { Button } from "@/components/core/Button";
import { TextField } from "@/components/core/TextField";
import { colors, radius, spacing, typography } from "@/design-system/tokens";
import { DEV_SALON_ID } from "@/constants/dev";
import { ServiceRepository } from "@/repositories/service-repository";
import type { ServiceRecord } from "@/repositories/service-repository";
import { ServiceCategoryRepository } from "@/repositories/service-category-repository";
import type { ServiceCategoryRecord } from "@/repositories/service-category-repository";
import { CategoryPickerSheet } from "./CategoryPickerSheet";

type ServiceFormSheetProps = {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
  /** When provided, the sheet loads and edits this service. */
  serviceId?: string | null;
  categories: ServiceCategoryRecord[];
  /** Called when a new category is created inside the picker. */
  onCategoriesChanged: () => void;
};

const serviceRepo = new ServiceRepository();
const categoryRepo = new ServiceCategoryRepository();

const emptyForm = {
  name: "",
  malePrice: "",
  femalePrice: "",
  productCost: "",
  categoryId: null as string | null,
  isActive: true
};

export function ServiceFormSheet({
  categories,
  onCategoriesChanged,
  onClose,
  onSaved,
  serviceId,
  visible
}: ServiceFormSheetProps) {
  const { t } = useTranslation();
  const isEditMode = !!serviceId;

  const [name, setName] = useState(emptyForm.name);
  const [malePrice, setMalePrice] = useState(emptyForm.malePrice);
  const [femalePrice, setFemalePrice] = useState(emptyForm.femalePrice);
  const [productCost, setProductCost] = useState(emptyForm.productCost);
  const [categoryId, setCategoryId] = useState<string | null>(emptyForm.categoryId);
  const [isActive, setIsActive] = useState(emptyForm.isActive);

  const [nameError, setNameError] = useState("");
  const [priceError, setPriceError] = useState("");
  const [categoryError, setCategoryError] = useState("");

  const [pickerOpen, setPickerOpen] = useState(false);

  const loadedForIdRef = useRef<string | null>(null);

  // Reset / load whenever the sheet becomes visible or serviceId changes.
  useEffect(() => {
    if (!visible) {
      loadedForIdRef.current = null;
      return;
    }
    setNameError("");
    setPriceError("");
    setCategoryError("");

    if (serviceId) {
      if (loadedForIdRef.current === serviceId) return;
      const svc: ServiceRecord | null = serviceRepo.getById(serviceId, DEV_SALON_ID);
      if (!svc) return;
      setName(svc.name);
      setMalePrice(svc.male_price > 0 ? paiseToInput(svc.male_price) : "");
      setFemalePrice(svc.female_price > 0 ? paiseToInput(svc.female_price) : "");
      setProductCost(svc.product_cost > 0 ? paiseToInput(svc.product_cost) : "");
      setCategoryId(svc.category_id);
      setIsActive(svc.is_active === 1);
      loadedForIdRef.current = serviceId;
    } else {
      setName(emptyForm.name);
      setMalePrice(emptyForm.malePrice);
      setFemalePrice(emptyForm.femalePrice);
      setProductCost(emptyForm.productCost);
      setCategoryId(emptyForm.categoryId);
      setIsActive(emptyForm.isActive);
    }
  }, [visible, serviceId]);

  const selectedCategory = categoryId
    ? categories.find((c) => c.id === categoryId)
    : null;

  const validate = (): boolean => {
    let ok = true;

    if (!name.trim()) {
      setNameError(t("services.nameRequired"));
      ok = false;
    } else {
      setNameError("");
    }

    const male = parsePriceToPaise(malePrice);
    const female = parsePriceToPaise(femalePrice);
    if (male <= 0 && female <= 0) {
      setPriceError(t("services.priceAtLeastOne"));
      ok = false;
    } else {
      setPriceError("");
    }

    if (!categoryId) {
      setCategoryError(t("services.categoryRequired"));
      ok = false;
    } else {
      setCategoryError("");
    }

    return ok;
  };

  const handleSave = () => {
    if (!validate()) return;
    const male = parsePriceToPaise(malePrice);
    const female = parsePriceToPaise(femalePrice);
    const cost = parsePriceToPaise(productCost);

    if (isEditMode && serviceId) {
      serviceRepo.update(serviceId, DEV_SALON_ID, {
        name: name.trim(),
        malePrice: male,
        femalePrice: female,
        productCost: cost,
        categoryId,
        isActive
      });
    } else {
      serviceRepo.insert({
        salonId: DEV_SALON_ID,
        name: name.trim(),
        malePrice: male,
        femalePrice: female,
        productCost: cost,
        categoryId
      });
    }
    onSaved();
    onClose();
  };

  return (
    <>
      <BottomSheet
        visible={visible}
        onClose={onClose}
        title={isEditMode ? t("services.edit") : t("services.add")}
        footer={
          <Button onPress={handleSave} fullWidth accessibilityLabel={t("common.save")}>
            {t("common.save")}
          </Button>
        }
      >
        <ScrollView
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <TextField
            label={t("services.name")}
            value={name}
            onChangeText={(v) => {
              setName(v);
              if (nameError) setNameError("");
            }}
            placeholder={t("services.namePlaceholder")}
            error={nameError}
            autoCapitalize="words"
            returnKeyType="next"
            testID="field-name"
          />

          {/* Category picker trigger */}
          <View>
            <Text style={styles.fieldLabel}>{t("services.category")}</Text>
            <Pressable
              onPress={() => {
                setPickerOpen(true);
                if (categoryError) setCategoryError("");
              }}
              style={({ pressed }) => [
                styles.pickerButton,
                categoryError ? styles.pickerError : styles.pickerDefault,
                pressed && styles.pickerPressed
              ]}
              accessibilityRole="button"
              accessibilityLabel={t("services.category")}
            >
              <Text
                style={[
                  styles.pickerText,
                  !selectedCategory && styles.pickerPlaceholder
                ]}
                numberOfLines={1}
              >
                {selectedCategory?.name ?? t("services.categoryPlaceholder")}
              </Text>
              <Ionicons
                name="chevron-down"
                size={18}
                color={colors.text.secondary}
              />
            </Pressable>
            {categoryError ? (
              <Text style={styles.errorText}>{categoryError}</Text>
            ) : null}
          </View>

          {/* Male / female prices */}
          <View style={styles.priceRow}>
            <View style={styles.priceCol}>
              <TextField
                label={t("services.malePrice")}
                value={malePrice}
                onChangeText={(v) => {
                  setMalePrice(v);
                  if (priceError) setPriceError("");
                }}
                placeholder={t("services.pricePlaceholder")}
                keyboardType="decimal-pad"
                returnKeyType="next"
                autoCapitalize="none"
                testID="field-male-price"
              />
            </View>
            <View style={styles.priceCol}>
              <TextField
                label={t("services.femalePrice")}
                value={femalePrice}
                onChangeText={(v) => {
                  setFemalePrice(v);
                  if (priceError) setPriceError("");
                }}
                placeholder={t("services.pricePlaceholder")}
                keyboardType="decimal-pad"
                returnKeyType="done"
                autoCapitalize="none"
                testID="field-female-price"
              />
            </View>
          </View>
          {priceError ? (
            <Text style={styles.errorText}>{priceError}</Text>
          ) : (
            <Text style={styles.hint}>{t("services.priceHint")}</Text>
          )}

          {/* Product cost (optional) — subtracted from line amount before */}
          {/* applying percentage-based commissions. */}
          <TextField
            label={t("services.productCost")}
            value={productCost}
            onChangeText={setProductCost}
            placeholder={t("services.pricePlaceholder")}
            keyboardType="decimal-pad"
            returnKeyType="done"
            autoCapitalize="none"
            testID="field-product-cost"
          />
          <Text style={styles.hint}>{t("services.productCostHint")}</Text>

          {/* Active toggle — edit mode only */}
          {isEditMode ? (
            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>{t("services.activeLabel")}</Text>
              <Switch
                value={isActive}
                onValueChange={setIsActive}
                trackColor={{
                  true: colors.brand.primary,
                  false: colors.interactive.disabled
                }}
                thumbColor={colors.surface.default}
              />
            </View>
          ) : null}
        </ScrollView>
      </BottomSheet>

      <CategoryPickerSheet
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        categories={categories}
        selectedId={categoryId}
        onSelect={(id) => {
          setCategoryId(id);
          setPickerOpen(false);
          if (categoryError) setCategoryError("");
        }}
        onCategoryCreated={() => {
          onCategoriesChanged();
        }}
      />
    </>
  );
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function parsePriceToPaise(input: string): number {
  const trimmed = input.trim();
  if (!trimmed) return 0;
  const rupees = parseFloat(trimmed);
  if (isNaN(rupees) || rupees < 0) return 0;
  return Math.round(rupees * 100);
}

function paiseToInput(paise: number): string {
  const rupees = paise / 100;
  return Number.isInteger(rupees) ? String(rupees) : rupees.toFixed(2);
}

const styles = StyleSheet.create({
  body: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[3],
    paddingBottom: spacing[2],
    gap: spacing[4]
  },
  fieldLabel: {
    ...typography.bodySmall,
    color: colors.text.secondary,
    fontWeight: "500",
    marginBottom: spacing[1]
  },
  pickerButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing[3],
    backgroundColor: colors.surface.default
  },
  pickerDefault: {
    borderColor: colors.border.subtle
  },
  pickerError: {
    borderColor: colors.status.danger
  },
  pickerPressed: {
    backgroundColor: colors.interactive.pressed
  },
  pickerText: {
    ...typography.body,
    color: colors.text.primary,
    flex: 1
  },
  pickerPlaceholder: {
    color: colors.text.muted
  },
  errorText: {
    ...typography.bodySmall,
    color: colors.status.danger,
    marginTop: spacing[1]
  },
  hint: {
    ...typography.bodySmall,
    color: colors.text.muted
  },
  priceRow: {
    flexDirection: "row",
    gap: spacing[3]
  },
  priceCol: {
    flex: 1
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing[1]
  },
  toggleLabel: {
    ...typography.body,
    color: colors.text.primary
  }
});
