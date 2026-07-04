import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { colors, spacing, typography } from "@/design-system/tokens";

type ListItemProps = {
  title: string;
  subtitle?: string;
  /** Left slot — avatar circle, icon, or any ReactNode. */
  leading?: ReactNode;
  /** Right slot — overrides the default chevron when provided. */
  trailing?: ReactNode;
  /**
   * Show a chevron-right when `onPress` is provided.
   * Set to false to suppress it (e.g. when you supply a custom trailing).
   */
  showChevron?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function ListItem({
  disabled = false,
  leading,
  onLongPress,
  onPress,
  showChevron = true,
  style,
  subtitle,
  testID,
  title,
  trailing
}: ListItemProps) {
  const inner = (
    <View style={[styles.container, style]}>
      {leading ? <View style={styles.leading}>{leading}</View> : null}
      <View style={styles.textBlock}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing ? (
        <View style={styles.trailing}>{trailing}</View>
      ) : onPress && showChevron ? (
        <Ionicons
          name="chevron-forward"
          size={18}
          color={colors.text.muted}
          style={styles.chevron}
        />
      ) : null}
    </View>
  );

  if (!onPress) {
    return (
      <View testID={testID} accessibilityRole="none">
        {inner}
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled}
      testID={testID}
      accessibilityRole="button"
      style={({ pressed }) => [pressed && styles.pressed]}
    >
      {inner}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    backgroundColor: colors.surface.default,
    minHeight: 64
  },
  leading: {
    marginRight: spacing[3]
  },
  textBlock: {
    flex: 1,
    gap: 2
  },
  title: {
    ...typography.body,
    color: colors.text.primary
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.text.secondary
  },
  trailing: {
    marginLeft: spacing[3]
  },
  chevron: {
    marginLeft: spacing[2]
  },
  pressed: {
    backgroundColor: colors.interactive.pressed
  }
});
