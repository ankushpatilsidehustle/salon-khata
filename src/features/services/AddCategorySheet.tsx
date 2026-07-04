import { useState } from "react";
import { StyleSheet, Switch, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { BottomSheet } from "@/components/core/BottomSheet";
import { Button } from "@/components/core/Button";
import { TextField } from "@/components/core/TextField";
import { colors, spacing, typography } from "@/design-system/tokens";
import { DEV_SALON_ID } from "@/constants/dev";
import { ServiceCategoryRepository } from "@/repositories/service-category-repository";
import type { ServiceCategoryRecord } from "@/repositories/service-category-repository";

type AddCategorySheetProps = {
  visible: boolean;
  onClose: () => void;
  onCreated: (category: ServiceCategoryRecord) => void;
};

const repo = new ServiceCategoryRepository();

/** Minimal sheet for creating a new service category: name + active toggle. */
export function AddCategorySheet({
  onClose,
  onCreated,
  visible
}: AddCategorySheetProps) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [nameError, setNameError] = useState("");

  const reset = () => {
    setName("");
    setIsActive(true);
    setNameError("");
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError(t("categories.nameRequired"));
      return;
    }
    const created = repo.insert({ salonId: DEV_SALON_ID, name: trimmed });
    if (!isActive) {
      repo.update(created.id, DEV_SALON_ID, { isActive: false });
    }
    reset();
    onCreated({
      ...created,
      is_active: isActive ? 1 : 0
    });
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={handleClose}
      title={t("categories.add")}
      footer={
        <Button onPress={handleSave} fullWidth accessibilityLabel={t("common.save")}>
          {t("common.save")}
        </Button>
      }
    >
      <View style={styles.body}>
        <TextField
          label={t("categories.name")}
          value={name}
          onChangeText={(v) => {
            setName(v);
            if (nameError) setNameError("");
          }}
          placeholder={t("categories.namePlaceholder")}
          error={nameError}
          autoCapitalize="words"
          returnKeyType="done"
          onSubmitEditing={handleSave}
          testID="field-category-name"
        />

        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>{t("categories.activeLabel")}</Text>
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
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[3],
    paddingBottom: spacing[2],
    gap: spacing[4]
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
