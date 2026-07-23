// Customer detail sheet — visit stats, contact actions (call/WhatsApp),
// edit + delete controls, and a scrolling list of past bills that opens
// IncomeEntry in edit mode when tapped.

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { useTranslation } from "react-i18next";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";

import { BottomSheet } from "@/components/core/BottomSheet";
import { useSnackbar } from "@/components/core/SnackbarProvider";
import { colors, radius, spacing, typography } from "@/design-system/tokens";
import { DEV_SALON_ID } from "@/constants/dev";
import { formatMoney } from "@/domain/money";
import {
  CustomerRepository,
  type CustomerRecord
} from "@/repositories/customer-repository";
import {
  IncomeRepository,
  type IncomeTransactionSummary
} from "@/repositories/income-repository";
import type { RootStackParamList } from "@/application/AppNavigator";
import { Events, track } from "@/observability";

const customerRepo = new CustomerRepository();
const incomeRepo = new IncomeRepository();

type Props = {
  visible: boolean;
  customerId: string;
  onClose: () => void;
  onEdit: (customerId: string) => void;
  onDeleted: () => void;
};

/**
 * WhatsApp URL for a 10-digit Indian phone. Prepends the +91 country code
 * because WhatsApp requires an international prefix in the wa.me path.
 */
function whatsappUrl(phone: string): string {
  const digits = phone.replace(/\D/g, "").slice(-10);
  return `https://wa.me/91${digits}`;
}

function telUrl(phone: string): string {
  return `tel:${phone}`;
}

function formatLastVisit(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function formatBillDate(iso: string): string {
  const [y, m, d] = iso.split("-").map((n) => parseInt(n, 10));
  const date = new Date(y, (m ?? 1) - 1, d ?? 1);
  return date.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

export function CustomerDetailSheet({
  customerId,
  onClose,
  onDeleted,
  onEdit,
  visible
}: Props) {
  const { t } = useTranslation();
  const { showSnackbar } = useSnackbar();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [customer, setCustomer] = useState<CustomerRecord | null>(null);
  const [bills, setBills] = useState<IncomeTransactionSummary[]>([]);

  const load = useCallback(() => {
    const c = customerRepo.getById(DEV_SALON_ID, customerId);
    setCustomer(c);
    if (c) setBills(incomeRepo.listBillsForCustomer(DEV_SALON_ID, customerId));
    else setBills([]);
  }, [customerId]);

  useEffect(() => {
    if (visible) load();
  }, [visible, load]);

  const stats = useMemo(() => {
    const totalSpend = bills.reduce((s, b) => s + b.net_amount, 0);
    const lastVisit = bills[0]?.created_at ?? null;
    return { visits: bills.length, totalSpend, lastVisit };
  }, [bills]);

  const handleCall = async () => {
    if (!customer) return;
    track(Events.customer.callTapped);
    const url = telUrl(customer.phone);
    try {
      const can = await Linking.canOpenURL(url);
      if (!can) {
        Alert.alert(t("customers.callUnavailable"));
        return;
      }
      await Linking.openURL(url);
    } catch {
      Alert.alert(t("customers.callUnavailable"));
    }
  };

  const handleWhatsapp = async () => {
    if (!customer) return;
    track(Events.customer.whatsappTapped);
    const url = whatsappUrl(customer.phone);
    try {
      const can = await Linking.canOpenURL(url);
      if (!can) {
        Alert.alert(t("customers.whatsappUnavailable"));
        return;
      }
      await Linking.openURL(url);
    } catch {
      Alert.alert(t("customers.whatsappUnavailable"));
    }
  };

  const handleDelete = () => {
    if (!customer) return;
    Alert.alert(
      t("customers.deleteConfirm.title"),
      t("customers.deleteConfirm.message"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.delete"),
          style: "destructive",
          onPress: () => {
            customerRepo.softDelete(DEV_SALON_ID, customer.id);
            track(Events.customer.deleted);
            showSnackbar(t("customers.deleted"));
            onDeleted();
          }
        }
      ]
    );
  };

  if (!customer) {
    return (
      <BottomSheet visible={visible} onClose={onClose} title="" size="auto">
        <View style={styles.emptyBody}>
          <Text style={styles.emptyText}>{t("common.loading")}</Text>
        </View>
      </BottomSheet>
    );
  }

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={customer.name}
      size="tall"
    >
      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.phoneText}>{customer.phone}</Text>

        <View style={styles.statsRow}>
          <StatCell
            label={t("customers.stats.visits", { count: stats.visits })}
            value={String(stats.visits)}
          />
          <StatCell
            label={t("customers.stats.totalSpend")}
            value={formatMoney(stats.totalSpend)}
          />
          <StatCell
            label={t("customers.stats.lastVisit")}
            value={
              stats.lastVisit
                ? formatLastVisit(stats.lastVisit)
                : t("customers.stats.noVisits")
            }
          />
        </View>

        <View style={styles.actionRow}>
          <ActionBtn
            icon="call"
            label={t("customers.actions.call")}
            color={colors.status.success}
            onPress={handleCall}
          />
          <ActionBtn
            icon="logo-whatsapp"
            label={t("customers.actions.whatsapp")}
            color={colors.status.success}
            onPress={handleWhatsapp}
          />
          <ActionBtn
            icon="create-outline"
            label={t("customers.actions.edit")}
            color={colors.brand.primary}
            onPress={() => onEdit(customer.id)}
          />
          <ActionBtn
            icon="trash-outline"
            label={t("customers.actions.delete")}
            color={colors.status.danger}
            onPress={handleDelete}
          />
        </View>

        <Text style={styles.sectionHeader}>{t("customers.pastBills")}</Text>

        {bills.length === 0 ? (
          <Text style={styles.emptyText}>
            {t("customers.pastBillsEmpty")}
          </Text>
        ) : (
          <View style={styles.billList}>
            {bills.map((tx) => (
              <Pressable
                key={tx.id}
                onPress={() => {
                  onClose();
                  navigation.navigate("IncomeEntry", {
                    transactionId: tx.id
                  });
                }}
                style={({ pressed }) => [
                  styles.billRow,
                  pressed && styles.billRowPressed
                ]}
                accessibilityRole="button"
                accessibilityLabel={tx.services_summary || "Bill"}
              >
                <View style={styles.billHeader}>
                  <Text style={styles.billPrimary} numberOfLines={1}>
                    {tx.services_summary || "—"}
                  </Text>
                  <Text style={styles.billAmount}>
                    {formatMoney(tx.net_amount)}
                  </Text>
                </View>
                <View style={styles.billFooter}>
                  <Text style={styles.billMeta} numberOfLines={1}>
                    {tx.employees_summary || tx.employee_name_snapshot}
                  </Text>
                  <View style={styles.billFooterRight}>
                    {tx.payment_mode === "credit" ? (
                      <View style={styles.creditPill}>
                        <Text style={styles.creditPillText}>
                          {t("expenses.creditBadge")}
                        </Text>
                      </View>
                    ) : null}
                    <Text style={styles.billMeta}>
                      {formatBillDate(tx.transaction_date)}
                    </Text>
                  </View>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </BottomSheet>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCell}>
      <Text style={styles.statValue} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function ActionBtn({
  color,
  icon,
  label,
  onPress
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  color: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionBtn,
        pressed && styles.actionBtnPressed
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={[styles.actionIcon, { backgroundColor: `${color}18` }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={styles.actionLabel} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  body: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[3],
    paddingBottom: spacing[5],
    gap: spacing[4]
  },
  emptyBody: {
    padding: spacing[6],
    alignItems: "center"
  },
  phoneText: {
    ...typography.body,
    color: colors.text.secondary,
    marginTop: -spacing[2]
  },
  statsRow: {
    flexDirection: "row",
    gap: spacing[3]
  },
  statCell: {
    flex: 1,
    backgroundColor: colors.surface.raised,
    borderRadius: radius.md,
    padding: spacing[3],
    gap: 2
  },
  statValue: {
    ...typography.bodyEmphasis,
    color: colors.text.primary
  },
  statLabel: {
    ...typography.caption,
    color: colors.text.secondary
  },
  actionRow: {
    flexDirection: "row",
    gap: spacing[2],
    justifyContent: "space-between"
  },
  actionBtn: {
    alignItems: "center",
    flex: 1,
    gap: spacing[1]
  },
  actionBtnPressed: {
    opacity: 0.7
  },
  actionIcon: {
    alignItems: "center",
    borderRadius: radius.full,
    height: 44,
    justifyContent: "center",
    width: 44
  },
  actionLabel: {
    ...typography.caption,
    color: colors.text.primary,
    textAlign: "center"
  },
  sectionHeader: {
    ...typography.overline,
    color: colors.text.secondary
  },
  emptyText: {
    ...typography.body,
    color: colors.text.muted,
    textAlign: "center",
    paddingVertical: spacing[3]
  },
  billList: {
    gap: spacing[2]
  },
  billRow: {
    backgroundColor: colors.surface.default,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
    gap: spacing[1]
  },
  billRowPressed: {
    backgroundColor: colors.interactive.selected
  },
  billHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[2],
    justifyContent: "space-between"
  },
  billPrimary: {
    ...typography.bodyEmphasis,
    color: colors.text.primary,
    flex: 1
  },
  billAmount: {
    ...typography.moneyBody,
    color: colors.text.primary
  },
  billFooter: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  billFooterRight: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[2]
  },
  creditPill: {
    backgroundColor: colors.status.warningBg,
    borderRadius: radius.full,
    paddingHorizontal: spacing[2],
    paddingVertical: 2
  },
  creditPillText: {
    ...typography.caption,
    color: colors.status.warning,
    fontSize: 10,
    fontWeight: "700"
  },
  billMeta: {
    ...typography.caption,
    color: colors.text.secondary
  }
});
