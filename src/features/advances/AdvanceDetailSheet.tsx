import { useEffect, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";

import { BottomSheet } from "@/components/core/BottomSheet";
import { Button } from "@/components/core/Button";
import { colors, radius, spacing, typography } from "@/design-system/tokens";
import { DEV_DEVICE_ID, DEV_SALON_ID } from "@/constants/dev";
import { formatMoney } from "@/domain/money";
import { getUtcTimestamp } from "@/domain/dates";
import { EmployeeAdvanceRepository } from "@/repositories/employee-advance-repository";
import type { EmployeeAdvanceRecord } from "@/repositories/employee-advance-repository";

const advanceRepo = new EmployeeAdvanceRepository();

type Props = {
  visible: boolean;
  advanceId: string | null;
  onClose: () => void;
  /** Fires after delete or mark-settled so the caller can refresh its list. */
  onChanged: () => void;
  /** Fires when the user taps Edit — caller navigates to AdvanceEntry. */
  onEdit: (advanceId: string) => void;
};

export function AdvanceDetailSheet({
  advanceId,
  onChanged,
  onClose,
  onEdit,
  visible
}: Props) {
  const { t } = useTranslation();

  const [loaded, setLoaded] = useState<EmployeeAdvanceRecord | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible || !advanceId) {
      setLoaded(null);
      return;
    }
    setLoaded(advanceRepo.getById(DEV_SALON_ID, advanceId));
  }, [visible, advanceId]);

  function handleDelete() {
    if (!loaded || busy) return;
    Alert.alert(
      t("advances.detail.deleteConfirmTitle"),
      t("advances.detail.deleteConfirmBody"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("advances.detail.deleteConfirmCta"),
          style: "destructive",
          onPress: () => {
            setBusy(true);
            try {
              advanceRepo.softDelete(
                DEV_SALON_ID,
                loaded.id,
                getUtcTimestamp(),
                DEV_DEVICE_ID
              );
              onChanged();
              onClose();
            } catch (err) {
              const message =
                err instanceof Error ? err.message : String(err);
              Alert.alert(t("advances.detail.deleteFailed"), message);
            } finally {
              setBusy(false);
            }
          }
        }
      ]
    );
  }

  function handleMarkPaid() {
    if (!loaded || busy) return;
    Alert.alert(
      t("advances.markPaidConfirmTitle"),
      t("advances.markPaidConfirmBody"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("advances.markPaidConfirmCta"),
          onPress: () => {
            setBusy(true);
            try {
              advanceRepo.markSettled(
                DEV_SALON_ID,
                loaded.id,
                getUtcTimestamp(),
                DEV_DEVICE_ID
              );
              onChanged();
              onClose();
            } catch (err) {
              const message =
                err instanceof Error ? err.message : String(err);
              Alert.alert(t("advances.markPaidFailed"), message);
            } finally {
              setBusy(false);
            }
          }
        }
      ]
    );
  }

  function handleEdit() {
    if (!loaded) return;
    onClose();
    onEdit(loaded.id);
  }

  const isSettled = !!loaded?.settled_at;

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={t("advances.detail.title")}
      size="auto"
      footer={
        <View style={styles.footer}>
          {loaded && !isSettled ? (
            <Button
              variant="primary"
              onPress={handleMarkPaid}
              fullWidth
              style={styles.footerBtnHeight}
              accessibilityLabel={t("advances.markPaid")}
            >
              {busy ? t("common.loading") : t("advances.markPaid")}
            </Button>
          ) : null}
          <View style={styles.footerRow}>
            <View style={styles.footerBtn}>
              <Button
                variant="secondary"
                onPress={handleDelete}
                fullWidth
                style={styles.footerBtnHeight}
                accessibilityLabel={t("advances.detail.delete")}
              >
                {busy ? t("common.loading") : t("advances.detail.delete")}
              </Button>
            </View>
            <View style={styles.footerBtn}>
              <Button
                variant={isSettled ? "primary" : "secondary"}
                onPress={handleEdit}
                fullWidth
                style={styles.footerBtnHeight}
                accessibilityLabel={t("advances.detail.edit")}
              >
                {t("advances.detail.edit")}
              </Button>
            </View>
          </View>
        </View>
      }
    >
      {!loaded ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>{t("common.loading")}</Text>
        </View>
      ) : (
        <View style={styles.content}>
          {/* Hero */}
          <View style={styles.heroRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.employeeName} numberOfLines={1}>
                {loaded.employee_name_snapshot}
              </Text>
              <Text style={styles.dateText}>{loaded.advance_date}</Text>
            </View>
            <Text style={styles.amount}>{formatMoney(loaded.amount)}</Text>
          </View>

          {/* Status pill */}
          <View
            style={[
              styles.statusPill,
              isSettled ? styles.statusPaid : styles.statusOutstanding
            ]}
          >
            <Ionicons
              name={isSettled ? "checkmark-circle" : "time-outline"}
              size={14}
              color={
                isSettled ? colors.status.success : colors.status.warning
              }
            />
            <Text
              style={[
                styles.statusText,
                isSettled ? styles.statusPaidText : styles.statusOutstandingText
              ]}
            >
              {isSettled
                ? t("advances.paidBadge")
                : t("advances.outstandingBadge")}
            </Text>
          </View>

          {/* Remarks */}
          {loaded.remarks ? (
            <View style={styles.remarksBlock}>
              <Text style={styles.remarksLabel}>
                {t("advances.remarks")}
              </Text>
              <Text style={styles.remarksText}>{loaded.remarks}</Text>
            </View>
          ) : null}
        </View>
      )}
    </BottomSheet>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  empty: {
    alignItems: "center",
    padding: spacing[6]
  },
  emptyText: {
    ...typography.bodySmall,
    color: colors.text.muted
  },
  content: {
    gap: spacing[3],
    padding: spacing[4]
  },
  heroRow: {
    alignItems: "flex-end",
    flexDirection: "row",
    gap: spacing[3],
    justifyContent: "space-between"
  },
  employeeName: {
    ...typography.h3,
    color: colors.text.primary
  },
  dateText: {
    ...typography.bodySmall,
    color: colors.text.muted,
    marginTop: 2
  },
  amount: {
    ...typography.moneyLarge,
    color: colors.status.warning
  },
  statusPill: {
    alignItems: "center",
    alignSelf: "flex-start",
    borderRadius: radius.full,
    flexDirection: "row",
    gap: spacing[1],
    paddingHorizontal: spacing[2],
    paddingVertical: 4
  },
  statusOutstanding: {
    backgroundColor: colors.status.warningBg
  },
  statusPaid: {
    backgroundColor: colors.status.successBg
  },
  statusText: {
    ...typography.caption,
    fontWeight: "700",
    letterSpacing: 0.5
  },
  statusOutstandingText: {
    color: colors.status.warning
  },
  statusPaidText: {
    color: colors.status.success
  },
  remarksBlock: {
    backgroundColor: colors.background.subtle,
    borderRadius: radius.md,
    gap: spacing[1],
    padding: spacing[3]
  },
  remarksLabel: {
    ...typography.overline,
    color: colors.text.muted
  },
  remarksText: {
    ...typography.body,
    color: colors.text.primary
  },
  footer: {
    gap: spacing[2]
  },
  footerRow: {
    flexDirection: "row",
    gap: spacing[2]
  },
  footerBtn: {
    flex: 1
  },
  footerBtnHeight: {
    minHeight: 52
  }
});
