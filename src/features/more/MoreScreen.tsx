import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";

import { AppBar } from "@/components/core/AppBar";
import { Button } from "@/components/core/Button";
import { useSnackbar } from "@/components/core/SnackbarProvider";
import { colors, radius, spacing, typography } from "@/design-system/tokens";
import { resetAppData } from "@/database/reset";
import { useAuth } from "@/features/auth/AuthProvider";
import { AuthError } from "@/firebase/auth";
import { backupScheduler } from "@/backup/backup-scheduler";
import { syncScheduler } from "@/sync/sync-scheduler";
import type { RootStackParamList } from "@/application/AppNavigator";

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function MoreScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const { signOut, deleteAccount } = useAuth();
  const { showSnackbar } = useSnackbar();
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);

  async function handleSyncNow() {
    if (syncing) return;
    setSyncing(true);
    try {
      const outcome = await syncScheduler.runNow();
      if (outcome.result === "skipped") {
        showSnackbar(
          outcome.reason === "offline"
            ? t("sync.result.offline")
            : t("sync.result.noWork")
        );
        return;
      }
      const { push, pull } = outcome;
      const conflicts = push.conflicts + (pull?.conflicts ?? 0);
      const errored = push.errors > 0 || (pull?.errors ?? 0) > 0;
      if (errored && push.pushed === 0 && (pull?.applied ?? 0) === 0) {
        showSnackbar({
          message: t("sync.result.failed"),
          variant: "error"
        });
        return;
      }
      if (push.pushed === 0 && (pull?.applied ?? 0) === 0 && conflicts === 0) {
        showSnackbar(t("sync.result.noWork"));
        return;
      }
      showSnackbar(
        conflicts > 0
          ? t("sync.result.doneWithConflicts", { conflicts })
          : t("sync.result.done", {
              pushed: push.pushed,
              applied: pull?.applied ?? 0
            })
      );
    } finally {
      setSyncing(false);
    }
  }

  async function handleExportSnapshot() {
    if (busy || syncing) return;
    Alert.alert(
      t("backup.export.title"),
      t("backup.export.message"),
      [
        { style: "cancel", text: t("common.cancel") },
        {
          onPress: () => void runExportSnapshot(),
          text: t("backup.export.confirm")
        }
      ]
    );
  }

  async function runExportSnapshot() {
    setBusy(true);
    try {
      const outcome = await backupScheduler.runNow();
      if (outcome === null) {
        showSnackbar(t("backup.export.busy"));
        return;
      }
      if (outcome.result === "success") {
        showSnackbar(
          t("backup.export.success", {
            size: formatBytes(outcome.ciphertextSizeBytes)
          })
        );
      } else if (outcome.result === "skipped") {
        showSnackbar(
          outcome.reason === "offline"
            ? t("sync.result.offline")
            : t("backup.export.skipped", { reason: outcome.reason })
        );
      } else if (outcome.result === "cancelled") {
        showSnackbar(t("backup.export.cancelled"));
      } else {
        showSnackbar({
          message: t("backup.export.failed", {
            message: outcome.message
          }),
          variant: "error"
        });
      }
    } finally {
      setBusy(false);
    }
  }

  function handleReset() {
    Alert.alert(
      "Reset app data?",
      "This deletes the local database and reloads the app. Only enabled in development.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: () => {
            void resetAppData();
          }
        }
      ]
    );
  }

  function handleLogout() {
    Alert.alert(
      t("auth.signOut.title"),
      t("auth.signOut.message"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("auth.signOut.confirm"),
          style: "destructive",
          onPress: async () => {
            if (busy) return;
            setBusy(true);
            try {
              await signOut();
              // AuthProvider will flip status → signed-out and swap navigators.
            } catch {
              Alert.alert(t("auth.signOut.failed"));
              setBusy(false);
            }
          }
        }
      ]
    );
  }

  function handleDeleteAccount() {
    Alert.alert(
      t("auth.delete.title"),
      t("auth.delete.message"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("auth.delete.confirm"),
          style: "destructive",
          onPress: () => confirmDeleteAccount()
        }
      ]
    );
  }

  async function confirmDeleteAccount() {
    if (busy) return;
    setBusy(true);
    try {
      await deleteAccount();
      // Firebase user is gone. Reset local DB then reload; AuthProvider will
      // resolve to signed-out on next boot.
      await resetAppData();
    } catch (err) {
      setBusy(false);
      if (err instanceof AuthError && err.code === "requires-recent-login") {
        // The user's session is too old. Sign them out so they re-auth via
        // OTP, then they can retry deletion from the fresh session.
        Alert.alert(
          t("auth.delete.title"),
          t("auth.delete.requiresRecentLogin"),
          [
            {
              text: t("auth.signOut.confirm"),
              style: "destructive",
              onPress: () => {
                void signOut();
              }
            },
            { text: t("common.cancel"), style: "cancel" }
          ]
        );
        return;
      }
      Alert.alert(t("auth.delete.failed"));
    }
  }

  return (
    <View style={styles.root}>
      <AppBar title={t("more.title")} />
      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
      >
        <Tile
          icon="wallet-outline"
          label={t("more.staffAdvances")}
          sub={t("more.staffAdvancesSub")}
          onPress={() => navigation.navigate("AdvancesList")}
        />

        <Tile
          icon="sync-outline"
          label={t("more.syncNow")}
          sub={t("more.syncNowSub")}
          onPress={handleSyncNow}
        />

        <Tile
          icon="pulse-outline"
          label={t("more.syncStatus")}
          sub={t("more.syncStatusSub")}
          onPress={() => navigation.navigate("SyncStatus")}
        />

        <Tile
          icon="cloud-upload-outline"
          label={t("more.exportSnapshot")}
          sub={t("more.exportSnapshotSub")}
          onPress={handleExportSnapshot}
        />

        <Text style={styles.sectionLabel}>{t("more.account")}</Text>

        <Tile
          icon="log-out-outline"
          label={t("more.logOut")}
          sub={t("more.logOutSub")}
          onPress={handleLogout}
        />

        <Tile
          icon="trash-outline"
          label={t("more.deleteAccount")}
          sub={t("more.deleteAccountSub")}
          onPress={handleDeleteAccount}
          destructive
        />

        {__DEV__ ? (
          <View style={styles.devSection}>
            <Text style={styles.devTitle}>Developer</Text>
            <Text style={styles.devHelper}>
              Wipe the SQLite database and reload the app. Useful for testing
              onboarding.
            </Text>
            <Button variant="destructive" onPress={handleReset} fullWidth>
              Reset app data
            </Button>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

// ─── helpers ─────────────────────────────────────────────────────────────────

/** Human-readable byte count for the export-snapshot success toast. */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}

// ─── Tile ────────────────────────────────────────────────────────────────────

function Tile({
  icon,
  label,
  onPress,
  sub,
  destructive = false
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  sub?: string;
  onPress: () => void;
  destructive?: boolean;
}) {
  const iconColor = destructive ? colors.status.danger : colors.brand.primary;
  const iconBg = destructive
    ? colors.status.dangerBg
    : colors.brand.accentLight;
  const labelColor = destructive ? colors.status.danger : colors.text.primary;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={[styles.tileIcon, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={20} color={iconColor} />
      </View>
      <View style={styles.tileText}>
        <Text style={[styles.tileLabel, { color: labelColor }]}>{label}</Text>
        {sub ? <Text style={styles.tileSub}>{sub}</Text> : null}
      </View>
      <Ionicons
        name="chevron-forward"
        size={20}
        color={colors.text.muted}
      />
    </Pressable>
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
  sectionLabel: {
    ...typography.overline,
    color: colors.text.muted,
    marginTop: spacing[4]
  },
  tile: {
    alignItems: "center",
    backgroundColor: colors.surface.default,
    borderColor: colors.border.subtle,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing[3],
    padding: spacing[3]
  },
  tilePressed: {
    backgroundColor: colors.interactive.pressed
  },
  tileIcon: {
    alignItems: "center",
    borderRadius: radius.full,
    height: 36,
    justifyContent: "center",
    width: 36
  },
  tileText: {
    flex: 1,
    gap: 2
  },
  tileLabel: {
    ...typography.body,
    color: colors.text.primary,
    fontWeight: "600"
  },
  tileSub: {
    ...typography.caption,
    color: colors.text.muted
  },
  devSection: {
    marginTop: spacing[4],
    padding: spacing[4],
    gap: spacing[2],
    backgroundColor: colors.surface.default,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.subtle
  },
  devTitle: {
    ...typography.overline,
    color: colors.text.muted
  },
  devHelper: {
    ...typography.bodySmall,
    color: colors.text.secondary,
    marginBottom: spacing[2]
  }
});
