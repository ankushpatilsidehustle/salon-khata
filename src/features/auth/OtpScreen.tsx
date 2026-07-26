import { useCallback, useEffect, useRef, useState } from "react";
import {
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
import { Ionicons } from "@expo/vector-icons";

import { Button } from "@/components/core/Button";
import { colors, radius, spacing, typography } from "@/design-system/tokens";
import {
  AuthError,
  signInWithPhone,
  verifyOtp,
  type PhoneConfirmation
} from "@/firebase/auth";
import { formatE164ForDisplay } from "@/domain/phone";
import { Events, recordNonFatal, track } from "@/observability";
import type { AuthStackParamList } from "./AuthNavigator";

type Props = NativeStackScreenProps<AuthStackParamList, "Otp">;

const OTP_LENGTH = 6;
const RESEND_COOLDOWN_SEC = 30;

function localDigitsFromE164(e164: string): string {
  const digits = e164.replace(/\D/g, "");
  if (digits.length >= 10) return digits.slice(-10);
  return digits;
}

export function OtpScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const { e164Phone } = route.params;
  const [confirmation, setConfirmation] = useState<PhoneConfirmation>(
    route.params.confirmation
  );

  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SEC);

  const inputRef = useRef<TextInput>(null);
  const submittedCodeRef = useRef<string | null>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => {
      setCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  const handleCodeChange = useCallback(
    (next: string) => {
      const digits = next.replace(/\D/g, "").slice(0, OTP_LENGTH);
      setCode(digits);
      if (error) setError(null);
      if (submittedCodeRef.current && digits !== submittedCodeRef.current) {
        submittedCodeRef.current = null;
      }
    },
    [error]
  );

  const handleSubmit = useCallback(async () => {
    if (code.length !== OTP_LENGTH || submitting) return;
    if (submittedCodeRef.current === code) return;
    submittedCodeRef.current = code;
    setSubmitting(true);
    setError(null);
    try {
      await verifyOtp(confirmation, code);
      track(Events.auth.otpVerified);
    } catch (err) {
      const authCode = err instanceof AuthError ? err.code : "unknown";
      track(Events.auth.loginFailed, {
        error_code: authCode,
        stage: "otp_verify"
      });
      const skip =
        authCode === "invalid-code" ||
        authCode === "code-expired" ||
        authCode === "too-many-requests";
      if (!skip) {
        recordNonFatal(err, "auth", {
          extra: { stage: "otp_verify", code: authCode }
        });
      }
      const message =
        err instanceof AuthError
          ? mapErrorMessage(err.code, t)
          : t("auth.errors.unknown");
      setError(message);
      setSubmitting(false);
    }
  }, [code, submitting, confirmation, t]);

  useEffect(() => {
    if (code.length === OTP_LENGTH && !submitting) {
      void handleSubmit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  async function handleResend() {
    if (cooldown > 0 || resending) return;
    setResending(true);
    setError(null);
    try {
      const next = await signInWithPhone(e164Phone);
      setConfirmation(next);
      setCode("");
      submittedCodeRef.current = null;
      setCooldown(RESEND_COOLDOWN_SEC);
      inputRef.current?.focus();
    } catch (err) {
      const message =
        err instanceof AuthError
          ? mapErrorMessage(err.code, t)
          : t("auth.errors.unknown");
      setError(message);
    } finally {
      setResending(false);
    }
  }

  function handleChangeNumber() {
    navigation.navigate("Phone", {
      prefillPhone: localDigitsFromE164(e164Phone)
    });
  }

  const boxes = Array.from({ length: OTP_LENGTH });
  const displayPhone = formatE164ForDisplay(e164Phone);
  const canVerify = code.length === OTP_LENGTH && !submitting;

  return (
    <SafeAreaView style={styles.root} edges={["top", "left", "right", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.header}>
          <Pressable
            onPress={() => navigation.goBack()}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t("common.back")}
            style={styles.backBtn}
          >
            <Ionicons name="arrow-back" size={22} color={colors.text.primary} />
          </Pressable>
        </View>

        <View style={styles.content}>
          <Text style={styles.title}>{t("auth.otp.title")}</Text>
          <Text style={styles.subtitle}>
            {t("auth.otp.subtitle", { phone: displayPhone })}{" "}
            <Text
              style={styles.changeLink}
              onPress={handleChangeNumber}
              accessibilityRole="link"
            >
              {t("auth.otp.change")}
            </Text>
          </Text>

          <Pressable
            style={styles.boxesRow}
            onPress={() => inputRef.current?.focus()}
            accessibilityRole="text"
            accessibilityLabel={t("auth.otp.a11yLabel")}
          >
            {boxes.map((_, idx) => {
              const char = code[idx] ?? "";
              const active = idx === code.length && !submitting;
              const filled = char.length > 0;
              return (
                <View
                  key={idx}
                  style={[
                    styles.box,
                    filled && styles.boxFilled,
                    active && styles.boxActive,
                    !!error && styles.boxError
                  ]}
                >
                  <Text style={styles.boxChar}>{char}</Text>
                </View>
              );
            })}
          </Pressable>

          <TextInput
            ref={inputRef}
            value={code}
            onChangeText={handleCodeChange}
            keyboardType="number-pad"
            maxLength={OTP_LENGTH}
            autoFocus
            style={styles.hiddenInput}
            textContentType="oneTimeCode"
            autoComplete="sms-otp"
            editable={!submitting}
          />

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <View style={styles.resendRow}>
            {cooldown > 0 ? (
              <Text style={styles.helperText}>
                {t("auth.otp.resendIn", { seconds: cooldown })}
              </Text>
            ) : (
              <Pressable
                onPress={() => void handleResend()}
                disabled={resending}
                accessibilityRole="button"
              >
                <Text
                  style={[
                    styles.resendLink,
                    resending && { color: colors.text.muted }
                  ]}
                >
                  {resending ? t("auth.otp.resending") : t("auth.otp.resend")}
                </Text>
              </Pressable>
            )}
          </View>
        </View>

        <View style={styles.footer}>
          <Button
            onPress={() => void handleSubmit()}
            fullWidth
            disabled={!canVerify}
            loading={submitting}
            accessibilityLabel={t("auth.otp.verify")}
          >
            {t("auth.otp.verify")}
          </Button>
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
    case "invalid-code":
      return t("auth.errors.invalidCode");
    case "code-expired":
      return t("auth.errors.codeExpired");
    case "too-many-requests":
      return t("auth.errors.tooManyRequests");
    case "network-request-failed":
      return t("auth.errors.network");
    case "session-expired":
      return t("auth.errors.sessionExpired");
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
  header: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2]
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface.default,
    borderWidth: 1,
    borderColor: colors.border.subtle
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing[5],
    paddingTop: spacing[3],
    gap: spacing[3]
  },
  title: {
    ...typography.h1,
    color: colors.text.primary
  },
  subtitle: {
    ...typography.body,
    color: colors.text.secondary,
    marginBottom: spacing[3],
    lineHeight: 22
  },
  changeLink: {
    ...typography.bodyEmphasis,
    color: colors.text.link
  },
  boxesRow: {
    flexDirection: "row",
    gap: spacing[2],
    justifyContent: "space-between",
    marginTop: spacing[2]
  },
  box: {
    flex: 1,
    minHeight: 56,
    borderWidth: 1.5,
    borderColor: colors.border.subtle,
    borderRadius: radius.md,
    backgroundColor: colors.surface.default,
    alignItems: "center",
    justifyContent: "center"
  },
  boxFilled: {
    borderColor: colors.border.strong,
    backgroundColor: colors.surface.raised
  },
  boxActive: {
    borderColor: colors.brand.primary
  },
  boxError: {
    borderColor: colors.status.danger
  },
  boxChar: {
    ...typography.h2,
    color: colors.text.primary
  },
  hiddenInput: {
    position: "absolute",
    opacity: 0,
    height: 1,
    width: 1
  },
  errorText: {
    ...typography.bodySmall,
    color: colors.status.danger
  },
  helperText: {
    ...typography.bodySmall,
    color: colors.text.muted
  },
  resendRow: {
    marginTop: spacing[1]
  },
  resendLink: {
    ...typography.bodyEmphasis,
    color: colors.text.link
  },
  footer: {
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[4],
    paddingTop: spacing[2]
  }
});
