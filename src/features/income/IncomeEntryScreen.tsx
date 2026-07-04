import { useCallback, useMemo, useState } from "react";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import DateTimePicker, {
  DateTimePickerAndroid,
  type DateTimePickerEvent
} from "@react-native-community/datetimepicker";

import { AppBar } from "@/components/core/AppBar";
import { Button } from "@/components/core/Button";
import { colors, radius, spacing, typography } from "@/design-system/tokens";
import { DEV_DEVICE_ID, DEV_SALON_ID } from "@/constants/dev";
import { formatMoney } from "@/domain/money";
import { newId } from "@/domain/id";
import { getUtcTimestamp } from "@/domain/dates";
import { calculateCommission } from "@/domain/commission-service";
import { EmployeeRepository } from "@/repositories/employee-repository";
import type { EmployeeRecord } from "@/repositories/employee-repository";
import { ServiceRepository } from "@/repositories/service-repository";
import type { ServiceRecord } from "@/repositories/service-repository";
import { CommissionRepository } from "@/repositories/commission-repository";
import type { CommissionRuleRecord } from "@/repositories/commission-repository";
import { IncomeRepository } from "@/repositories/income-repository";
import type { RootStackParamList } from "@/application/AppNavigator";
import { AddServicesSheet } from "./AddServicesSheet";

type Props = NativeStackScreenProps<RootStackParamList, "IncomeEntry">;

// ─── Types ───────────────────────────────────────────────────────────────────

type CustomerGender = "male" | "female";
type PaymentMode = "cash" | "upi" | "card" | "other";
type DiscountType = "percentage" | "flat";

interface BillItem {
  serviceId: string;
  serviceName: string;
  unitPrice: number; // paise
  quantity: number;
  lineAmount: number; // unitPrice × quantity
  /** Employee assigned to this specific service line. */
  employeeId: string;
  employeeName: string;
  rule: CommissionRuleRecord | null;
  commissionAmount: number; // paise
}

// ─── Repositories ────────────────────────────────────────────────────────────

const employeeRepo = new EmployeeRepository();
const serviceRepo = new ServiceRepository();
const commissionRepo = new CommissionRepository();
const incomeRepo = new IncomeRepository();

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Pick the right price based on customer gender. */
function pickPrice(svc: ServiceRecord, gender: CustomerGender | null): number {
  if (gender === "male") return svc.male_price || svc.female_price;
  if (gender === "female") return svc.female_price || svc.male_price;
  return svc.male_price || svc.female_price;
}

function computeCommission(item: Omit<BillItem, "commissionAmount">): number {
  if (!item.rule) return 0;
  return calculateCommission({
    lineAmount: item.lineAmount,
    quantity: item.quantity,
    rule: { ruleType: item.rule.rule_type, value: item.rule.value }
  });
}

/** Local YYYY-MM-DD (no timezone shift). */
function toLocalISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Human-friendly date label — "Today", "Yesterday", or "5 Jul 2026". */
function formatDateLabel(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round(
    (today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export function IncomeEntryScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  // Master data
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [servicesById, setServicesById] = useState<Map<string, ServiceRecord>>(
    new Map()
  );

  // Form
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [customerGender, setCustomerGender] = useState<CustomerGender | null>(
    null
  );
  const [billDate, setBillDate] = useState<string>(toLocalISODate(new Date()));
  const [billItems, setBillItems] = useState<BillItem[]>([]);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("cash");

  const [discountEnabled, setDiscountEnabled] = useState(false);
  const [discountType, setDiscountType] = useState<DiscountType>("percentage");
  const [discountInput, setDiscountInput] = useState("");
  const [discountError, setDiscountError] = useState("");

  // UI
  const [saving, setSaving] = useState(false);
  const [servicesSheetOpen, setServicesSheetOpen] = useState(false);
  const [iosPickerOpen, setIosPickerOpen] = useState(false);
  /** When set, the per-line employee picker modal is showing for this item. */
  const [pickingEmployeeForItemId, setPickingEmployeeForItemId] = useState<
    string | null
  >(null);

  // Reload master data every time the screen is focused.
  useFocusEffect(
    useCallback(() => {
      setEmployees(
        employeeRepo.listAll(DEV_SALON_ID).filter((e) => e.is_active === 1)
      );
      const all = serviceRepo.listActive(DEV_SALON_ID);
      const map = new Map<string, ServiceRecord>();
      for (const s of all) map.set(s.id, s);
      setServicesById(map);
    }, [])
  );

  // ── Derived ────────────────────────────────────────────────────────────────

  const grossAmount = useMemo(
    () => billItems.reduce((s, i) => s + i.lineAmount, 0),
    [billItems]
  );

  const discountAmount = useMemo(() => {
    if (!discountEnabled) return 0;
    const raw = parseFloat(discountInput) || 0;
    if (raw <= 0) return 0;
    if (discountType === "flat") return Math.round(raw * 100); // ₹ → paise
    return Math.round((grossAmount * raw) / 100); // % of gross
  }, [discountEnabled, discountType, discountInput, grossAmount]);

  const netAmount = Math.max(0, grossAmount - discountAmount);

  const totalCommission = useMemo(
    () => billItems.reduce((s, i) => s + i.commissionAmount, 0),
    [billItems]
  );

  const canSave = !!employeeId && billItems.length > 0;
  const selectedIds = useMemo(
    () => billItems.map((i) => i.serviceId),
    [billItems]
  );

  // ── Employee ───────────────────────────────────────────────────────────────

  /**
   * The top-level employee selector picks the *default* employee for the visit.
   * Any service line already tied to the previous default follows the switch,
   * but lines the user explicitly reassigned via the per-line picker keep
   * their override.
   */
  function handleSelectEmployee(id: string) {
    if (employeeId === id) return;
    const previousDefault = employeeId;
    const newEmployee = employees.find((e) => e.id === id);
    if (!newEmployee) return;
    setEmployeeId(id);
    setBillItems((prev) =>
      prev.map((item) => {
        const wasInherited =
          previousDefault === null || item.employeeId === previousDefault;
        if (!wasInherited) return item;
        const rule = commissionRepo.findActiveRule(id, item.serviceId);
        const nextItem = {
          ...item,
          employeeId: id,
          employeeName: newEmployee.name,
          rule
        };
        return { ...nextItem, commissionAmount: computeCommission(nextItem) };
      })
    );
  }

  /** Reassign a single service line to a specific employee. */
  function changeItemEmployee(serviceId: string, nextEmployeeId: string) {
    const nextEmployee = employees.find((e) => e.id === nextEmployeeId);
    if (!nextEmployee) return;
    setBillItems((prev) =>
      prev.map((item) => {
        if (item.serviceId !== serviceId) return item;
        const rule = commissionRepo.findActiveRule(
          nextEmployeeId,
          item.serviceId
        );
        const nextItem = {
          ...item,
          employeeId: nextEmployeeId,
          employeeName: nextEmployee.name,
          rule
        };
        return { ...nextItem, commissionAmount: computeCommission(nextItem) };
      })
    );
  }

  // ── Gender ─────────────────────────────────────────────────────────────────

  function handleGender(g: CustomerGender) {
    const newGender = customerGender === g ? null : g; // deselectable
    setCustomerGender(newGender);
    // Re-price selected items.
    setBillItems((prev) =>
      prev.map((item) => {
        const svc = servicesById.get(item.serviceId);
        if (!svc) return item;
        const unitPrice = pickPrice(svc, newGender);
        const lineAmount = unitPrice * item.quantity;
        return {
          ...item,
          unitPrice,
          lineAmount,
          commissionAmount: computeCommission({
            ...item,
            unitPrice,
            lineAmount
          })
        };
      })
    );
  }

  // ── Date ───────────────────────────────────────────────────────────────────

  function openDatePicker() {
    const current = new Date(billDate + "T00:00:00");
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value: current,
        mode: "date",
        maximumDate: new Date(),
        onChange: (event: DateTimePickerEvent, selected?: Date) => {
          if (event.type === "set" && selected) {
            setBillDate(toLocalISODate(selected));
          }
        }
      });
    } else {
      setIosPickerOpen((v) => !v);
    }
  }

  // ── Services sheet callback ────────────────────────────────────────────────

  function applyServiceSelection(services: ServiceRecord[]) {
    // Preserve per-item quantity AND per-line employee overrides across
    // reselection.
    const prevById = new Map<string, BillItem>();
    for (const item of billItems) prevById.set(item.serviceId, item);

    const defaultEmployee = employeeId
      ? employees.find((e) => e.id === employeeId)
      : null;

    const next: BillItem[] = services.map((svc) => {
      const prev = prevById.get(svc.id);
      const quantity = prev?.quantity ?? 1;
      const unitPrice = pickPrice(svc, customerGender);
      const lineAmount = unitPrice * quantity;

      // Existing line keeps its employee; new line inherits current default.
      const lineEmployeeId = prev?.employeeId ?? defaultEmployee?.id ?? null;
      const lineEmployeeName =
        prev?.employeeName ?? defaultEmployee?.name ?? "";

      const rule = lineEmployeeId
        ? commissionRepo.findActiveRule(lineEmployeeId, svc.id)
        : null;
      const base = {
        serviceId: svc.id,
        serviceName: svc.name,
        unitPrice,
        quantity,
        lineAmount,
        employeeId: lineEmployeeId ?? "",
        employeeName: lineEmployeeName,
        rule
      };
      return { ...base, commissionAmount: computeCommission(base) };
    });

    setBillItems(next);
    setServicesSheetOpen(false);
  }

  function removeItem(serviceId: string) {
    setBillItems((prev) => prev.filter((i) => i.serviceId !== serviceId));
  }

  function changeQty(serviceId: string, delta: number) {
    setBillItems((prev) =>
      prev.map((item) => {
        if (item.serviceId !== serviceId) return item;
        const quantity = Math.max(1, item.quantity + delta);
        const lineAmount = item.unitPrice * quantity;
        return {
          ...item,
          quantity,
          lineAmount,
          commissionAmount: computeCommission({ ...item, quantity, lineAmount })
        };
      })
    );
  }

  // ── Discount ───────────────────────────────────────────────────────────────

  function toggleDiscount() {
    if (discountEnabled) {
      setDiscountEnabled(false);
      setDiscountInput("");
      setDiscountError("");
    } else {
      setDiscountEnabled(true);
    }
  }

  // ── Save ───────────────────────────────────────────────────────────────────

  function handleSave() {
    if (!canSave || saving) return;

    if (discountEnabled && discountInput.trim()) {
      const raw = parseFloat(discountInput);
      if (isNaN(raw) || raw < 0) {
        setDiscountError(t("income.discountInvalid"));
        return;
      }
      if (discountType === "percentage" && raw > 100) {
        setDiscountError(t("income.discountMax"));
        return;
      }
    }

    setSaving(true);

    try {
      const employee = employees.find((e) => e.id === employeeId)!;
      const txId = newId();
      const now = getUtcTimestamp();
      const discountInputRaw = parseFloat(discountInput) || 0;
      const discountValue = discountEnabled
        ? Math.round(discountInputRaw * 100)
        : 0;

      incomeRepo.saveIncomeTransaction({
        transaction: {
          id: txId,
          salon_id: DEV_SALON_ID,
          employee_id: employeeId!,
          employee_name_snapshot: employee.name,
          transaction_date: billDate,
          payment_mode: paymentMode,
          gross_amount: grossAmount,
          discount_type: discountEnabled ? discountType : null,
          discount_value: discountValue,
          discount_amount: discountAmount,
          net_amount: netAmount,
          commission_amount: totalCommission,
          remarks: null,
          created_at: now,
          updated_at: now,
          deleted_at: null,
          sync_status: "pending",
          device_id: DEV_DEVICE_ID
        },
        items: billItems.map((item) => ({
          id: newId(),
          salon_id: DEV_SALON_ID,
          transaction_id: txId,
          service_id: item.serviceId,
          service_name_snapshot: item.serviceName,
          service_price_snapshot: item.unitPrice,
          quantity: item.quantity,
          line_amount: item.lineAmount,
          commission_rule_type_snapshot: item.rule?.rule_type ?? null,
          commission_rule_value_snapshot: item.rule?.value ?? null,
          commission_amount: item.commissionAmount,
          // Per-line employee assignment (migration 006). Falls back to the
          // visit-level employee for lines that never got an override.
          employee_id: item.employeeId || employeeId!,
          employee_name_snapshot: item.employeeName || employee.name,
          created_at: now,
          updated_at: now,
          deleted_at: null,
          sync_status: "pending",
          device_id: DEV_DEVICE_ID
        }))
      });

      Alert.alert(t("income.saved"), formatMoney(netAmount), [
        { text: t("common.done"), onPress: () => navigation.goBack() }
      ]);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      Alert.alert(t("income.saveFailed"), message);
    } finally {
      setSaving(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const PAYMENT_MODES: { key: PaymentMode; icon: string; label: string }[] = [
    { key: "cash", icon: "cash-outline", label: t("income.modes.cash") },
    { key: "upi", icon: "phone-portrait-outline", label: t("income.modes.upi") },
    { key: "card", icon: "card-outline", label: t("income.modes.card") },
    {
      key: "other",
      icon: "ellipsis-horizontal-circle-outline",
      label: t("income.modes.other")
    }
  ];

  return (
    <View style={styles.root}>
      {/* AppBar */}
      <AppBar
        title={t("income.newBill")}
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
            <Text style={styles.sectionLabel}>{t("income.whoServed")}</Text>
            {employees.length === 0 ? (
              <Text style={styles.emptyHint}>{t("income.noEmployees")}</Text>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipRow}
              >
                {employees.map((emp) => {
                  const isSelected = employeeId === emp.id;
                  return (
                    <Pressable
                      key={emp.id}
                      style={[
                        styles.empChip,
                        isSelected && styles.empChipSelected
                      ]}
                      onPress={() => handleSelectEmployee(emp.id)}
                    >
                      <View
                        style={[
                          styles.empAvatar,
                          isSelected && styles.empAvatarSelected
                        ]}
                      >
                        <Text
                          style={[
                            styles.empAvatarText,
                            isSelected && styles.empAvatarTextSelected
                          ]}
                        >
                          {emp.name.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <Text
                        style={[
                          styles.empChipLabel,
                          isSelected && styles.empChipLabelSelected
                        ]}
                        numberOfLines={1}
                      >
                        {emp.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
          </View>

          {/* ── Customer gender + Date ─────────────────────────────── */}
          <View style={styles.metaRow}>
            {/* Gender */}
            <View style={styles.metaCol}>
              <Text style={styles.sectionLabel}>{t("income.customer")}</Text>
              <View style={styles.genderRow}>
                {(["male", "female"] as CustomerGender[]).map((g) => (
                  <Pressable
                    key={g}
                    style={[
                      styles.genderChip,
                      customerGender === g && styles.genderChipSelected
                    ]}
                    onPress={() => handleGender(g)}
                  >
                    <Text
                      style={[
                        styles.genderChipText,
                        customerGender === g && styles.genderChipTextSelected
                      ]}
                    >
                      {g === "male" ? "♂  M" : "♀  F"}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Date */}
            <View style={styles.metaCol}>
              <Text style={styles.sectionLabel}>{t("income.date")}</Text>
              <Pressable
                onPress={openDatePicker}
                style={styles.dateField}
                accessibilityRole="button"
                accessibilityLabel={t("income.date")}
              >
                <Ionicons
                  name="calendar-outline"
                  size={16}
                  color={colors.brand.primary}
                />
                <Text style={styles.dateFieldText}>
                  {formatDateLabel(billDate)}
                </Text>
              </Pressable>
            </View>
          </View>

          {/* iOS inline spinner */}
          {Platform.OS === "ios" && iosPickerOpen && (
            <View style={styles.iosPickerWrap}>
              <DateTimePicker
                value={new Date(billDate + "T00:00:00")}
                mode="date"
                display="spinner"
                maximumDate={new Date()}
                onChange={(_e, selected) => {
                  if (selected) setBillDate(toLocalISODate(selected));
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

          {/* ── Services ───────────────────────────────────────────── */}
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionLabel}>{t("income.services")}</Text>
              {billItems.length > 0 && (
                <Pressable
                  onPress={() => setServicesSheetOpen(true)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={t("income.editSelection")}
                >
                  <Text style={styles.linkText}>
                    {t("income.editSelection")}
                  </Text>
                </Pressable>
              )}
            </View>

            {billItems.length === 0 ? (
              <Pressable
                style={styles.addServicesBtn}
                onPress={() => setServicesSheetOpen(true)}
              >
                <Ionicons
                  name="add-circle-outline"
                  size={20}
                  color={colors.brand.primary}
                />
                <Text style={styles.addServicesBtnText}>
                  {t("income.addServices")}
                </Text>
              </Pressable>
            ) : (
              <View style={styles.billCard}>
                {billItems.map((item) => (
                  <View key={item.serviceId} style={styles.billRow}>
                    <View style={styles.billText}>
                      <Text style={styles.billName} numberOfLines={1}>
                        {item.serviceName}
                      </Text>
                      <Text style={styles.billUnitPrice}>
                        {formatMoney(item.unitPrice)}{" "}
                        {t("income.each")}
                      </Text>
                      <Pressable
                        onPress={() =>
                          setPickingEmployeeForItemId(item.serviceId)
                        }
                        hitSlop={6}
                        style={styles.billEmployeeChip}
                        accessibilityRole="button"
                        accessibilityLabel={t("income.changeEmployee")}
                      >
                        <Ionicons
                          name="person-outline"
                          size={12}
                          color={colors.brand.primary}
                        />
                        <Text
                          style={styles.billEmployeeChipText}
                          numberOfLines={1}
                        >
                          {item.employeeName ||
                            t("income.selectEmployee")}
                        </Text>
                      </Pressable>
                    </View>
                    <View style={styles.qtyCtrl}>
                      <Pressable
                        style={styles.qtyBtn}
                        onPress={() => changeQty(item.serviceId, -1)}
                        hitSlop={4}
                      >
                        <Text style={styles.qtyBtnText}>−</Text>
                      </Pressable>
                      <Text style={styles.qtyNum}>{item.quantity}</Text>
                      <Pressable
                        style={styles.qtyBtn}
                        onPress={() => changeQty(item.serviceId, 1)}
                        hitSlop={4}
                      >
                        <Text style={styles.qtyBtnText}>+</Text>
                      </Pressable>
                    </View>
                    <Text style={styles.billLineAmt}>
                      {formatMoney(item.lineAmount)}
                    </Text>
                    <Pressable
                      onPress={() => removeItem(item.serviceId)}
                      hitSlop={8}
                      style={styles.removeBtn}
                      accessibilityRole="button"
                      accessibilityLabel={t("common.delete")}
                    >
                      <Ionicons
                        name="close"
                        size={16}
                        color={colors.text.muted}
                      />
                    </Pressable>
                  </View>
                ))}

                <View style={styles.divider} />

                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>
                    {t("income.subtotal")}
                  </Text>
                  <Text style={styles.summaryValue}>
                    {formatMoney(grossAmount)}
                  </Text>
                </View>
                {totalCommission > 0 && (
                  <View style={styles.summaryRow}>
                    <Text style={styles.commissionLabel}>
                      {t("income.commission")}
                    </Text>
                    <Text style={styles.commissionValue}>
                      {formatMoney(totalCommission)}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>

          {/* ── Discount ───────────────────────────────────────────── */}
          <View style={styles.section}>
            <Pressable
              style={styles.discountToggle}
              onPress={toggleDiscount}
            >
              <Text style={styles.sectionLabel}>{t("income.discount")}</Text>
              <Ionicons
                name={
                  discountEnabled
                    ? "remove-circle-outline"
                    : "add-circle-outline"
                }
                size={20}
                color={
                  discountEnabled ? colors.status.danger : colors.brand.primary
                }
              />
            </Pressable>

            {discountEnabled && (
              <View style={styles.discountBody}>
                <View style={styles.chipRow}>
                  {(["percentage", "flat"] as DiscountType[]).map((dt) => (
                    <Pressable
                      key={dt}
                      style={[
                        styles.discChip,
                        discountType === dt && styles.discChipSelected
                      ]}
                      onPress={() => {
                        setDiscountType(dt);
                        setDiscountInput("");
                        setDiscountError("");
                      }}
                    >
                      <Text
                        style={[
                          styles.discChipText,
                          discountType === dt && styles.discChipTextSelected
                        ]}
                      >
                        {dt === "percentage"
                          ? t("income.discountPercent")
                          : t("income.discountFlat")}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <View style={styles.discInputRow}>
                  <Text style={styles.discPrefix}>
                    {discountType === "percentage" ? "%" : "₹"}
                  </Text>
                  <TextInput
                    style={[
                      styles.discInput,
                      discountError ? styles.discInputError : undefined
                    ]}
                    value={discountInput}
                    onChangeText={(v) => {
                      setDiscountInput(v);
                      setDiscountError("");
                    }}
                    keyboardType="decimal-pad"
                    placeholder={
                      discountType === "percentage" ? "e.g. 10" : "e.g. 100"
                    }
                    placeholderTextColor={colors.text.muted}
                    maxLength={6}
                  />
                </View>
                {discountError ? (
                  <Text style={styles.fieldError}>{discountError}</Text>
                ) : null}

                {discountAmount > 0 && (
                  <View style={styles.discSummary}>
                    <Text style={styles.discSummaryLabel}>
                      {t("income.discountApplied")}
                    </Text>
                    <Text style={styles.discSummaryValue}>
                      −{formatMoney(discountAmount)}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>

          {/* ── Payment mode ───────────────────────────────────────── */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{t("income.paymentMode")}</Text>
            <View style={styles.payGrid}>
              {PAYMENT_MODES.map(({ key, icon, label }) => (
                <Pressable
                  key={key}
                  style={[
                    styles.payChip,
                    paymentMode === key && styles.payChipSelected
                  ]}
                  onPress={() => setPaymentMode(key)}
                >
                  <Ionicons
                    name={icon as any}
                    size={18}
                    color={
                      paymentMode === key
                        ? colors.brand.primary
                        : colors.text.secondary
                    }
                  />
                  <Text
                    style={[
                      styles.payChipText,
                      paymentMode === key && styles.payChipTextSelected
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.footerSpacer} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Sticky footer ─────────────────────────────────────────── */}
      <View
        style={[
          styles.footer,
          { paddingBottom: Math.max(spacing[4], insets.bottom) }
        ]}
      >
        <View style={styles.footerMeta}>
          <Text style={styles.footerLabel}>{t("income.total")}</Text>
          <Text style={styles.footerAmount}>{formatMoney(netAmount)}</Text>
          {totalCommission > 0 && (
            <Text style={styles.footerCommission}>
              {t("income.commissionShort", {
                amount: formatMoney(totalCommission)
              })}
            </Text>
          )}
        </View>
        <Button
          variant="primary"
          onPress={handleSave}
          style={[
            styles.saveBtn,
            (!canSave || saving) && styles.saveBtnDisabled
          ]}
          accessibilityLabel={t("income.saveBill")}
        >
          {saving ? t("common.loading") : t("income.saveBill")}
        </Button>
      </View>

      {/* Services picker sheet */}
      <AddServicesSheet
        visible={servicesSheetOpen}
        onClose={() => setServicesSheetOpen(false)}
        onDone={applyServiceSelection}
        initialSelectedIds={selectedIds}
        customerGender={customerGender}
      />

      {/* Per-line employee picker */}
      <Modal
        visible={pickingEmployeeForItemId !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPickingEmployeeForItemId(null)}
      >
        <Pressable
          style={styles.pickerScrim}
          onPress={() => setPickingEmployeeForItemId(null)}
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
                  pickingEmployeeForItemId !== null &&
                  billItems.find(
                    (i) => i.serviceId === pickingEmployeeForItemId
                  )?.employeeId === emp.id;
                return (
                  <Pressable
                    key={emp.id}
                    style={[
                      styles.pickerRow,
                      current && styles.pickerRowActive
                    ]}
                    onPress={() => {
                      if (pickingEmployeeForItemId) {
                        changeItemEmployee(
                          pickingEmployeeForItemId,
                          emp.id
                        );
                      }
                      setPickingEmployeeForItemId(null);
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
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    backgroundColor: colors.surface.default, // white per design system
    flex: 1
  },
  flex: {
    flex: 1
  },
  scrollContent: {
    gap: spacing[5],
    padding: spacing[4]
  },
  section: {
    gap: spacing[2]
  },
  sectionLabel: {
    ...typography.overline,
    color: colors.text.muted
  },
  sectionHeaderRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  linkText: {
    ...typography.bodySmall,
    color: colors.brand.primary,
    fontWeight: "600"
  },
  emptyHint: {
    ...typography.bodySmall,
    color: colors.text.muted
  },
  chipRow: {
    flexDirection: "row",
    gap: spacing[2]
  },
  // Employee chips
  empChip: {
    alignItems: "center",
    backgroundColor: colors.surface.default,
    borderColor: colors.border.subtle,
    borderRadius: radius.xl,
    borderWidth: 1.5,
    flexDirection: "row",
    gap: spacing[1],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1]
  },
  empChipSelected: {
    backgroundColor: colors.interactive.selected,
    borderColor: colors.brand.primary
  },
  empAvatar: {
    alignItems: "center",
    backgroundColor: colors.brand.accentLight,
    borderRadius: radius.full,
    height: 26,
    justifyContent: "center",
    width: 26
  },
  empAvatarSelected: {
    backgroundColor: colors.brand.primary
  },
  empAvatarText: {
    ...typography.caption,
    color: colors.brand.secondary,
    fontWeight: "700"
  },
  empAvatarTextSelected: {
    color: colors.text.inverse
  },
  empChipLabel: {
    ...typography.bodySmall,
    color: colors.text.primary,
    maxWidth: 100
  },
  empChipLabelSelected: {
    color: colors.brand.primary,
    fontWeight: "600"
  },
  // Meta row (gender + date side-by-side)
  metaRow: {
    flexDirection: "row",
    gap: spacing[4]
  },
  metaCol: {
    flex: 1,
    gap: spacing[2]
  },
  genderRow: {
    flexDirection: "row",
    gap: spacing[2]
  },
  genderChip: {
    borderColor: colors.border.subtle,
    borderRadius: radius.full,
    borderWidth: 1,
    minWidth: 52,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1]
  },
  genderChipSelected: {
    backgroundColor: colors.interactive.selected,
    borderColor: colors.brand.primary
  },
  genderChipText: {
    ...typography.bodySmall,
    color: colors.text.secondary,
    textAlign: "center"
  },
  genderChipTextSelected: {
    color: colors.brand.primary,
    fontWeight: "600"
  },
  dateField: {
    alignItems: "center",
    alignSelf: "flex-start",
    borderColor: colors.border.subtle,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing[1],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2]
  },
  dateFieldText: {
    ...typography.bodySmall,
    color: colors.text.primary,
    fontWeight: "500"
  },
  iosPickerWrap: {
    backgroundColor: colors.background.subtle,
    borderRadius: radius.md,
    marginTop: spacing[2],
    padding: spacing[2]
  },
  iosDone: {
    alignSelf: "flex-end",
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2]
  },
  iosDoneText: {
    ...typography.bodyEmphasis,
    color: colors.brand.primary
  },
  // Add-services button
  addServicesBtn: {
    alignItems: "center",
    borderColor: colors.brand.primary,
    borderRadius: radius.md,
    borderStyle: "dashed",
    borderWidth: 1.5,
    flexDirection: "row",
    gap: spacing[2],
    justifyContent: "center",
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4]
  },
  addServicesBtnText: {
    ...typography.bodyEmphasis,
    color: colors.brand.primary
  },
  // Bill card
  billCard: {
    backgroundColor: colors.background.subtle,
    borderRadius: radius.md,
    gap: spacing[3],
    padding: spacing[3]
  },
  billRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[2]
  },
  billText: {
    flex: 1
  },
  billName: {
    ...typography.bodySmall,
    color: colors.text.primary,
    fontWeight: "600"
  },
  billUnitPrice: {
    ...typography.caption,
    color: colors.text.muted
  },
  billEmployeeChip: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: colors.background.subtle,
    borderColor: colors.border.subtle,
    borderRadius: radius.full,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing[1],
    marginTop: spacing[1],
    paddingHorizontal: spacing[2],
    paddingVertical: 2
  },
  billEmployeeChipText: {
    ...typography.caption,
    color: colors.brand.primary,
    fontWeight: "600",
    maxWidth: 120
  },
  qtyCtrl: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[2]
  },
  qtyBtn: {
    alignItems: "center",
    backgroundColor: colors.surface.default,
    borderColor: colors.border.subtle,
    borderRadius: radius.full,
    borderWidth: 1,
    height: 26,
    justifyContent: "center",
    width: 26
  },
  qtyBtnText: {
    ...typography.body,
    color: colors.brand.primary,
    fontWeight: "700",
    lineHeight: 20
  },
  qtyNum: {
    ...typography.bodySmall,
    color: colors.text.primary,
    fontWeight: "600",
    minWidth: 16,
    textAlign: "center"
  },
  billLineAmt: {
    ...typography.bodySmall,
    color: colors.text.primary,
    fontWeight: "700",
    minWidth: 64,
    textAlign: "right"
  },
  removeBtn: {
    alignItems: "center",
    height: 22,
    justifyContent: "center",
    marginLeft: spacing[1],
    width: 22
  },
  divider: {
    backgroundColor: colors.border.subtle,
    height: StyleSheet.hairlineWidth,
    marginVertical: spacing[1]
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between"
  },
  summaryLabel: {
    ...typography.bodySmall,
    color: colors.text.secondary
  },
  summaryValue: {
    ...typography.bodySmall,
    color: colors.text.primary,
    fontWeight: "600"
  },
  commissionLabel: {
    ...typography.caption,
    color: colors.text.muted
  },
  commissionValue: {
    ...typography.caption,
    color: colors.text.muted
  },
  // Discount
  discountToggle: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  discountBody: {
    gap: spacing[3]
  },
  discChip: {
    borderColor: colors.border.subtle,
    borderRadius: radius.full,
    borderWidth: 1,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1]
  },
  discChipSelected: {
    backgroundColor: colors.interactive.selected,
    borderColor: colors.brand.primary
  },
  discChipText: {
    ...typography.bodySmall,
    color: colors.text.secondary
  },
  discChipTextSelected: {
    color: colors.brand.primary,
    fontWeight: "600"
  },
  discInputRow: {
    alignItems: "center",
    borderBottomColor: colors.brand.primary,
    borderBottomWidth: 2,
    flexDirection: "row",
    gap: spacing[1],
    paddingBottom: spacing[1]
  },
  discPrefix: {
    ...typography.h3,
    color: colors.text.secondary,
    width: 20
  },
  discInput: {
    ...typography.h3,
    color: colors.text.primary,
    flex: 1,
    paddingVertical: spacing[1]
  },
  discInputError: {
    color: colors.status.danger
  },
  fieldError: {
    ...typography.caption,
    color: colors.status.danger
  },
  discSummary: {
    alignItems: "center",
    backgroundColor: colors.status.successBg,
    borderRadius: radius.sm,
    flexDirection: "row",
    justifyContent: "space-between",
    padding: spacing[3]
  },
  discSummaryLabel: {
    ...typography.bodySmall,
    color: colors.status.success
  },
  discSummaryValue: {
    ...typography.bodySmall,
    color: colors.status.success,
    fontWeight: "600"
  },
  // Payment mode
  payGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[2]
  },
  payChip: {
    alignItems: "center",
    backgroundColor: colors.surface.default,
    borderColor: colors.border.subtle,
    borderRadius: radius.md,
    borderWidth: 1.5,
    flexDirection: "row",
    gap: spacing[1],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2]
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
    ...typography.h2,
    color: colors.text.primary
  },
  footerCommission: {
    ...typography.caption,
    color: colors.text.muted
  },
  saveBtn: {
    minWidth: 120
  },
  saveBtnDisabled: {
    backgroundColor: colors.interactive.disabled,
    opacity: 0.7
  },
  // Per-line employee picker modal
  pickerScrim: {
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.4)",
    flex: 1,
    justifyContent: "center",
    padding: spacing[6]
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
    maxHeight: 320
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
    backgroundColor: colors.background.subtle
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
