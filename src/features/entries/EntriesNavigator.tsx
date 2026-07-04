import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { EntriesHubScreen } from "./EntriesScreen";
import { EmployeesScreen } from "@/features/employees/EmployeesScreen";
import { ServicesScreen } from "@/features/services/ServicesScreen";

// ─── Param list ──────────────────────────────────────────────────────────────

export type EntriesStackParamList = {
  EntriesHub: undefined;
  /** Employees add/edit is a bottom sheet, not a route. */
  Employees: undefined;
  /** Services add/edit is a bottom sheet, not a route. */
  Services: undefined;
};

// ─── Navigator ───────────────────────────────────────────────────────────────

const Stack = createNativeStackNavigator<EntriesStackParamList>();

export function EntriesNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: "slide_from_right" }}>
      <Stack.Screen name="EntriesHub" component={EntriesHubScreen} />
      <Stack.Screen name="Employees" component={EmployeesScreen} />
      <Stack.Screen name="Services" component={ServicesScreen} />
    </Stack.Navigator>
  );
}
