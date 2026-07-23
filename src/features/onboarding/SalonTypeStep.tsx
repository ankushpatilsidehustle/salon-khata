import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";

import { colors, radius, spacing, typography } from "@/design-system/tokens";
import type { SalonType } from "@/repositories/salon-repository";
import { Events, track } from "@/observability";
import type { OnboardingStackParamList } from "./OnboardingNavigator";
import { StepHeader } from "./components/StepHeader";

type Props = NativeStackScreenProps<OnboardingStackParamList, "SalonType">;

type SalonTypeOption = {
  value: SalonType;
  icon: keyof typeof Ionicons.glyphMap;
  titleKey: string;
  bodyKey: string;
};

const OPTIONS: SalonTypeOption[] = [
  {
    value: "male",
    icon: "man",
    titleKey: "onboarding.salonType.male.title",
    bodyKey: "onboarding.salonType.male.body"
  },
  {
    value: "female",
    icon: "woman",
    titleKey: "onboarding.salonType.female.title",
    bodyKey: "onboarding.salonType.female.body"
  },
  {
    value: "unisex",
    icon: "people",
    titleKey: "onboarding.salonType.unisex.title",
    bodyKey: "onboarding.salonType.unisex.body"
  }
];

export function SalonTypeStep({ navigation, route }: Props) {
  const { t } = useTranslation();
  const { language } = route.params;

  function select(salonType: SalonType) {
    track(Events.onboarding.salonTypeSelected, { salon_type: salonType });
    navigation.navigate("BusinessSetup", { language, salonType });
  }

  return (
    <View style={styles.root}>
      <StepHeader
        currentStep={2}
        totalSteps={4}
        onBack={() => navigation.goBack()}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>{t("onboarding.salonType.title")}</Text>
        <Text style={styles.subtitle}>{t("onboarding.salonType.subtitle")}</Text>

        <View style={styles.list}>
          {OPTIONS.map((opt) => (
            <Pressable
              key={opt.value}
              onPress={() => select(opt.value)}
              accessibilityRole="button"
              accessibilityLabel={t(opt.titleKey)}
              style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
            >
              <View style={styles.iconWrap}>
                <Ionicons name={opt.icon} size={28} color={colors.brand.primary} />
              </View>
              <View style={styles.cardText}>
                <Text style={styles.cardTitle}>{t(opt.titleKey)}</Text>
                <Text style={styles.cardBody}>{t(opt.bodyKey)}</Text>
              </View>
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
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[4],
    backgroundColor: colors.surface.default,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.subtle
  },
  cardPressed: {
    opacity: 0.85
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.background.subtle,
    alignItems: "center",
    justifyContent: "center"
  },
  cardText: {
    flex: 1,
    gap: 2
  },
  cardTitle: {
    ...typography.bodyEmphasis,
    color: colors.text.primary
  },
  cardBody: {
    ...typography.bodySmall,
    color: colors.text.secondary
  }
});
