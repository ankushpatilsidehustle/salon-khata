import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { useTranslation } from "react-i18next";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import DateTimePicker, {
  DateTimePickerAndroid,
  type DateTimePickerEvent
} from "@react-native-community/datetimepicker";

import { AppBar } from "@/components/core/AppBar";
import { Button } from "@/components/core/Button";
import { useSnackbar } from "@/components/core/SnackbarProvider";
import { colors, radius, spacing, typography } from "@/design-system/tokens";
import { DEV_SALON_ID } from "@/constants/dev";
import { formatMoney } from "@/domain/money";
import { newId } from "@/domain/id";
import { getUtcTimestamp } from "@/domain/dates";
import { EmployeeRepository } from "@/repositories/employee-repository";
import type { EmployeeRecord } from "@/repositories/employee-repository";
import { EmployeeAdvanceRepository } from "@/repositories/employee-advance-repository";
import type { RootStackParamList } from "@/application/AppNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "AdvanceEntry">;

// ─── Repositories ────────────────────────────────────────────────────────────

const employeeRepo = new EmployeeRepository();
const advanceRepo = new EmployeeAdvanceRepository();

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Local YYYY-MM-DD (no timezone shift). */
function toLocalISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Human-friendly date label — "5 Jul 2026". */
function formatDateLabel(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

/** Parse rupee-decimal string ("2000" or "2000.50") into paise. NaN on bad input. */
function parseRupeesToPaise(input: string): number {
  const trimmed = input.trim();
  if (!trimmed) return NaN;
  const raw = Number(trimmed);
  if (!Number.isFinite(raw) || raw < 0) return NaN;
  return Math.round(raw * 100);
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export function AdvanceEntryScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const editingId = route.params?.advanceId ?? null;
  const isEditing = !!editingId;
  const preselectEmployeeId = route.params?.employeeId ?? null;
  /** Preserve original `created_at` across updates so ordering doesn't jump. */
  const editingCreatedAtRef = useRef<string | null>(null);
  /** Preserve `settled_at` across edits — don't accidentally re-open. */
  const editingSettledAtRef = useRef<string | null>(null);
  /** Guards the hydration effect so it only runs once per mount. */
  const hydratedRef = useRef<string | null>(null);

  // Master data
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);

  // Form
  const [employeeId, setEmployeeId] = useState<string | null>(
    preselectEmployeeId
  );
  const [amountInput, setAmountInput] = useState<string>("");
  const [amountError, setAmountError] = useState<string>("");
  const [advanceDate, setAdvanceDate] = useState<string>(
    toLocalISODate(new Date())
  );
  const [remarks, setRemarks] = useState<string>("");

  const [saving, setSaving] = useState(false);
  const { showSnackbar } = useSnackbar();
  const [iosPickerOpen, setIosPickerOpen] = useState(false);

  // Reload employees on every focus.
  useFocusEffect(
    useCallback(() => {
      setEmployees(
        employeeRepo.listAll(DEV_SALON_ID).filter((e) => e.is_active === 1)
      );
    }, [])
  );

  // Hydrate from existing advance in edit mode. Runs once, after employees
  // load so the chip row highlights correctly.
  useEffect(() => {
    if (!editingId) return;
    if (hydratedRef.current === editingId) return;
    if (employees.length === 0) return;

    const existing = advanceRepo.getById(DEV_SALON_ID, editingId);
    if (!existing) return;

    editingCreatedAtRef.current = existing.created_at;
    editingSettledAtRef.current = existing.settled_at;
    setEmployeeId(existing.employee_id);
    setAmountInput((existing.amount / 100).toString());
    setAdvanceDate(existing.advance_date);
    setRemarks(existing.remarks ?? "");
    hydratedRef.current = editingId;
  }, [editingId, employees.length]);

  // ── Derived ────────────────────────────────────────────────────────────────

  const amountPaise = useMemo(
    () => parseRupeesToPaise(amountInput),
    [amountInput]
  );
  const amountValid = Number.isFinite(amountPaise) && amountPaise > 0;
  const canSave = amountValid && !!employeeId && !saving;

  // ── Handlers ───────────────────────────────────────────────────────────────

  function openDatePicker() {
    const current = new Date(advanceDate + "T00:00:00");
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value: current,
        mode: "date",
        maximumDate: new Date(),
        onChange: (event: DateTimePickerEvent, selected?: Date) => {
          if (event.type === "set" && selected) {
            setAdvanceDate(toLocalISODate(selected));
          }
        }
      });
    } else {
      setIosPickerOpen((v) => !v);
    }
  }

  function handleSave() {
    if (!canSave || !employeeId) return;
    if (!amountValid) {
      setAmountError(t("advances.amountRequired"));
      return;
    }
    const employee = employees.find((e) => e.id === employeeId);
    if (!employee) {
      Alert.alert(t("advances.employeeRequired"));
      return;
    }

    setSaving(true);
    try {
      const now = getUtcTimestamp();
      const id = editingId ?? newId();
      const createdAt = editingCreatedAtRef.current ?? now;

      const draft = {
        id,
        salon_id: DEV_SALON_ID,
        employee_id: employee.id,
        employee_name_snapshot: employee.name,
        amount: amountPaise,
        advance_date: advanceDate,
        remarks: remarks.trim() ? remarks.trim() : null,
        // Preserve any prior settle-up when editing.
        settled_at: editingSettledAtRef.current,
        created_at: createdAt,
        updated_at: now,
        deleted_at: null
      };

      if (isEditing) {
        advanceRepo.update(draft);
      } else {
        advanceRepo.insert(draft);
      }

      const label = isEditing
        ? t("advances.updateAdvance")
        : t("advances.saveAdvance");
      showSnackbar(`${label} • ${formatMoney(amountPaise)}`);
      navigation.goBack();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      Alert.alert(t("advances.saveFailed"), message);
    } finally {
      setSaving(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <View style={styles.root}>
      <AppBar
        title={isEditing ? t("advances.editAdvance") : t("advances.newAdvance")}
        leading={
          <Pressable
            onPress={() => navigation.goBack()}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t("common.cancel")}
          >
            <Ionicons name="close" size={24} color={colors.text.primary} />
          </Pressable>
        }
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={56}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Employee ───────────────────────────────────────────── */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{t("advances.employee")}</Text>
            {employees.length === 0 ? (
              <Text style={styles.emptyHint}>
                {t("advances.noEmployees")}
              </Text>
            ) : (
              <View style={styles.chipGrid}>
                {employees.map((emp) => {
                  const selected = employeeId === emp.id;
                  return (
                    <Pressable
                      key={emp.id}
                      style={[
                        styles.empChip,
                        selected && styles.empChipSelected
                      ]}
                      onPress={() => setEmployeeId(emp.id)}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                    >
                      <Text
                        style={[
                          styles.empChipText,
                          selected && styles.empChipTextSelected
                        ]}
                        numberOfLines={1}
                      >
                        {emp.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>

          {/* ── Amount ─────────────────────────────────────────────── */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{t("advances.amount")}</Text>
            <View
              style={[
                styles.amountRow,
                amountError ? styles.amountRowError : undefined
              ]}
            >
              <Text style={styles.amountPrefix}>₹</Text>
              <TextInput
                style={styles.amountInput}
                value={amountInput}
                onChangeText={(v) => {
                  setAmountInput(v);
                  setAmountError("");
                }}
                keyboardType="decimal-pad"
                placeholder={t("advances.amountPlaceholder")}
                placeholderTextColor={colors.text.muted}
                maxLength={10}
                autoFocus={!isEditing}
                testID="advance-amount-input"
              />
            </View>
            {amountError ? (
              <Text style={styles.fieldError}>{amountError}</Text>
            ) : null}
          </View>

          {/* ── Date ───────────────────────────────────────────────── */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{t("advances.date")}</Text>
            <Pressable
              onPress={openDatePicker}
              style={styles.dateField}
              accessibilityRole="button"
              accessibilityLabel={t("advances.date")}
            >
              <Ionicons
                name="calendar-outline"
                size={16}
                color={colors.brand.primary}
              />
              <Text style={styles.dateFieldText}>
                {formatDateLabel(advanceDate)}
              </Text>
            </Pressable>

            {Platform.OS === "ios" && iosPickerOpen && (
              <View style={styles.iosPickerWrap}>
                <DateTimePicker
                  value={new Date(advanceDate + "T00:00:00")}
                  mode="date"
                  display="spinner"
                  maximumDate={new Date()}
                  onChange={(_e, selected) => {
                    if (selected) setAdvanceDate(toLocalISODate(selected));
                  }}
                />
                <Pressable
                  onPress={() => setIosPickerOpen(false)}
                  style={styles.iosDone}
                >
                  <Text style={styles.iosDoneText}>{t("common.done")}</Text>
                </Pressable>
              </View>
            )}
          </View>

          {/* ── Remarks ────────────────────────────────────────────── */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{t("advances.remarks")}</Text>
            <TextInput
              style={styles.remarksInput}
              value={remarks}
              onChangeText={setRemarks}
              placeholder={t("advances.remarksPlaceholder")}
              placeholderTextColor={colors.text.muted}
              multiline
              maxLength={200}
            />
          </View>

          <View style={styles.footerSpacer} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Sticky footer */}
      <View
        style={[
          styles.footer,
          { paddingBottom: Math.max(spacing[4], insets.bottom) }
        ]}
      >
        <View style={styles.footerMeta}>
          <Text style={styles.footerLabel}>{t("advances.amount")}</Text>
          <Text style={styles.footerAmount}>
            {formatMoney(amountValid ? amountPaise : 0)}
          </Text>
        </View>
        <Button
          variant="primary"
          onPress={handleSave}
          style={[
            styles.saveBtn,
            (!canSave || saving) && styles.saveBtnDisabled
          ]}
          accessibilityLabel={
            isEditing ? t("advances.updateAdvance") : t("advances.saveAdvance")
          }
        >
          {saving
            ? t("common.loading")
            : isEditing
              ? t("advances.updateAdvance")
              : t("advances.saveAdvance")}
        </Button>
      </View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    backgroundColor: colors.surface.default,
    flex: 1
  },
  flex: { flex: 1 },
  scrollContent: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[3],
    paddingBottom: spacing[6],
    gap: spacing[4]
  },
  section: {
    gap: spacing[2]
  },
  sectionLabel: {
    ...typography.overline,
    color: colors.text.muted
  },
  emptyHint: {
    ...typography.bodySmall,
    color: colors.text.muted
  },
  // Employee chips
  chipGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[2]
  },
  empChip: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radius.full,
    backgroundColor: colors.background.subtle,
    borderWidth: 1,
    borderColor: colors.border.subtle
  },
  empChipSelected: {
    backgroundColor: colors.interactive.selected,
    borderColor: colors.brand.primary
  },
  empChipText: {
    ...typography.bodySmall,
    color: colors.text.secondary
  },
  empChipTextSelected: {
    color: colors.brand.primary,
    fontWeight: "600"
  },
  // Amount
  amountRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border.subtle,
    borderRadius: radius.md,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
    backgroundColor: colors.surface.default,
    gap: spacing[2]
  },
  amountRowError: {
    borderColor: colors.status.danger
  },
  amountPrefix: {
    ...typography.h3,
    color: colors.text.secondary
  },
  amountInput: {
    ...typography.h3,
    color: colors.text.primary,
    flex: 1,
    padding: 0
  },
  fieldError: {
    ...typography.caption,
    color: colors.status.danger
  },
  // Date
  dateField: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
    borderWidth: 1,
    borderColor: colors.border.subtle,
    borderRadius: radius.md,
    backgroundColor: colors.surface.default
  },
  dateFieldText: {
    ...typography.body,
    color: colors.text.primary
  },
  iosPickerWrap: {
    marginTop: spacing[2],
    borderWidth: 1,
    borderColor: colors.border.subtle,
    borderRadius: radius.md,
    backgroundColor: colors.background.subtle
  },
  iosDone: {
    alignSelf: "flex-end",
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3]
  },
  iosDoneText: {
    ...typography.button,
    color: colors.brand.primary
  },
  // Remarks
  remarksInput: {
    ...typography.body,
    color: colors.text.primary,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    borderRadius: radius.md,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
    backgroundColor: colors.surface.default,
    minHeight: 80,
    textAlignVertical: "top"
  },
  // Footer
  footerSpacer: {
    height: spacing[9]
  },
  footer: {
    alignItems: "center",
    backgroundColor: colors.surface.default,
    borderTopColor: colors.border.subtle,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing[3],
    paddingHorizontal: spacing[4],
    paddingTop: spacing[3]
  },
  footerMeta: {
    flex: 1,
    gap: 2
  },
  footerLabel: {
    ...typography.caption,
    color: colors.text.muted
  },
  footerAmount: {
    ...typography.moneyHero,
    color: colors.text.primary
  },
  saveBtn: {
    minWidth: 140
  },
  saveBtnDisabled: {
    opacity: 0.5
  }
});
