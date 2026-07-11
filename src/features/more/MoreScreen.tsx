import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";

import { AppBar } from "@/components/core/AppBar";
import { Button } from "@/components/core/Button";
import { colors, radius, spacing, typography } from "@/design-system/tokens";
import { resetAppData } from "@/database/reset";
import type { RootStackParamList } from "@/application/AppNavigator";

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function MoreScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();

  function handleReset() {
    Alert.alert(
      "Reset app data?",
      "This deletes the local database and reloads the app. Only enabled in development.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: () => {
            void resetAppData();
          }
        }
      ]
    );
  }

  return (
    <View style={styles.root}>
      <AppBar title={t("more.title")} />
      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
      >
        <Tile
          icon="wallet-outline"
          label={t("more.staffAdvances")}
          sub={t("more.staffAdvancesSub")}
          onPress={() => navigation.navigate("AdvancesList")}
        />

        {__DEV__ ? (
          <View style={styles.devSection}>
            <Text style={styles.devTitle}>Developer</Text>
            <Text style={styles.devHelper}>
              Wipe the SQLite database and reload the app. Useful for testing
              onboarding.
            </Text>
            <Button variant="destructive" onPress={handleReset} fullWidth>
              Reset app data
            </Button>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

// ─── Tile ────────────────────────────────────────────────────────────────────

function Tile({
  icon,
  label,
  onPress,
  sub
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  sub?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={styles.tileIcon}>
        <Ionicons name={icon} size={20} color={colors.brand.primary} />
      </View>
      <View style={styles.tileText}>
        <Text style={styles.tileLabel}>{label}</Text>
        {sub ? <Text style={styles.tileSub}>{sub}</Text> : null}
      </View>
      <Ionicons
        name="chevron-forward"
        size={20}
        color={colors.text.muted}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background.default
  },
  body: {
    padding: spacing[4],
    gap: spacing[3]
  },
  tile: {
    alignItems: "center",
    backgroundColor: colors.surface.default,
    borderColor: colors.border.subtle,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing[3],
    padding: spacing[3]
  },
  tilePressed: {
    backgroundColor: colors.interactive.pressed
  },
  tileIcon: {
    alignItems: "center",
    backgroundColor: colors.brand.accentLight,
    borderRadius: radius.full,
    height: 36,
    justifyContent: "center",
    width: 36
  },
  tileText: {
    flex: 1,
    gap: 2
  },
  tileLabel: {
    ...typography.body,
    color: colors.text.primary,
    fontWeight: "600"
  },
  tileSub: {
    ...typography.caption,
    color: colors.text.muted
  },
  devSection: {
    marginTop: spacing[4],
    padding: spacing[4],
    gap: spacing[2],
    backgroundColor: colors.surface.default,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.subtle
  },
  devTitle: {
    ...typography.overline,
    color: colors.text.muted
  },
  devHelper: {
    ...typography.bodySmall,
    color: colors.text.secondary,
    marginBottom: spacing[2]
  }
});
