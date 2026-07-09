import { useCallback, useEffect, useState } from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import "@/i18n";
import { i18n } from "@/i18n";
import { SnackbarProvider } from "@/components/core/SnackbarProvider";
import { colors, spacing, typography } from "@/design-system/tokens";
import { runAllMigrations } from "@/database/migrations";
import { AppNavigator } from "@/application/AppNavigator";
import { DEV_SALON_ID } from "@/constants/dev";
import { SalonRepository } from "@/repositories/salon-repository";
import { SettingsRepository } from "@/repositories/settings-repository";
import { OnboardingNavigator } from "@/features/onboarding/OnboardingNavigator";

const salonRepo = new SalonRepository();
const settingsRepo = new SettingsRepository();

export function AppRoot() {
  const { t } = useTranslation();
  const [isReady, setIsReady] = useState(false);
  const [startupError, setStartupError] = useState<string | null>(null);
  const [hasOnboarded, setHasOnboarded] = useState(false);

  useEffect(() => {
    try {
      runAllMigrations();
      const onboarded = salonRepo.hasSalon(DEV_SALON_ID);
      if (onboarded) {
        const lang = settingsRepo.getSalonLanguage(DEV_SALON_ID);
        if (lang && lang !== i18n.language) {
          void i18n.changeLanguage(lang);
        }
      }
      setHasOnboarded(onboarded);
      setIsReady(true);
    } catch (error) {
      setStartupError(error instanceof Error ? error.message : t("errors.unknown"));
    }
  }, [t]);

  const handleOnboardingDone = useCallback(() => {
    setHasOnboarded(true);
  }, []);

  if (startupError) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.centeredScreen}>
          <Text style={styles.title}>{t("errors.startupTitle")}</Text>
          <Text style={styles.body}>{startupError}</Text>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  if (!isReady) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.centeredScreen}>
          <ActivityIndicator color={colors.brand.primary} />
          <Text style={styles.body}>{t("common.loading")}</Text>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <SnackbarProvider>
        {hasOnboarded ? (
          <AppNavigator />
        ) : (
          <OnboardingNavigator onDone={handleOnboardingDone} />
        )}
      </SnackbarProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  centeredScreen: {
    alignItems: "center",
    backgroundColor: colors.background.default,
    flex: 1,
    gap: spacing[3],
    justifyContent: "center",
    padding: spacing[4]
  },
  title: {
    ...typography.h2,
    color: colors.text.primary,
    textAlign: "center"
  },
  body: {
    ...typography.body,
    color: colors.text.secondary,
    textAlign: "center"
  }
});