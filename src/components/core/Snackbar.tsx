import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, radius, spacing, typography } from "@/design-system/tokens";

type SnackbarProps = {
  message: string;
  visible: boolean;
  onDismiss: () => void;
  actionLabel?: string;
  onAction?: () => void;
  /** Auto-dismiss delay in ms. Default 3000. */
  duration?: number;
};

export function Snackbar({
  actionLabel,
  duration = 3000,
  message,
  onAction,
  onDismiss,
  visible
}: SnackbarProps) {
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(onDismiss, duration);
    return () => clearTimeout(timer);
  }, [visible, duration, onDismiss]);

  if (!visible) return null;

  return (
    <Pressable
      onPress={onDismiss}
      style={[styles.container, { bottom: insets.bottom + spacing[4] }]}
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
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: spacing[4],
    right: spacing[4],
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.text.primary,
    borderRadius: radius.md,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    gap: spacing[3],
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 8
  },
  message: {
    ...typography.bodySmall,
    color: colors.text.inverse,
    flex: 1
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
