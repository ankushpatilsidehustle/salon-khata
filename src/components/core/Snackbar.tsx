import { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, radius, spacing, typography } from "@/design-system/tokens";

type SnackbarProps = {
  message: string;
  visible: boolean;
  onDismiss: () => void;
  actionLabel?: string;
  onAction?: () => void;
  /** Auto-dismiss delay in ms. Default 2500. */
  duration?: number;
  /** Where the snackbar appears. Default "top". */
  position?: "top" | "bottom";
  variant?: "default" | "error";
};

export function Snackbar({
  actionLabel,
  duration = 2500,
  message,
  onAction,
  onDismiss,
  position = "top",
  variant = "default",
  visible
}: SnackbarProps) {
  const insets = useSafeAreaInsets();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(position === "top" ? -16 : 16)).current;

  useEffect(() => {
    if (!visible) return;

    // slide in
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, speed: 22, bounciness: 3, useNativeDriver: true })
    ]).start();

    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(translateY, {
          toValue: position === "top" ? -16 : 16,
          duration: 180,
          useNativeDriver: true
        })
      ]).start(() => onDismiss());
    }, duration);

    return () => clearTimeout(timer);
  }, [visible, duration, opacity, translateY, onDismiss, position]);

  if (!visible) return null;

  const positionStyle =
    position === "top"
      ? { top: insets.top + spacing[3] }
      : { bottom: insets.bottom + spacing[4] };

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.container,
        variant === "error" ? styles.containerError : styles.containerDefault,
        positionStyle,
        { opacity, transform: [{ translateY }] }
      ]}
    >
      <Pressable
        style={styles.inner}
        onPress={onDismiss}
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
      >
        <Text style={styles.message} numberOfLines={2}>
          {message}
        </Text>
        {actionLabel && onAction ? (
          <View style={styles.actionWrap}>
            <Pressable onPress={onAction}>
              <Text style={styles.actionLabel}>{actionLabel}</Text>
            </Pressable>
          </View>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: spacing[4],
    right: spacing[4],
    zIndex: 9999,
    elevation: 10,
    borderRadius: radius.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 8
  },
  containerDefault: {
    backgroundColor: colors.text.primary
  },
  containerError: {
    backgroundColor: colors.status.danger
  },
  inner: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    gap: spacing[3]
  },
  message: {
    ...typography.bodySmall,
    color: colors.text.inverse,
    flex: 1,
    fontWeight: "600"
  },
  actionWrap: {
    paddingVertical: 2
  },
  actionLabel: {
    ...typography.bodySmall,
    color: colors.brand.accent,
    fontWeight: "700"
  }
});

