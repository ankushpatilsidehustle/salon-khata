import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { colors, radius, spacing } from "@/design-system/tokens";

type IllustrationProps = {
  size?: number;
};

function Stage({ size = 220, children }: IllustrationProps & { children: ReactNode }) {
  return (
    <View style={[styles.stage, { width: size, height: size }]}>
      <View style={styles.glow} />
      {children}
    </View>
  );
}

/** Slide 1 — daily khata / bookkeeping overview */
export function IllustrationKhata({ size }: IllustrationProps) {
  return (
    <Stage size={size}>
      <View style={styles.book}>
        <View style={styles.bookSpine} />
        <View style={styles.bookPage}>
          <View style={[styles.rule, { width: "70%" }]} />
          <View style={[styles.rule, { width: "88%" }]} />
          <View style={[styles.ruleAccent, { width: "55%" }]} />
          <View style={[styles.rule, { width: "78%" }]} />
        </View>
      </View>
      <View style={[styles.floatBadge, styles.badgeTopRight]}>
        <Ionicons name="cut" size={18} color={colors.brand.primary} />
      </View>
      <View style={[styles.floatBadge, styles.badgeBottomLeft]}>
        <Ionicons name="cash-outline" size={18} color={colors.status.success} />
      </View>
    </Stage>
  );
}

/** Slide 2 — offline income / expenses / commission */
export function IllustrationOfflineBenefits({ size }: IllustrationProps) {
  return (
    <Stage size={size}>
      <View style={styles.phone}>
        <View style={styles.phoneNotch} />
        <View style={styles.metricCard}>
          <View style={[styles.metricBar, { backgroundColor: colors.status.success }]} />
          <View style={styles.metricLines}>
            <View style={[styles.rule, { width: "60%" }]} />
            <View style={[styles.rule, { width: "40%" }]} />
          </View>
        </View>
        <View style={styles.metricRow}>
          <View style={[styles.miniCard, { backgroundColor: colors.status.dangerBg }]}>
            <Ionicons name="arrow-down" size={14} color={colors.status.danger} />
          </View>
          <View style={[styles.miniCard, { backgroundColor: colors.status.warningBg }]}>
            <Ionicons name="people-outline" size={14} color={colors.status.warning} />
          </View>
        </View>
      </View>
      <View style={[styles.floatBadge, styles.badgeTopLeft]}>
        <Ionicons name="cloud-offline-outline" size={18} color={colors.brand.secondary} />
      </View>
    </Stage>
  );
}

/** Slide 3 — key features: bills, staff, reports */
export function IllustrationFeatures({ size }: IllustrationProps) {
  return (
    <Stage size={size}>
      <View style={styles.featureGrid}>
        <View style={[styles.featureTile, { backgroundColor: colors.brand.accentLight }]}>
          <Ionicons name="receipt-outline" size={28} color={colors.brand.primary} />
        </View>
        <View style={[styles.featureTile, { backgroundColor: colors.status.infoBg }]}>
          <Ionicons name="person-outline" size={28} color={colors.status.info} />
        </View>
        <View style={[styles.featureTile, { backgroundColor: colors.status.successBg }]}>
          <Ionicons name="bar-chart-outline" size={28} color={colors.status.success} />
        </View>
        <View style={[styles.featureTile, { backgroundColor: colors.status.warningBg }]}>
          <Ionicons name="wallet-outline" size={28} color={colors.status.warning} />
        </View>
      </View>
    </Stage>
  );
}

/** Slide 4 — simple for small salon owners */
export function IllustrationGetStarted({ size }: IllustrationProps) {
  return (
    <Stage size={size}>
      <View style={styles.heroCircle}>
        <Ionicons name="storefront-outline" size={56} color={colors.brand.primary} />
      </View>
      <View style={[styles.floatBadge, styles.badgeTopRight]}>
        <Ionicons name="flash" size={16} color={colors.status.warning} />
      </View>
      <View style={[styles.floatBadge, styles.badgeBottomRight]}>
        <Ionicons name="checkmark-circle" size={20} color={colors.status.success} />
      </View>
      <View style={[styles.floatBadge, styles.badgeBottomLeft]}>
        <Ionicons name="phone-portrait-outline" size={16} color={colors.brand.secondary} />
      </View>
    </Stage>
  );
}

const styles = StyleSheet.create({
  stage: {
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center"
  },
  glow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 999,
    backgroundColor: colors.brand.accentLight,
    opacity: 0.45,
    transform: [{ scale: 0.92 }]
  },
  book: {
    width: "58%",
    height: "64%",
    borderRadius: radius.lg,
    backgroundColor: colors.surface.default,
    flexDirection: "row",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border.subtle,
    elevation: 2,
    shadowColor: colors.brand.secondary,
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 }
  },
  bookSpine: {
    width: "12%",
    backgroundColor: colors.brand.primary
  },
  bookPage: {
    flex: 1,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[4],
    justifyContent: "space-evenly",
    backgroundColor: colors.surface.raised
  },
  rule: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border.subtle
  },
  ruleAccent: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.brand.accent
  },
  floatBadge: {
    position: "absolute",
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface.default,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border.subtle,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 }
  },
  badgeTopRight: { top: "12%", right: "8%" },
  badgeTopLeft: { top: "14%", left: "8%" },
  badgeBottomLeft: { bottom: "14%", left: "10%" },
  badgeBottomRight: { bottom: "16%", right: "10%" },
  phone: {
    width: "46%",
    height: "72%",
    borderRadius: 28,
    backgroundColor: colors.brand.secondary,
    padding: spacing[2],
    justifyContent: "flex-start",
    gap: spacing[2]
  },
  phoneNotch: {
    alignSelf: "center",
    width: "36%",
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.brand.accent,
    marginBottom: spacing[2]
  },
  metricCard: {
    backgroundColor: colors.surface.default,
    borderRadius: radius.md,
    padding: spacing[3],
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2]
  },
  metricBar: {
    width: 6,
    height: 36,
    borderRadius: 3
  },
  metricLines: {
    flex: 1,
    gap: 6
  },
  metricRow: {
    flexDirection: "row",
    gap: spacing[2]
  },
  miniCard: {
    flex: 1,
    height: 44,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center"
  },
  featureGrid: {
    width: "72%",
    aspectRatio: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[3],
    justifyContent: "center"
  },
  featureTile: {
    width: "44%",
    aspectRatio: 1,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center"
  },
  heroCircle: {
    width: "58%",
    aspectRatio: 1,
    borderRadius: 999,
    backgroundColor: colors.surface.default,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border.subtle
  }
});
