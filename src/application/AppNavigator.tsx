import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { BottomTabBar } from "@/components/core/BottomTabBar";
import { DashboardScreen } from "@/features/dashboard/DashboardScreen";
import { EntriesNavigator } from "@/features/entries/EntriesNavigator";
import { ExpenseEntryScreen } from "@/features/expenses/ExpenseEntryScreen";
import { IncomeEntryScreen } from "@/features/income/IncomeEntryScreen";
import { MoreScreen } from "@/features/more/MoreScreen";
import { ReportsScreen } from "@/features/reports/ReportsScreen";

// ─── types ───────────────────────────────────────────────────────────────────

/** Root modal stack — sits above the tab navigator so IncomeEntry slides up. */
export type RootStackParamList = {
  MainTabs: undefined;
  /** `transactionId` present → edit mode; absent → new bill. */
  IncomeEntry: { transactionId?: string } | undefined;
  /** `expenseId` present → edit mode; absent → new expense. */
  ExpenseEntry: { expenseId?: string } | undefined;
};

export type RootTabParamList = {
  Dashboard: undefined;
  Entries: undefined;
  Add: undefined;
  Reports: undefined;
  More: undefined;
};

// ─── navigators ──────────────────────────────────────────────────────────────

const RootStack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<RootTabParamList>();

// Placeholder for the Add tab — never actually rendered; the center button
// in BottomTabBar navigates to IncomeEntry in the root stack.
function AddPlaceholder() {
  return null;
}

function MainTabsNavigator() {
  return (
    <Tab.Navigator
      tabBar={(props) => <BottomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Entries" component={EntriesNavigator} />
      <Tab.Screen
        name="Add"
        component={AddPlaceholder}
        listeners={{
          tabPress: (e) => {
            // Prevent the tab navigator from navigating to Add.
            // BottomTabBar's center button navigates to IncomeEntry instead.
            e.preventDefault();
          }
        }}
      />
      <Tab.Screen name="Reports" component={ReportsScreen} />
      <Tab.Screen name="More" component={MoreScreen} />
    </Tab.Navigator>
  );
}

export function AppNavigator() {
  return (
    <NavigationContainer>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        <RootStack.Screen name="MainTabs" component={MainTabsNavigator} />
        <RootStack.Screen
          name="IncomeEntry"
          component={IncomeEntryScreen}
          options={{ presentation: "modal" }}
        />
        <RootStack.Screen
          name="ExpenseEntry"
          component={ExpenseEntryScreen}
          options={{ presentation: "modal" }}
        />
      </RootStack.Navigator>
    </NavigationContainer>
  );
}
