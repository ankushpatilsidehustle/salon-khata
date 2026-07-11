import { useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";

import { BottomSheet } from "@/components/core/BottomSheet";
import { Button } from "@/components/core/Button";
import { ReceiptCard } from "@/components/domain/ReceiptCard";
import { colors, radius, spacing, typography } from "@/design-system/tokens";
import { DEV_DEVICE_ID, DEV_SALON_ID } from "@/constants/dev";
import { formatMoney } from "@/domain/money";
import { getUtcTimestamp } from "@/domain/dates";
import { IncomeRepository } from "@/repositories/income-repository";
import type {
  IncomeItemRecord,
  IncomeTransactionRecord
} from "@/repositories/income-repository";
import { SalonRepository } from "@/repositories/salon-repository";
import { useShareReceipt } from "./useShareReceipt";

const incomeRepo = new IncomeRepository();
const salonRepo = new SalonRepository();

type Props = {
  visible: boolean;
  transactionId: string | null;
  onClose: () => void;
  /** Fires after a successful delete so the caller can refresh its list. */
  onDeleted: () => void;
  /** Fires when the user taps Edit — caller navigates to IncomeEntry. */
  onEdit: (transactionId: string) => void;
};

/** Local HH:MM display for the `created_at` timestamp (ISO UTC). */
function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function TransactionDetailSheet({
  onClose,
  onDeleted,
  onEdit,
  transactionId,
  visible
}: Props) {
  const { t } = useTranslation();

  const [loaded, setLoaded] = useState<{
    transaction: IncomeTransactionRecord;
    items: IncomeItemRecord[];
  } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { receiptRef, shareReceipt, sharing } = useShareReceipt();

  useEffect(() => {
    if (!visible || !transactionId) {
      setLoaded(null);
      return;
    }
    setLoaded(incomeRepo.getById(DEV_SALON_ID, transactionId));
  }, [visible, transactionId]);

  const businessName =
    salonRepo.getById(DEV_SALON_ID)?.business_name ?? t("dashboard.businessNameFallback");
  const hasPhone = !!loaded?.transaction.customer_phone_snapshot;

  function handleDelete() {
    if (!loaded || deleting) return;
    Alert.alert(
      t("income.detail.deleteConfirmTitle"),
      t("income.detail.deleteConfirmBody"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("income.detail.deleteConfirmCta"),
          style: "destructive",
          onPress: () => {
            setDeleting(true);
            try {
              incomeRepo.softDelete(
                DEV_SALON_ID,
                loaded.transaction.id,
                getUtcTimestamp(),
                DEV_DEVICE_ID
              );
              onDeleted();
              onClose();
            } catch (err) {
              const message =
                err instanceof Error ? err.message : String(err);
              Alert.alert(t("income.detail.deleteFailed"), message);
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
    onEdit(loaded.transaction.id);
  }

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={t("income.detail.title")}
      size="auto"
      footer={
        <View style={styles.footer}>
          {loaded ? (
            <Button
              variant="secondary"
              onPress={shareReceipt}
              fullWidth
              style={styles.footerBtnHeight}
              accessibilityLabel={
                hasPhone
                  ? t("receipt.shareOnWhatsapp")
                  : t("receipt.shareReceipt")
              }
            >
              {sharing
                ? t("common.loading")
                : hasPhone
                  ? t("receipt.shareOnWhatsapp")
                  : t("receipt.shareReceipt")}
            </Button>
          ) : null}
          <View style={styles.footerRow}>
            <View style={styles.footerBtn}>
              <Button
                variant="secondary"
                onPress={handleDelete}
                fullWidth
                style={styles.footerBtnHeight}
                accessibilityLabel={t("income.detail.delete")}
              >
                {deleting ? t("common.loading") : t("income.detail.delete")}
              </Button>
            </View>
            <View style={styles.footerBtn}>
              <Button
                variant="primary"
                onPress={handleEdit}
                fullWidth
                style={styles.footerBtnHeight}
                accessibilityLabel={t("income.detail.edit")}
              >
                {t("income.detail.edit")}
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
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Meta row */}
          <View style={styles.metaRow}>
            <View style={styles.metaCol}>
              <Text style={styles.metaLabel}>{t("income.date")}</Text>
              <Text style={styles.metaValue}>
                {loaded.transaction.transaction_date}
              </Text>
            </View>
            <View style={styles.metaCol}>
              <Text style={styles.metaLabel}>{t("income.paymentMode")}</Text>
              <Text style={styles.metaValue}>
                {loaded.transaction.payment_mode.toUpperCase()}
              </Text>
            </View>
          </View>

          <Text style={styles.timeLine}>
            {t("income.detail.billTime", {
              time: formatTime(loaded.transaction.created_at)
            })}
          </Text>

          {/* Items */}
          <View style={styles.itemsCard}>
            {loaded.items.map((item) => (
              <View key={item.id} style={styles.itemRow}>
                <View style={styles.itemLeft}>
                  <Text style={styles.itemName} numberOfLines={1}>
                    {item.service_name_snapshot}
                  </Text>
                  <View style={styles.itemMetaRow}>
                    <Text style={styles.itemMeta}>
                      {formatMoney(item.service_price_snapshot)}
                      {item.quantity > 1 ? ` × ${item.quantity}` : ""}
                    </Text>
                    {item.employee_name_snapshot ? (
                      <View style={styles.employeeChip}>
                        <Ionicons
                          name="person-outline"
                          size={11}
                          color={colors.brand.primary}
                        />
                        <Text
                          style={styles.employeeChipText}
                          numberOfLines={1}
                        >
                          {item.employee_name_snapshot}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </View>
                <Text style={styles.itemAmount}>
                  {formatMoney(item.line_amount)}
                </Text>
              </View>
            ))}

            <View style={styles.divider} />

            {/* Totals */}
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>{t("income.subtotal")}</Text>
              <Text style={styles.summaryValue}>
                {formatMoney(loaded.transaction.gross_amount)}
              </Text>
            </View>
            {loaded.transaction.discount_amount > 0 ? (
              <View style={styles.summaryRow}>
                <Text style={styles.discountLabel}>
                  {t("income.discountApplied")}
                </Text>
                <Text style={styles.discountValue}>
                  −{formatMoney(loaded.transaction.discount_amount)}
                </Text>
              </View>
            ) : null}
            {loaded.transaction.commission_amount > 0 ? (
              <View style={styles.summaryRow}>
                <Text style={styles.commissionLabel}>
                  {t("income.commission")}
                </Text>
                <Text style={styles.commissionValue}>
                  {formatMoney(loaded.transaction.commission_amount)}
                </Text>
              </View>
            ) : null}

            <View style={styles.divider} />

            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>{t("income.total")}</Text>
              <Text style={styles.totalValue}>
                {formatMoney(loaded.transaction.net_amount)}
              </Text>
            </View>
          </View>
        </ScrollView>
      )}

      {/* Off-screen ReceiptCard used only for `captureRef`. Rendered inside the
          sheet so it's still mounted while the sheet is visible. Layout is
          computed but the view is positioned off-canvas so the user never
          sees it. */}
      {loaded ? (
        <View pointerEvents="none" style={styles.receiptOffscreen}>
          <ReceiptCard
            ref={receiptRef}
            transaction={loaded.transaction}
            items={loaded.items}
            businessName={businessName}
          />
        </View>
      ) : null}
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
  timeLine: {
    ...typography.bodySmall,
    color: colors.text.muted
  },
  itemsCard: {
    backgroundColor: colors.background.subtle,
    borderRadius: radius.md,
    gap: spacing[2],
    padding: spacing[3]
  },
  itemRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing[3]
  },
  itemLeft: {
    flex: 1,
    gap: spacing[1] / 2
  },
  itemName: {
    ...typography.body,
    color: colors.text.primary
  },
  itemMetaRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[2]
  },
  itemMeta: {
    ...typography.bodySmall,
    color: colors.text.secondary
  },
  employeeChip: {
    alignItems: "center",
    backgroundColor: colors.brand.accentLight,
    borderRadius: radius.full,
    flexDirection: "row",
    gap: spacing[1],
    maxWidth: 120,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1] / 2
  },
  employeeChipText: {
    ...typography.caption,
    color: colors.brand.primary,
    fontWeight: "600"
  },
  itemAmount: {
    ...typography.bodyEmphasis,
    color: colors.text.primary
  },
  divider: {
    backgroundColor: colors.divider,
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
    color: colors.text.primary
  },
  discountLabel: {
    ...typography.bodySmall,
    color: colors.status.success
  },
  discountValue: {
    ...typography.bodySmall,
    color: colors.status.success
  },
  commissionLabel: {
    ...typography.bodySmall,
    color: colors.text.muted
  },
  commissionValue: {
    ...typography.bodySmall,
    color: colors.text.muted
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between"
  },
  totalLabel: {
    ...typography.bodyEmphasis,
    color: colors.text.primary
  },
  totalValue: {
    ...typography.h3,
    color: colors.brand.primary
  },
  footerRow: {
    flexDirection: "row",
    gap: spacing[2]
  },
  footer: {
    gap: spacing[2]
  },
  footerBtn: {
    flex: 1
  },
  footerBtnHeight: {
    minHeight: 52
  },
  receiptOffscreen: {
    left: 0,
    position: "absolute",
    top: -10000
  }
});
