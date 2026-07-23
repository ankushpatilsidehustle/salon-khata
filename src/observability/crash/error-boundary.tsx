import { Component, type ErrorInfo, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, spacing, typography } from "@/design-system/tokens";
import { recordNonFatal } from "@/observability/crash/crash-reporter";
import { logger } from "@/observability/logging/logger";

type Props = {
  children: ReactNode;
  /** Optional i18n strings; defaults keep the boundary dependency-light. */
  title?: string;
  body?: string;
  retryLabel?: string;
};

type State = {
  hasError: boolean;
};

/**
 * Global React error boundary. Shows a safe recovery UI — never a stack trace.
 * Reports the error as a non-fatal Crashlytics event.
 */
export class ObservabilityErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    logger.error(error.message, {
      category: "error",
      err_code: "ui",
      component_stack_len: info.componentStack?.length ?? 0
    });
    recordNonFatal(error, "ui", {
      extra: { boundary: "ObservabilityErrorBoundary" }
    });
  }

  handleRetry = (): void => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <SafeAreaView style={styles.root}>
          <View style={styles.card}>
            <Text style={styles.title}>
              {this.props.title ?? "Something went wrong"}
            </Text>
            <Text style={styles.body}>
              {this.props.body ??
                "The app hit an unexpected error. You can try again — your data is safe on this device."}
            </Text>
            <Pressable
              onPress={this.handleRetry}
              style={({ pressed }) => [
                styles.button,
                pressed && styles.buttonPressed
              ]}
              accessibilityRole="button"
              accessibilityLabel={this.props.retryLabel ?? "Try again"}
            >
              <Text style={styles.buttonLabel}>
                {this.props.retryLabel ?? "Try again"}
              </Text>
            </Pressable>
          </View>
        </SafeAreaView>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  root: {
    alignItems: "center",
    backgroundColor: colors.background.default,
    flex: 1,
    justifyContent: "center",
    padding: spacing[4]
  },
  card: {
    gap: spacing[3],
    maxWidth: 360,
    width: "100%"
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
  },
  button: {
    alignItems: "center",
    backgroundColor: colors.brand.primary,
    borderRadius: 12,
    marginTop: spacing[2],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3]
  },
  buttonPressed: {
    opacity: 0.85
  },
  buttonLabel: {
    ...typography.bodyEmphasis,
    color: colors.text.inverse
  }
});
