import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, spacing, typography } from "@/design-system/tokens";

// ─── constants ───────────────────────────────────────────────────────────────
const BAR_HEIGHT = 64;
const CENTER_SIZE = 52; // fits inside the bar height

// ─── tab definitions ─────────────────────────────────────────────────────────
// Route order: Dashboard(0) Entries(1) Add(2) Reports(3) More(4)

type TabDef = {
  routeIndex: number;
  label: string;
  iconFilled: React.ComponentProps<typeof Ionicons>["name"];
  iconOutline: React.ComponentProps<typeof Ionicons>["name"];
};

const LEFT_TABS: TabDef[] = [
  {
    routeIndex: 0,
    label: "Dashboard",
    iconFilled: "home",
    iconOutline: "home-outline"
  },
  {
    routeIndex: 1,
    label: "Manage",
    iconFilled: "layers",
    iconOutline: "layers-outline"
  }
];

const RIGHT_TABS: TabDef[] = [
  {
    routeIndex: 3,
    label: "Reports",
    iconFilled: "bar-chart",
    iconOutline: "bar-chart-outline"
  },
  {
    routeIndex: 4,
    label: "More",
    iconFilled: "ellipsis-horizontal-circle",
    iconOutline: "ellipsis-horizontal-circle-outline"
  }
];

// ─── component ───────────────────────────────────────────────────────────────

export function BottomTabBar({ navigation, state }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  function pressTab(routeIndex: number) {
    const route = state.routes[routeIndex];
    const isFocused = state.index === routeIndex;
    const event = navigation.emit({
      type: "tabPress",
      target: route.key,
      canPreventDefault: true
    });
    if (!isFocused && !event.defaultPrevented) {
      navigation.navigate(route.name as never);
    }
  }

  function renderTab(tab: TabDef) {
    const active = state.index === tab.routeIndex;
    return (
      <Pressable
        key={tab.routeIndex}
        accessibilityRole="tab"
        accessibilityLabel={`${tab.label} tab`}
        accessibilityState={{ selected: active }}
        onPress={() => pressTab(tab.routeIndex)}
        style={({ pressed }) => [styles.tabItem, pressed && styles.tabItemPressed]}
      >
        <Ionicons
          name={active ? tab.iconFilled : tab.iconOutline}
          size={24}
          color={active ? colors.brand.accent : colors.text.secondary}
        />
        <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
          {tab.label}
        </Text>
      </Pressable>
    );
  }

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <View style={styles.tabRow}>
        {LEFT_TABS.map(renderTab)}

        {/* Center Add button — navigates to IncomeEntry modal in the root stack */}
        <View style={styles.centerSlot}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Record a bill"
            testID="nav-center-add"
            onPress={() => {
              // Navigate up to the root stack's IncomeEntry modal.
              // React Navigation v6 bubbles navigate() up the tree automatically.
              navigation.navigate("IncomeEntry" as never);
            }}
            style={({ pressed }) => [
              styles.centerButton,
              pressed && styles.centerButtonPressed
            ]}
          >
            <Ionicons name="add" size={30} color={colors.text.inverse} />
          </Pressable>
        </View>

        {RIGHT_TABS.map(renderTab)}
      </View>
    </View>
  );
}

// ─── styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface.default
  },
  tabRow: {
    height: BAR_HEIGHT,
    flexDirection: "row",
    alignItems: "center"
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    gap: spacing[1]
  },
  tabItemPressed: {
    opacity: 0.7
  },
  tabLabel: {
    ...typography.overline,
    textTransform: "none",
    color: colors.text.secondary
  },
  tabLabelActive: {
    ...typography.overline,
    textTransform: "none",
    color: colors.brand.accent
  },
  centerSlot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  centerButton: {
    width: CENTER_SIZE,
    height: CENTER_SIZE,
    borderRadius: CENTER_SIZE / 2,
    backgroundColor: colors.brand.primary,
    alignItems: "center",
    justifyContent: "center"
  },
  centerButtonPressed: {
    backgroundColor: colors.brand.primaryPressed,
    transform: [{ scale: 0.95 }]
  }
});
