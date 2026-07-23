import { createContext, useContext } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import type { SalonType } from "@/repositories/salon-repository";
import { LanguageStep } from "./LanguageStep";
import { SalonTypeStep } from "./SalonTypeStep";
import { BusinessSetupStep } from "./BusinessSetupStep";
import { ServicesStep } from "./ServicesStep";

export type OnboardingStackParamList = {
  Language: undefined;
  SalonType: { language: string };
  BusinessSetup: { language: string; salonType: SalonType };
  Services: {
    language: string;
    salonType: SalonType;
    businessName: string;
    ownerName: string;
    alsoDoesServices: boolean;
    /** Optional referral code entered during business setup. */
    referralCode?: string;
  };
};

const Stack = createNativeStackNavigator<OnboardingStackParamList>();

/** Signals AppRoot to swap in the main navigator once onboarding is done. */
const OnboardingDoneContext = createContext<() => void>(() => {});

export function useOnboardingDone(): () => void {
  return useContext(OnboardingDoneContext);
}

type OnboardingNavigatorProps = {
  onDone: () => void;
};

export function OnboardingNavigator({ onDone }: OnboardingNavigatorProps) {
  return (
    <OnboardingDoneContext.Provider value={onDone}>
      <NavigationContainer>
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
            animation: "slide_from_right",
            gestureEnabled: false
          }}
        >
          <Stack.Screen name="Language" component={LanguageStep} />
          <Stack.Screen name="SalonType" component={SalonTypeStep} />
          <Stack.Screen name="BusinessSetup" component={BusinessSetupStep} />
          <Stack.Screen name="Services" component={ServicesStep} />
        </Stack.Navigator>
      </NavigationContainer>
    </OnboardingDoneContext.Provider>
  );
}
