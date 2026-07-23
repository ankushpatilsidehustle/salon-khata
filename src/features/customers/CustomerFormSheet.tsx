// Add / edit customer sheet. Two fields (name + phone). Phone is normalized
// to the last 10 digits on save so users can paste "+91 98765 43210" or
// "98765 43210" interchangeably. If the phone collides with an existing
// customer, the sheet surfaces a `DuplicatePhoneError` message with an
// "Open existing" action wired via `onJumpToExisting`.

import { useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { BottomSheet } from "@/components/core/BottomSheet";
import { Button } from "@/components/core/Button";
import { TextField } from "@/components/core/TextField";
import { useSnackbar } from "@/components/core/SnackbarProvider";
import { colors, spacing, typography } from "@/design-system/tokens";
import { DEV_SALON_ID } from "@/constants/dev";
import {
  CustomerRepository,
  DuplicatePhoneError
} from "@/repositories/customer-repository";
import { Events, track } from "@/observability";

type Props = {
  visible: boolean;
  /** When present, load that customer for editing; otherwise add mode. */
  customerId?: string | null;
  onClose: () => void;
  onSaved: () => void;
  /** Fired when the duplicate-phone snackbar action is tapped. */
  onJumpToExisting?: (existingId: string) => void;
};

const repo = new CustomerRepository();

export function CustomerFormSheet({
  customerId,
  onClose,
  onJumpToExisting,
  onSaved,
  visible
}: Props) {
  const { t } = useTranslation();
  const { showSnackbar } = useSnackbar();
  const isEditMode = !!customerId;

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [nameError, setNameError] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const loadedForIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!visible) {
      loadedForIdRef.current = null;
      return;
    }
    setNameError("");
    setPhoneError("");
    if (customerId) {
      if (loadedForIdRef.current === customerId) return;
      const existing = repo.getById(DEV_SALON_ID, customerId);
      if (existing) {
        setName(existing.name);
        setPhone(existing.phone);
      }
      loadedForIdRef.current = customerId;
    } else {
      setName("");
      setPhone("");
    }
  }, [visible, customerId]);

  const validate = (): boolean => {
    let ok = true;
    if (!name.trim()) {
      setNameError(t("customers.form.nameRequired"));
      ok = false;
    } else {
      setNameError("");
    }
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) {
      setPhoneError(t("customers.form.phoneRequired"));
      ok = false;
    } else {
      setPhoneError("");
    }
    return ok;
  };

  const handleSave = () => {
    if (!validate()) return;
    try {
      if (isEditMode && customerId) {
        repo.update(DEV_SALON_ID, customerId, { name, phone });
        track(Events.customer.updated);
      } else {
        repo.insert({ salonId: DEV_SALON_ID, name, phone });
        track(Events.customer.created);
      }
      onSaved();
      showSnackbar(t("customers.saved"));
      onClose();
    } catch (err) {
      if (err instanceof DuplicatePhoneError) {
        setPhoneError(t("customers.form.duplicate"));
        showSnackbar({
          message: t("customers.form.duplicate"),
          actionLabel: t("customers.form.duplicateJump"),
          onAction: () => onJumpToExisting?.(err.existingId)
        });
        return;
      }
      const message = err instanceof Error ? err.message : String(err);
      showSnackbar(message);
    }
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={isEditMode ? t("customers.edit") : t("customers.add")}
      footer={
        <Button onPress={handleSave} fullWidth>
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
          label={t("customers.form.name")}
          value={name}
          onChangeText={(v) => {
            setName(v);
            if (nameError) setNameError("");
          }}
          placeholder={t("customers.form.namePlaceholder")}
          error={nameError}
          autoCapitalize="words"
          returnKeyType="next"
          testID="customer-field-name"
        />
        <TextField
          label={t("customers.form.phone")}
          value={phone}
          onChangeText={(v) => {
            setPhone(v);
            if (phoneError) setPhoneError("");
          }}
          placeholder={t("customers.form.phonePlaceholder")}
          keyboardType="phone-pad"
          maxLength={15}
          error={phoneError}
          testID="customer-field-phone"
        />
        <Text style={styles.hint}>
          {/* Same normalization applied elsewhere — mention it once. */}
          {t("income.customerPhonePlaceholder")}
        </Text>
      </ScrollView>
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
  hint: {
    ...typography.caption,
    color: colors.text.muted
  }
});
