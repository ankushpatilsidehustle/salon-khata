import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { colors, radius, spacing, typography } from "@/design-system/tokens";
import { signInWithPhone, AuthError } from "@/firebase/auth";
import { toE164 } from "@/domain/phone";
import type { AuthStackParamList } from "./AuthNavigator";

type Props = NativeStackScreenProps<AuthStackParamList, "Phone">;

const COUNTRY_CODE = "+91";

export function PhoneNumberScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keep only digits and cap at 10 (India NDC).
  function handlePhoneChange(next: string) {
    const digits = next.replace(/\D/g, "").slice(0, 10);
    setPhone(digits);
    if (error) setError(null);
  }

  const canSubmit = phone.length === 10 && !submitting;

  async function handleSubmit() {
    if (!canSubmit) return;
    const e164 = toE164(phone);
    if (!e164) {
      setError(t("auth.errors.invalidPhone"));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const confirmation = await signInWithPhone(e164);
      navigation.navigate("Otp", { e164Phone: e164, confirmation });
    } catch (err) {
      const message =
        err instanceof AuthError
          ? mapErrorMessage(err.code, t)
          : t("auth.errors.unknown");
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.root} edges={["top", "left", "right", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.content}>
          <Text style={styles.title}>{t("auth.phone.title")}</Text>
          <Text style={styles.subtitle}>{t("auth.phone.subtitle")}</Text>

          <View style={styles.inputRow}>
            <View style={styles.prefixBox}>
              <Text style={styles.prefixText}>{COUNTRY_CODE}</Text>
            </View>
            <TextInput
              style={styles.input}
              placeholder={t("auth.phone.placeholder")}
              placeholderTextColor={colors.text.muted}
              keyboardType="number-pad"
              value={phone}
              onChangeText={handlePhoneChange}
              autoFocus
              maxLength={10}
              accessibilityLabel={t("auth.phone.a11yLabel")}
            />
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <Text style={styles.helperText}>{t("auth.phone.helper")}</Text>
        </View>

        <View style={styles.footer}>
          <Pressable
            onPress={handleSubmit}
            disabled={!canSubmit}
            accessibilityRole="button"
            accessibilityLabel={t("auth.phone.continue")}
            style={({ pressed }) => [
              styles.cta,
              !canSubmit && styles.ctaDisabled,
              pressed && canSubmit && styles.ctaPressed
            ]}
          >
            {submitting ? (
              <ActivityIndicator color={colors.text.inverse} />
            ) : (
              <Text style={styles.ctaLabel}>{t("auth.phone.continue")}</Text>
            )}
          </Pressable>
          <Text style={styles.legal}>{t("auth.phone.legal")}</Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function mapErrorMessage(
  code: AuthError["code"],
  t: ReturnType<typeof useTranslation>["t"]
): string {
  switch (code) {
    case "invalid-phone":
      return t("auth.errors.invalidPhone");
    case "too-many-requests":
      return t("auth.errors.tooManyRequests");
    case "network-request-failed":
      return t("auth.errors.network");
    case "quota-exceeded":
      return t("auth.errors.quotaExceeded");
    default:
      return t("auth.errors.unknown");
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background.default
  },
  flex: {
    flex: 1
  },
  content: {
    flex: 1,
    padding: spacing[5],
    gap: spacing[3]
  },
  title: {
    ...typography.h1,
    color: colors.text.primary,
    marginTop: spacing[6]
  },
  subtitle: {
    ...typography.body,
    color: colors.text.secondary,
    marginBottom: spacing[4]
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: spacing[2]
  },
  prefixBox: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.surface.sunken,
    borderRadius: radius.md,
    paddingHorizontal: spacing[3],
    minWidth: 64
  },
  prefixText: {
    ...typography.bodyEmphasis,
    color: colors.text.primary
  },
  input: {
    flex: 1,
    ...typography.h3,
    color: colors.text.primary,
    backgroundColor: colors.surface.default,
    borderColor: colors.border.subtle,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing[3],
    minHeight: 52,
    letterSpacing: 1
  },
  errorText: {
    ...typography.bodySmall,
    color: colors.status.danger
  },
  helperText: {
    ...typography.caption,
    color: colors.text.muted,
    marginTop: spacing[2]
  },
  footer: {
    padding: spacing[5],
    gap: spacing[3]
  },
  cta: {
    minHeight: 52,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brand.primary
  },
  ctaPressed: {
    backgroundColor: colors.brand.primaryPressed
  },
  ctaDisabled: {
    backgroundColor: colors.interactive.disabled
  },
  ctaLabel: {
    ...typography.button,
    color: colors.text.inverse
  },
  legal: {
    ...typography.caption,
    color: colors.text.muted,
    textAlign: "center"
  }
});
