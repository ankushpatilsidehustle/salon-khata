import { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { Button } from "@/components/core/Button";
import { AppLogo } from "@/components/domain/AppLogo";
import { colors, radius, spacing, typography } from "@/design-system/tokens";
import {
  APP_LANGUAGES,
  isAppLanguageCode,
  type AppLanguageCode
} from "@/i18n/languages";
import { i18n } from "@/i18n";
import { setPreferredLanguage } from "@/session/app-preferences";
import { Events, track } from "@/observability";
import type { AuthStackParamList } from "./AuthNavigator";

type Props = NativeStackScreenProps<AuthStackParamList, "Language">;

function detectDeviceLanguage(): AppLanguageCode {
  const raw =
    (typeof Intl !== "undefined" &&
      Intl.DateTimeFormat().resolvedOptions().locale) ||
    "en";
  const primary = raw.split("-")[0]?.toLowerCase() ?? "en";
  return isAppLanguageCode(primary) ? primary : "en";
}

export function LanguagePickerScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const initial = useMemo(() => detectDeviceLanguage(), []);
  const [selected, setSelected] = useState<AppLanguageCode>(initial);

  function handleSelect(code: AppLanguageCode) {
    setSelected(code);
    void i18n.changeLanguage(code);
  }

  async function handleContinue() {
    await setPreferredLanguage(selected);
    void i18n.changeLanguage(selected);
    track(Events.onboarding.languageSelected, { language: selected });
    navigation.replace("GettingStarted");
  }

  return (
    <SafeAreaView style={styles.root} edges={["top", "left", "right", "bottom"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <AppLogo size={56} showWordmark wordmark={t("app.name")} />
        <Text style={styles.title}>{t("auth.language.title")}</Text>
        <Text style={styles.subtitle}>{t("auth.language.subtitle")}</Text>

        <View style={styles.list}>
          {APP_LANGUAGES.map((lang) => {
            const active = lang.code === selected;
            return (
              <Pressable
                key={lang.code}
                onPress={() => handleSelect(lang.code)}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                accessibilityLabel={lang.nativeName}
                style={({ pressed }) => [
                  styles.item,
                  active && styles.itemActive,
                  pressed && styles.itemPressed
                ]}
              >
                <Text
                  style={[styles.itemLabel, active && styles.itemLabelActive]}
                >
                  {lang.nativeName}
                </Text>
                <Ionicons
                  name={active ? "radio-button-on" : "radio-button-off"}
                  size={22}
                  color={active ? colors.brand.primary : colors.text.muted}
                />
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button
          onPress={() => void handleContinue()}
          fullWidth
          accessibilityLabel={t("common.continue")}
        >
          {t("common.continue")}
        </Button>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background.default
  },
  content: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[5],
    paddingBottom: spacing[4],
    gap: spacing[2]
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
    borderWidth: 1.5,
    borderColor: colors.border.subtle
  },
  itemActive: {
    borderColor: colors.brand.primary,
    backgroundColor: colors.interactive.selected
  },
  itemPressed: {
    opacity: 0.9
  },
  itemLabel: {
    ...typography.bodyEmphasis,
    color: colors.text.primary
  },
  itemLabelActive: {
    color: colors.brand.primary
  },
  footer: {
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[4],
    paddingTop: spacing[2]
  }
});
