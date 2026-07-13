import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { colors, radius, spacing, typography } from "@/design-system/tokens";

type BottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  /** Header right-side action (e.g. Save button). */
  headerAction?: ReactNode;
  /**
   * Sticky footer rendered below `children`, above the safe-area padding.
   * Use this for primary actions (Save, Confirm) so they stay visible even
   * when the keyboard is open and the content scrolls.
   */
  footer?: ReactNode;
  /**
   * Sheet size preset.
   * - `auto` (default): sizes to content, capped at 92% of screen.
   * - `tall`: pins the sheet to ~85% of screen so long forms have room.
   */
  size?: "auto" | "tall";
  /**
   * When true, tapping the scrim dismisses the sheet.
   * Set false for forms with unsaved changes.
   */
  dismissOnBackdropPress?: boolean;
  children: ReactNode;
  testID?: string;
};

/**
 * Simple bottom sheet built on RN Modal + Animated slide.
 * Rounded top corners, drag-handle affordance, safe-area padded footer area
 * inherited by consumers via `insets.bottom` if they add their own footer.
 */
export function BottomSheet({
  children,
  dismissOnBackdropPress = true,
  footer,
  headerAction,
  onClose,
  size = "auto",
  testID,
  title,
  visible
}: BottomSheetProps) {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(600)).current;
  const backdrop = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: 260,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true
        }),
        Animated.timing(backdrop, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true
        })
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 600,
          duration: 200,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true
        }),
        Animated.timing(backdrop, {
          toValue: 0,
          duration: 160,
          useNativeDriver: true
        })
      ]).start();
    }
  }, [visible, translateY, backdrop]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.root} testID={testID}>
        <Animated.View style={[styles.backdrop, { opacity: backdrop }]}>
          <Pressable
            style={styles.backdropTouchable}
            onPress={dismissOnBackdropPress ? onClose : undefined}
            accessibilityRole="button"
            accessibilityLabel="Dismiss"
          />
        </Animated.View>

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.avoider}
          pointerEvents="box-none"
        >
          <Animated.View
            style={[
              styles.sheet,
              size === "tall" && styles.sheetTall,
              { transform: [{ translateY }] }
            ]}
          >
            <View style={styles.handle} />

            {(title || headerAction) && (
              <View style={styles.header}>
                <Pressable
                  onPress={onClose}
                  hitSlop={12}
                  style={styles.closeButton}
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                >
                  <Ionicons name="close" size={22} color={colors.text.secondary} />
                </Pressable>
                <Text style={styles.title} numberOfLines={1}>
                  {title}
                </Text>
                <View style={styles.headerAction}>{headerAction}</View>
              </View>
            )}

            {/* Scrollable content area — shrinks so the footer stays visible. */}
            <View
              style={[
                styles.content,
                size === "tall" && styles.contentTall
              ]}
            >
              {children}
            </View>

            {footer ? (
              <View style={[styles.footer, { paddingBottom: insets.bottom + spacing[3] }]}>
                {footer}
              </View>
            ) : (
              <View style={{ height: insets.bottom + spacing[4] }} />
            )}
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "flex-end"
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay.scrim
  },
  backdropTouchable: {
    flex: 1
  },
  avoider: {
    flex: 1,
    justifyContent: "flex-end"
  },
  sheet: {
    backgroundColor: colors.surface.default,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: spacing[2],
    maxHeight: "92%"
  },
  sheetTall: {
    height: "85%"
  },
  content: {
    flexShrink: 1
  },
  contentTall: {
    flex: 1
  },
  footer: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[3],
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
    backgroundColor: colors.surface.default
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: radius.full,
    backgroundColor: colors.border.strong,
    marginBottom: spacing[2]
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    gap: spacing[2]
  },
  closeButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center"
  },
  title: {
    ...typography.h3,
    color: colors.text.primary,
    flex: 1
  },
  headerAction: {
    marginLeft: "auto"
  }
});
