import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { onNavigationStateChange } from "@/observability";
import { BottomTabBar } from "@/components/core/BottomTabBar";
import { DashboardScreen } from "@/features/dashboard/DashboardScreen";
import { EntriesNavigator } from "@/features/entries/EntriesNavigator";
import { ExpenseEntryScreen } from "@/features/expenses/ExpenseEntryScreen";
import { IncomeEntryScreen } from "@/features/income/IncomeEntryScreen";
import { MoreScreen } from "@/features/more/MoreScreen";
import { ReportsScreen } from "@/features/reports/ReportsScreen";
import { CommissionSummaryScreen } from "@/features/reports/CommissionSummaryScreen";
import { EmployeeCommissionDetailScreen } from "@/features/reports/EmployeeCommissionDetailScreen";
import { TopEmployeesScreen } from "@/features/reports/TopEmployeesScreen";
import { TopServicesScreen } from "@/features/reports/TopServicesScreen";
import { AdvanceEntryScreen } from "@/features/advances/AdvanceEntryScreen";
import { AdvancesListScreen } from "@/features/advances/AdvancesListScreen";
import { SyncStatusScreen } from "@/features/sync/SyncStatusScreen";
import { SubscriptionScreen } from "@/features/subscription/SubscriptionScreen";
import { LanguageScreen } from "@/features/more/LanguageScreen";
import type { PeriodMode } from "@/domain/period";

// ─── types ───────────────────────────────────────────────────────────────────

/** Optional date-range params shared by report screens. Backwards compatible
 *  with the pre-range `date` param — screens normalize either shape. */
type ReportRangeParams = {
  /** Legacy: single YYYY-MM-DD date; treated as day range when start/end absent. */
  date?: string;
  /** Inclusive local YYYY-MM-DD. */
  start?: string;
  /** Inclusive local YYYY-MM-DD. */
  end?: string;
  mode?: PeriodMode;
};

/** Root modal stack — sits above the tab navigator so IncomeEntry slides up. */
export type RootStackParamList = {
  MainTabs: undefined;
  /** `transactionId` present → edit mode; absent → new bill. */
  IncomeEntry: { transactionId?: string } | undefined;
  /** `expenseId` present → edit mode; absent → new expense. */
  ExpenseEntry: { expenseId?: string } | undefined;
  /** `advanceId` present → edit mode; `employeeId` pre-selects the employee. */
  AdvanceEntry: { advanceId?: string; employeeId?: string } | undefined;
  /** `employeeId` filters to that employee only. */
  AdvancesList: { employeeId?: string } | undefined;
  /**
   * Per-employee commission totals. Accepts either the legacy `date` param
   * (single day) or an explicit `{ start, end, mode }` range. When all are
   * omitted, defaults to today.
   */
  CommissionSummary: ReportRangeParams | undefined;
  /** Line-item breakdown of one employee's commission for a date range. */
  EmployeeCommissionDetail: ReportRangeParams & {
    employeeId: string;
    employeeName: string;
  };
  /** Full ranked list of employees by revenue for the given period. */
  TopEmployees: ReportRangeParams | undefined;
  /** Full ranked list of services by revenue for the given period. */
  TopServices: ReportRangeParams | undefined;
  /** Observability + retry/discard UI for the per-record sync engine. */
  SyncStatus: undefined;
  /** Trial / plan status, referral code, upcoming paid plans. */
  Subscription: undefined;
  /** Switch app UI language (persisted on the salon). */
  Language: undefined;
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
    <NavigationContainer onStateChange={onNavigationStateChange}>
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
        <RootStack.Screen
          name="AdvanceEntry"
          component={AdvanceEntryScreen}
          options={{ presentation: "modal" }}
        />
        <RootStack.Screen
          name="AdvancesList"
          component={AdvancesListScreen}
        />
        <RootStack.Screen
          name="CommissionSummary"
          component={CommissionSummaryScreen}
        />
        <RootStack.Screen
          name="EmployeeCommissionDetail"
          component={EmployeeCommissionDetailScreen}
        />
        <RootStack.Screen
          name="TopEmployees"
          component={TopEmployeesScreen}
        />
        <RootStack.Screen
          name="TopServices"
          component={TopServicesScreen}
        />
        <RootStack.Screen
          name="SyncStatus"
          component={SyncStatusScreen}
        />
        <RootStack.Screen
          name="Subscription"
          component={SubscriptionScreen}
        />
        <RootStack.Screen name="Language" component={LanguageScreen} />
      </RootStack.Navigator>
    </NavigationContainer>
  );
}
