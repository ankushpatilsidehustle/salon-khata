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
import { calculateCommission, resolveEffectiveRule } from "@/domain/commission-service";
import { EmployeeRepository } from "@/repositories/employee-repository";
import type { EmployeeRecord } from "@/repositories/employee-repository";
import { ServiceRepository } from "@/repositories/service-repository";
import type { ServiceRecord } from "@/repositories/service-repository";
import { CommissionRepository } from "@/repositories/commission-repository";
import type { CommissionRuleRecord } from "@/repositories/commission-repository";
import { IncomeRepository } from "@/repositories/income-repository";
import type {
  IncomeItemRecord,
  IncomeTransactionRecord
} from "@/repositories/income-repository";
import { SettingsRepository } from "@/repositories/settings-repository";
import {
  CustomerRepository,
  normalizePhone
} from "@/repositories/customer-repository";
import { SalonRepository } from "@/repositories/salon-repository";
import { ReceiptCard } from "@/components/domain/ReceiptCard";
import type { RootStackParamList } from "@/application/AppNavigator";
import { AddServicesSheet } from "./AddServicesSheet";
import type { ServiceSelection } from "./AddServicesSheet";
import { useShareReceipt } from "./useShareReceipt";

type Props = NativeStackScreenProps<RootStackParamList, "IncomeEntry">;

// ─── Types ───────────────────────────────────────────────────────────────────

type CustomerGender = "male" | "female";
/**
 * Payment modes the picker offers for new bills. Historical bills may still
 * carry legacy values (`card`, `other`) — we accept them in state via
 * `LegacyPaymentMode` and preserve them on save/load, but never let the user
 * pick them again from the chips.
 */
type PaymentMode = "cash" | "upi" | "credit";
type LegacyPaymentMode = PaymentMode | "card" | "other";
type DiscountType = "percentage" | "flat";

interface BillItem {
  serviceId: string;
  serviceName: string;
  unitPrice: number; // paise
  /** Per-unit product ("parts") cost in paise. Captured from service master. */
  unitProductCost: number;
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
const settingsRepo = new SettingsRepository();
const customerRepo = new CustomerRepository();
const salonRepo = new SalonRepository();

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Pick the right price based on customer gender. */
function pickPrice(svc: ServiceRecord, gender: CustomerGender | null): number {
  if (gender === "male") return svc.male_price || svc.female_price;
  if (gender === "female") return svc.female_price || svc.male_price;
  return svc.male_price || svc.female_price;
}

function computeCommission(
  item: Omit<BillItem, "commissionAmount">,
  employee: EmployeeRecord | undefined
): number {
  const effective = resolveEffectiveRule(item.rule, employee ?? null);
  if (!effective) return 0;
  return calculateCommission({
    lineAmount: item.lineAmount,
    quantity: item.quantity,
    rule: { ruleType: effective.rule_type, value: effective.value },
    productCostPerUnit: item.unitProductCost
  });
}

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

// ─── Screen ──────────────────────────────────────────────────────────────────

export function IncomeEntryScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const editingId = route.params?.transactionId ?? null;
  const isEditing = !!editingId;
  /** Preserve original `created_at` across updates so ordering doesn't jump. */
  const editingCreatedAtRef = useRef<string | null>(null);
  /** Guards the hydration effect so it only runs once per mount. */
  const hydratedRef = useRef<string | null>(null);

  // Master data
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [servicesById, setServicesById] = useState<Map<string, ServiceRecord>>(
    new Map()
  );

  // Form
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [customerGender, setCustomerGender] = useState<CustomerGender | null>(
    () => {
      // For a new bill, seed the default from the salon type. Editing an
      // existing bill leaves this untouched (the price snapshots on items
      // already reflect the gender chosen at save time).
      if (editingId) return null;
      const t = settingsRepo.getSalonType(DEV_SALON_ID);
      if (t === "male") return "male";
      if (t === "female") return "female";
      return "male"; // unisex → default to male
    }
  );
  const [billDate, setBillDate] = useState<string>(toLocalISODate(new Date()));
  const [billItems, setBillItems] = useState<BillItem[]>([]);
  const [paymentMode, setPaymentMode] = useState<LegacyPaymentMode>("cash");

  const [discountEnabled, setDiscountEnabled] = useState(false);
  const [discountType, setDiscountType] = useState<DiscountType>("percentage");
  const [discountInput, setDiscountInput] = useState("");
  const [discountError, setDiscountError] = useState("");

  // Customer identity — always-visible inline fields (no collapse toggle).
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerName, setCustomerName] = useState("");
  /** Set when the typed phone matches an existing customer. */
  const [matchedCustomerId, setMatchedCustomerId] = useState<string | null>(
    null
  );
  /** Typeahead suggestions surfaced under the customer fields. */
  const [customerSuggestions, setCustomerSuggestions] = useState<
    { id: string; name: string; phone: string }[]
  >([]);
  /** True while either customer field is focused — gates the dropdown. */
  const [customerPickerActive, setCustomerPickerActive] = useState(false);
  /** Which field the user is currently typing in — used to bias the search. */
  const [customerActiveField, setCustomerActiveField] = useState<
    "phone" | "name" | null
  >(null);
  /**
   * Error surfaced under the customer section when credit is selected but a
   * valid phone + name aren't supplied. Cleared as soon as the user starts
   * filling either field.
   */
  const [customerError, setCustomerError] = useState("");

  // Post-save bill preview — shown when customer phone was provided.
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewData, setPreviewData] = useState<{
    transaction: IncomeTransactionRecord;
    items: IncomeItemRecord[];
  } | null>(null);

  // UI
  const [saving, setSaving] = useState(false);
  const { showSnackbar } = useSnackbar();
  const [servicesSheetOpen, setServicesSheetOpen] = useState(false);
  const [iosPickerOpen, setIosPickerOpen] = useState(false);
  /** When set, the per-line employee picker modal is showing for this item. */
  const [pickingEmployeeForItemId, setPickingEmployeeForItemId] = useState<
    string | null
  >(null);
  /** Share hook — provides ref for the receipt view + captureRef/share action. */
  const { receiptRef, shareReceipt, sharing } = useShareReceipt();

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

  // Hydrate the form from an existing transaction when in edit mode. Runs
  // exactly once, after both masters (employees + services) are loaded so
  // per-line lookups and commission-rule resolution succeed.
  useEffect(() => {
    if (!editingId) return;
    if (hydratedRef.current === editingId) return;
    if (employees.length === 0 || servicesById.size === 0) return;

    const loaded = incomeRepo.getById(DEV_SALON_ID, editingId);
    if (!loaded) return;
    const { transaction: tx, items } = loaded;

    editingCreatedAtRef.current = tx.created_at;
    setEmployeeId(tx.employee_id || null);
    setBillDate(tx.transaction_date);
    setPaymentMode(tx.payment_mode as LegacyPaymentMode);
    if (tx.discount_type) {
      setDiscountEnabled(true);
      setDiscountType(tx.discount_type as DiscountType);
      // discount_value is stored as raw * 100 (e.g. 10% → 1000, ₹50 → 5000).
      setDiscountInput(String(tx.discount_value / 100));
    }

    // Hydrate the customer section if the bill was linked at save time.
    if (tx.customer_phone_snapshot || tx.customer_name_snapshot) {
      setCustomerPhone(tx.customer_phone_snapshot ?? "");
      setCustomerName(tx.customer_name_snapshot ?? "");
      setMatchedCustomerId(tx.customer_id ?? null);
    }

    const hydrated: BillItem[] = items.map((item) => {
      const lineEmployeeId = item.employee_id ?? tx.employee_id;
      const rule = lineEmployeeId
        ? commissionRepo.findActiveRule(lineEmployeeId, item.service_id)
        : null;
      return {
        serviceId: item.service_id,
        serviceName: item.service_name_snapshot,
        unitPrice: item.service_price_snapshot,
        unitProductCost: item.product_cost_snapshot ?? 0,
        quantity: item.quantity,
        lineAmount: item.line_amount,
        employeeId: lineEmployeeId,
        employeeName:
          item.employee_name_snapshot ?? tx.employee_name_snapshot ?? "",
        rule,
        commissionAmount: item.commission_amount
      };
    });
    setBillItems(hydrated);
    hydratedRef.current = editingId;
  }, [editingId, employees.length, servicesById.size]);

  // Debounced phone-first customer lookup. As the owner types, once we have
  // 10 valid digits we look up the master row and auto-fill the name.
  useEffect(() => {
    const normalized = normalizePhone(customerPhone);
    if (!normalized) {
      setMatchedCustomerId(null);
      return;
    }
    const handle = setTimeout(() => {
      const match = customerRepo.findByPhone(DEV_SALON_ID, normalized);
      if (match) {
        setMatchedCustomerId(match.id);
        // Only auto-fill the name if the field is still blank so we don't
        // stomp on a name the user has already begun editing.
        setCustomerName((prev) => (prev.trim() ? prev : match.name));
      } else {
        setMatchedCustomerId(null);
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [customerPhone]);

  // Debounced typeahead search — feeds the suggestion dropdown under the
  // customer fields. We bias the query by whichever field the user is
  // actively typing in so digits search phone, letters search name.
  useEffect(() => {
    if (!customerPickerActive) {
      setCustomerSuggestions([]);
      return;
    }
    const query =
      customerActiveField === "name"
        ? customerName
        : customerActiveField === "phone"
          ? customerPhone
          : customerPhone || customerName;
    if (!query.trim()) {
      setCustomerSuggestions([]);
      return;
    }
    // Hide suggestions when the phone field already resolved to an exact
    // match — the badge below the fields already confirms selection.
    if (matchedCustomerId && normalizePhone(customerPhone).length === 10) {
      setCustomerSuggestions([]);
      return;
    }
    const handle = setTimeout(() => {
      const results = customerRepo.searchByQuery(DEV_SALON_ID, query, 5);
      setCustomerSuggestions(
        results.map((r) => ({ id: r.id, name: r.name, phone: r.phone }))
      );
    }, 150);
    return () => clearTimeout(handle);
  }, [
    customerPickerActive,
    customerActiveField,
    customerName,
    customerPhone,
    matchedCustomerId
  ]);

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

  const canSave =
    billItems.length > 0 && billItems.every((i) => !!i.employeeId);
  const selectedIds = useMemo(
    () => billItems.map((i) => i.serviceId),
    [billItems]
  );
  const initialEmployeeByServiceId = useMemo(() => {
    const map: Record<string, string> = {};
    for (const item of billItems) {
      if (item.employeeId) map[item.serviceId] = item.employeeId;
    }
    return map;
  }, [billItems]);
  /**
   * True when every other field is at its default — so the sheet's "Done"
   * button can be relabeled to "Save Bill" for the fast single-tap commit.
   */
  const isFormAtDefaults =
    !discountEnabled &&
    paymentMode === "cash" &&
    billDate === toLocalISODate(new Date());

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
        return {
          ...nextItem,
          commissionAmount: computeCommission(nextItem, newEmployee)
        };
      })
    );
    // Fast-path: on first employee pick, jump straight into service selection.
    // Skipped in edit mode — items are already populated from the loaded bill.
    if (!isEditing && billItems.length === 0) {
      setServicesSheetOpen(true);
    }
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
        return {
          ...nextItem,
          commissionAmount: computeCommission(nextItem, nextEmployee)
        };
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
        const emp = employees.find((e) => e.id === item.employeeId);
        return {
          ...item,
          unitPrice,
          lineAmount,
          commissionAmount: computeCommission(
            { ...item, unitPrice, lineAmount },
            emp
          )
        };
      })
    );
  }

  // ── Customer ───────────────────────────────────────────────────────────────

  /** Fill both customer fields from a suggestion tap and close the dropdown. */
  function handleSelectCustomer(row: {
    id: string;
    name: string;
    phone: string;
  }) {
    setCustomerPhone(row.phone);
    setCustomerName(row.name);
    setMatchedCustomerId(row.id);
    setCustomerSuggestions([]);
    setCustomerPickerActive(false);
    setCustomerActiveField(null);
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

  /** Pure builder — turns the sheet's selection payload into BillItems. */
  function buildBillItems(selections: ServiceSelection[]): BillItem[] {
    const prevById = new Map<string, BillItem>();
    for (const item of billItems) prevById.set(item.serviceId, item);

    const defaultEmployee = employeeId
      ? employees.find((e) => e.id === employeeId)
      : null;

    return selections.map(({ service: svc, employeeId: assignedId }) => {
      const prev = prevById.get(svc.id);
      const quantity = prev?.quantity ?? 1;
      const unitPrice = pickPrice(svc, customerGender);
      const unitProductCost = svc.product_cost ?? 0;
      const lineAmount = unitPrice * quantity;

      const resolvedId =
        assignedId ?? prev?.employeeId ?? defaultEmployee?.id ?? "";
      const resolvedEmployee = resolvedId
        ? employees.find((e) => e.id === resolvedId)
        : undefined;
      const resolvedName = resolvedEmployee?.name ?? "";

      const rule = resolvedId
        ? commissionRepo.findActiveRule(resolvedId, svc.id)
        : null;
      const base = {
        serviceId: svc.id,
        serviceName: svc.name,
        unitPrice,
        unitProductCost,
        quantity,
        lineAmount,
        employeeId: resolvedId,
        employeeName: resolvedName,
        rule
      };
      return {
        ...base,
        commissionAmount: computeCommission(base, resolvedEmployee)
      };
    });
  }

  function applyServiceSelection(selections: ServiceSelection[]) {
    setBillItems(buildBillItems(selections));
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
        const emp = employees.find((e) => e.id === item.employeeId);
        return {
          ...item,
          quantity,
          lineAmount,
          commissionAmount: computeCommission(
            { ...item, quantity, lineAmount },
            emp
          )
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

  /**
   * Credit bills owe the salon money — always tag them to a specific customer
   * so the owner can chase collection later. Returns true when validation
   * passes; otherwise shows an alert + inline error and returns false.
   */
  function validateCreditCustomer(): boolean {
    if (paymentMode !== "credit") return true;
    const normalized = normalizePhone(customerPhone);
    const trimmedName = customerName.trim();
    if (normalized.length === 10 && trimmedName.length > 0) return true;
    setCustomerError(t("income.creditRequiresCustomerBody"));
    Alert.alert(
      t("income.creditRequiresCustomerTitle"),
      t("income.creditRequiresCustomerBody")
    );
    return false;
  }

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

    if (!validateCreditCustomer()) return;

    saveBill(billItems);
  }

  /**
   * Fast-path used by the services sheet when the rest of the form is at
   * defaults (cash, today, no discount). Skips the return trip to the parent
   * screen — selections → bill → save in one gesture.
   */
  function handleSaveFromSelections(selections: ServiceSelection[]) {
    if (saving) return;
    const items = buildBillItems(selections);
    if (items.length === 0 || items.some((i) => !i.employeeId)) return;
    setBillItems(items);
    setServicesSheetOpen(false);
    saveBill(items);
  }

  function saveBill(items: BillItem[]) {
    setSaving(true);

    try {
      // Recompute totals from the exact `items` we're saving — avoids stale
      // state when saving directly from the sheet.
      const gross = items.reduce((s, i) => s + i.lineAmount, 0);
      const discountRaw = parseFloat(discountInput) || 0;
      const discount = discountEnabled
        ? discountType === "flat"
          ? Math.round(discountRaw * 100)
          : Math.round((gross * discountRaw) / 100)
        : 0;
      const net = Math.max(0, gross - discount);
      const commission = items.reduce((s, i) => s + i.commissionAmount, 0);

      // Transaction-level employee: prefer the top-level shortcut selection;
      // otherwise fall back to the first line's employee.
      const primaryEmployeeId = employeeId || items[0].employeeId;
      const primaryEmployee = employees.find((e) => e.id === primaryEmployeeId)!;
      const now = getUtcTimestamp();
      const txId = editingId ?? newId();
      const createdAt = editingCreatedAtRef.current ?? now;
      const discountValue = discountEnabled
        ? Math.round(discountRaw * 100)
        : 0;

      // Resolve customer link — upsert only when we have both a valid phone
      // and a non-blank name. Otherwise the bill stays customer-less.
      const normalizedCustomerPhone = normalizePhone(customerPhone);
      const trimmedCustomerName = customerName.trim();
      let resolvedCustomerId: string | null = null;
      let customerNameSnapshot: string | null = null;
      let customerPhoneSnapshot: string | null = null;
      if (normalizedCustomerPhone && trimmedCustomerName) {
        resolvedCustomerId = customerRepo.upsert({
          salonId: DEV_SALON_ID,
          name: trimmedCustomerName,
          phone: normalizedCustomerPhone
        });
        customerNameSnapshot = trimmedCustomerName;
        customerPhoneSnapshot = normalizedCustomerPhone;
      }

      const draft = {
        transaction: {
          id: txId,
          salon_id: DEV_SALON_ID,
          employee_id: primaryEmployeeId,
          employee_name_snapshot: primaryEmployee.name,
          transaction_date: billDate,
          payment_mode: paymentMode,
          gross_amount: gross,
          discount_type: discountEnabled ? discountType : null,
          discount_value: discountValue,
          discount_amount: discount,
          net_amount: net,
          commission_amount: commission,
          remarks: null,
          customer_id: resolvedCustomerId,
          customer_name_snapshot: customerNameSnapshot,
          customer_phone_snapshot: customerPhoneSnapshot,
          created_at: createdAt,
          updated_at: now,
          deleted_at: null
        },
        items: items.map((item) => {
          const lineEmployee = employees.find((e) => e.id === item.employeeId);
          const effective = resolveEffectiveRule(item.rule, lineEmployee ?? null);
          return {
            id: newId(),
            salon_id: DEV_SALON_ID,
            transaction_id: txId,
            service_id: item.serviceId,
            service_name_snapshot: item.serviceName,
            service_price_snapshot: item.unitPrice,
            quantity: item.quantity,
            line_amount: item.lineAmount,
            commission_rule_type_snapshot: effective?.rule_type ?? null,
            commission_rule_value_snapshot: effective?.value ?? null,
            commission_amount: item.commissionAmount,
            employee_id: item.employeeId,
            employee_name_snapshot: item.employeeName,
            product_cost_snapshot: item.unitProductCost,
            created_at: now,
            updated_at: now,
            deleted_at: null
          };
        })
      };

      if (isEditing) {
        incomeRepo.updateIncomeTransaction(draft);
      } else {
        incomeRepo.saveIncomeTransaction(draft);
      }

      const label = isEditing ? t("income.updateBill") : t("income.saveBill");
      showSnackbar(`${label} • ${formatMoney(net)}`);

      // When customer phone is present, show the receipt preview modal so the
      // owner can review and send to WhatsApp in one tap.
      if (customerPhoneSnapshot) {
        const saved = incomeRepo.getById(DEV_SALON_ID, txId);
        if (saved) {
          setPreviewData(saved);
          setPreviewVisible(true);
          return; // navigation happens when the preview is dismissed
        }
      }
      navigation.goBack();
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
    {
      key: "credit",
      icon: "time-outline",
      label: t("income.modes.credit")
    }
  ];

  return (
    <View style={styles.root}>
      {/* AppBar */}
      <AppBar
        title={isEditing ? t("income.editBill") : t("income.newBill")}
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
          {/* ── Customer mobile + name (optional, always visible) ─── */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>
              {t("income.customerSection")}
            </Text>
            <View style={styles.customerFieldRow}>
              <View style={styles.customerFieldCol}>
                <TextInput
                  style={styles.customerInput}
                  value={customerPhone}
                  onChangeText={(v) => {
                    setCustomerPhone(v);
                    if (matchedCustomerId) setMatchedCustomerId(null);
                    if (customerError) setCustomerError("");
                    setCustomerActiveField("phone");
                    setCustomerPickerActive(true);
                  }}
                  onFocus={() => {
                    setCustomerActiveField("phone");
                    setCustomerPickerActive(true);
                  }}
                  onBlur={() => {
                    // Small delay so a tap on a suggestion registers before
                    // we hide the dropdown.
                    setTimeout(() => setCustomerPickerActive(false), 150);
                  }}
                  keyboardType="phone-pad"
                  placeholder={t("income.customerPhonePlaceholder")}
                  placeholderTextColor={colors.text.muted}
                  maxLength={16}
                />
              </View>
              <View style={styles.customerFieldCol}>
                <TextInput
                  style={styles.customerInput}
                  value={customerName}
                  onChangeText={(v) => {
                    setCustomerName(v);
                    if (matchedCustomerId) setMatchedCustomerId(null);
                    if (customerError) setCustomerError("");
                    setCustomerActiveField("name");
                    setCustomerPickerActive(true);
                  }}
                  onFocus={() => {
                    setCustomerActiveField("name");
                    setCustomerPickerActive(true);
                  }}
                  onBlur={() => {
                    setTimeout(() => setCustomerPickerActive(false), 150);
                  }}
                  autoCapitalize="words"
                  placeholder={t("income.customerNamePlaceholder")}
                  placeholderTextColor={colors.text.muted}
                  maxLength={60}
                />
              </View>
            </View>

            {/* Typeahead suggestions — tap fills both fields. */}
            {customerPickerActive && customerSuggestions.length > 0 ? (
              <View style={styles.customerSuggestList}>
                {customerSuggestions.map((row, idx) => (
                  <Pressable
                    key={row.id}
                    style={[
                      styles.customerSuggestItem,
                      idx > 0 && styles.customerSuggestItemBorder
                    ]}
                    onPress={() => handleSelectCustomer(row)}
                    accessibilityRole="button"
                    accessibilityLabel={`${row.name}, ${row.phone}`}
                  >
                    <View style={styles.customerSuggestAvatar}>
                      <Text style={styles.customerSuggestAvatarText}>
                        {row.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.customerSuggestBody}>
                      <Text
                        style={styles.customerSuggestName}
                        numberOfLines={1}
                      >
                        {row.name}
                      </Text>
                      <Text
                        style={styles.customerSuggestPhone}
                        numberOfLines={1}
                      >
                        {row.phone}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            ) : null}

            {matchedCustomerId ? (
              <View style={styles.customerMatchChip}>
                <Ionicons
                  name="checkmark-circle"
                  size={12}
                  color={colors.status.success}
                />
                <Text style={styles.customerMatchText}>
                  {t("income.customerMatched")}
                </Text>
              </View>
            ) : null}

            {customerError ? (
              <View style={styles.customerErrorRow}>
                <Ionicons
                  name="alert-circle"
                  size={14}
                  color={colors.status.danger}
                />
                <Text style={styles.customerErrorText}>{customerError}</Text>
              </View>
            ) : paymentMode === "credit" ? (
              <View style={styles.customerHintRow}>
                <Ionicons
                  name="information-circle-outline"
                  size={14}
                  color={colors.status.warning}
                />
                <Text style={styles.customerHintText}>
                  {t("income.creditRequiresCustomerHint")}
                </Text>
              </View>
            ) : null}
          </View>

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

          {/* ── Gender + Date ──────────────────────────────────────── */}
          <View style={styles.metaRow}>
            {/* Gender toggle — always visible */}
            <View style={styles.metaCol}>
              <Text style={styles.sectionLabel}>{t("income.customer")}</Text>
              <View style={styles.genderToggle}>
                {(["male", "female"] as CustomerGender[]).map((g, idx) => (
                  <Pressable
                    key={g}
                    style={[
                      styles.genderToggleBtn,
                      idx === 0 && styles.genderToggleBtnLeft,
                      customerGender === g && styles.genderToggleBtnSelected
                    ]}
                    onPress={() => handleGender(g)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: customerGender === g }}
                  >
                    <Text
                      style={[
                        styles.genderToggleText,
                        customerGender === g &&
                          styles.genderToggleTextSelected
                      ]}
                    >
                      {g === "male" ? "♂ Male" : "♀ Female"}
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
                  onPress={() => {
                    setPaymentMode(key);
                    // Leaving credit clears the customer-required warning.
                    if (key !== "credit" && customerError) setCustomerError("");
                  }}
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
          accessibilityLabel={isEditing ? t("income.updateBill") : t("income.saveBill")}
        >
          {saving
            ? t("common.loading")
            : isEditing
              ? t("income.updateBill")
              : t("income.saveBill")}
        </Button>
      </View>

      {/* Services picker sheet */}
      <AddServicesSheet
        visible={servicesSheetOpen}
        onClose={() => setServicesSheetOpen(false)}
        onDone={applyServiceSelection}
        onSaveAndClose={
          !isEditing && isFormAtDefaults ? handleSaveFromSelections : undefined
        }
        initialSelectedIds={selectedIds}
        initialEmployeeByServiceId={initialEmployeeByServiceId}
        customerGender={customerGender}
        employees={employees}
        defaultEmployeeId={employeeId}
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

      {/* ── Post-save bill preview ────────────────────────────────── */}
      <Modal
        visible={previewVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setPreviewVisible(false);
          navigation.goBack();
        }}
      >
        <View style={styles.previewScrim}>
          <View style={styles.previewCard}>
            <Text style={styles.previewTitle}>{t("income.previewTitle")}</Text>

            {previewData ? (
              <ScrollView
                style={styles.previewScroll}
                showsVerticalScrollIndicator={false}
              >
                <ReceiptCard
                  ref={receiptRef}
                  transaction={previewData.transaction}
                  items={previewData.items}
                  businessName={
                    salonRepo.getById(DEV_SALON_ID)?.business_name ??
                    t("dashboard.businessNameFallback")
                  }
                />
              </ScrollView>
            ) : null}

            <View style={styles.previewActions}>
              {previewData?.transaction.customer_phone_snapshot ? (
                <Button
                  variant="primary"
                  fullWidth
                  onPress={async () => {
                    // Capture the receipt view as PNG and open the native
                    // share sheet. WhatsApp appears prominently — user picks
                    // it, then picks the customer's chat, and the image is
                    // attached. WhatsApp's share intent doesn't support
                    // pre-selecting both a contact AND an image in one call,
                    // so this is the reliable cross-platform flow.
                    await shareReceipt();
                    setPreviewVisible(false);
                    navigation.goBack();
                  }}
                  accessibilityLabel={t("receipt.shareOnWhatsapp")}
                >
                  {sharing
                    ? t("common.loading")
                    : t("receipt.shareOnWhatsapp")}
                </Button>
              ) : null}
              <Button
                variant="secondary"
                fullWidth
                onPress={() => {
                  setPreviewVisible(false);
                  navigation.goBack();
                }}
                accessibilityLabel={t("common.cancel")}
              >
                {t("common.cancel")}
              </Button>
            </View>
          </View>
        </View>
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
  genderToggle: {
    borderColor: colors.border.subtle,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: "row",
    overflow: "hidden"
  },
  genderToggleBtn: {
    alignItems: "center",
    backgroundColor: colors.surface.default,
    flex: 1,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[2]
  },
  genderToggleBtnLeft: {
    borderColor: colors.border.subtle,
    borderRightWidth: 1
  },
  genderToggleBtnSelected: {
    backgroundColor: colors.interactive.selected
  },
  genderToggleText: {
    ...typography.bodySmall,
    color: colors.text.secondary,
    textAlign: "center"
  },
  genderToggleTextSelected: {
    color: colors.brand.primary,
    fontWeight: "600"
  },
  dateField: {
    alignItems: "center",
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
  // Customer section
  customerToggle: {
    alignItems: "center",
    backgroundColor: colors.background.subtle,
    borderRadius: radius.md,
    flexDirection: "row",
    gap: spacing[2],
    justifyContent: "space-between",
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3]
  },
  customerToggleLeft: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: spacing[2]
  },
  customerToggleLabel: {
    ...typography.bodySmall,
    color: colors.text.primary,
    flex: 1,
    fontWeight: "500"
  },
  customerBody: {
    gap: spacing[2],
    marginTop: spacing[2]
  },
  customerFieldRow: {
    flexDirection: "row",
    gap: spacing[3]
  },
  customerFieldCol: {
    flex: 1,
    gap: spacing[1]
  },
  customerInput: {
    ...typography.body,
    backgroundColor: colors.surface.default,
    borderColor: colors.border.subtle,
    borderRadius: radius.md,
    borderWidth: 1,
    color: colors.text.primary,
    minHeight: 44,
    paddingHorizontal: spacing[3]
  },
  customerFooterRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 24
  },
  customerMatchChip: {
    alignItems: "center",
    backgroundColor: colors.status.successBg,
    borderRadius: radius.full,
    flexDirection: "row",
    gap: spacing[1],
    paddingHorizontal: spacing[2],
    paddingVertical: 2
  },
  customerMatchText: {
    ...typography.caption,
    color: colors.status.success,
    fontWeight: "600"
  },
  customerErrorRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[1],
    marginTop: spacing[1]
  },
  customerErrorText: {
    ...typography.caption,
    color: colors.status.danger,
    flex: 1,
    fontWeight: "600"
  },
  customerHintRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[1],
    marginTop: spacing[1]
  },
  customerHintText: {
    ...typography.caption,
    color: colors.status.warning,
    flex: 1
  },
  customerSuggestList: {
    backgroundColor: colors.surface.default,
    borderColor: colors.border.subtle,
    borderRadius: radius.md,
    borderWidth: 1,
    marginTop: spacing[2],
    overflow: "hidden"
  },
  customerSuggestItem: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[3],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2]
  },
  customerSuggestItemBorder: {
    borderTopColor: colors.border.subtle,
    borderTopWidth: 1
  },
  customerSuggestAvatar: {
    alignItems: "center",
    backgroundColor: colors.brand.accentLight,
    borderRadius: radius.full,
    height: 32,
    justifyContent: "center",
    width: 32
  },
  customerSuggestAvatarText: {
    ...typography.bodySmall,
    color: colors.brand.primary,
    fontWeight: "700"
  },
  customerSuggestBody: {
    flex: 1,
    gap: 2
  },
  customerSuggestName: {
    ...typography.body,
    color: colors.text.primary,
    fontWeight: "600"
  },
  customerSuggestPhone: {
    ...typography.caption,
    color: colors.text.muted
  },
  customerClearText: {
    ...typography.bodySmall,
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
  },
  // Post-save preview modal
  previewScrim: {
    backgroundColor: "rgba(0,0,0,0.55)",
    flex: 1,
    justifyContent: "flex-end"
  },
  previewCard: {
    backgroundColor: colors.surface.default,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: "90%",
    paddingTop: spacing[4]
  },
  previewTitle: {
    ...typography.h3,
    color: colors.text.primary,
    paddingHorizontal: spacing[4],
    marginBottom: spacing[3],
    textAlign: "center"
  },
  previewScroll: {
    maxHeight: 480
  },
  previewActions: {
    gap: spacing[2],
    padding: spacing[4]
  }
});
