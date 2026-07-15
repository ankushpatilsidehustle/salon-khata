import * as BackgroundTask from "expo-background-task";
import * as TaskManager from "expo-task-manager";

import { runAllMigrations } from "@/database/migrations";
import { loadDeviceIdentity } from "@/device/device-identity";
import { startNetworkManager, isOnline } from "@/network/network-manager";
import { getPersistedSalonId } from "@/session/session-storage";
import { syncService } from "@/sync/sync-service";

/**
 * `expo-background-task` worker that opportunistically drains the sync
 * queue + pulls remote changes while the app is not foregrounded.
 *
 * Companion to `src/backup/background-task.ts` (whole-DB DR backup) —
 * uses a distinct task name so both can register independently and be
 * scheduled by the OS on its own cadence.
 *
 * Design notes:
 *
 *   - The OS decides *if* and *when* to fire (BGTaskScheduler on iOS,
 *     WorkManager on Android). Our requested interval is a lower bound.
 *   - JS runtime is cold when the OS invokes us: no React, no
 *     AuthProvider, no NetworkManager subscription. This worker
 *     rebootstraps the minimum context needed for sync.
 *   - `TaskManager.defineTask` MUST be called at module top level so the
 *     JS bundle registers the task before RN calls back into it.
 *     `registerBackgroundSyncTask()` is called later from AppRoot to
 *     actually enable the schedule.
 *   - Both `pushOnce` and `pullOnce` are called; each is per-record and
 *     small, so the whole cycle typically completes within a few seconds
 *     — well inside the OS budget for background tasks.
 */

/** Task name — must be unique across the app; used by TaskManager. */
export const SYNC_TASK_NAME = "salon-khata.sync.periodic";

/** Requested minimum interval in minutes. The OS may enforce longer gaps. */
const MIN_INTERVAL_MINUTES = 60; // Roughly hourly on Android; iOS decides.

/** Register the task handler at module load — required by TaskManager. */
TaskManager.defineTask(SYNC_TASK_NAME, async () => {
  try {
    // 1. Rebootstrap the minimum runtime the sync engine needs.
    runAllMigrations();
    await loadDeviceIdentity();
    startNetworkManager();

    // 2. Resolve the active salon from persistent session storage.
    const salonId = await getPersistedSalonId();
    if (!salonId) {
      // Signed-out device — nothing to sync.
      return BackgroundTask.BackgroundTaskResult.Success;
    }

    // 3. Bail on offline — the OS will re-schedule when connectivity
    //    returns rather than us burning our background slot waiting.
    if (!isOnline()) {
      return BackgroundTask.BackgroundTaskResult.Success;
    }

    // 4. Drain the queue then pull remote changes.
    const push = await syncService.pushOnce(salonId);
    const pull = await syncService.pullOnce(salonId);

    // Signal "Failed" only when a genuine transport error surfaced. The
    // OS uses this hint to throttle future invocations.
    const failed = push.errors > 0 || pull.errors > 0;
    return failed
      ? BackgroundTask.BackgroundTaskResult.Failed
      : BackgroundTask.BackgroundTaskResult.Success;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      `[background-sync] worker threw: ${err instanceof Error ? err.message : String(err)}`
    );
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

/**
 * Register the periodic worker with the OS. Idempotent — safe to call on
 * every app start. On platforms without background execution this
 * resolves to a no-op.
 */
export async function registerBackgroundSyncTask(): Promise<void> {
  try {
    const status = await BackgroundTask.getStatusAsync();
    if (status !== BackgroundTask.BackgroundTaskStatus.Available) {
      // eslint-disable-next-line no-console
      console.info(
        "[background-sync] not available on this platform / restricted"
      );
      return;
    }

    const alreadyRegistered = await TaskManager.isTaskRegisteredAsync(
      SYNC_TASK_NAME
    );
    if (alreadyRegistered) return;

    await BackgroundTask.registerTaskAsync(SYNC_TASK_NAME, {
      minimumInterval: MIN_INTERVAL_MINUTES
    });
  } catch (err) {
    // Registration failures shouldn't block app startup — the in-app
    // SyncScheduler still covers all the primary triggers.
    // eslint-disable-next-line no-console
    console.warn(
      `[background-sync] registration failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

/**
 * Unregister the worker. Called on sign-out so a signed-out device stops
 * waking to try (and fail) syncs.
 */
export async function unregisterBackgroundSyncTask(): Promise<void> {
  try {
    const alreadyRegistered = await TaskManager.isTaskRegisteredAsync(
      SYNC_TASK_NAME
    );
    if (!alreadyRegistered) return;
    await TaskManager.unregisterTaskAsync(SYNC_TASK_NAME);
  } catch {
    // Non-fatal.
  }
}
