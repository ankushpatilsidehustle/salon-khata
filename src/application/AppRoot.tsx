import { useEffect, useState } from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import "@/i18n";
import { colors, spacing, typography } from "@/design-system/tokens";
import { runAllMigrations } from "@/database/migrations";
import { AppNavigator } from "@/application/AppNavigator";

export function AppRoot() {
  const { t } = useTranslation();
  const [isReady, setIsReady] = useState(false);
  const [startupError, setStartupError] = useState<string | null>(null);

  useEffect(() => {
    try {
      runAllMigrations();
      setIsReady(true);
    } catch (error) {
      setStartupError(error instanceof Error ? error.message : t("errors.unknown"));
    }
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
      <AppNavigator />
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