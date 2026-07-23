import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { onNavigationStateChange } from "@/observability";
import { PhoneNumberScreen } from "./PhoneNumberScreen";
import { OtpScreen } from "./OtpScreen";
import type { PhoneConfirmation } from "@/firebase/auth";

export type AuthStackParamList = {
  Phone: { prefillPhone?: string } | undefined;
  Otp: { e164Phone: string; confirmation: PhoneConfirmation };
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

export function AuthNavigator() {
  return (
    <NavigationContainer onStateChange={onNavigationStateChange}>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          animation: "slide_from_right"
        }}
      >
        <Stack.Screen name="Phone" component={PhoneNumberScreen} />
        <Stack.Screen name="Otp" component={OtpScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
