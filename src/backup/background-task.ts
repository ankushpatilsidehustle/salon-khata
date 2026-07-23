import * as BackgroundTask from "expo-background-task";
import * as TaskManager from "expo-task-manager";

import { runAllMigrations } from "@/database/migrations";
import { loadDeviceIdentity } from "@/device/device-identity";
import { startNetworkManager, isOnline } from "@/network/network-manager";
import { loadBackupPreferences } from "@/backup/backup-preferences";
import { runBackupOnce } from "@/backup/backup-pipeline";
import { getPersistedSalonId } from "@/session/session-storage";
import { logger } from "@/observability/logging/logger";
import { recordNonFatal } from "@/observability/crash/crash-reporter";

/**
 * `expo-background-task` worker that opportunistically runs the backup
 * pipeline while the app is not foregrounded.
 *
 * Design notes:
 *
 *   - The OS decides *if* and *when* to fire this task (BGTaskScheduler on
 *     iOS, WorkManager on Android). Our requested interval is a lower
 *     bound; on iOS it typically runs during the system's overnight
 *     window and only when the device is on a charger + wifi.
 *   - When it does run, the JS runtime is **cold**: no React, no
 *     AuthProvider, no NetworkManager subscription. This worker must
 *     rebootstrap the minimum context (migrations → identity → network →
 *     preferences → pipeline). That's cheap — a few tens of ms of setup
 *     before the ~seconds of actual backup work.
 *   - `TaskManager.defineTask` MUST be called at module top-level so the
 *     JS bundle registers the task before RN calls back into it.
 *
 * **Phase 7 note**: `registerBackgroundBackupTask()` is no longer called
 * on boot — the whole-DB file backup is now manual-only. This module
 * stays alive so `unregisterBackgroundBackupTask()` can defensively
 * clean up any stale registration from a previous app version, and so
 * a future opt-in weekly reminder can re-register on demand.
 *
 * The task deliberately returns quickly (< 30 s target) even when the
 * upload could take longer — Firebase's `putFile` is native and continues
 * uploading via URLSession/WorkManager even if this JS worker returns
 * before it finishes.
 */

/** Task name — must be unique across the app; used by TaskManager. */
export const BACKUP_TASK_NAME = "salon-khata.backup.periodic";

/** Requested minimum interval in minutes. The OS may enforce longer gaps. */
const MIN_INTERVAL_MINUTES = 60; // Roughly hourly on Android; iOS decides.

/** Register the task handler at module load — required by TaskManager. */
TaskManager.defineTask(BACKUP_TASK_NAME, async () => {
  try {
    // 1. Rebootstrap the minimum runtime the pipeline needs.
    runAllMigrations();
    await loadDeviceIdentity();
    startNetworkManager();
    await loadBackupPreferences();

    // 2. Resolve the active salon from persistent session storage.
    const salonId = await getPersistedSalonId();
    if (!salonId) {
      // No signed-in user on this device — nothing to back up.
      return BackgroundTask.BackgroundTaskResult.Success;
    }

    // 3. Preflight checks that mirror the scheduler's cheap guards.
    if (!isOnline()) {
      // No point holding a background slot waiting; iOS/Android will
      // schedule us again when connectivity returns.
      return BackgroundTask.BackgroundTaskResult.Success;
    }

    // 4. Run the pipeline. It handles wifi-only / dirty checks internally.
    const outcome = await runBackupOnce({
      failFastIfOffline: true,
      salonId,
      trigger: "background-task"
    });

    // Only surface a "Failed" result to the OS when the pipeline actually
    // errored — the OS uses this signal to throttle future invocations.
    // Skipped / cancelled / success are all "Success" from the OS's POV.
    return outcome.result === "failed"
      ? BackgroundTask.BackgroundTaskResult.Failed
      : BackgroundTask.BackgroundTaskResult.Success;
  } catch (err) {
    logger.warn("background-task worker threw", {
      category: "background",
      err_code: err instanceof Error ? err.message.slice(0, 80) : "unknown"
    });
    recordNonFatal(err, "background", { extra: { task: "backup" } });
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

/**
 * Register the periodic worker with the OS. Idempotent — safe to call on
 * every app start. On web / platforms without background execution this
 * resolves to a no-op.
 */
export async function registerBackgroundBackupTask(): Promise<void> {
  try {
    const status = await BackgroundTask.getStatusAsync();
    if (status !== BackgroundTask.BackgroundTaskStatus.Available) {
      // eslint-disable-next-line no-console
      console.info(
        "[background-task] not available on this platform / restricted"
      );
      return;
    }

    const alreadyRegistered = await TaskManager.isTaskRegisteredAsync(
      BACKUP_TASK_NAME
    );
    if (alreadyRegistered) return;

    await BackgroundTask.registerTaskAsync(BACKUP_TASK_NAME, {
      minimumInterval: MIN_INTERVAL_MINUTES
    });
  } catch (err) {
    // Registration failures shouldn't block app startup — the in-app
    // scheduler still covers all the primary triggers.
    logger.warn("background-task registration failed", {
      category: "background",
      err_code: err instanceof Error ? err.message.slice(0, 80) : "unknown"
    });
  }
}

/**
 * Unregister the worker. Called on sign-out / account deletion so a
 * signed-out device stops waking to try (and fail) uploads.
 */
export async function unregisterBackgroundBackupTask(): Promise<void> {
  try {
    const alreadyRegistered = await TaskManager.isTaskRegisteredAsync(
      BACKUP_TASK_NAME
    );
    if (!alreadyRegistered) return;
    await TaskManager.unregisterTaskAsync(BACKUP_TASK_NAME);
  } catch {
    // Non-fatal.
  }
}
