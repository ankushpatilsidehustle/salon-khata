import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { colors, radius, spacing, typography } from "@/design-system/tokens";

type AppLogoProps = {
  /** Icon box size in dp. */
  size?: number;
  /** Show the wordmark beside / below the mark. */
  showWordmark?: boolean;
  /** Layout when wordmark is shown. */
  layout?: "horizontal" | "vertical";
  /** Optional override for the wordmark string (already translated). */
  wordmark?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * In-app brand mark — ledger card + scissors motif in brand purple.
 * Used on splash, language, getting-started, and login screens.
 */
export function AppLogo({
  size = 56,
  showWordmark = false,
  layout = "horizontal",
  wordmark = "Salon Khata",
  style
}: AppLogoProps) {
  const iconSize = Math.round(size * 0.42);
  const badgeSize = Math.round(size * 0.36);

  return (
    <View
      style={[
        styles.root,
        layout === "vertical" ? styles.vertical : styles.horizontal,
        style
      ]}
      accessibilityRole="image"
      accessibilityLabel={wordmark}
    >
      <View style={[styles.mark, { width: size, height: size, borderRadius: size * 0.22 }]}>
        <View style={styles.card}>
          <View style={[styles.line, styles.lineMuted]} />
          <View style={[styles.line, styles.lineAccent]} />
          <View style={[styles.line, styles.lineMuted]} />
        </View>
        <View
          style={[
            styles.badge,
            {
              width: badgeSize,
              height: badgeSize,
              borderRadius: badgeSize / 2,
              bottom: size * 0.08,
              right: size * 0.08
            }
          ]}
        >
          <Ionicons name="cut" size={iconSize * 0.55} color={colors.text.inverse} />
        </View>
      </View>
      {showWordmark ? (
        <Text
          style={[
            styles.wordmark,
            layout === "vertical" && styles.wordmarkCentered,
            { fontSize: Math.max(18, Math.round(size * 0.36)) }
          ]}
        >
          {wordmark}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: "center"
  },
  horizontal: {
    flexDirection: "row",
    gap: spacing[3]
  },
  vertical: {
    flexDirection: "column",
    gap: spacing[3]
  },
  mark: {
    backgroundColor: colors.brand.primary,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden"
  },
  card: {
    width: "58%",
    height: "52%",
    marginTop: -4,
    backgroundColor: colors.surface.default,
    borderRadius: radius.sm,
    paddingHorizontal: "12%",
    paddingVertical: "14%",
    justifyContent: "space-between"
  },
  line: {
    height: 3,
    borderRadius: 2,
    width: "100%"
  },
  lineMuted: {
    backgroundColor: colors.brand.accentLight
  },
  lineAccent: {
    backgroundColor: colors.brand.primary
  },
  badge: {
    position: "absolute",
    backgroundColor: colors.brand.secondary,
    alignItems: "center",
    justifyContent: "center"
  },
  wordmark: {
    ...typography.h2,
    color: colors.brand.primary,
    fontWeight: "700"
  },
  wordmarkCentered: {
    textAlign: "center"
  }
});
