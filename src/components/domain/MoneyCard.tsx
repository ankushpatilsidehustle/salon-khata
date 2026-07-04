import type { StyleProp, ViewStyle } from "react-native";
import { StyleSheet, Text, View } from "react-native";

import { Card } from "@/components/core/Card";
import { colors, spacing, typography } from "@/design-system/tokens";
import { formatMoney } from "@/domain/money";

type MoneyCardVariant = "hero" | "standard";

type Delta = {
  direction: "up" | "down";
  amount: number;
};

type MoneyCardProps = {
  label: string;
  amount: number;
  variant?: MoneyCardVariant;
  delta?: Delta;
  accessibilityLabel?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
};

export function MoneyCard({
  accessibilityLabel,
  amount,
  delta,
  label,
  style,
  testID,
  variant = "standard"
}: MoneyCardProps) {
  const isHero = variant === "hero";
  return (
    <Card padding={isHero ? "comfortable" : "default"} style={style}>
      <View accessible accessibilityLabel={accessibilityLabel} testID={testID}>
        <Text style={styles.label}>{label}</Text>
        <Text style={isHero ? styles.amountHero : styles.amountStandard}>{formatMoney(amount)}</Text>
        {delta ? (
          <View style={styles.deltaRow}>
            <Text
              style={[
                styles.deltaIcon,
                { color: delta.direction === "up" ? colors.status.success : colors.text.secondary }
              ]}
              accessibilityElementsHidden
              importantForAccessibility="no"
            >
              {delta.direction === "up" ? "\u2191" : "\u2193"}
            </Text>
            <Text
              style={[
                styles.deltaText,
                { color: delta.direction === "up" ? colors.status.success : colors.text.secondary }
              ]}
            >
              {formatMoney(delta.amount)}
            </Text>
          </View>
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  label: {
    ...typography.caption,
    color: colors.text.secondary,
    marginBottom: spacing[1]
  },
  amountHero: {
    ...typography.moneyHero,
    color: colors.text.primary
  },
  amountStandard: {
    ...typography.moneyMedium,
    color: colors.text.primary
  },
  deltaRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[1],
    marginTop: spacing[2]
  },
  deltaIcon: {
    ...typography.bodySmall,
    fontWeight: "700"
  },
  deltaText: {
    ...typography.bodySmall
  }
});