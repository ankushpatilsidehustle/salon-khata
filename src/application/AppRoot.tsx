import { useEffect, useState } from "react";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import "@/i18n";
import { i18n } from "@/i18n";
import { isAppLanguageCode } from "@/i18n/languages";
import { SnackbarProvider } from "@/components/core/SnackbarProvider";
import { AppLogo } from "@/components/domain/AppLogo";
import { colors, spacing, typography } from "@/design-system/tokens";
import { runAllMigrations } from "@/database/migrations";
import { AppNavigator } from "@/application/AppNavigator";
import { SettingsRepository } from "@/repositories/settings-repository";
import { OnboardingNavigator } from "@/features/onboarding/OnboardingNavigator";
import { AuthNavigator } from "@/features/auth/AuthNavigator";
import { AuthProvider, useAuth } from "@/features/auth/AuthProvider";
import { SubscriptionProvider } from "@/features/subscription/SubscriptionProvider";
import { initializeAppCheck } from "@/firebase/app-check";
import { loadDeviceIdentity } from "@/device/device-identity";
import { startNetworkManager } from "@/network/network-manager";
import { loadBackupPreferences } from "@/backup/backup-preferences";
import { loadAppPreferences } from "@/session/app-preferences";
import { registerBackgroundSyncTask } from "@/sync/background-sync-task";
import {
  ObservabilityErrorBoundary,
  beginStartupTrace,
  bootstrapObservability,
  endStartupTrace
} from "@/observability";

// Keep the native splash visible until JS boot finishes — no artificial delay.
void SplashScreen.preventAutoHideAsync().catch(() => {
  // Expo Go / unsupported environments — ignore.
});

const settingsRepo = new SettingsRepository();

export function AppRoot() {
  const { t } = useTranslation();
  const [isReady, setIsReady] = useState(false);
  const [startupError, setStartupError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await beginStartupTrace();
        runAllMigrations();
        await loadDeviceIdentity();
        startNetworkManager();
        await loadBackupPreferences();
        const prefs = await loadAppPreferences();
        if (prefs.preferredLanguage) {
          await i18n.changeLanguage(prefs.preferredLanguage);
        }
        await initializeAppCheck();
        await bootstrapObservability();
        void registerBackgroundSyncTask();
        if (!cancelled) {
          setIsReady(true);
          void endStartupTrace();
          await SplashScreen.hideAsync().catch(() => undefined);
        }
      } catch (error) {
        if (!cancelled) {
          setStartupError(
            error instanceof Error ? error.message : t("errors.unknown")
          );
          await SplashScreen.hideAsync().catch(() => undefined);
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
    return <BootSplash />;
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <ObservabilityErrorBoundary
        title={t("errors.boundaryTitle")}
        body={t("errors.boundaryBody")}
        retryLabel={t("errors.boundaryRetry")}
      >
        <AuthProvider>
          <SnackbarProvider>
            <AuthGate />
          </SnackbarProvider>
        </AuthProvider>
      </ObservabilityErrorBoundary>
    </SafeAreaProvider>
  );
}

function AuthGate() {
  const { t } = useTranslation();
  const { status, salonId, refreshSalon } = useAuth();

  useEffect(() => {
    if (status !== "signed-in" || !salonId) return;
    const lang = settingsRepo.getSalonLanguage(salonId);
    if (isAppLanguageCode(lang) && lang !== i18n.language) {
      void i18n.changeLanguage(lang);
    }
  }, [status, salonId]);

  if (status === "loading") {
    return <BootSplash />;
  }
  if (status === "signed-out") {
    return <AuthNavigator />;
  }
  if (status === "signed-in-no-salon") {
    return <OnboardingNavigator onDone={refreshSalon} />;
  }
  return (
    <SubscriptionProvider>
      <AppNavigator />
    </SubscriptionProvider>
  );
}

function BootSplash() {
  const { t } = useTranslation();
  return (
    <SafeAreaProvider>
      <View style={styles.bootRoot}>
        <AppLogo
          size={88}
          showWordmark
          layout="vertical"
          wordmark={t("app.name")}
        />
        <Text style={styles.tagline}>{t("app.tagline")}</Text>
      </View>
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
  bootRoot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background.default,
    padding: spacing[5],
    gap: spacing[3]
  },
  tagline: {
    ...typography.body,
    color: colors.text.secondary,
    textAlign: "center",
    marginTop: spacing[1]
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
