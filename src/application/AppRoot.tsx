import { useEffect, useState } from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { ActivityIndicator, StyleSheet, Text } from "react-native";
import { useTranslation } from "react-i18next";

import "@/i18n";
import { i18n } from "@/i18n";
import { isAppLanguageCode } from "@/i18n/languages";
import { SnackbarProvider } from "@/components/core/SnackbarProvider";
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
import { registerBackgroundSyncTask } from "@/sync/background-sync-task";

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
        // Resolve the persistent install_id before anything else — the key
        // vault and backup engine depend on it. Cheap on subsequent launches
        // (a single Secure Store read).
        await loadDeviceIdentity();
        // Begin observing connectivity so the BackupScheduler (Phase 3) has
        // a warm cache the moment it starts.
        startNetworkManager();
        // Hydrate backup preferences so both the foreground scheduler and
        // the background-task worker see the user's wifi-only / enabled
        // flags without a redundant AsyncStorage round-trip.
        await loadBackupPreferences();
        // Kick off App Check before any auth request goes out. Errors are
        // swallowed inside initializeAppCheck (soft-fail).
        await initializeAppCheck();
        // Register the OS-level per-record sync background worker. The
        // Phase-7 file-backup engine is manual-only — no OS task registered.
        void registerBackgroundSyncTask();
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
    if (isAppLanguageCode(lang) && lang !== i18n.language) {
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
  return (
    <SubscriptionProvider>
      <AppNavigator />
    </SubscriptionProvider>
  );
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