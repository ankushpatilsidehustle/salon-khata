import { StyleSheet, Text, View } from "react-native";

import { colors, spacing, typography } from "@/design-system/tokens";

import { Button } from "./Button";

type EmptyStateProps = {
  icon?: string;
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
  testID?: string;
};

export function EmptyState({
  actionLabel,
  body,
  icon,
  onAction,
  testID,
  title
}: EmptyStateProps) {
  return (
    <View style={styles.container} testID={testID} accessibilityRole="summary">
      {icon ? (
        <Text style={styles.icon} accessibilityElementsHidden importantForAccessibility="no">
          {icon}
        </Text>
      ) : null}
      <Text style={styles.title}>{title}</Text>
      {body ? <Text style={styles.body}>{body}</Text> : null}
      {actionLabel && onAction ? (
        <View style={styles.action}>
          <Button variant="secondary" onPress={onAction}>
            {actionLabel}
          </Button>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    gap: spacing[2],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[7]
  },
  icon: {
    fontSize: 40,
    lineHeight: 48,
    color: colors.text.muted,
    marginBottom: spacing[2]
  },
  title: {
    ...typography.h2,
    color: colors.text.primary,
    textAlign: "center"
  },
  body: {
    ...typography.body,
    color: colors.text.secondary,
    textAlign: "center"
  },
  action: {
    marginTop: spacing[4]
  }
});
