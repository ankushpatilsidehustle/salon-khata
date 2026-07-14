import { useEffect, useState } from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { ActivityIndicator, StyleSheet, Text } from "react-native";
import { useTranslation } from "react-i18next";

import "@/i18n";
import { i18n } from "@/i18n";
import { SnackbarProvider } from "@/components/core/SnackbarProvider";
import { colors, spacing, typography } from "@/design-system/tokens";
import { runAllMigrations } from "@/database/migrations";
import { AppNavigator } from "@/application/AppNavigator";
import { SettingsRepository } from "@/repositories/settings-repository";
import { OnboardingNavigator } from "@/features/onboarding/OnboardingNavigator";
import { AuthNavigator } from "@/features/auth/AuthNavigator";
import { AuthProvider, useAuth } from "@/features/auth/AuthProvider";
import { initializeAppCheck } from "@/firebase/app-check";

const settingsRepo = new SettingsRepository();

export function AppRoot() {
  const { t } = useTranslation();
  const [isReady, setIsReady] = useState(false);
  const [startupError, setStartupError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        runAllMigrations();
        // Kick off App Check before any auth request goes out. Errors are
        // swallowed inside initializeAppCheck (soft-fail).
        await initializeAppCheck();
        if (!cancelled) setIsReady(true);
      } catch (error) {
        if (!cancelled) {
          setStartupError(
            error instanceof Error ? error.message : t("errors.unknown")
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [t]);

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
    return <BootSplash label={t("common.loading")} />;
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <AuthProvider>
        <SnackbarProvider>
          <AuthGate />
        </SnackbarProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

function AuthGate() {
  const { t } = useTranslation();
  const { status, salonId, refreshSalon } = useAuth();

  // Whenever we land in `signed-in` for the first time, sync the salon's
  // saved language into i18n so the app boots in the owner's chosen locale.
  useEffect(() => {
    if (status !== "signed-in" || !salonId) return;
    const lang = settingsRepo.getSalonLanguage(salonId);
    if (lang && lang !== i18n.language) {
      void i18n.changeLanguage(lang);
    }
  }, [status, salonId]);

  if (status === "loading") {
    return <BootSplash label={t("common.loading")} />;
  }
  if (status === "signed-out") {
    return <AuthNavigator />;
  }
  if (status === "signed-in-no-salon") {
    return <OnboardingNavigator onDone={refreshSalon} />;
  }
  return <AppNavigator />;
}

function BootSplash({ label }: { label: string }) {
  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.centeredScreen}>
        <ActivityIndicator color={colors.brand.primary} />
        <Text style={styles.body}>{label}</Text>
      </SafeAreaView>
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