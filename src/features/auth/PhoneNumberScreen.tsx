import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { Button } from "@/components/core/Button";
import { AppLogo } from "@/components/domain/AppLogo";
import { colors, radius, spacing, typography } from "@/design-system/tokens";
import { signInWithPhone, AuthError } from "@/firebase/auth";
import { toE164 } from "@/domain/phone";
import { Events, recordNonFatal, track } from "@/observability";
import type { AuthStackParamList } from "./AuthNavigator";

type Props = NativeStackScreenProps<AuthStackParamList, "Phone">;

const COUNTRY_CODE = "+91";

export function PhoneNumberScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const [phone, setPhone] = useState(route.params?.prefillPhone ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    const prefill = route.params?.prefillPhone;
    if (prefill) setPhone(prefill);
  }, [route.params?.prefillPhone]);

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
    track(Events.auth.loginStarted);
    try {
      const confirmation = await signInWithPhone(e164);
      track(Events.auth.otpSent);
      navigation.navigate("Otp", { e164Phone: e164, confirmation });
    } catch (err) {
      const code = err instanceof AuthError ? err.code : "unknown";
      track(Events.auth.loginFailed, { error_code: code, stage: "otp_send" });
      if (err instanceof AuthError) {
        const skip =
          code === "invalid-phone" ||
          code === "too-many-requests" ||
          code === "network-request-failed";
        if (!skip) {
          recordNonFatal(err, "auth", { extra: { stage: "otp_send", code } });
        }
      }
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
          <AppLogo size={48} showWordmark wordmark={t("app.name")} />

          <View style={styles.heroBlock}>
            <Text style={styles.title}>{t("auth.phone.title")}</Text>
            <Text style={styles.subtitle}>{t("auth.phone.subtitle")}</Text>
          </View>

          <View>
            <View
              style={[
                styles.inputRow,
                focused && styles.inputRowFocused,
                !!error && styles.inputRowError
              ]}
            >
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
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                autoFocus
                maxLength={10}
                accessibilityLabel={t("auth.phone.a11yLabel")}
                returnKeyType="done"
                onSubmitEditing={() => void handleSubmit()}
              />
            </View>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            <Text style={styles.helperText}>{t("auth.phone.helper")}</Text>
          </View>
        </View>

        <View style={styles.footer}>
          <Button
            onPress={() => void handleSubmit()}
            fullWidth
            disabled={!canSubmit}
            loading={submitting}
            accessibilityLabel={t("auth.phone.sendOtp")}
          >
            {t("auth.phone.sendOtp")}
          </Button>
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
    paddingHorizontal: spacing[5],
    paddingTop: spacing[5],
    gap: spacing[5]
  },
  heroBlock: {
    marginTop: spacing[4],
    gap: spacing[2]
  },
  title: {
    ...typography.h1,
    color: colors.text.primary
  },
  subtitle: {
    ...typography.body,
    color: colors.text.secondary,
    lineHeight: 22
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "stretch",
    backgroundColor: colors.surface.default,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border.subtle,
    overflow: "hidden"
  },
  inputRowFocused: {
    borderColor: colors.brand.primary
  },
  inputRowError: {
    borderColor: colors.status.danger
  },
  prefixBox: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.surface.sunken,
    paddingHorizontal: spacing[3],
    minWidth: 68,
    borderRightWidth: 1,
    borderRightColor: colors.border.subtle
  },
  prefixText: {
    ...typography.bodyEmphasis,
    color: colors.text.primary
  },
  input: {
    flex: 1,
    ...typography.h3,
    color: colors.text.primary,
    paddingHorizontal: spacing[3],
    minHeight: 56,
    letterSpacing: 1.5
  },
  errorText: {
    ...typography.bodySmall,
    color: colors.status.danger,
    marginTop: spacing[2]
  },
  helperText: {
    ...typography.caption,
    color: colors.text.muted,
    marginTop: spacing[2]
  },
  footer: {
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[4],
    paddingTop: spacing[2],
    gap: spacing[3]
  },
  legal: {
    ...typography.caption,
    color: colors.text.muted,
    textAlign: "center"
  }
});
