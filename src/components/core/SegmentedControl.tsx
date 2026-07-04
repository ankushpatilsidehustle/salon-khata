import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, radius, spacing, typography } from "@/design-system/tokens";

type Option<T extends string> = {
  label: string;
  value: T;
};

type SegmentedControlProps<T extends string> = {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  testID?: string;
};

export function SegmentedControl<T extends string>({
  onChange,
  options,
  testID,
  value
}: SegmentedControlProps<T>) {
  return (
    <View style={styles.track} testID={testID} accessibilityRole="tablist">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            style={[styles.segment, active && styles.segmentActive]}
            onPress={() => onChange(opt.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.label, active && styles.labelActive]}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: "row",
    backgroundColor: colors.surface.sunken,
    borderRadius: radius.md,
    padding: 3,
    gap: 3
  },
  segment: {
    flex: 1,
    paddingVertical: spacing[1] + 2,
    alignItems: "center",
    borderRadius: radius.sm
  },
  segmentActive: {
    backgroundColor: colors.surface.default,
    // Subtle lifted shadow on the active pill
    shadowColor: colors.brand.primary,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2
  },
  label: {
    ...typography.bodySmall,
    fontWeight: "500",
    color: colors.text.secondary
  },
  labelActive: {
    color: colors.brand.primary,
    fontWeight: "700"
  }
});
