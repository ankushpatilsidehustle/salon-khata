import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, spacing, typography } from "@/design-system/tokens";

type SectionHeaderProps = {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  actionAccessibilityLabel?: string;
  trailing?: ReactNode;
};

export function SectionHeader({
  actionAccessibilityLabel,
  actionLabel,
  onAction,
  title,
  trailing
}: SectionHeaderProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      {actionLabel && onAction ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={actionAccessibilityLabel ?? actionLabel}
          onPress={onAction}
          style={({ pressed }) => [styles.actionTarget, pressed && styles.actionPressed]}
          hitSlop={12}
        >
          <Text style={styles.actionLabel}>{actionLabel}</Text>
        </Pressable>
      ) : (
        trailing ?? null
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing[5],
    marginBottom: spacing[2]
  },
  title: {
    ...typography.overline,
    color: colors.text.secondary,
    flexShrink: 1
  },
  actionTarget: {
    minHeight: 32,
    justifyContent: "center",
    paddingHorizontal: spacing[2]
  },
  actionPressed: {
    opacity: 0.7
  },
  actionLabel: {
    ...typography.bodySmall,
    fontWeight: "700",
    color: colors.brand.primary
  }
});
