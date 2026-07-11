import { forwardRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { colors, radius, spacing, typography } from "@/design-system/tokens";
import { formatMoney } from "@/domain/money";
import type {
  IncomeItemRecord,
  IncomeTransactionRecord
} from "@/repositories/income-repository";

export type ReceiptCardProps = {
  transaction: IncomeTransactionRecord;
  items: IncomeItemRecord[];
  businessName: string;
};

/** Fixed width — matches the pixel width used when capturing to PNG so the
 *  shared image looks identical to what the owner previews on screen. */
export const RECEIPT_CARD_WIDTH = 360;

/**
 * Pure visual receipt used for image capture (`captureRef`) and previewing.
 * Renders bill info in a clean list suited to a portrait PNG share. Kept as
 * a plain component so it can be mounted off-screen for silent capture.
 */
export const ReceiptCard = forwardRef<View, ReceiptCardProps>(
  function ReceiptCard({ businessName, items, transaction }, ref) {
    const { t } = useTranslation();

    const paymentModeLabel = t(
      `income.modes.${transaction.payment_mode}` as const,
      { defaultValue: transaction.payment_mode.toUpperCase() }
    );

    return (
      <View ref={ref} collapsable={false} style={styles.card}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.businessName} numberOfLines={1}>
            {businessName}
          </Text>
          <Text style={styles.receiptTitle}>{t("receipt.title")}</Text>
        </View>

        {/* Meta */}
        <View style={styles.metaBlock}>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>{t("receipt.date")}</Text>
            <Text style={styles.metaValue}>{transaction.transaction_date}</Text>
          </View>
          {transaction.customer_name_snapshot ? (
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>{t("receipt.customer")}</Text>
              <Text style={styles.metaValue} numberOfLines={1}>
                {transaction.customer_name_snapshot}
              </Text>
            </View>
          ) : null}
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>{t("receipt.servedBy")}</Text>
            <Text style={styles.metaValue} numberOfLines={1}>
              {transaction.employee_name_snapshot}
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Items */}
        <View style={styles.items}>
          <View style={styles.itemsHeader}>
            <Text style={[styles.itemHeadCol, styles.itemHeadService]}>
              {t("receipt.service")}
            </Text>
            <Text style={[styles.itemHeadCol, styles.itemHeadQty]}>
              {t("receipt.qty")}
            </Text>
            <Text style={[styles.itemHeadCol, styles.itemHeadAmount]}>
              {t("receipt.amount")}
            </Text>
          </View>

          {items.map((item) => (
            <View key={item.id} style={styles.itemRow}>
              <Text style={[styles.itemCol, styles.itemName]} numberOfLines={2}>
                {item.service_name_snapshot}
              </Text>
              <Text style={[styles.itemCol, styles.itemQty]}>
                {item.quantity}
              </Text>
              <Text style={[styles.itemCol, styles.itemAmount]}>
                {formatMoney(item.line_amount)}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.divider} />

        {/* Totals */}
        <View style={styles.totals}>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>{t("receipt.subtotal")}</Text>
            <Text style={styles.totalsValue}>
              {formatMoney(transaction.gross_amount)}
            </Text>
          </View>
          {transaction.discount_amount > 0 ? (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>{t("receipt.discount")}</Text>
              <Text style={styles.totalsValue}>
                −{formatMoney(transaction.discount_amount)}
              </Text>
            </View>
          ) : null}
          <View style={styles.grandRow}>
            <Text style={styles.grandLabel}>{t("receipt.total")}</Text>
            <Text style={styles.grandValue}>
              {formatMoney(transaction.net_amount)}
            </Text>
          </View>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>{t("receipt.paidBy")}</Text>
            <Text style={styles.totalsValue}>{paymentModeLabel}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <Text style={styles.thankYou}>{t("receipt.thankYou")}</Text>
      </View>
    );
  }
);
ReceiptCard.displayName = "ReceiptCard";

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface.default,
    borderRadius: radius.md,
    padding: spacing[4],
    width: RECEIPT_CARD_WIDTH,
    gap: spacing[3]
  },
  header: {
    alignItems: "center",
    gap: spacing[1]
  },
  businessName: {
    ...typography.h3,
    color: colors.brand.primary,
    textAlign: "center"
  },
  receiptTitle: {
    ...typography.overline,
    color: colors.text.muted
  },
  metaBlock: {
    gap: spacing[1]
  },
  metaRow: {
    flexDirection: "row",
    gap: spacing[3],
    justifyContent: "space-between"
  },
  metaLabel: {
    ...typography.bodySmall,
    color: colors.text.muted
  },
  metaValue: {
    ...typography.bodySmall,
    color: colors.text.primary,
    flexShrink: 1,
    fontWeight: "600",
    textAlign: "right"
  },
  divider: {
    backgroundColor: colors.divider,
    height: StyleSheet.hairlineWidth
  },
  items: {
    gap: spacing[2]
  },
  itemsHeader: {
    flexDirection: "row"
  },
  itemHeadCol: {
    ...typography.caption,
    color: colors.text.muted,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase"
  },
  itemHeadService: {
    flex: 1
  },
  itemHeadQty: {
    textAlign: "center",
    width: 40
  },
  itemHeadAmount: {
    textAlign: "right",
    width: 90
  },
  itemRow: {
    alignItems: "center",
    flexDirection: "row"
  },
  itemCol: {
    ...typography.bodySmall,
    color: colors.text.primary
  },
  itemName: {
    flex: 1,
    paddingRight: spacing[2]
  },
  itemQty: {
    textAlign: "center",
    width: 40
  },
  itemAmount: {
    ...typography.moneyBody,
    textAlign: "right",
    width: 90
  },
  totals: {
    gap: spacing[1]
  },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between"
  },
  totalsLabel: {
    ...typography.bodySmall,
    color: colors.text.secondary
  },
  totalsValue: {
    ...typography.bodySmall,
    color: colors.text.primary
  },
  grandRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing[1]
  },
  grandLabel: {
    ...typography.bodyEmphasis,
    color: colors.text.primary
  },
  grandValue: {
    ...typography.h3,
    color: colors.brand.primary
  },
  thankYou: {
    ...typography.bodySmall,
    color: colors.text.muted,
    fontStyle: "italic",
    textAlign: "center"
  }
});
