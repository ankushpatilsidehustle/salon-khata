import type { PropsWithChildren } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { StyleSheet, View } from "react-native";

import { colors, radius, shadows, spacing } from "@/design-system/tokens";

type CardPadding = "compact" | "default" | "comfortable";

type CardProps = PropsWithChildren<{
  padding?: CardPadding;
  style?: StyleProp<ViewStyle>;
}>;

export function Card({ children, padding = "default", style }: CardProps) {
  return <View style={[styles.card, paddingStyle[padding], style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface.default,
    borderRadius: radius.md,
    ...shadows.sm
  }
});

const paddingStyle = StyleSheet.create({
  compact: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3]
  },
  default: {
    padding: spacing[4]
  },
  comfortable: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[5]
  }
});