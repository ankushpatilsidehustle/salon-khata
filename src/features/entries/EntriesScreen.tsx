// EntriesScreen re-exports as EntriesHubScreen — the landing page of the
// Manage stack navigator. Four tiles: Employees, Services, Customers,
// Commission (opens CommissionSummary in the root stack).

import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { NativeStackScreenProps, NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import { AppBar } from "@/components/core/AppBar";
import { colors, radius, shadows, spacing, typography } from "@/design-system/tokens";
import type { EntriesStackParamList } from "./EntriesNavigator";
import type { RootStackParamList } from "@/application/AppNavigator";

type Props = NativeStackScreenProps<EntriesStackParamList, "EntriesHub">;

type Tile = {
  label: string;
  sub: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  iconBg: string;
  onPress: () => void;
};

export function EntriesHubScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const rootNavigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const tiles: Tile[] = [
    {
      label: t("employees.title"),
      sub: t("entries.hub.employees.sub"),
      icon: "people",
      iconColor: colors.brand.primary,
      iconBg: "rgba(103,57,183,0.10)",
      onPress: () => navigation.navigate("Employees")
    },
    {
      label: t("services.title"),
      sub: t("entries.hub.services.sub"),
      icon: "cut",
      iconColor: colors.status.info,
      iconBg: "rgba(37,99,235,0.10)",
      onPress: () => navigation.navigate("Services")
    },
    {
      label: t("entries.hub.customers.label"),
      sub: t("entries.hub.customers.sub"),
      icon: "person-circle-outline",
      iconColor: colors.brand.accent,
      iconBg: "rgba(153,103,209,0.14)",
      onPress: () => navigation.navigate("Customers")
    },
    {
      label: t("entries.hub.commission.label"),
      sub: t("entries.hub.commission.sub"),
      icon: "cash-outline",
      iconColor: colors.status.success,
      iconBg: "rgba(21,131,62,0.10)",
      onPress: () => rootNavigation.navigate("CommissionSummary")
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
              pressed && styles.tilePressed
            ]}
            onPress={tile.onPress}
            accessibilityRole="button"
            accessibilityLabel={tile.label}
          >
            <View style={[styles.iconCircle, { backgroundColor: tile.iconBg }]}>
              <Ionicons name={tile.icon} size={28} color={tile.iconColor} />
            </View>
            <Text style={styles.tileLabel}>{tile.label}</Text>
            <Text style={styles.tileSub}>{tile.sub}</Text>
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
  tileSub: {
    ...typography.caption,
    color: colors.text.muted
  }
});
