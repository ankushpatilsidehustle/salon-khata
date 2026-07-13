import { useEffect, useRef, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View
} from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker, {
  DateTimePickerAndroid,
  type DateTimePickerEvent
} from "@react-native-community/datetimepicker";

import { BottomSheet } from "@/components/core/BottomSheet";
import { Button } from "@/components/core/Button";
import { TextField } from "@/components/core/TextField";
import { colors, radius, spacing, typography } from "@/design-system/tokens";
import { DEV_SALON_ID } from "@/constants/dev";
import { CommissionRepository } from "@/repositories/commission-repository";
import { EmployeeRepository } from "@/repositories/employee-repository";
import type {
  CompensationType,
  EmployeeGender,
  EmployeeRecord
} from "@/repositories/employee-repository";
import { CommissionRulesSheet } from "./CommissionRulesSheet";

type EmployeeFormSheetProps = {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
  /** When present, sheet loads and edits this employee. */
  employeeId?: string | null;
};

const repo = new EmployeeRepository();
const commissionRepo = new CommissionRepository();

export function EmployeeFormSheet({
  employeeId,
  onClose,
  onSaved,
  visible
}: EmployeeFormSheetProps) {
  const { t } = useTranslation();
  const isEditMode = !!employeeId;

  // ─── Form state ────────────────────────────────────────────────────────────
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [mobile, setMobile] = useState("");
  const [gender, setGender] = useState<EmployeeGender | null>(null);
  const [joiningDate, setJoiningDate] = useState<string | null>(null);
  const [compType, setCompType] = useState<CompensationType | null>(null);
  const [salaryInput, setSalaryInput] = useState("");
  const [commissionInput, setCommissionInput] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [isOwner, setIsOwner] = useState(false);

  const [nameError, setNameError] = useState("");
  const [compError, setCompError] = useState("");

  const [iosPickerOpen, setIosPickerOpen] = useState(false);
  const loadedForIdRef = useRef<string | null>(null);

  /** Number of per-service overrides configured for this employee (edit mode). */
  const [ruleCount, setRuleCount] = useState(0);
  /** Toggles the nested commission-rules sheet on top of this one. */
  const [rulesSheetOpen, setRulesSheetOpen] = useState(false);

  // Reset / load whenever visibility or target id changes.
  useEffect(() => {
    if (!visible) {
      loadedForIdRef.current = null;
      return;
    }
    setNameError("");
    setCompError("");
    setIosPickerOpen(false);

    if (employeeId) {
      if (loadedForIdRef.current === employeeId) return;
      const emp: EmployeeRecord | null = repo.getById(employeeId, DEV_SALON_ID);
      if (!emp) return;
      setName(emp.name);
      setAddress(emp.address ?? "");
      setMobile(emp.mobile_number ?? "");
      setGender(emp.gender);
      setJoiningDate(emp.joining_date);
      setCompType(emp.compensation_type);
      setSalaryInput(
        emp.salary_amount != null ? paiseToInput(emp.salary_amount) : ""
      );
      setCommissionInput(
        emp.commission_percent != null
          ? percentBpsToInput(emp.commission_percent)
          : ""
      );
      setIsActive(emp.is_active === 1);
      setIsOwner(emp.is_owner === 1);
      setRuleCount(
        commissionRepo.findAllRulesForEmployee(employeeId, DEV_SALON_ID).length
      );
      loadedForIdRef.current = employeeId;
    } else {
      setName("");
      setAddress("");
      setMobile("");
      setGender(null);
      setJoiningDate(null);
      setCompType(null);
      setSalaryInput("");
      setCommissionInput("");
      setIsActive(true);
      setIsOwner(false);
      setRuleCount(0);
    }
  }, [visible, employeeId]);

  // ─── Validation ────────────────────────────────────────────────────────────
  const validate = (): boolean => {
    let ok = true;
    if (!name.trim()) {
      setNameError(t("employees.nameRequired"));
      ok = false;
    } else {
      setNameError("");
    }

    if (compType === "salary") {
      const amt = parseSalaryToPaise(salaryInput);
      if (amt <= 0) {
        setCompError(t("employees.salaryRequired"));
        ok = false;
      } else {
        setCompError("");
      }
    } else if (compType === "commission") {
      const pct = parsePercentToBps(commissionInput);
      if (pct <= 0 || pct > 10000) {
        setCompError(t("employees.commissionRequired"));
        ok = false;
      } else {
        setCompError("");
      }
    } else {
      setCompError("");
    }
    return ok;
  };

  // ─── Save ──────────────────────────────────────────────────────────────────
  const handleSave = () => {
    if (!validate()) return;

    const payload = {
      salonId: DEV_SALON_ID,
      name: name.trim(),
      address: address.trim() || null,
      mobileNumber: mobile.trim() || null,
      gender,
      joiningDate,
      compensationType: compType,
      salaryAmount:
        compType === "salary" ? parseSalaryToPaise(salaryInput) : null,
      commissionPercent:
        compType === "commission" ? parsePercentToBps(commissionInput) : null
    };

    if (isEditMode && employeeId) {
      repo.update(employeeId, DEV_SALON_ID, { ...payload, isActive });
    } else {
      repo.insert(payload);
    }
    onSaved();
    onClose();
  };

  // ─── Date picker ───────────────────────────────────────────────────────────
  const openDatePicker = () => {
    const current = joiningDate ? new Date(joiningDate) : new Date();
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value: current,
        mode: "date",
        maximumDate: new Date(),
        onChange: (event: DateTimePickerEvent, selected?: Date) => {
          if (event.type === "set" && selected) {
            setJoiningDate(toISODate(selected));
          }
        }
      });
    } else {
      setIosPickerOpen((v) => !v);
    }
  };

  // ─── Options ───────────────────────────────────────────────────────────────
  const genderOptions: { label: string; value: EmployeeGender }[] = [
    { label: t("employees.genderOptions.male"), value: "male" },
    { label: t("employees.genderOptions.female"), value: "female" },
    { label: t("employees.genderOptions.other"), value: "other" }
  ];
  const compensationOptions: { label: string; value: CompensationType }[] = [
    { label: t("employees.compensation.salary"), value: "salary" },
    { label: t("employees.compensation.commission"), value: "commission" }
  ];

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={isEditMode ? t("employees.edit") : t("employees.add")}
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
        {isEditMode && isOwner ? (
          <View style={styles.ownerBanner}>
            <View style={styles.ownerPill}>
              <Ionicons name="star" size={12} color={colors.brand.primary} />
              <Text style={styles.ownerPillText}>
                {t("employees.ownerBadge")}
              </Text>
            </View>
            <Text style={styles.ownerHint}>{t("employees.ownerHint")}</Text>
          </View>
        ) : null}

        {/* Name */}
        <TextField
          label={t("employees.name")}
          value={name}
          onChangeText={(v) => {
            setName(v);
            if (nameError) setNameError("");
          }}
          placeholder={t("employees.namePlaceholder")}
          error={nameError}
          autoCapitalize="words"
          returnKeyType="next"
          testID="field-name"
        />

        {/* Address */}
        <TextField
          label={t("employees.address")}
          value={address}
          onChangeText={setAddress}
          placeholder={t("employees.addressPlaceholder")}
          multiline
          autoCapitalize="sentences"
          testID="field-address"
        />

        {/* Mobile */}
        <TextField
          label={t("employees.mobile")}
          value={mobile}
          onChangeText={setMobile}
          placeholder={t("employees.mobilePlaceholder")}
          keyboardType="phone-pad"
          maxLength={15}
          testID="field-mobile"
        />

        {/* Gender */}
        <View>
          <Text style={styles.fieldLabel}>{t("employees.gender")}</Text>
          <View style={styles.compTypeRow}>
            {genderOptions.map((opt) => {
              const selected = gender === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => setGender(selected ? null : opt.value)}
                  style={({ pressed }) => [
                    styles.compChip,
                    selected ? styles.compChipActive : styles.compChipIdle,
                    pressed && !selected && styles.pickerPressed
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                >
                  <Text
                    style={[
                      styles.compChipLabel,
                      selected && styles.compChipLabelActive
                    ]}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Joining date */}
        <View>
          <Text style={styles.fieldLabel}>{t("employees.joiningDate")}</Text>
          <Pressable
            onPress={openDatePicker}
            style={({ pressed }) => [
              styles.pickerButton,
              pressed && styles.pickerPressed
            ]}
            accessibilityRole="button"
            accessibilityLabel={t("employees.joiningDate")}
          >
            <Ionicons
              name="calendar-outline"
              size={18}
              color={colors.text.secondary}
            />
            <Text
              style={[
                styles.pickerText,
                !joiningDate && styles.pickerPlaceholder
              ]}
            >
              {joiningDate
                ? formatDisplayDate(joiningDate)
                : t("employees.joiningDatePlaceholder")}
            </Text>
            {joiningDate ? (
              <Pressable
                onPress={() => setJoiningDate(null)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={t("common.clear")}
              >
                <Ionicons
                  name="close-circle"
                  size={18}
                  color={colors.text.muted}
                />
              </Pressable>
            ) : (
              <Ionicons
                name="chevron-down"
                size={18}
                color={colors.text.secondary}
              />
            )}
          </Pressable>

          {/* iOS inline spinner */}
          {Platform.OS === "ios" && iosPickerOpen ? (
            <View style={styles.iosPickerWrap}>
              <DateTimePicker
                value={joiningDate ? new Date(joiningDate) : new Date()}
                mode="date"
                display="spinner"
                maximumDate={new Date()}
                onChange={(_e, selected) => {
                  if (selected) setJoiningDate(toISODate(selected));
                }}
              />
              <Pressable
                onPress={() => setIosPickerOpen(false)}
                style={styles.iosPickerDone}
                accessibilityRole="button"
              >
                <Text style={styles.iosPickerDoneText}>
                  {t("common.done")}
                </Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        {/* Compensation */}
        <View>
          <Text style={styles.fieldLabel}>{t("employees.compensation.label")}</Text>
          <View style={styles.compTypeRow}>
            {compensationOptions.map((opt) => {
              const selected = compType === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  onPress={() =>
                    setCompType(selected ? null : opt.value)
                  }
                  style={({ pressed }) => [
                    styles.compChip,
                    selected ? styles.compChipActive : styles.compChipIdle,
                    pressed && !selected && styles.pickerPressed
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                >
                  <Text
                    style={[
                      styles.compChipLabel,
                      selected && styles.compChipLabelActive
                    ]}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {compType === "salary" ? (
            <View style={styles.compAmountWrap}>
              <TextField
                label={t("employees.salaryAmount")}
                value={salaryInput}
                onChangeText={(v) => {
                  setSalaryInput(v);
                  if (compError) setCompError("");
                }}
                placeholder={t("employees.salaryPlaceholder")}
                keyboardType="decimal-pad"
                error={compError}
                testID="field-salary"
              />
            </View>
          ) : compType === "commission" ? (
            <View style={styles.compAmountWrap}>
              <TextField
                label={t("employees.commissionPercent")}
                value={commissionInput}
                onChangeText={(v) => {
                  setCommissionInput(v);
                  if (compError) setCompError("");
                }}
                placeholder={t("employees.commissionPlaceholder")}
                keyboardType="decimal-pad"
                error={compError}
                testID="field-commission"
              />
            </View>
          ) : (
            <Text style={styles.compHint}>{t("employees.compensation.hint")}</Text>
          )}
        </View>

        {/* Per-service commission overrides */}
        {isEditMode && employeeId ? (
          <Pressable
            onPress={() => setRulesSheetOpen(true)}
            style={({ pressed }) => [
              styles.rulesTile,
              pressed && styles.rulesTilePressed
            ]}
            accessibilityRole="button"
            accessibilityLabel={t("employees.perServiceRules.title")}
          >
            <View style={styles.rulesTileIcon}>
              <Ionicons
                name="cash-outline"
                size={20}
                color={colors.brand.primary}
              />
            </View>
            <View style={styles.rulesTileText}>
              <Text style={styles.rulesTileTitle}>
                {t("employees.perServiceRules.title")}
              </Text>
              <Text style={styles.rulesTileSubtitle}>
                {ruleCount === 0
                  ? t("employees.perServiceRules.countZero")
                  : ruleCount === 1
                  ? t("employees.perServiceRules.countOne")
                  : t("employees.perServiceRules.countMany", {
                      count: ruleCount
                    })}
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={colors.text.muted}
            />
          </Pressable>
        ) : (
          <View style={styles.rulesTileDisabled}>
            <View style={styles.rulesTileIcon}>
              <Ionicons
                name="cash-outline"
                size={20}
                color={colors.text.muted}
              />
            </View>
            <View style={styles.rulesTileText}>
              <Text style={styles.rulesTileTitleDisabled}>
                {t("employees.perServiceRules.title")}
              </Text>
              <Text style={styles.rulesTileSubtitle}>
                {t("employees.perServiceRules.hintAddMode")}
              </Text>
            </View>
          </View>
        )}

        {/* Active toggle — edit mode only */}
        {isEditMode ? (
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>{t("employees.activeLabel")}</Text>
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

      {/* Nested commission-rules sheet — layers on top of this one so the
          user returns to the same employee edit context on close. */}
      {isEditMode && employeeId ? (
        <CommissionRulesSheet
          visible={rulesSheetOpen}
          onClose={() => {
            setRulesSheetOpen(false);
            // Refresh the tile count in case the user added/removed overrides.
            setRuleCount(
              commissionRepo.findAllRulesForEmployee(employeeId, DEV_SALON_ID)
                .length
            );
          }}
          employeeId={employeeId}
          employeeName={name.trim() || ""}
        />
      ) : null}
    </BottomSheet>
  );
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function parseSalaryToPaise(input: string): number {
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

function parsePercentToBps(input: string): number {
  const trimmed = input.trim();
  if (!trimmed) return 0;
  const percent = parseFloat(trimmed);
  if (isNaN(percent) || percent < 0) return 0;
  return Math.round(percent * 100);
}

function percentBpsToInput(bps: number): string {
  const percent = bps / 100;
  return Number.isInteger(percent) ? String(percent) : percent.toFixed(2);
}

/** Local YYYY-MM-DD (no timezone shift). */
function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Human-friendly display, e.g. "12 Mar 2025". */
function formatDisplayDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

// ─── Styles ──────────────────────────────────────────────────────────────────

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
    gap: spacing[2],
    minHeight: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    paddingHorizontal: spacing[3],
    backgroundColor: colors.surface.default
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
  iosPickerWrap: {
    marginTop: spacing[2],
    backgroundColor: colors.background.subtle,
    borderRadius: radius.md,
    overflow: "hidden"
  },
  iosPickerDone: {
    alignSelf: "flex-end",
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2]
  },
  iosPickerDoneText: {
    ...typography.button,
    color: colors.brand.primary
  },
  compTypeRow: {
    flexDirection: "row",
    gap: spacing[2]
  },
  compChip: {
    flex: 1,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    borderWidth: 1
  },
  compChipIdle: {
    backgroundColor: colors.surface.default,
    borderColor: colors.border.subtle
  },
  compChipActive: {
    backgroundColor: colors.brand.primary,
    borderColor: colors.brand.primary
  },
  compChipLabel: {
    ...typography.bodyEmphasis,
    color: colors.text.primary
  },
  compChipLabelActive: {
    color: colors.text.inverse
  },
  compAmountWrap: {
    marginTop: spacing[3]
  },
  compHint: {
    ...typography.bodySmall,
    color: colors.text.muted,
    marginTop: spacing[2]
  },
  rulesTile: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[3],
    borderWidth: 1,
    borderColor: colors.border.subtle,
    borderRadius: radius.md,
    backgroundColor: colors.surface.default,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3]
  },
  rulesTilePressed: {
    backgroundColor: colors.interactive.selected
  },
  rulesTileDisabled: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[3],
    borderWidth: 1,
    borderColor: colors.border.subtle,
    borderStyle: "dashed",
    borderRadius: radius.md,
    backgroundColor: colors.surface.sunken,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3]
  },
  rulesTileIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(103,57,183,0.10)"
  },
  rulesTileText: {
    flex: 1,
    gap: 2
  },
  rulesTileTitle: {
    ...typography.bodyEmphasis,
    color: colors.text.primary
  },
  rulesTileTitleDisabled: {
    ...typography.bodyEmphasis,
    color: colors.text.secondary
  },
  rulesTileSubtitle: {
    ...typography.caption,
    color: colors.text.secondary
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
  },
  ownerBanner: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[2],
    backgroundColor: "rgba(103,57,183,0.06)",
    borderRadius: radius.md,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2]
  },
  ownerPill: {
    alignItems: "center",
    backgroundColor: "rgba(103,57,183,0.14)",
    borderRadius: radius.full,
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: spacing[2],
    paddingVertical: 3
  },
  ownerPillText: {
    ...typography.caption,
    color: colors.brand.primary,
    fontSize: 11,
    fontWeight: "700"
  },
  ownerHint: {
    ...typography.caption,
    color: colors.text.secondary,
    flex: 1
  }
});
