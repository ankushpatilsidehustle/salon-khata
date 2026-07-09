import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, spacing, typography } from "@/design-system/tokens";

type StepHeaderProps = {
  currentStep: number;
  totalSteps: number;
  onBack?: () => void;
};

/**
 * Compact top-of-screen indicator for the onboarding wizard. Shows an optional
 * back chevron, a "Step X of Y" label, and a segmented progress bar.
 */
export function StepHeader({ currentStep, totalSteps, onBack }: StepHeaderProps) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing[2] }]}>
      <View style={styles.row}>
        {onBack ? (
          <Pressable
            onPress={onBack}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t("onboarding.back")}
            style={styles.backBtn}
          >
            <Ionicons name="chevron-back" size={22} color={colors.text.primary} />
          </Pressable>
        ) : (
          <View style={styles.backBtn} />
        )}
        <Text style={styles.stepLabel}>
          {t("onboarding.step", { current: currentStep, total: totalSteps })}
        </Text>
        <View style={styles.backBtn} />
      </View>

      <View style={styles.progressTrack}>
        {Array.from({ length: totalSteps }).map((_, idx) => (
          <View
            key={idx}
            style={[
              styles.progressSegment,
              idx < currentStep && styles.progressSegmentDone
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[3],
    backgroundColor: colors.background.default
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  backBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center"
  },
  stepLabel: {
    ...typography.caption,
    color: colors.text.secondary,
    fontWeight: "600"
  },
  progressTrack: {
    marginTop: spacing[2],
    flexDirection: "row",
    gap: spacing[1]
  },
  progressSegment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border.subtle
  },
  progressSegmentDone: {
    backgroundColor: colors.brand.primary
  }
});
