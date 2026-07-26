import { useRef, useState, type ComponentType } from "react";
import {
  Animated,
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { Button } from "@/components/core/Button";
import { colors, spacing, typography } from "@/design-system/tokens";
import { setGettingStartedCompleted } from "@/session/app-preferences";
import { Events, track } from "@/observability";
import type { AuthStackParamList } from "@/features/auth/AuthNavigator";
import {
  IllustrationFeatures,
  IllustrationGetStarted,
  IllustrationKhata,
  IllustrationOfflineBenefits
} from "./illustrations";

type Props = NativeStackScreenProps<AuthStackParamList, "GettingStarted">;

type Slide = {
  key: string;
  titleKey: string;
  bodyKey: string;
  Illustration: ComponentType<{ size?: number }>;
};

const SLIDES: Slide[] = [
  {
    key: "what",
    titleKey: "gettingStarted.slides.what.title",
    bodyKey: "gettingStarted.slides.what.body",
    Illustration: IllustrationKhata
  },
  {
    key: "benefits",
    titleKey: "gettingStarted.slides.benefits.title",
    bodyKey: "gettingStarted.slides.benefits.body",
    Illustration: IllustrationOfflineBenefits
  },
  {
    key: "features",
    titleKey: "gettingStarted.slides.features.title",
    bodyKey: "gettingStarted.slides.features.body",
    Illustration: IllustrationFeatures
  },
  {
    key: "why",
    titleKey: "gettingStarted.slides.why.title",
    bodyKey: "gettingStarted.slides.why.body",
    Illustration: IllustrationGetStarted
  }
];

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export function GettingStartedScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);
  const fade = useRef(new Animated.Value(1)).current;

  const isLast = index === SLIDES.length - 1;

  function animateIn() {
    fade.setValue(0.35);
    Animated.timing(fade, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true
    }).start();
  }

  function onScrollEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const next = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    if (next !== index && next >= 0 && next < SLIDES.length) {
      setIndex(next);
      animateIn();
    }
  }

  function goTo(next: number) {
    scrollRef.current?.scrollTo({ x: next * SCREEN_WIDTH, animated: true });
    setIndex(next);
    animateIn();
  }

  async function finish() {
    await setGettingStartedCompleted(true);
    track(Events.onboarding.gettingStartedCompleted);
    navigation.replace("Phone");
  }

  async function handleSkip() {
    track(Events.onboarding.gettingStartedSkipped, { at_slide: index });
    await finish();
  }

  function handlePrimary() {
    if (isLast) {
      void finish();
      return;
    }
    goTo(index + 1);
  }

  return (
    <SafeAreaView style={styles.root} edges={["top", "left", "right", "bottom"]}>
      <View style={styles.topBar}>
        <View style={styles.dots}>
          {SLIDES.map((slide, i) => (
            <View
              key={slide.key}
              style={[styles.dot, i === index && styles.dotActive]}
            />
          ))}
        </View>
        {!isLast ? (
          <Pressable
            onPress={() => void handleSkip()}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t("common.skip")}
          >
            <Text style={styles.skip}>{t("common.skip")}</Text>
          </Pressable>
        ) : (
          <View style={styles.skipPlaceholder} />
        )}
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        scrollEventThrottle={16}
        decelerationRate="fast"
        style={styles.pager}
      >
        {SLIDES.map((slide) => {
          const Illustration = slide.Illustration;
          return (
            <View key={slide.key} style={[styles.page, { width: SCREEN_WIDTH }]}>
              <Animated.View style={[styles.illustrationWrap, { opacity: fade }]}>
                <Illustration size={Math.min(240, SCREEN_WIDTH * 0.58)} />
              </Animated.View>
              <Animated.View style={{ opacity: fade }}>
                <Text style={styles.title}>{t(slide.titleKey)}</Text>
                <Text style={styles.body}>{t(slide.bodyKey)}</Text>
              </Animated.View>
            </View>
          );
        })}
      </ScrollView>

      <View style={styles.footer}>
        <Button
          onPress={handlePrimary}
          fullWidth
          accessibilityLabel={
            isLast ? t("gettingStarted.getStarted") : t("common.continue")
          }
        >
          {isLast ? t("gettingStarted.getStarted") : t("common.continue")}
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
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing[5],
    paddingTop: spacing[3],
    paddingBottom: spacing[2]
  },
  dots: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2]
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border.strong
  },
  dotActive: {
    width: 22,
    backgroundColor: colors.brand.primary
  },
  skip: {
    ...typography.bodyEmphasis,
    color: colors.text.secondary
  },
  skipPlaceholder: {
    width: 40
  },
  pager: {
    flex: 1
  },
  page: {
    flex: 1,
    paddingHorizontal: spacing[6],
    justifyContent: "center",
    gap: spacing[5]
  },
  illustrationWrap: {
    alignItems: "center",
    marginBottom: spacing[2]
  },
  title: {
    ...typography.h1,
    color: colors.text.primary,
    textAlign: "center"
  },
  body: {
    ...typography.body,
    color: colors.text.secondary,
    textAlign: "center",
    marginTop: spacing[3],
    lineHeight: 24
  },
  footer: {
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[4],
    paddingTop: spacing[2]
  }
});
