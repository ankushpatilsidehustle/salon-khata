import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, spacing, typography } from "@/design-system/tokens";

/** `default` — neutral canvas background; `brand` — primary purple header. */
export type AppBarVariant = "default" | "brand";

type AppBarProps = {
  title: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  /** Controls background + title color. Defaults to `"default"`. */
  variant?: AppBarVariant;
};

const variantConfig: Record<AppBarVariant, { bg: string; titleColor: string }> = {
  default: {
    bg: colors.background.default,
    titleColor: colors.text.primary
  },
  brand: {
    bg: colors.brand.primary,
    titleColor: colors.text.inverse
  }
};

export function AppBar({ leading, title, trailing, variant = "default" }: AppBarProps) {
  const insets = useSafeAreaInsets();
  const vc = variantConfig[variant];
  return (
    // Outer view fills behind the status bar with the correct background color.
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: vc.bg }]}>
      {/* Inner row has a fixed 56 dp height — independent of the top inset. */}
      <View style={styles.row}>
        <View style={styles.side}>{leading ?? null}</View>
        <Text style={styles.title} accessibilityRole="header" numberOfLines={1}>
          {title}
        </Text>
        <View style={[styles.side, styles.trailing]}>{trailing ?? null}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    // backgroundColor is set dynamically via variantConfig.
    paddingHorizontal: spacing[4]
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    height: 56
  },
  side: {
    minWidth: 48,
    alignItems: "flex-start",
    justifyContent: "center"
  },
  trailing: {
    alignItems: "flex-end"
  },
  title: {
    ...typography.h2,
    color: colors.text.primary,
    flex: 1,
    marginHorizontal: spacing[3]
  }
});
