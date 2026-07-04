import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, radius, shadows, spacing, typography } from "@/design-system/tokens";

type FabProps = {
  onPress: () => void;
  label?: string;
  icon?: string;
  accessibilityLabel: string;
  testID?: string;
  disabled?: boolean;
};

export function Fab({ accessibilityLabel, disabled, icon = "+", label, onPress, testID }: FabProps) {
  const extended = Boolean(label);
  return (
    <View style={styles.wrapper} pointerEvents="box-none">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={disabled ? { disabled: true } : undefined}
        testID={testID}
        onPress={onPress}
        disabled={disabled}
        style={({ pressed }) => [
          styles.fab,
          extended ? styles.extended : styles.regular,
          disabled && styles.disabled,
          pressed && !disabled && styles.pressed
        ]}
      >
        <Text style={[styles.icon, extended && styles.iconWithLabel]}>{icon}</Text>
        {extended ? <Text style={styles.label}>{label}</Text> : null}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    right: spacing[4],
    bottom: spacing[4]
  },
  fab: {
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    backgroundColor: colors.brand.primary,
    height: 56,
    borderRadius: radius.full,
    ...shadows.lg
  },
  regular: {
    width: 56
  },
  extended: {
    paddingHorizontal: spacing[5]
  },
  disabled: {
    backgroundColor: colors.interactive.disabled
  },
  pressed: {
    backgroundColor: colors.brand.primaryPressed,
    transform: [{ scale: 0.98 }]
  },
  icon: {
    color: colors.text.inverse,
    fontSize: 28,
    lineHeight: 28,
    fontWeight: "700"
  },
  iconWithLabel: {
    marginRight: spacing[2],
    fontSize: 22,
    lineHeight: 22
  },
  label: {
    ...typography.button,
    color: colors.text.inverse
  }
});
