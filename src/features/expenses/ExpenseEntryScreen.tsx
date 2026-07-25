import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
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
import { SafeAreaView } from "react-native-safe-area-context";
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
import { ExpenseRepository } from "@/repositories/expense-repository";
import type { ExpensePaymentMode } from "@/repositories/expense-repository";
import { ExpenseCategoryRepository } from "@/repositories/expense-category-repository";
import type { ExpenseCategoryRecord } from "@/repositories/expense-category-repository";
import type { RootStackParamList } from "@/application/AppNavigator";
import { Events, track } from "@/observability";

type Props = NativeStackScreenProps<RootStackParamList, "ExpenseEntry">;

// ─── Repositories ────────────────────────────────────────────────────────────

const expenseRepo = new ExpenseRepository();
const categoryRepo = new ExpenseCategoryRepository();

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

/** Parse a rupee-decimal string ("120.50") into paise. Returns NaN on bad input. */
function parseRupeesToPaise(input: string): number {
  const trimmed = input.trim();
  if (!trimmed) return NaN;
  const raw = Number(trimmed);
  if (!Number.isFinite(raw) || raw < 0) return NaN;
  return Math.round(raw * 100);
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export function ExpenseEntryScreen({ navigation, route }: Props) {
  const { t } = useTranslation();

  const editingId = route.params?.expenseId ?? null;
  const isEditing = !!editingId;
  /** Preserve original `created_at` across updates so ordering doesn't jump. */
  const editingCreatedAtRef = useRef<string | null>(null);
  /** Preserve `settled_at` across edits — don't accidentally re-open a paid credit. */
  const editingSettledAtRef = useRef<string | null>(null);
  /** Guards the hydration effect so it only runs once per mount. */
  const hydratedRef = useRef<string | null>(null);

  // Master data
  const [categories, setCategories] = useState<ExpenseCategoryRecord[]>([]);

  // Form
  const [amountInput, setAmountInput] = useState<string>("");
  const [amountError, setAmountError] = useState<string>("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [expenseDate, setExpenseDate] = useState<string>(
    toLocalISODate(new Date())
  );
  const [remarks, setRemarks] = useState<string>("");
  const [paymentMode, setPaymentMode] = useState<ExpensePaymentMode>("cash");

  // UI
  const [saving, setSaving] = useState(false);
  const { showSnackbar } = useSnackbar();
  const [iosPickerOpen, setIosPickerOpen] = useState(false);
  const [newCatOpen, setNewCatOpen] = useState(false);
  const [newCatName, setNewCatName] = useState("");

  // Reload categories every time the screen is focused. Seed defaults on
  // first-ever visit so the picker isn't empty.
  useFocusEffect(
    useCallback(() => {
      categoryRepo.ensureDefaults(DEV_SALON_ID);
      setCategories(categoryRepo.listActive(DEV_SALON_ID));
    }, [])
  );

  // Hydrate form from existing expense in edit mode. Runs once, after
  // categories have loaded so the chip row highlights correctly.
  useEffect(() => {
    if (!editingId) return;
    if (hydratedRef.current === editingId) return;
    if (categories.length === 0) return;

    const existing = expenseRepo.getById(DEV_SALON_ID, editingId);
    if (!existing) return;

    editingCreatedAtRef.current = existing.created_at;
    editingSettledAtRef.current = existing.settled_at;
    setAmountInput((existing.amount / 100).toString());
    setCategoryId(existing.category_id);
    setExpenseDate(existing.expense_date);
    setRemarks(existing.remarks ?? "");
    setPaymentMode(existing.payment_mode);
    hydratedRef.current = editingId;
  }, [editingId, categories.length]);

  // ── Derived ────────────────────────────────────────────────────────────────

  const amountPaise = useMemo(() => parseRupeesToPaise(amountInput), [
    amountInput
  ]);
  const amountValid = Number.isFinite(amountPaise) && amountPaise > 0;
  const canSave = amountValid && !!categoryId && !saving;

  // ── Handlers ───────────────────────────────────────────────────────────────

  function openDatePicker() {
    const current = new Date(expenseDate + "T00:00:00");
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value: current,
        mode: "date",
        maximumDate: new Date(),
        onChange: (event: DateTimePickerEvent, selected?: Date) => {
          if (event.type === "set" && selected) {
            setExpenseDate(toLocalISODate(selected));
          }
        }
      });
    } else {
      setIosPickerOpen((v) => !v);
    }
  }

  function handleAddCategory() {
    const trimmed = newCatName.trim();
    if (!trimmed) return;
    const created = categoryRepo.insert(DEV_SALON_ID, trimmed);
    setCategories(categoryRepo.listActive(DEV_SALON_ID));
    setCategoryId(created.id);
    setNewCatName("");
    setNewCatOpen(false);
  }

  function handleSave() {
    if (!canSave || !categoryId) return;
    if (!amountValid) {
      setAmountError(t("expenses.amountRequired"));
      return;
    }

    const category = categories.find((c) => c.id === categoryId);
    if (!category) {
      Alert.alert(t("expenses.categoryRequired"));
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
        category_id: category.id,
        category_name_snapshot: category.name,
        amount: amountPaise,
        remarks: remarks.trim() ? remarks.trim() : null,
        expense_date: expenseDate,
        payment_mode: paymentMode,
        // Keep the existing settled_at when editing so we don't reopen a paid
        // credit. Switching mode away from credit clears it.
        settled_at:
          paymentMode === "credit" ? editingSettledAtRef.current : null,
        created_at: createdAt,
        updated_at: now,
        deleted_at: null
      };

      if (isEditing) {
        expenseRepo.update(draft);
        track(Events.expense.updated, { payment_mode: paymentMode });
      } else {
        expenseRepo.insert(draft);
        track(Events.expense.created, { payment_mode: paymentMode });
      }

      const label = isEditing
        ? t("expenses.updateExpense")
        : t("expenses.saveExpense");
      showSnackbar(`${label} • ${formatMoney(amountPaise)}`);
      navigation.goBack();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      Alert.alert(t("expenses.saveFailed"), message);
    } finally {
      setSaving(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <View style={styles.root}>
      <AppBar
        title={isEditing ? t("expenses.editExpense") : t("expenses.newExpense")}
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
          {/* ── Amount ─────────────────────────────────────────────── */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{t("expenses.amount")}</Text>
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
                placeholder={t("expenses.amountPlaceholder")}
                placeholderTextColor={colors.text.muted}
                maxLength={10}
                autoFocus={!isEditing}
                testID="expense-amount-input"
              />
            </View>
            {amountError ? (
              <Text style={styles.fieldError}>{amountError}</Text>
            ) : null}
          </View>

          {/* ── Date ───────────────────────────────────────────────── */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{t("expenses.date")}</Text>
            <Pressable
              onPress={openDatePicker}
              style={styles.dateField}
              accessibilityRole="button"
              accessibilityLabel={t("expenses.date")}
            >
              <Ionicons
                name="calendar-outline"
                size={16}
                color={colors.brand.primary}
              />
              <Text style={styles.dateFieldText}>
                {formatDateLabel(expenseDate)}
              </Text>
            </Pressable>

            {Platform.OS === "ios" && iosPickerOpen && (
              <View style={styles.iosPickerWrap}>
                <DateTimePicker
                  value={new Date(expenseDate + "T00:00:00")}
                  mode="date"
                  display="spinner"
                  maximumDate={new Date()}
                  onChange={(_e, selected) => {
                    if (selected) setExpenseDate(toLocalISODate(selected));
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

          {/* ── Category ───────────────────────────────────────────── */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{t("expenses.category")}</Text>
            {categories.length === 0 ? (
              <Text style={styles.emptyHint}>{t("expenses.noCategories")}</Text>
            ) : (
              <View style={styles.catGrid}>
                {categories.map((cat) => {
                  const selected = categoryId === cat.id;
                  return (
                    <Pressable
                      key={cat.id}
                      style={[
                        styles.catChip,
                        selected && styles.catChipSelected
                      ]}
                      onPress={() => setCategoryId(cat.id)}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                    >
                      <Text
                        style={[
                          styles.catChipText,
                          selected && styles.catChipTextSelected
                        ]}
                        numberOfLines={1}
                      >
                        {cat.name}
                      </Text>
                    </Pressable>
                  );
                })}
                <Pressable
                  style={styles.catChipAdd}
                  onPress={() => setNewCatOpen(true)}
                  accessibilityRole="button"
                  accessibilityLabel={t("expenses.newCategory")}
                >
                  <Ionicons
                    name="add"
                    size={14}
                    color={colors.brand.primary}
                  />
                  <Text style={styles.catChipAddText}>
                    {t("expenses.newCategory")}
                  </Text>
                </Pressable>
              </View>
            )}
          </View>

          {/* ── Remarks ────────────────────────────────────────────── */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{t("expenses.remarks")}</Text>
            <TextInput
              style={styles.remarksInput}
              value={remarks}
              onChangeText={setRemarks}
              placeholder={t("expenses.remarksPlaceholder")}
              placeholderTextColor={colors.text.muted}
              multiline
              maxLength={200}
            />
          </View>

          {/* ── Payment mode ──────────────────────────────────────── */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{t("expenses.paymentMode")}</Text>
            <View style={styles.payGrid}>
              {(
                [
                  { key: "cash", icon: "cash-outline" as const },
                  { key: "upi", icon: "phone-portrait-outline" as const },
                  { key: "credit", icon: "time-outline" as const }
                ] satisfies { key: ExpensePaymentMode; icon: string }[]
              ).map(({ key, icon }) => {
                const selected = paymentMode === key;
                return (
                  <Pressable
                    key={key}
                    style={[
                      styles.payChip,
                      selected && styles.payChipSelected
                    ]}
                    onPress={() => setPaymentMode(key)}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                  >
                    <Ionicons
                      name={icon}
                      size={18}
                      color={
                        selected
                          ? colors.brand.primary
                          : colors.text.secondary
                      }
                    />
                    <Text
                      style={[
                        styles.payChipText,
                        selected && styles.payChipTextSelected
                      ]}
                    >
                      {t(`expenses.modes.${key}`)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {paymentMode === "credit" ? (
              <Text style={styles.creditHint}>{t("expenses.creditHint")}</Text>
            ) : null}
          </View>

          <View style={styles.footerSpacer} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Sticky footer ─────────────────────────────────────────── */}
      <SafeAreaView
        edges={["bottom"]}
        style={[styles.footer, styles.footerSafeArea]}
      >
        <View style={styles.footerInner}>
          <View style={styles.footerMeta}>
            <Text style={styles.footerLabel}>{t("expenses.amount")}</Text>
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
              isEditing ? t("expenses.updateExpense") : t("expenses.saveExpense")
            }
          >
            {saving
              ? t("common.loading")
              : isEditing
                ? t("expenses.updateExpense")
                : t("expenses.saveExpense")}
          </Button>
        </View>
      </SafeAreaView>

      {/* ── New category modal ────────────────────────────────────── */}
      <Modal
        visible={newCatOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setNewCatOpen(false)}
      >
        <Pressable
          style={styles.pickerScrim}
          onPress={() => setNewCatOpen(false)}
        >
          <Pressable style={styles.pickerCard} onPress={() => {}}>
            <Text style={styles.pickerTitle}>
              {t("expenses.newCategoryPrompt")}
            </Text>
            <TextInput
              style={styles.pickerInput}
              value={newCatName}
              onChangeText={setNewCatName}
              placeholder={t("expenses.categoryNamePlaceholder")}
              placeholderTextColor={colors.text.muted}
              autoFocus
              maxLength={40}
              returnKeyType="done"
              onSubmitEditing={handleAddCategory}
            />
            <View style={styles.pickerButtons}>
              <View style={styles.pickerBtn}>
                <Button
                  variant="secondary"
                  fullWidth
                  style={styles.pickerActionBtn}
                  onPress={() => {
                    setNewCatOpen(false);
                    setNewCatName("");
                  }}
                >
                  {t("common.cancel")}
                </Button>
              </View>
              <View style={styles.pickerBtn}>
                <Button
                  variant="primary"
                  fullWidth
                  onPress={handleAddCategory}
                  style={[
                    styles.pickerActionBtn,
                    !newCatName.trim() && styles.saveBtnDisabled
                  ]}
                >
                  {t("common.done")}
                </Button>
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
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
  // Amount input
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
  // Category chip grid
  catGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[2]
  },
  catChip: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radius.full,
    backgroundColor: colors.background.subtle,
    borderWidth: 1,
    borderColor: colors.border.subtle
  },
  catChipSelected: {
    backgroundColor: colors.interactive.selected,
    borderColor: colors.brand.primary
  },
  catChipText: {
    ...typography.bodySmall,
    color: colors.text.secondary
  },
  catChipTextSelected: {
    color: colors.brand.primary,
    fontWeight: "600"
  },
  catChipAdd: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[1],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radius.full,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.brand.primary
  },
  catChipAddText: {
    ...typography.bodySmall,
    color: colors.brand.primary,
    fontWeight: "600"
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
  // Payment mode
  payGrid: {
    flexDirection: "row",
    gap: spacing[2]
  },
  payChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing[1],
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[3],
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    backgroundColor: colors.background.subtle
  },
  payChipSelected: {
    backgroundColor: colors.interactive.selected,
    borderColor: colors.brand.primary
  },
  payChipText: {
    ...typography.bodySmall,
    color: colors.text.secondary
  },
  payChipTextSelected: {
    color: colors.brand.primary,
    fontWeight: "600"
  },
  creditHint: {
    ...typography.caption,
    color: colors.text.muted,
    marginTop: spacing[1]
  },
  // Footer
  footerSpacer: {
    height: spacing[6]
  },
  footer: {
    backgroundColor: colors.surface.default,
    borderTopWidth: 1,
    borderTopColor: colors.divider
  },
  footerSafeArea: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[3]
  },
  footerInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3]
  },
  footerMeta: {
    flex: 1
  },
  footerLabel: {
    ...typography.caption,
    color: colors.text.muted
  },
  footerAmount: {
    ...typography.h3,
    color: colors.text.primary
  },
  saveBtn: {
    minHeight: 52,
    minWidth: 140
  },
  saveBtnDisabled: {
    opacity: 0.5
  },
  // New-category modal
  pickerScrim: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    padding: spacing[6]
  },
  pickerCard: {
    backgroundColor: colors.surface.default,
    borderRadius: radius.lg,
    padding: spacing[4],
    gap: spacing[3]
  },
  pickerTitle: {
    ...typography.bodyEmphasis,
    color: colors.text.primary
  },
  pickerInput: {
    ...typography.body,
    color: colors.text.primary,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    borderRadius: radius.md,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3]
  },
  pickerButtons: {
    flexDirection: "row",
    gap: spacing[2]
  },
  pickerBtn: {
    flex: 1
  },
  pickerActionBtn: {
    minHeight: 48
  }
});
