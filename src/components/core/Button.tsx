import type { PropsWithChildren } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { Pressable, StyleSheet, Text } from "react-native";

import { colors, radius, spacing, typography } from "@/design-system/tokens";

type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive";

type ButtonProps = PropsWithChildren<{
  onPress: () => void;
  variant?: ButtonVariant;
  fullWidth?: boolean;
  accessibilityLabel?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}>;

export function Button({
  accessibilityLabel,
  children,
  fullWidth = false,
  onPress,
  style,
  testID,
  variant = "primary"
}: ButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variantContainerStyle[variant],
        fullWidth && styles.fullWidth,
        pressed && styles.pressed,
        style
      ]}
    >
      <Text style={[styles.label, variantLabelStyle[variant]]}>{children}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    borderRadius: radius.md,
    justifyContent: "center",
    paddingHorizontal: spacing[4]
  },
  fullWidth: {
    alignSelf: "stretch"
  },
  pressed: {
    opacity: 0.86
  },
  label: {
    ...typography.button
  }
});

const variantContainerStyle = StyleSheet.create({
  primary: {
    backgroundColor: colors.brand.primary,
    minHeight: 52
  },
  secondary: {
    backgroundColor: colors.surface.default,
    borderColor: colors.border.subtle,
    borderWidth: 1,
    minHeight: 44
  },
  ghost: {
    backgroundColor: "transparent",
    minHeight: 44
  },
  destructive: {
    backgroundColor: colors.status.danger,
    minHeight: 52
  }
});

const variantLabelStyle = StyleSheet.create({
  primary: {
    color: colors.text.inverse
  },
  secondary: {
    color: colors.text.primary
  },
  ghost: {
    color: colors.brand.primary
  },
  destructive: {
    color: colors.text.inverse
  }
});