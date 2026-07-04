import { StyleSheet, Text, View } from "react-native";

import { AppBar } from "@/components/core/AppBar";
import { colors, typography } from "@/design-system/tokens";

export function ReportsScreen() {
  return (
    <View style={styles.root}>
      <AppBar title="Reports" />
      <View style={styles.body}>
        <Text style={styles.placeholder}>Daily · Monthly · Employee · Service</Text>
        <Text style={styles.sub}>Coming in Wave 5</Text>
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
    alignItems: "center",
    justifyContent: "center",
    gap: 8
  },
  placeholder: {
    ...typography.h3,
    color: colors.text.secondary,
    textAlign: "center"
  },
  sub: {
    ...typography.bodySmall,
    color: colors.text.muted
  }
});
