import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";

import { colors, radius, spacing, typography } from "@/design-system/tokens";
import { APP_LANGUAGES, type AppLanguageCode } from "@/i18n/languages";
import { i18n } from "@/i18n";
import { Events, track } from "@/observability";
import type { OnboardingStackParamList } from "./OnboardingNavigator";
import { StepHeader } from "./components/StepHeader";

type Props = NativeStackScreenProps<OnboardingStackParamList, "Language">;

export function LanguageStep({ navigation }: Props) {
  const { t } = useTranslation();

  function select(code: AppLanguageCode) {
    void i18n.changeLanguage(code);
    track(Events.onboarding.languageSelected, { language: code });
    navigation.navigate("SalonType", { language: code });
  }

  return (
    <View style={styles.root}>
      <StepHeader currentStep={1} totalSteps={4} />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>{t("onboarding.language.title")}</Text>
        <Text style={styles.subtitle}>{t("onboarding.language.subtitle")}</Text>

        <View style={styles.list}>
          {APP_LANGUAGES.map((lang) => (
            <Pressable
              key={lang.code}
              onPress={() => select(lang.code)}
              accessibilityRole="button"
              accessibilityLabel={lang.nativeName}
              style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
            >
              <Text style={styles.itemLabel}>{lang.nativeName}</Text>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={colors.text.muted}
              />
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background.default
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
  list: {
    gap: spacing[3]
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[4],
    backgroundColor: colors.surface.default,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.subtle
  },
  itemPressed: {
    opacity: 0.85
  },
  itemLabel: {
    ...typography.bodyEmphasis,
    color: colors.text.primary
  }
});
