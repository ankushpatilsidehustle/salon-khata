import type { BackupTrigger } from "@/application/event-bus";
import {
  runBackupOnce,
  type BackupOutcome,
  type RunBackupOptions
} from "@/backup/backup-pipeline";
import { getBackupPreferences } from "@/backup/backup-preferences";
import {
  createCancelToken,
  type CancelToken
} from "@/cloud/cloud-backup-client";

/**
 * BackupScheduler — MANUAL-ONLY orchestrator for the whole-DB
 * disaster-recovery file backup.
 *
 * As of Phase 7 the per-record sync engine (`syncScheduler`) is the
 * primary sync mechanism. The file-backup pipeline is retained solely as
 * a safety net for catastrophic scenarios that per-record sync would
 * faithfully replicate (e.g. "user tapped Delete on 500 rows"):
 *
 *   - No AppState triggers.
 *   - No `db:dirty` debounce.
 *   - No network-reconnect trigger.
 *   - No periodic timer.
 *   - No auto retry backoff.
 *   - No OS-level background-task registration (see AppRoot.tsx).
 *
 * The only way to fire a backup now is `runNow()` — invoked from an
 * "Export snapshot" tile in `MoreScreen`. Failure surfaces to the user
 * immediately; there is no silent retry.
 *
 * Kept surface:
 *   - `start(salonId)` — records the salon id for `runNow()`. Does NOT
 *     subscribe to any events.
 *   - `stop()` — clears the salon id and cancels any in-flight attempt.
 *   - `runNow()` — user-initiated backup. Returns the typed outcome so
 *     the UI can render a snackbar with the result.
 *   - `cancelInFlight()` — safety hook for edge cases.
 *
 * Kept alive but no longer auto-invoked:
 *   - `BackupPipeline` (`runBackupOnce`) — full snapshot + gzip + encrypt
 *     + upload + Firestore metadata commit path.
 *   - `DeviceLock` — the pipeline still acquires it so a second device
 *     can't race an emergency backup. (Multi-writer per-record sync
 *     uses per-record OCC instead of the file-level lock.)
 *   - `BackupHistory` — still records every attempt, still surfaced in
 *     the diagnostic UI.
 */

class BackupScheduler {
  private salonId: string | null = null;

  private currentRun: Promise<BackupOutcome> | null = null;
  private currentCancel: CancelToken | null = null;

  /**
   * Record the salon id so `runNow()` has something to pass to the
   * pipeline. Idempotent — repeated calls are no-ops. Called from
   * `AuthProvider` on sign-in.
   *
   * No subscriptions, no timers, no side effects. The old auto-trigger
   * behaviour was stripped in Phase 7 when the per-record sync engine
   * took over primary sync duty.
   */
  start(salonId: string): void {
    this.salonId = salonId;
  }

  /**
   * Clear the salon id and cancel any in-flight backup. Called from
   * `AuthProvider` on sign-out.
   */
  stop(): void {
    this.cancelInFlight();
    this.salonId = null;
    this.currentRun = null;
    this.currentCancel = null;
  }

  /**
   * User-initiated backup. Fails fast if offline (surface to the UI
   * without a 20 s wait) and ignores the `dirty_since` clean flag (users
   * can always request a safety snapshot).
   *
   * Returns `null` when no salon is set (signed-out), when backups are
   * disabled in preferences, or when another `runNow()` is already in
   * flight. Otherwise returns the pipeline's typed outcome.
   */
  async runNow(): Promise<BackupOutcome | null> {
    if (!this.salonId) return null;
    if (this.currentRun) return null;

    const prefs = getBackupPreferences();
    if (!prefs.backupsEnabled) return null;

    const cancelToken = createCancelToken();
    this.currentCancel = cancelToken;

    const options: RunBackupOptions = {
      cancelToken,
      failFastIfOffline: true,
      ignoreCleanFlag: true,
      salonId: this.salonId,
      trigger: "manual" satisfies BackupTrigger,
      wifiOnly: prefs.wifiOnly
    };

    const runPromise = runBackupOnce(options);
    this.currentRun = runPromise;

    try {
      return await runPromise;
    } finally {
      this.currentRun = null;
      this.currentCancel = null;
    }
  }

  /**
   * Cancel any in-flight attempt. Safe to call when idle. Called from
   * `stop()` on sign-out so the pipeline doesn't outlive the auth session.
   */
  cancelInFlight(): void {
    this.currentCancel?.cancel();
  }
}

/**
 * Process-wide singleton. Instantiated eagerly so import order doesn't
 * matter. Does nothing until `start(salonId)` is called.
 */
export const backupScheduler = new BackupScheduler();
