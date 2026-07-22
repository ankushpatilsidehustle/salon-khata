import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, spacing, typography } from "@/design-system/tokens";

/**
 * Shared screen header for the whole app.
 * Title uses H2 (20/28/700) per design-system. Prefer `default` on all
 * primary screens so headers look identical across tabs and stacks.
 */
export type AppBarVariant = "default" | "brand";

type AppBarProps = {
  title: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  /** Controls background + title color. Defaults to `"default"`. */
  variant?: AppBarVariant;
};

const variantConfig: Record<
  AppBarVariant,
  { bg: string; titleColor: string; borderColor: string }
> = {
  default: {
    bg: colors.background.default,
    titleColor: colors.text.primary,
    borderColor: colors.border.subtle
  },
  brand: {
    bg: colors.brand.primary,
    titleColor: colors.text.inverse,
    borderColor: colors.brand.primaryPressed
  }
};

export function AppBar({
  leading,
  title,
  trailing,
  variant = "default"
}: AppBarProps) {
  const insets = useSafeAreaInsets();
  const vc = variantConfig[variant];
  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: insets.top,
          backgroundColor: vc.bg,
          borderBottomColor: vc.borderColor
        }
      ]}
    >
      <View style={styles.row}>
        <View style={styles.side}>{leading ?? null}</View>
        <Text
          style={[styles.title, { color: vc.titleColor }]}
          accessibilityRole="header"
          numberOfLines={1}
        >
          {title}
        </Text>
        <View style={[styles.side, styles.trailing]}>{trailing ?? null}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing[4],
    borderBottomWidth: StyleSheet.hairlineWidth
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
    flex: 1,
    marginHorizontal: spacing[3]
  }
});
