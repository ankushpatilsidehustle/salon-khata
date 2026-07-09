import { Alert, StyleSheet, Text, View } from "react-native";

import { AppBar } from "@/components/core/AppBar";
import { Button } from "@/components/core/Button";
import { colors, radius, spacing, typography } from "@/design-system/tokens";
import { resetAppData } from "@/database/reset";

export function MoreScreen() {
  function handleReset() {
    Alert.alert(
      "Reset app data?",
      "This deletes the local database and reloads the app. Only enabled in development.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: () => {
            void resetAppData();
          }
        }
      ]
    );
  }

  return (
    <View style={styles.root}>
      <AppBar title="More" />
      <View style={styles.body}>
        <Text style={styles.placeholder}>Settings · Backup · About · Sign out</Text>
        <Text style={styles.sub}>Coming in Wave 6</Text>

        {__DEV__ ? (
          <View style={styles.devSection}>
            <Text style={styles.devTitle}>Developer</Text>
            <Text style={styles.devHelper}>
              Wipe the SQLite database and reload the app. Useful for testing
              onboarding.
            </Text>
            <Button variant="destructive" onPress={handleReset} fullWidth>
              Reset app data
            </Button>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background.default
  },
  body: {
    flex: 1,
    padding: spacing[4],
    gap: spacing[3]
  },
  placeholder: {
    ...typography.h3,
    color: colors.text.secondary,
    textAlign: "center"
  },
  sub: {
    ...typography.bodySmall,
    color: colors.text.muted,
    textAlign: "center"
  },
  devSection: {
    marginTop: "auto",
    padding: spacing[4],
    gap: spacing[2],
    backgroundColor: colors.surface.default,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.subtle
  },
  devTitle: {
    ...typography.overline,
    color: colors.text.muted
  },
  devHelper: {
    ...typography.bodySmall,
    color: colors.text.secondary,
    marginBottom: spacing[2]
  }
});
