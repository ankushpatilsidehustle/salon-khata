// EntriesScreen re-exports as EntriesHubScreen — the landing page of the
// Entries stack navigator. Four tiles: Employees, Services, Commission (locked),
// Expenses (locked).

import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";

import { AppBar } from "@/components/core/AppBar";
import { colors, radius, shadows, spacing, typography } from "@/design-system/tokens";
import type { EntriesStackParamList } from "./EntriesNavigator";

type Props = NativeStackScreenProps<EntriesStackParamList, "EntriesHub">;

type Tile = {
  label: string;
  sub: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  iconBg: string;
  onPress: () => void;
  locked: boolean;
};

export function EntriesHubScreen({ navigation }: Props) {
  const { t } = useTranslation();

  const tiles: Tile[] = [
    {
      label: t("employees.title"),
      sub: t("entries.hub.employees.sub"),
      icon: "people",
      iconColor: colors.brand.primary,
      iconBg: "rgba(103,57,183,0.10)",
      onPress: () => navigation.navigate("Employees"),
      locked: false
    },
    {
      label: t("services.title"),
      sub: t("entries.hub.services.sub"),
      icon: "cut",
      iconColor: colors.status.info,
      iconBg: "rgba(37,99,235,0.10)",
      onPress: () => navigation.navigate("Services"),
      locked: false
    },
    {
      label: t("entries.hub.commission.label"),
      sub: t("entries.hub.commission.sub"),
      icon: "cash-outline",
      iconColor: colors.status.success,
      iconBg: "rgba(21,131,62,0.10)",
      onPress: () => navigation.navigate("Employees"),
      locked: false
    },
    {
      label: t("entries.hub.expenses.label"),
      sub: t("entries.hub.expenses.sub"),
      icon: "wallet-outline",
      iconColor: colors.status.warning,
      iconBg: "rgba(245,158,11,0.10)",
      onPress: () => {},
      locked: true
    }
  ];

  return (
    <View style={styles.root}>
      <AppBar title={t("entries.title")} />
      <ScrollView
        contentContainerStyle={styles.grid}
        showsVerticalScrollIndicator={false}
      >
        {tiles.map((tile) => (
          <Pressable
            key={tile.label}
            style={({ pressed }) => [
              styles.tile,
              tile.locked && styles.tileLocked,
              pressed && !tile.locked && styles.tilePressed
            ]}
            onPress={tile.locked ? undefined : tile.onPress}
            disabled={tile.locked}
            accessibilityRole="button"
            accessibilityLabel={tile.label}
            accessibilityState={{ disabled: tile.locked }}
          >
            <View style={[styles.iconCircle, { backgroundColor: tile.iconBg }]}>
              <Ionicons
                name={tile.icon}
                size={28}
                color={tile.locked ? colors.text.muted : tile.iconColor}
              />
            </View>
            <Text
              style={[styles.tileLabel, tile.locked && styles.tileLabelMuted]}
            >
              {tile.label}
            </Text>
            <Text style={styles.tileSub}>{tile.sub}</Text>
            {tile.locked ? (
              <View style={styles.lockBadge}>
                <Ionicons name="lock-closed" size={10} color={colors.text.inverse} />
              </View>
            ) : null}
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background.default
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    padding: spacing[3],
    gap: spacing[3]
  },
  tile: {
    width: "47%",
    backgroundColor: colors.surface.default,
    borderRadius: radius.lg,
    padding: spacing[4],
    gap: spacing[2],
    ...shadows.sm
  },
  tileLocked: {
    opacity: 0.55
  },
  tilePressed: {
    backgroundColor: colors.surface.raised
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing[1]
  },
  tileLabel: {
    ...typography.bodyEmphasis,
    color: colors.text.primary
  },
  tileLabelMuted: {
    color: colors.text.secondary
  },
  tileSub: {
    ...typography.caption,
    color: colors.text.muted
  },
  lockBadge: {
    position: "absolute",
    top: spacing[3],
    right: spacing[3],
    width: 18,
    height: 18,
    borderRadius: radius.full,
    backgroundColor: colors.text.muted,
    alignItems: "center",
    justifyContent: "center"
  }
});

