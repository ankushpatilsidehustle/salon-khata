import { useEffect, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";

import { BottomSheet } from "@/components/core/BottomSheet";
import { Button } from "@/components/core/Button";
import { colors, radius, spacing, typography } from "@/design-system/tokens";
import { DEV_SALON_ID } from "@/constants/dev";
import { formatMoney } from "@/domain/money";
import { getUtcTimestamp } from "@/domain/dates";
import { ExpenseRepository } from "@/repositories/expense-repository";
import type { ExpenseRecord } from "@/repositories/expense-repository";

const expenseRepo = new ExpenseRepository();

type Props = {
  visible: boolean;
  expenseId: string | null;
  onClose: () => void;
  /** Fires after a successful delete so the caller can refresh its list. */
  onDeleted: () => void;
  /** Fires when the user taps Edit — caller navigates to ExpenseEntry. */
  onEdit: (expenseId: string) => void;
};

/** Local HH:MM display for the `created_at` timestamp (ISO UTC). */
function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function ExpenseDetailSheet({
  expenseId,
  onClose,
  onDeleted,
  onEdit,
  visible
}: Props) {
  const { t } = useTranslation();

  const [loaded, setLoaded] = useState<ExpenseRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!visible || !expenseId) {
      setLoaded(null);
      return;
    }
    setLoaded(expenseRepo.getById(DEV_SALON_ID, expenseId));
  }, [visible, expenseId]);

  function handleDelete() {
    if (!loaded || deleting) return;
    Alert.alert(
      t("expenses.detail.deleteConfirmTitle"),
      t("expenses.detail.deleteConfirmBody"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("expenses.detail.deleteConfirmCta"),
          style: "destructive",
          onPress: () => {
            setDeleting(true);
            try {
              expenseRepo.softDelete(
                DEV_SALON_ID,
                loaded.id,
                getUtcTimestamp()
              );
              onDeleted();
              onClose();
            } catch (err) {
              const message =
                err instanceof Error ? err.message : String(err);
              Alert.alert(t("expenses.detail.deleteFailed"), message);
            } finally {
              setDeleting(false);
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

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={t("expenses.detail.title")}
      size="auto"
      footer={
        <View style={styles.footerRow}>
          <View style={styles.footerBtn}>
            <Button
              variant="secondary"
              onPress={handleDelete}
              fullWidth
              style={styles.footerBtnHeight}
              accessibilityLabel={t("expenses.detail.delete")}
            >
              {deleting ? t("common.loading") : t("expenses.detail.delete")}
            </Button>
          </View>
          <View style={styles.footerBtn}>
            <Button
              variant="primary"
              onPress={handleEdit}
              fullWidth
              style={styles.footerBtnHeight}
              accessibilityLabel={t("expenses.detail.edit")}
            >
              {t("expenses.detail.edit")}
            </Button>
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
          {/* Amount hero */}
          <View style={styles.amountBlock}>
            <Text style={styles.amountValue}>
              {formatMoney(loaded.amount)}
            </Text>
            <View style={styles.categoryChip}>
              <Ionicons
                name="pricetag-outline"
                size={12}
                color={colors.brand.primary}
              />
              <Text style={styles.categoryChipText} numberOfLines={1}>
                {loaded.category_name_snapshot}
              </Text>
            </View>
          </View>

          {/* Meta */}
          <View style={styles.metaRow}>
            <View style={styles.metaCol}>
              <Text style={styles.metaLabel}>{t("expenses.date")}</Text>
              <Text style={styles.metaValue}>{loaded.expense_date}</Text>
            </View>
            <View style={styles.metaCol}>
              <Text style={styles.metaLabel}>
                {t("expenses.paymentMode")}
              </Text>
              <View style={styles.paidRow}>
                <Text
                  style={[
                    styles.metaValue,
                    loaded.payment_mode === "credit" &&
                      loaded.settled_at === null &&
                      styles.creditText
                  ]}
                >
                  {t(`expenses.modes.${loaded.payment_mode}`)}
                </Text>
                {loaded.payment_mode === "credit" &&
                loaded.settled_at !== null ? (
                  <View style={styles.paidPill}>
                    <Text style={styles.paidPillText}>
                      {t("expenses.paidBadge")}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
          </View>

          <Text style={styles.timeLine}>
            {t("expenses.detail.loggedAt", {
              time: formatTime(loaded.created_at)
            })}
          </Text>

          {loaded.remarks ? (
            <View style={styles.remarksBlock}>
              <Text style={styles.metaLabel}>{t("expenses.remarks")}</Text>
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
    gap: spacing[4],
    padding: spacing[4]
  },
  amountBlock: {
    alignItems: "center",
    gap: spacing[2]
  },
  amountValue: {
    ...typography.moneyHero,
    color: colors.text.primary
  },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[1],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    backgroundColor: colors.interactive.selected,
    borderRadius: radius.full
  },
  categoryChipText: {
    ...typography.bodySmall,
    color: colors.brand.primary,
    fontWeight: "600"
  },
  metaRow: {
    flexDirection: "row",
    gap: spacing[4]
  },
  metaCol: {
    flex: 1,
    gap: spacing[1] / 2
  },
  metaLabel: {
    ...typography.overline,
    color: colors.text.muted
  },
  metaValue: {
    ...typography.body,
    color: colors.text.primary,
    fontWeight: "600"
  },
  creditText: {
    color: colors.status.danger
  },
  paidRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2]
  },
  paidPill: {
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    borderRadius: radius.full,
    backgroundColor: colors.status.successBg
  },
  paidPillText: {
    ...typography.caption,
    color: colors.status.success,
    fontWeight: "700",
    letterSpacing: 0.5
  },
  timeLine: {
    ...typography.bodySmall,
    color: colors.text.muted
  },
  remarksBlock: {
    gap: spacing[1],
    padding: spacing[3],
    borderRadius: radius.md,
    backgroundColor: colors.background.subtle
  },
  remarksText: {
    ...typography.body,
    color: colors.text.primary
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
