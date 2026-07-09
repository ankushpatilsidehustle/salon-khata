import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";

import { colors, radius, spacing, typography } from "@/design-system/tokens";
import { i18n } from "@/i18n";
import type { OnboardingStackParamList } from "./OnboardingNavigator";
import { StepHeader } from "./components/StepHeader";

type Props = NativeStackScreenProps<OnboardingStackParamList, "Language">;

type LanguageOption = {
  code: string;
  labelKey: string;
};

const LANGUAGES: LanguageOption[] = [
  { code: "en", labelKey: "onboarding.language.english" },
  { code: "hi", labelKey: "onboarding.language.hindi" }
];

export function LanguageStep({ navigation }: Props) {
  const { t } = useTranslation();

  function select(code: string) {
    void i18n.changeLanguage(code);
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
          {LANGUAGES.map((lang) => (
            <Pressable
              key={lang.code}
              onPress={() => select(lang.code)}
              accessibilityRole="button"
              accessibilityLabel={t(lang.labelKey)}
              style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
            >
              <Text style={styles.itemLabel}>{t(lang.labelKey)}</Text>
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
