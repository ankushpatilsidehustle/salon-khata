import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import { AppBar } from "@/components/core/AppBar";
import { colors, radius, spacing, typography } from "@/design-system/tokens";
import { useAuth } from "@/features/auth/AuthProvider";
import { APP_LANGUAGES, getAppLanguage, type AppLanguageCode } from "@/i18n/languages";
import { i18n } from "@/i18n";
import { SalonRepository } from "@/repositories/salon-repository";

const salonRepo = new SalonRepository();

/**
 * SET-03 Language — instant switch, no confirmation, no restart.
 * Names are shown in each language's own script (not via t()).
 */
export function LanguageScreen() {
  const { t, i18n: i18nHook } = useTranslation();
  const navigation = useNavigation();
  const { salonId } = useAuth();
  const current = getAppLanguage(i18nHook.language).code;

  function select(code: AppLanguageCode) {
    if (code === current) return;
    void i18n.changeLanguage(code);
    if (salonId) {
      salonRepo.updateLanguage(salonId, code);
    }
  }

  return (
    <View style={styles.root}>
      <AppBar
        title={t("settings.language.title")}
        leading={
          <Pressable
            onPress={() => navigation.goBack()}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t("common.back")}
          >
            <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
          </Pressable>
        }
      />
      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
      >
        {APP_LANGUAGES.map((lang) => {
          const selected = lang.code === current;
          return (
            <Pressable
              key={lang.code}
              onPress={() => select(lang.code)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={lang.nativeName}
              style={({ pressed }) => [
                styles.row,
                pressed && styles.rowPressed,
                selected && styles.rowSelected
              ]}
            >
              <Text style={styles.label}>{lang.nativeName}</Text>
              <View style={[styles.radio, selected && styles.radioSelected]}>
                {selected ? <View style={styles.radioDot} /> : null}
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background.default
  },
  body: {
    padding: spacing[4],
    gap: spacing[3]
  },
  row: {
    alignItems: "center",
    backgroundColor: colors.surface.default,
    borderColor: colors.border.subtle,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4]
  },
  rowPressed: {
    backgroundColor: colors.interactive.pressed
  },
  rowSelected: {
    borderColor: colors.brand.primary
  },
  label: {
    ...typography.bodyEmphasis,
    color: colors.text.primary
  },
  radio: {
    alignItems: "center",
    borderColor: colors.border.strong,
    borderRadius: radius.full,
    borderWidth: 2,
    height: 22,
    justifyContent: "center",
    width: 22
  },
  radioSelected: {
    borderColor: colors.brand.primary
  },
  radioDot: {
    backgroundColor: colors.brand.primary,
    borderRadius: radius.full,
    height: 12,
    width: 12
  }
});
