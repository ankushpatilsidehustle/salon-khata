import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { AppBar } from "@/components/core/AppBar";
import { Button } from "@/components/core/Button";
import { Card } from "@/components/core/Card";
import { SectionHeader } from "@/components/core/SectionHeader";
import { useSnackbar } from "@/components/core/SnackbarProvider";
import { colors, radius, spacing, typography } from "@/design-system/tokens";
import { database } from "@/database/sqlite-client";
import { useAuth } from "@/features/auth/AuthProvider";
import { queueManager } from "@/sync/queue-manager";
import {
  syncHistoryRepo,
  type SyncHistoryEntry
} from "@/sync/sync-history-repo";
import { syncScheduler } from "@/sync/sync-scheduler";
import { syncStateStore } from "@/sync/sync-state-store";
import type { SyncQueueRow } from "@/sync/types";

/** Shorthand — `react-i18next`'s `TFunction` is unwieldy to spell out. */
type TFn = ReturnType<typeof useTranslation>["t"];

/**
 * Sync Status screen — observability for the per-record sync engine.
 *
 * Sections:
 *   1. Hero card: last successful sync (relative) + queue depth chips.
 *   2. "Sync now" button — same handler as MoreScreen's tile.
 *   3. Dead-letters list (when non-empty) — rows the engine gave up on
 *      after 7 retries. Each row has Retry (reopenWithFreshBase) and
 *      Discard (delete queue entry — user must edit the record to try
 *      again) actions.
 *   4. Recent conflicts (last 10 from conflict_log).
 *   5. Recent activity (last 20 sync_history rows).
 *
 * All reads are synchronous (SQLite) and cheap — the whole screen
 * re-fetches on pull-to-refresh and after every action button tap.
 */
export function SyncStatusScreen() {
  const { t } = useTranslation();
  const { salonId } = useAuth();
  const { showSnackbar } = useSnackbar();

  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<StatusState>(() => emptyState());

  const load = useCallback(() => {
    if (!salonId) {
      setState(emptyState());
      return;
    }
    setState({
      conflicts: loadConflicts(salonId),
      deadLetters: queueManager.countByStatus(salonId).dead > 0
        ? loadDeadLetters(salonId)
        : [],
      history: syncHistoryRepo.listRecent(salonId, 20),
      lastFullSyncAt: syncStateStore.getLastFullSyncAt(),
      lastSuccess: syncHistoryRepo.latestSuccess(salonId),
      queue: queueManager.countByStatus(salonId)
    });
  }, [salonId]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
    // The load is synchronous; short spin so the user feels the pull.
    setTimeout(() => setRefreshing(false), 250);
  }, [load]);

  async function handleSyncNow() {
    if (busy) return;
    setBusy(true);
    try {
      const outcome = await syncScheduler.runNow();
      if (outcome.result === "skipped") {
        showSnackbar(
          outcome.reason === "offline"
            ? t("sync.result.offline")
            : t("sync.result.noWork")
        );
      } else {
        const conflicts =
          outcome.push.conflicts + (outcome.pull?.conflicts ?? 0);
        if (
          outcome.push.pushed === 0 &&
          (outcome.pull?.applied ?? 0) === 0 &&
          conflicts === 0
        ) {
          showSnackbar(t("sync.result.noWork"));
        } else if (conflicts > 0) {
          showSnackbar(t("sync.result.doneWithConflicts", { conflicts }));
        } else {
          showSnackbar(
            t("sync.result.done", {
              applied: outcome.pull?.applied ?? 0,
              pushed: outcome.push.pushed
            })
          );
        }
      }
    } finally {
      setBusy(false);
      load();
    }
  }

  function handleRetry(row: SyncQueueRow) {
    queueManager.reopenWithFreshBase(row.id);
    load();
    // Kick a cycle so the user sees the retry attempt happen immediately.
    void syncScheduler.runNow();
  }

  function handleDiscard(row: SyncQueueRow) {
    Alert.alert(
      t("syncStatus.discardTitle"),
      t("syncStatus.discardMessage"),
      [
        { style: "cancel", text: t("common.cancel") },
        {
          onPress: () => {
            database.runSync(`DELETE FROM sync_queue WHERE id = ?`, [row.id]);
            load();
          },
          style: "destructive",
          text: t("syncStatus.discardConfirm")
        }
      ]
    );
  }

  return (
    <View style={styles.root}>
      <AppBar title={t("syncStatus.title")} />
      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Hero */}
        <Card>
          <Text style={styles.heroLabel}>{t("syncStatus.lastSynced")}</Text>
          <Text style={styles.heroValue}>
            {state.lastFullSyncAt
              ? formatRelative(state.lastFullSyncAt, t)
              : t("syncStatus.never")}
          </Text>
          <View style={styles.chipRow}>
            <StatChip
              label={t("syncStatus.pending", { count: state.queue.queued })}
              tone="info"
            />
            {state.queue.processing > 0 ? (
              <StatChip
                label={t("syncStatus.syncing", {
                  count: state.queue.processing
                })}
                tone="warning"
              />
            ) : null}
            {state.queue.dead > 0 ? (
              <StatChip
                label={t("syncStatus.failed", { count: state.queue.dead })}
                tone="danger"
              />
            ) : null}
          </View>
        </Card>

        <Button variant="primary" fullWidth onPress={handleSyncNow}>
          {busy ? t("common.loading") : t("more.syncNow")}
        </Button>

        {/* Dead letters */}
        {state.deadLetters.length > 0 ? (
          <>
            <SectionHeader
              title={t("syncStatus.deadLetters", {
                count: state.deadLetters.length
              })}
            />
            {state.deadLetters.map((row) => (
              <DeadLetterCard
                key={row.id}
                row={row}
                onRetry={() => handleRetry(row)}
                onDiscard={() => handleDiscard(row)}
                t={t}
              />
            ))}
          </>
        ) : null}

        {/* Recent conflicts */}
        {state.conflicts.length > 0 ? (
          <>
            <SectionHeader title={t("syncStatus.recentConflicts")} />
            {state.conflicts.map((c) => (
              <View key={c.id} style={styles.conflictRow}>
                <Text style={styles.rowTitle}>{c.entity_type}</Text>
                <Text style={styles.rowSub}>
                  {c.resolution === "local-won"
                    ? t("syncStatus.localWon")
                    : t("syncStatus.remoteWon")}{" "}
                  · {c.reason} · {formatRelative(c.created_at, t)}
                </Text>
              </View>
            ))}
          </>
        ) : null}

        {/* Recent activity */}
        <SectionHeader title={t("syncStatus.recentActivity")} />
        {state.history.length === 0 ? (
          <Text style={styles.emptyHint}>{t("syncStatus.noActivity")}</Text>
        ) : (
          state.history.map((h) => (
            <HistoryRow key={h.id} entry={h} t={t} />
          ))
        )}
      </ScrollView>
    </View>
  );
}

// ─── local types ─────────────────────────────────────────────────────────────

type ConflictLogRow = {
  id: string;
  entity_type: string;
  entity_id: string;
  resolution: "local-won" | "remote-won" | "merged";
  reason: string | null;
  created_at: string;
};

type StatusState = {
  lastFullSyncAt: string | null;
  lastSuccess: SyncHistoryEntry | null;
  queue: { queued: number; processing: number; dead: number };
  deadLetters: SyncQueueRow[];
  history: SyncHistoryEntry[];
  conflicts: ConflictLogRow[];
};

function emptyState(): StatusState {
  return {
    conflicts: [],
    deadLetters: [],
    history: [],
    lastFullSyncAt: null,
    lastSuccess: null,
    queue: { dead: 0, processing: 0, queued: 0 }
  };
}

function loadDeadLetters(salonId: string): SyncQueueRow[] {
  return database.getAllSync<SyncQueueRow>(
    `SELECT * FROM sync_queue
     WHERE salon_id = ? AND status = 'dead'
     ORDER BY updated_at DESC
     LIMIT 50`,
    [salonId]
  );
}

function loadConflicts(salonId: string): ConflictLogRow[] {
  return database.getAllSync<ConflictLogRow>(
    `SELECT id, entity_type, entity_id, resolution, reason, created_at
     FROM conflict_log
     WHERE salon_id = ?
     ORDER BY created_at DESC
     LIMIT 10`,
    [salonId]
  );
}

// ─── sub-components ──────────────────────────────────────────────────────────

function StatChip({
  label,
  tone
}: {
  label: string;
  tone: "info" | "warning" | "danger";
}) {
  const bg =
    tone === "danger"
      ? colors.status.dangerBg
      : tone === "warning"
        ? colors.status.warningBg
        : colors.status.infoBg;
  const fg =
    tone === "danger"
      ? colors.status.danger
      : tone === "warning"
        ? colors.status.warning
        : colors.status.info;
  return (
    <View style={[styles.chip, { backgroundColor: bg }]}>
      <Text style={[styles.chipText, { color: fg }]}>{label}</Text>
    </View>
  );
}

function DeadLetterCard({
  row,
  onRetry,
  onDiscard,
  t
}: {
  row: SyncQueueRow;
  onRetry: () => void;
  onDiscard: () => void;
  t: TFn;
}) {
  return (
    <Card padding="compact" style={styles.deadCard}>
      <Text style={styles.rowTitle}>{row.entity_type}</Text>
      <Text style={styles.rowSubMono} numberOfLines={1}>
        {row.entity_id}
      </Text>
      {row.error_code ? (
        <Text style={styles.errorText}>
          {row.error_code}
          {row.error_message ? ` · ${row.error_message}` : ""}
        </Text>
      ) : null}
      <View style={styles.deadActions}>
        <Pressable onPress={onRetry} style={styles.actionBtn}>
          <Ionicons
            name="refresh"
            size={16}
            color={colors.brand.primary}
          />
          <Text style={styles.actionLabel}>{t("syncStatus.retry")}</Text>
        </Pressable>
        <Pressable onPress={onDiscard} style={styles.actionBtn}>
          <Ionicons
            name="trash-outline"
            size={16}
            color={colors.status.danger}
          />
          <Text style={[styles.actionLabel, { color: colors.status.danger }]}>
            {t("syncStatus.discard")}
          </Text>
        </Pressable>
      </View>
    </Card>
  );
}

function HistoryRow({
  entry,
  t
}: {
  entry: SyncHistoryEntry;
  t: TFn;
}) {
  const resultColor =
    entry.result === "success"
      ? colors.status.success
      : entry.result === "partial"
        ? colors.status.warning
        : colors.text.muted;
  return (
    <View style={styles.historyRow}>
      <View style={styles.historyLeft}>
        <View style={[styles.resultDot, { backgroundColor: resultColor }]} />
        <View>
          <Text style={styles.rowTitle}>
            {t(`syncStatus.trigger.${entry.trigger}`, {
              defaultValue: entry.trigger
            })}
          </Text>
          <Text style={styles.rowSub}>
            {formatRelative(entry.started_at, t)} · {entry.duration_ms}ms ·{" "}
            {entry.network_type}
          </Text>
        </View>
      </View>
      <Text style={styles.historyCounts}>
        ↑{entry.pushed_count} ↓{entry.applied_count}
        {entry.errors_count > 0 ? ` · ${entry.errors_count} err` : ""}
      </Text>
    </View>
  );
}

// ─── helpers ─────────────────────────────────────────────────────────────────

/**
 * Simple relative-time formatter — good enough for a support screen. Not
 * localized beyond the unit strings (which come from the i18n bundle).
 */
function formatRelative(iso: string, t: TFn): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return t("syncStatus.time.justNow");
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return t("syncStatus.time.minutesAgo", { count: mins });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t("syncStatus.time.hoursAgo", { count: hours });
  const days = Math.floor(hours / 24);
  return t("syncStatus.time.daysAgo", { count: days });
}

// ─── styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  actionBtn: {
    alignItems: "center",
    borderRadius: radius.sm,
    flexDirection: "row",
    gap: spacing[1],
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1]
  },
  actionLabel: {
    ...typography.button,
    color: colors.brand.primary,
    fontSize: 14
  },
  body: {
    gap: spacing[3],
    padding: spacing[4],
    paddingBottom: spacing[8]
  },
  chip: {
    borderRadius: radius.full,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1]
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[2],
    marginTop: spacing[3]
  },
  chipText: {
    ...typography.caption,
    fontWeight: "600"
  },
  conflictRow: {
    backgroundColor: colors.surface.default,
    borderRadius: radius.sm,
    padding: spacing[3]
  },
  deadActions: {
    flexDirection: "row",
    gap: spacing[3],
    marginTop: spacing[2]
  },
  deadCard: {
    borderColor: colors.status.dangerBg,
    borderWidth: 1
  },
  emptyHint: {
    ...typography.bodySmall,
    color: colors.text.muted,
    paddingVertical: spacing[3],
    textAlign: "center"
  },
  errorText: {
    ...typography.caption,
    color: colors.status.danger,
    marginTop: spacing[1]
  },
  heroLabel: {
    ...typography.overline,
    color: colors.text.muted
  },
  heroValue: {
    ...typography.h2,
    color: colors.text.primary,
    marginTop: spacing[1]
  },
  historyCounts: {
    ...typography.caption,
    color: colors.text.muted,
    fontVariant: ["tabular-nums"]
  },
  historyLeft: {
    alignItems: "center",
    flexDirection: "row",
    flex: 1,
    gap: spacing[2]
  },
  historyRow: {
    alignItems: "center",
    backgroundColor: colors.surface.default,
    borderRadius: radius.sm,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2]
  },
  resultDot: {
    borderRadius: 4,
    height: 8,
    width: 8
  },
  root: {
    backgroundColor: colors.background.default,
    flex: 1
  },
  rowSub: {
    ...typography.caption,
    color: colors.text.muted
  },
  rowSubMono: {
    ...typography.caption,
    color: colors.text.secondary,
    fontVariant: ["tabular-nums"]
  },
  rowTitle: {
    ...typography.bodyEmphasis,
    color: colors.text.primary
  }
});
