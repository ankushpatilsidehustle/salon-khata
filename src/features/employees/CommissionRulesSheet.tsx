import { useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";

import { BottomSheet } from "@/components/core/BottomSheet";
import { Button } from "@/components/core/Button";
import { colors, radius, spacing, typography } from "@/design-system/tokens";
import { DEV_SALON_ID } from "@/constants/dev";
import { CommissionRepository } from "@/repositories/commission-repository";
import type { CommissionRuleRecord } from "@/repositories/commission-repository";
import { EmployeeRepository } from "@/repositories/employee-repository";
import type { EmployeeRecord } from "@/repositories/employee-repository";
import { ServiceRepository } from "@/repositories/service-repository";
import type { ServiceRecord } from "@/repositories/service-repository";
import { Events, track } from "@/observability";

type Props = {
  visible: boolean;
  onClose: () => void;
  employeeId: string;
  employeeName: string;
};

type RuleType = "percentage" | "fixed";

const commissionRepo = new CommissionRepository();
const employeeRepo = new EmployeeRepository();
const serviceRepo = new ServiceRepository();

/** Display label for a saved rule — e.g. "35%" or "₹50". */
function ruleLabel(rule: CommissionRuleRecord): string {
  const n = rule.value / 100;
  return rule.rule_type === "percentage" ? `${n}%` : `₹${n}`;
}

/** Format a basis-point percent value (4000 → "40") for display. */
function formatPercent(bps: number): string {
  const p = bps / 100;
  return Number.isInteger(p) ? String(p) : p.toFixed(2);
}

/** Convert stored value → user-facing input string. */
function ruleToInput(rule: CommissionRuleRecord): string {
  return String(rule.value / 100);
}

export function CommissionRulesSheet({
  employeeId,
  employeeName,
  onClose,
  visible
}: Props) {
  const { t } = useTranslation();

  const [employee, setEmployee] = useState<EmployeeRecord | null>(null);
  const [services, setServices] = useState<ServiceRecord[]>([]);
  const [rulesMap, setRulesMap] = useState<Record<string, CommissionRuleRecord>>({});

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editType, setEditType] = useState<RuleType>("percentage");
  const [editInput, setEditInput] = useState("");
  const [editError, setEditError] = useState("");

  function loadData() {
    setEmployee(employeeRepo.getById(employeeId, DEV_SALON_ID));
    setServices(serviceRepo.listActive(DEV_SALON_ID));
    const rules = commissionRepo.findAllRulesForEmployee(employeeId, DEV_SALON_ID);
    const map: Record<string, CommissionRuleRecord> = {};
    for (const r of rules) map[r.service_id] = r;
    setRulesMap(map);
  }

  useEffect(() => {
    if (visible) {
      loadData();
      setEditingId(null);
    }
  }, [visible, employeeId]);

  function openEdit(serviceId: string) {
    const rule = rulesMap[serviceId];
    setEditingId(serviceId);
    setEditType(rule?.rule_type ?? "percentage");
    setEditInput(rule ? ruleToInput(rule) : "");
    setEditError("");
  }

  function closeEdit() {
    setEditingId(null);
    setEditError("");
  }

  function saveEdit(serviceId: string) {
    const raw = parseFloat(editInput.trim());
    if (isNaN(raw) || raw <= 0) {
      setEditError(t("commission.valueRequired"));
      return;
    }
    if (editType === "percentage" && raw > 100) {
      setEditError(t("commission.percentMax"));
      return;
    }
    commissionRepo.saveRule({
      employeeId,
      serviceId,
      salonId: DEV_SALON_ID,
      ruleType: editType,
      value: Math.round(raw * 100) // → basis points or paise
    });
    track(Events.staff.commissionRulesUpdated, {
      rule_type: editType
    });
    loadData();
    setEditingId(null);
  }

  function clearRule(serviceId: string) {
    commissionRepo.clearRule(employeeId, serviceId);
    loadData();
    if (editingId === serviceId) setEditingId(null);
  }

  // Employee-level fallback percent, if this employee is on commission and
  // has a default set. Any service without its own rule inherits this.
  const defaultPercentBps =
    employee &&
    employee.compensation_type === "commission" &&
    employee.commission_percent != null &&
    employee.commission_percent > 0
      ? employee.commission_percent
      : null;

  const defaultSummary = (() => {
    if (!employee) return null;
    if (defaultPercentBps != null) {
      return {
        tone: "commission" as const,
        text: t("commission.defaultCommission", {
          percent: formatPercent(defaultPercentBps)
        })
      };
    }
    if (employee.compensation_type === "salary") {
      return { tone: "salary" as const, text: t("commission.defaultSalary") };
    }
    return { tone: "none" as const, text: t("commission.defaultNone") };
  })();

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={t("commission.sheetTitle", { name: employeeName })}
      dismissOnBackdropPress={editingId === null}
      size="tall"
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {defaultSummary ? (
          <View
            style={[
              styles.defaultCard,
              defaultSummary.tone === "commission" && styles.defaultCardCommission,
              defaultSummary.tone === "salary" && styles.defaultCardSalary,
              defaultSummary.tone === "none" && styles.defaultCardNone
            ]}
          >
            <View style={styles.defaultCardHeader}>
              <Ionicons
                name={
                  defaultSummary.tone === "commission"
                    ? "cash-outline"
                    : defaultSummary.tone === "salary"
                    ? "briefcase-outline"
                    : "information-circle-outline"
                }
                size={16}
                color={colors.brand.primary}
              />
              <Text style={styles.defaultCardLabel}>
                {t("commission.defaultLabel")}
              </Text>
            </View>
            <Text style={styles.defaultCardText}>{defaultSummary.text}</Text>
            <Text style={styles.defaultCardHint}>
              {t("commission.defaultHint")}
            </Text>
          </View>
        ) : null}

        {services.length === 0 ? (
          <Text style={styles.empty}>{t("commission.noServices")}</Text>
        ) : (
          services.map((svc) => {
            const rule = rulesMap[svc.id];
            const isThisEditing = editingId === svc.id;

            return (
              <View key={svc.id} style={styles.row}>
                {/* Row header */}
                <Pressable
                  style={styles.rowHeader}
                  onPress={() => (isThisEditing ? closeEdit() : openEdit(svc.id))}
                >
                  <Text style={styles.serviceName} numberOfLines={1}>
                    {svc.name}
                  </Text>
                  <View style={styles.rowRight}>
                    {rule ? (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>{ruleLabel(rule)}</Text>
                      </View>
                    ) : defaultPercentBps != null ? (
                      <View style={styles.defaultBadge}>
                        <Text style={styles.defaultBadgeText}>
                          {t("commission.usesDefaultBadge", {
                            percent: formatPercent(defaultPercentBps)
                          })}
                        </Text>
                      </View>
                    ) : (
                      <Text style={styles.noRule}>{t("commission.noRule")}</Text>
                    )}
                    <Ionicons
                      name={isThisEditing ? "chevron-up" : "pencil-outline"}
                      size={16}
                      color={colors.text.muted}
                    />
                  </View>
                </Pressable>

                {/* Inline editor */}
                {isThisEditing && (
                  <View style={styles.editor}>
                    {/* Rule type chips */}
                    <View style={styles.typeRow}>
                      {(["percentage", "fixed"] as RuleType[]).map((rt) => (
                        <Pressable
                          key={rt}
                          style={[
                            styles.typeChip,
                            editType === rt && styles.typeChipActive
                          ]}
                          onPress={() => {
                            setEditType(rt);
                            setEditInput("");
                            setEditError("");
                          }}
                        >
                          <Text
                            style={[
                              styles.typeChipText,
                              editType === rt && styles.typeChipTextActive
                            ]}
                          >
                            {rt === "percentage"
                              ? t("commission.typePercent")
                              : t("commission.typeFixed")}
                          </Text>
                        </Pressable>
                      ))}
                    </View>

                    {/* Value input */}
                    <View style={styles.inputRow}>
                      <Text style={styles.inputPrefix}>
                        {editType === "percentage" ? "%" : "₹"}
                      </Text>
                      <TextInput
                        style={[
                          styles.valueInput,
                          editError ? styles.valueInputError : undefined
                        ]}
                        value={editInput}
                        onChangeText={(v) => {
                          setEditInput(v);
                          setEditError("");
                        }}
                        keyboardType="decimal-pad"
                        placeholder={
                          editType === "percentage" ? "e.g. 35" : "e.g. 50"
                        }
                        placeholderTextColor={colors.text.muted}
                        maxLength={6}
                        autoFocus
                      />
                    </View>
                    {editError ? (
                      <Text style={styles.errorText}>{editError}</Text>
                    ) : null}

                    {/* Action buttons */}
                    <View style={styles.actions}>
                      {rule ? (
                        <Button
                          variant="ghost"
                          onPress={() => clearRule(svc.id)}
                          style={styles.actionLeft}
                        >
                          {t("common.clear")}
                        </Button>
                      ) : null}
                      <View style={styles.actionRight}>
                        <Button variant="secondary" onPress={closeEdit}>
                          {t("common.cancel")}
                        </Button>
                        <Button
                          variant="primary"
                          onPress={() => saveEdit(svc.id)}
                        >
                          {t("common.save")}
                        </Button>
                      </View>
                    </View>
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1
  },
  scrollContent: {
    paddingBottom: spacing[4]
  },
  defaultCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    backgroundColor: colors.surface.sunken,
    gap: spacing[1],
    marginHorizontal: spacing[4],
    marginTop: spacing[3],
    marginBottom: spacing[3],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3]
  },
  defaultCardCommission: {
    backgroundColor: "rgba(103,57,183,0.06)",
    borderColor: "rgba(103,57,183,0.24)"
  },
  defaultCardSalary: {
    backgroundColor: "rgba(37,99,235,0.06)",
    borderColor: "rgba(37,99,235,0.24)"
  },
  defaultCardNone: {
    backgroundColor: colors.surface.sunken,
    borderColor: colors.border.subtle
  },
  defaultCardHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[1]
  },
  defaultCardLabel: {
    ...typography.overline,
    color: colors.text.secondary
  },
  defaultCardText: {
    ...typography.bodyEmphasis,
    color: colors.text.primary
  },
  defaultCardHint: {
    ...typography.caption,
    color: colors.text.secondary
  },
  defaultBadge: {
    backgroundColor: "rgba(0,0,0,0.04)",
    borderRadius: radius.full,
    paddingHorizontal: spacing[2],
    paddingVertical: 2
  },
  defaultBadgeText: {
    ...typography.caption,
    color: colors.text.secondary,
    fontWeight: "500"
  },
  empty: {
    ...typography.bodySmall,
    color: colors.text.secondary,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[8],
    textAlign: "center"
  },
  row: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.subtle
  },
  rowHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3]
  },
  serviceName: {
    ...typography.body,
    color: colors.text.primary,
    flex: 1,
    marginRight: spacing[2]
  },
  rowRight: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[2]
  },
  badge: {
    backgroundColor: colors.interactive.selected,
    borderRadius: radius.full,
    paddingHorizontal: spacing[2],
    paddingVertical: 2
  },
  badgeText: {
    ...typography.caption,
    color: colors.brand.primary,
    fontWeight: "600"
  },
  noRule: {
    ...typography.caption,
    color: colors.text.muted
  },
  editor: {
    backgroundColor: colors.surface.sunken,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border.subtle,
    gap: spacing[3],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3]
  },
  typeRow: {
    flexDirection: "row",
    gap: spacing[2]
  },
  typeChip: {
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1]
  },
  typeChipActive: {
    backgroundColor: colors.brand.primary,
    borderColor: colors.brand.primary
  },
  typeChipText: {
    ...typography.caption,
    color: colors.text.secondary
  },
  typeChipTextActive: {
    color: colors.text.inverse
  },
  inputRow: {
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: colors.brand.primary,
    flexDirection: "row",
    gap: spacing[1],
    paddingBottom: spacing[1]
  },
  inputPrefix: {
    ...typography.h3,
    color: colors.text.secondary,
    width: 20
  },
  valueInput: {
    ...typography.h3,
    color: colors.text.primary,
    flex: 1,
    paddingVertical: spacing[1]
  },
  valueInputError: {
    color: colors.status.danger
  },
  errorText: {
    ...typography.caption,
    color: colors.status.danger
  },
  actions: {
    alignItems: "center",
    flexDirection: "row"
  },
  actionLeft: {
    marginRight: "auto"
  },
  actionRight: {
    flexDirection: "row",
    gap: spacing[2]
  }
});
