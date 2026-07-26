import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { onNavigationStateChange } from "@/observability";
import { getAppPreferencesSync } from "@/session/app-preferences";
import { PhoneNumberScreen } from "./PhoneNumberScreen";
import { OtpScreen } from "./OtpScreen";
import { LanguagePickerScreen } from "./LanguagePickerScreen";
import { GettingStartedScreen } from "@/features/onboarding/getting-started/GettingStartedScreen";
import type { PhoneConfirmation } from "@/firebase/auth";

export type AuthStackParamList = {
  Language: undefined;
  GettingStarted: undefined;
  Phone: { prefillPhone?: string } | undefined;
  Otp: { e164Phone: string; confirmation: PhoneConfirmation };
};

export type AuthInitialRoute = keyof Pick<
  AuthStackParamList,
  "Language" | "GettingStarted" | "Phone"
>;

const Stack = createNativeStackNavigator<AuthStackParamList>();

export function resolveAuthInitialRoute(): AuthInitialRoute {
  const prefs = getAppPreferencesSync();
  if (!prefs.preferredLanguage) return "Language";
  if (!prefs.hasCompletedGettingStarted) return "GettingStarted";
  return "Phone";
}

export function AuthNavigator() {
  const initialRouteName = resolveAuthInitialRoute();

  return (
    <NavigationContainer onStateChange={onNavigationStateChange}>
      <Stack.Navigator
        initialRouteName={initialRouteName}
        screenOptions={{
          headerShown: false,
          animation: "slide_from_right"
        }}
      >
        <Stack.Screen name="Language" component={LanguagePickerScreen} />
        <Stack.Screen name="GettingStarted" component={GettingStartedScreen} />
        <Stack.Screen name="Phone" component={PhoneNumberScreen} />
        <Stack.Screen name="Otp" component={OtpScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
