import { useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View
} from "react-native";
import { useTranslation } from "react-i18next";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { Button } from "@/components/core/Button";
import { TextField } from "@/components/core/TextField";
import { colors, radius, spacing, typography } from "@/design-system/tokens";
import { Events, track } from "@/observability";
import type { OnboardingStackParamList } from "./OnboardingNavigator";
import { StepHeader } from "./components/StepHeader";

type Props = NativeStackScreenProps<OnboardingStackParamList, "BusinessSetup">;

export function BusinessSetupStep({ navigation, route }: Props) {
  const { t } = useTranslation();
  const { salonType } = route.params;

  const [businessName, setBusinessName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [alsoDoesServices, setAlsoDoesServices] = useState(false);
  const [referralCode, setReferralCode] = useState("");
  const [nameError, setNameError] = useState("");

  const ownerToggleEnabled = ownerName.trim().length > 0;

  const canSubmit = useMemo(
    () => businessName.trim().length > 0,
    [businessName]
  );

  function handleContinue() {
    const trimmedBusiness = businessName.trim();
    const trimmedOwner = ownerName.trim();

    if (trimmedBusiness.length === 0) {
      setNameError(t("onboarding.business.businessNameRequired"));
      return;
    }
    setNameError("");

    track(Events.onboarding.businessSetupCompleted, {
      has_owner_name: trimmedOwner.length > 0 ? 1 : 0,
      also_does_services: alsoDoesServices && ownerToggleEnabled ? 1 : 0,
      has_referral: referralCode.trim().length > 0 ? 1 : 0
    });
    if (referralCode.trim().length > 0) {
      track(Events.subscription.referralCodeEntered);
    }

    navigation.navigate("Services", {
      salonType,
      businessName: trimmedBusiness,
      ownerName: trimmedOwner,
      alsoDoesServices: alsoDoesServices && ownerToggleEnabled,
      referralCode: referralCode.trim() || undefined
    });
  }

  return (
    <View style={styles.root}>
      <StepHeader
        currentStep={2}
        totalSteps={3}
        onBack={() => navigation.goBack()}
      />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.title}>{t("onboarding.business.title")}</Text>
          <Text style={styles.subtitle}>
            {t("onboarding.business.subtitle")}
          </Text>

          <View style={styles.form}>
            <TextField
              label={t("onboarding.business.businessName")}
              placeholder={t("onboarding.business.businessNamePlaceholder")}
              value={businessName}
              onChangeText={(v) => {
                setBusinessName(v);
                if (nameError) setNameError("");
              }}
              error={nameError || undefined}
              autoCapitalize="words"
              maxLength={80}
            />
            <TextField
              label={t("onboarding.business.ownerName")}
              placeholder={t("onboarding.business.ownerNamePlaceholder")}
              value={ownerName}
              onChangeText={(v) => {
                setOwnerName(v);
                if (v.trim().length === 0) setAlsoDoesServices(false);
              }}
              helper={t("onboarding.business.ownerNameHelper")}
              autoCapitalize="words"
              maxLength={60}
            />

            <TextField
              label={t("onboarding.business.referralCode")}
              placeholder={t("onboarding.business.referralCodePlaceholder")}
              value={referralCode}
              onChangeText={setReferralCode}
              helper={t("onboarding.business.referralCodeHelper")}
              autoCapitalize="characters"
              maxLength={12}
            />

            <View style={styles.toggleRow}>
              <View style={styles.toggleText}>
                <Text style={styles.toggleTitle}>
                  {t("onboarding.business.iDoServices")}
                </Text>
                <Text style={styles.toggleHelper}>
                  {ownerToggleEnabled
                    ? t("onboarding.business.iDoServicesHelper")
                    : t("onboarding.business.iDoServicesNeedsName")}
                </Text>
              </View>
              <Switch
                value={alsoDoesServices && ownerToggleEnabled}
                onValueChange={setAlsoDoesServices}
                disabled={!ownerToggleEnabled}
                trackColor={{
                  false: colors.border.subtle,
                  true: colors.brand.accentLight
                }}
                thumbColor={
                  alsoDoesServices && ownerToggleEnabled
                    ? colors.brand.primary
                    : colors.surface.default
                }
              />
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Button
            onPress={handleContinue}
            fullWidth
            variant={canSubmit ? "primary" : "secondary"}
          >
            {t("onboarding.next")}
          </Button>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
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
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[6]
  },
  title: {
    ...typography.h1,
    color: colors.text.primary,
    marginTop: spacing[4]
  },
  subtitle: {
    ...typography.body,
    color: colors.text.secondary,
    marginTop: spacing[2],
    marginBottom: spacing[5]
  },
  form: {
    gap: spacing[4]
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    padding: spacing[4],
    backgroundColor: colors.surface.default,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.subtle
  },
  toggleText: {
    flex: 1,
    gap: 2
  },
  toggleTitle: {
    ...typography.bodyEmphasis,
    color: colors.text.primary
  },
  toggleHelper: {
    ...typography.caption,
    color: colors.text.secondary
  },
  footer: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[3],
    paddingBottom: spacing[4],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border.subtle,
    backgroundColor: colors.background.default
  }
});
