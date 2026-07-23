import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { useTranslation } from "react-i18next";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";

import { Button } from "@/components/core/Button";
import { useSnackbar } from "@/components/core/SnackbarProvider";
import { colors, radius, spacing, typography } from "@/design-system/tokens";
import { getCurrentAuthUser } from "@/firebase/auth";
import { setCurrentSalonId } from "@/session/current-salon";
import { runInTransaction } from "@/database/sqlite-client";
import { EmployeeRepository } from "@/repositories/employee-repository";
import type { EmployeeGender } from "@/repositories/employee-repository";
import { SalonRepository } from "@/repositories/salon-repository";
import type { SalonType } from "@/repositories/salon-repository";
import { ServiceRepository } from "@/repositories/service-repository";
import { ServiceCategoryRepository } from "@/repositories/service-category-repository";
import {
  getServicesForSalonType,
  type DefaultServiceSeed,
  type ServiceGenderSide
} from "./defaultServices";
import type { OnboardingStackParamList } from "./OnboardingNavigator";
import { useOnboardingDone } from "./OnboardingNavigator";
import { StepHeader } from "./components/StepHeader";
import { ensureSalonBillingBootstrap } from "@/repositories/subscription-bootstrap";
import { claimReferralOnline } from "@/cloud/referral-claim";
import { normalizeReferralCode } from "@/domain/subscription";
import { syncScheduler } from "@/sync/sync-scheduler";
import { Events, logger, track } from "@/observability";

type Props = NativeStackScreenProps<OnboardingStackParamList, "Services">;

type Row = DefaultServiceSeed & { price: string };

const salonRepo = new SalonRepository();
const employeeRepo = new EmployeeRepository();
const serviceRepo = new ServiceRepository();
const categoryRepo = new ServiceCategoryRepository();

function ownerGenderFor(salonType: SalonType): EmployeeGender {
  if (salonType === "male") return "male";
  if (salonType === "female") return "female";
  return "other";
}

/** Parse a rupee amount typed by the user into paise. Returns 0 for blank/junk. */
function toPaise(input: string): number {
  const trimmed = input.trim();
  if (trimmed.length === 0) return 0;
  const parsed = parseFloat(trimmed);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.round(parsed * 100);
}

export function ServicesStep({ navigation, route }: Props) {
  const { t } = useTranslation();
  const { showSnackbar } = useSnackbar();
  const onDone = useOnboardingDone();
  const {
    language,
    salonType,
    businessName,
    ownerName,
    alsoDoesServices,
    referralCode
  } = route.params;

  const lists = useMemo(() => getServicesForSalonType(salonType), [salonType]);

  const [menRows, setMenRows] = useState<Row[]>(
    lists.men.map((s) => ({ ...s, price: "" }))
  );
  const [womenRows, setWomenRows] = useState<Row[]>(
    lists.women.map((s) => ({ ...s, price: "" }))
  );
  const [saving, setSaving] = useState(false);

  function updateRow(side: ServiceGenderSide, index: number, price: string) {
    const setter = side === "male" ? setMenRows : setWomenRows;
    setter((prev) => {
      const next = prev.slice();
      next[index] = { ...next[index], price };
      return next;
    });
  }

  function handleFinish() {
    const authUser = getCurrentAuthUser();
    if (!authUser) {
      Alert.alert(
        t("onboarding.business.saveFailed"),
        t("auth.errors.sessionExpired")
      );
      return;
    }
    const salonId = authUser.uid;

    setSaving(true);
    try {
      runInTransaction(() => {
        salonRepo.create({
          id: salonId,
          businessName,
          ownerName,
          mobileNumber: authUser.phoneNumber ?? undefined,
          language,
          salonType,
          ownerUid: authUser.uid
        });

        if (alsoDoesServices && ownerName.length > 0) {
          employeeRepo.insert({
            salonId,
            name: ownerName,
            gender: ownerGenderFor(salonType),
            isOwner: true
          });
        }

        // Seed the default category set, then build a name → id lookup so
        // each service can point at the correct category row.
        categoryRepo.ensureDefaults(salonId);
        const categoriesByName = new Map<string, string>();
        for (const cat of categoryRepo.listActive(salonId)) {
          categoriesByName.set(cat.name.toLowerCase(), cat.id);
        }
        const fallbackCategoryId =
          categoriesByName.get("others") ?? null;

        const insertSide = (rows: Row[]) => {
          for (const row of rows) {
            const paise = toPaise(row.price);
            const categoryId =
              categoriesByName.get(row.category.toLowerCase()) ??
              fallbackCategoryId;
            serviceRepo.insert({
              salonId,
              categoryId,
              name: row.name,
              malePrice: row.gender === "male" ? paise : 0,
              femalePrice: row.gender === "female" ? paise : 0
            });
          }
        };
        insertSide(menRows);
        insertSide(womenRows);
      });

      track(Events.onboarding.servicesSeeded, {
        service_count: menRows.length + womenRows.length,
        salon_type: salonType
      });

      // Billing bootstrap is intentionally outside the seed transaction —
      // it has its own atomic writes and must not nest expo-sqlite txs.
      ensureSalonBillingBootstrap(salonId);
      track(Events.subscription.trialStarted);

      // Publish referral code + claim online. Firebase is authoritative for
      // cross-salon referral claims and later reward grants.
      setCurrentSalonId(salonId);
      void syncScheduler.start(salonId);
      void syncScheduler.runNow().catch(() => {});

      const trimmedReferral = normalizeReferralCode(referralCode ?? "");
      if (trimmedReferral.length > 0) {
        void claimReferralOnline({
          code: trimmedReferral,
          referredSalonId: salonId
        }).then((result) => {
          if (result.ok) {
            track(
              Events.subscription.referralClaimSucceeded,
              {},
              { critical: true }
            );
          } else if (result.reason !== "already_applied") {
            track(Events.subscription.referralClaimFailed, {
              reason: result.reason
            });
            logger.warn("referral claim failed", {
              category: "auth",
              err_code: result.reason
            });
          }
        });
      }

      track(Events.onboarding.completed, { salon_type: salonType }, { critical: true });
      showSnackbar(t("onboarding.welcome", { name: businessName }));
      onDone();
    } catch (err) {
      setSaving(false);
      const message = err instanceof Error ? err.message : String(err);
      Alert.alert(t("onboarding.business.saveFailed"), message);
    }
  }

  return (
    <View style={styles.root}>
      <StepHeader
        currentStep={4}
        totalSteps={4}
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
          <Text style={styles.title}>{t("onboarding.services.title")}</Text>
          <Text style={styles.subtitle}>
            {t("onboarding.services.subtitle")}
          </Text>

          {menRows.length > 0 ? (
            <ServiceSection
              titleKey="onboarding.services.menSection"
              icon="man"
              rows={menRows}
              onChange={(idx, price) => updateRow("male", idx, price)}
              placeholder={t("onboarding.services.pricePlaceholder")}
            />
          ) : null}

          {womenRows.length > 0 ? (
            <ServiceSection
              titleKey="onboarding.services.womenSection"
              icon="woman"
              rows={womenRows}
              onChange={(idx, price) => updateRow("female", idx, price)}
              placeholder={t("onboarding.services.pricePlaceholder")}
            />
          ) : null}

          <Text style={styles.footnote}>
            {t("onboarding.services.footnote")}
          </Text>
        </ScrollView>

        <View style={styles.footer}>
          <Text style={styles.footerCount}>
            {t("onboarding.services.footerHint")}
          </Text>
          <Button onPress={handleFinish} fullWidth variant="primary">
            {saving ? (
              <ActivityIndicator color={colors.text.inverse} />
            ) : (
              t("onboarding.business.finish")
            )}
          </Button>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

// ─── Section ─────────────────────────────────────────────────────────────────

type ServiceSectionProps = {
  titleKey: string;
  icon: keyof typeof Ionicons.glyphMap;
  rows: Row[];
  placeholder: string;
  onChange: (index: number, price: string) => void;
};

function ServiceSection({
  titleKey,
  icon,
  rows,
  onChange,
  placeholder
}: ServiceSectionProps) {
  const { t } = useTranslation();

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Ionicons name={icon} size={18} color={colors.brand.primary} />
        <Text style={styles.sectionTitle}>{t(titleKey)}</Text>
      </View>

      <View style={styles.sectionList}>
        {rows.map((row, idx) => (
          <View
            key={`${row.gender}-${row.name}-${idx}`}
            style={[
              styles.row,
              idx < rows.length - 1 && styles.rowDivider
            ]}
          >
            <Text style={styles.rowName}>{row.name}</Text>
            <View style={styles.priceInputWrap}>
              <Text style={styles.currencyPrefix}>₹</Text>
              <TextInput
                style={styles.priceInput}
                value={row.price}
                onChangeText={(v) => onChange(idx, v)}
                placeholder={placeholder}
                placeholderTextColor={colors.text.muted}
                keyboardType="numeric"
                maxLength={7}
                returnKeyType="done"
              />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

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
    marginBottom: spacing[4]
  },
  section: {
    marginTop: spacing[4]
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
    marginBottom: spacing[2]
  },
  sectionTitle: {
    ...typography.overline,
    color: colors.text.secondary
  },
  sectionList: {
    backgroundColor: colors.surface.default,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    overflow: "hidden"
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4]
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.subtle
  },
  rowName: {
    ...typography.body,
    color: colors.text.primary,
    flex: 1
  },
  priceInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    minWidth: 110,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderWidth: 1,
    borderColor: colors.border.subtle,
    borderRadius: radius.sm,
    backgroundColor: colors.background.subtle
  },
  currencyPrefix: {
    ...typography.body,
    color: colors.text.muted
  },
  priceInput: {
    ...typography.body,
    color: colors.text.primary,
    flex: 1,
    padding: 0,
    minWidth: 60,
    textAlign: "right"
  },
  footnote: {
    ...typography.caption,
    color: colors.text.muted,
    marginTop: spacing[4]
  },
  footer: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[3],
    paddingBottom: spacing[4],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border.subtle,
    backgroundColor: colors.background.default,
    gap: spacing[2]
  },
  footerCount: {
    ...typography.caption,
    color: colors.text.secondary,
    textAlign: "center"
  }
});
