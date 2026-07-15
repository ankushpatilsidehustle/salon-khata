import * as Application from "expo-application";
import { File, Paths } from "expo-file-system";

import { eventBus, type BackupTrigger } from "@/application/event-bus";
import { getDeviceIdentity } from "@/device/device-identity";
import { readDirtyState, clearDirtyIfUnchanged } from "@/database/db-meta";
import { getOrCreateDek } from "@/security/key-vault";
import {
  getNetworkState,
  isOnline,
  waitForOnline,
  NetworkTimeoutError
} from "@/network/network-manager";
import { takeSnapshot, SnapshotError } from "@/backup/snapshot";
import { packSnapshot, PackError } from "@/backup/pack";
import {
  BackupHistoryRepository,
  type NetworkType
} from "@/backup/backup-history-repo";
import {
  buildVersionId,
  cacheFileFor,
  FirebaseBackupClient
} from "@/cloud/firebase-backup-client";
import {
  commitBackupMetadata,
  BackupMetadataConflictError
} from "@/cloud/backup-index";
import {
  acquireOrRefreshLock,
  DeviceLockError
} from "@/cloud/device-lock";
import { applyLockCheck } from "@/session/lock-state";
import type {
  CancelToken,
  CloudBackupClient,
  SnapshotMetadata
} from "@/cloud/cloud-backup-client";
import { CloudBackupError } from "@/cloud/cloud-backup-client";

/**
 * BackupPipeline — end-to-end orchestration of a single backup attempt.
 *
 *   dirty check ─►  snapshot ─►  pack ─►  write cache file ─►
 *   commit Firestore metadata ─► upload blob ─► clear dirty flag ─►
 *   record history
 *
 * Every stage is:
 *   - **Cancellable** via `CancelToken` (checked between stages).
 *   - **Bounded** — the pipeline holds no reference to plaintext bytes
 *     after `pack.ts` completes; the temp file is `delete()`d in `finally`.
 *   - **Idempotent** — a retried attempt with the same `versionId` will
 *     hit `BackupMetadataConflictError` and treat it as success.
 *
 * The pipeline itself is **not** retried internally. Retry policy lives in
 * the BackupScheduler (Phase 3) which owns the exponential backoff timer
 * and the "quiet after failure" state. This module runs exactly once per
 * invocation and returns a typed outcome.
 *
 * Concurrency: the exported `runBackupOnce` guards a single in-flight
 * attempt with a module-level lock. A second concurrent call resolves to
 * `{ result: "skipped", reason: "in-flight" }` rather than double-uploading.
 */

export type BackupOutcome =
  | {
      result: "success";
      versionId: string;
      ciphertextSizeBytes: number;
      durationMs: number;
    }
  | {
      result: "skipped";
      reason:
        | "not-dirty"
        | "offline"
        | "wifi-only"
        | "in-flight"
        | "low-disk"
        | "not-authenticated"
        | "not-lock-owner";
    }
  | {
      result: "failed";
      errorCode: string;
      message: string;
      durationMs: number;
    }
  | {
      result: "cancelled";
      durationMs: number;
    };

export type RunBackupOptions = {
  salonId: string;
  trigger: BackupTrigger;
  cancelToken?: CancelToken;
  /** When true, an unmetered connection is required. */
  wifiOnly?: boolean;
  /**
   * When true, don't wait for online. Callers use this from the "manual"
   * button so failure is immediately visible to the user.
   */
  failFastIfOffline?: boolean;
  /**
   * When true, run the pipeline even if `dirty_since` is null. Used only
   * by the manual "Sync now" button so users can force a safety snapshot.
   */
  ignoreCleanFlag?: boolean;
  /** Injectable for tests. Defaults to a fresh `FirebaseBackupClient`. */
  client?: CloudBackupClient;
};

/**
 * Approximate free-space guard. Snapshot + gzip both hold roughly the DB
 * size worth of buffer, plus the on-disk temp file. Refuse if we don't
 * have this much headroom.
 */
const MIN_FREE_DISK_MULTIPLIER = 3;

/** Timeout for waiting on online before giving up on scheduled runs. */
const ONLINE_WAIT_TIMEOUT_MS = 20_000;

const historyRepo = new BackupHistoryRepository();
let inFlight = false;

/**
 * Execute one backup attempt. See BackupOutcome for the shape of the
 * return value. Never throws — all failure paths route through the typed
 * outcome so the scheduler's control flow is exhaustive.
 */
export async function runBackupOnce(
  options: RunBackupOptions
): Promise<BackupOutcome> {
  if (inFlight) {
    return { reason: "in-flight", result: "skipped" };
  }

  inFlight = true;
  const startedWallClock = Date.now();
  const startedIso = new Date(startedWallClock).toISOString();
  const {
    salonId,
    trigger,
    cancelToken,
    wifiOnly = false,
    failFastIfOffline = false,
    ignoreCleanFlag = false,
    client = new FirebaseBackupClient()
  } = options;

  const networkTypeAtStart = classifyNetwork();
  const cacheFile: { current: File | null } = { current: null };

  try {
    // ── Preflight ───────────────────────────────────────────────────────
    const dirty = readDirtyState();
    if (!ignoreCleanFlag && dirty.dirtySince === null) {
      return { reason: "not-dirty", result: "skipped" };
    }

    if (wifiOnly && getNetworkState().isMetered) {
      return { reason: "wifi-only", result: "skipped" };
    }

    if (failFastIfOffline && !isOnline()) {
      return { reason: "offline", result: "skipped" };
    }

    if (!isOnline()) {
      try {
        await waitForOnline(ONLINE_WAIT_TIMEOUT_MS);
      } catch (err) {
        if (err instanceof NetworkTimeoutError) {
          return { reason: "offline", result: "skipped" };
        }
        throw err;
      }
    }

    // ── Acquire / refresh the active-device lock ────────────────────────
    // Runs before we spend CPU on snapshot + pack so a read-only device
    // exits cheaply. Own → we may write. Other → skip; the scheduler
    // will re-check on the next trigger (network reconnect, take-over,
    // or manual sync). Any error → surface as failed so the retry
    // backoff kicks in.
    const lockResult = await acquireOrRefreshLock(salonId);
    applyLockCheck(lockResult);
    if (lockResult.stance !== "own") {
      return { reason: "not-lock-owner", result: "skipped" };
    }
    throwIfCancelled(cancelToken);

    // ── Emit start ──────────────────────────────────────────────────────
    eventBus.emit("backup:started", { trigger });
    throwIfCancelled(cancelToken);

    // ── Snapshot + free-disk guard ──────────────────────────────────────
    const snapshot = takeSnapshot();
    const required = snapshot.sizeBytes * MIN_FREE_DISK_MULTIPLIER;
    if (Paths.availableDiskSpace < required) {
      return { reason: "low-disk", result: "skipped" };
    }
    throwIfCancelled(cancelToken);

    // ── Pack + write to cache ───────────────────────────────────────────
    const identity = getDeviceIdentity();
    const dek = await getOrCreateDek(salonId);
    const packed = packSnapshot(snapshot.bytes, dek);
    // Drop the plaintext buffer eagerly — the pipeline no longer needs it.
    // (JS GC decides when to free, but there are no more live references.)

    const versionId = buildVersionId();
    const file = cacheFileFor(versionId);
    cacheFile.current = file;
    if (file.exists) file.delete();
    file.create({ intermediates: true });
    file.write(packed.blob);
    throwIfCancelled(cancelToken);

    // ── Compose metadata ────────────────────────────────────────────────
    const metadata: SnapshotMetadata = {
      versionId,
      plaintextSha256: snapshot.plaintextSha256,
      ciphertextSha256: packed.ciphertextSha256,
      schemaVersion: snapshot.schemaVersion,
      appVersion: Application.nativeApplicationVersion ?? "unknown",
      plaintextSizeBytes: snapshot.sizeBytes,
      ciphertextSizeBytes: packed.ciphertextSize,
      deviceInstallId: identity.installId,
      deviceLabel: identity.deviceLabel,
      changeCountAtSnapshot: dirty.changeCount
    };

    // ── Commit metadata BEFORE the upload ───────────────────────────────
    // If the upload fails, we're left with an orphan Firestore doc — that's
    // fine, retention pruning + rules keep it bounded. If we uploaded
    // first, a metadata-commit failure would leave an unreferenced blob
    // (worse, because storage costs money and rules are keyed on metadata).
    try {
      await commitBackupMetadata(salonId, metadata);
    } catch (err) {
      if (err instanceof BackupMetadataConflictError) {
        // A previous partial upload with the same versionId already
        // committed metadata. Treat as success.
        // (versionId collisions are astronomically unlikely, but a retry
        // that happens to re-use one is caught here.)
      } else {
        throw err;
      }
    }
    throwIfCancelled(cancelToken);

    // ── Upload the blob ─────────────────────────────────────────────────
    const uploadResult = await client.upload({
      cancelToken,
      localBlobPath: file.uri,
      metadata,
      salonId
    });

    // ── Clear dirty flag with optimistic concurrency check ──────────────
    clearDirtyIfUnchanged(dirty.changeCount);
    // Note: if a write raced in during the upload, the flag stays set and
    // the scheduler will run again shortly. That's correct behaviour.

    const durationMs = Date.now() - startedWallClock;
    eventBus.emit("backup:succeeded", {
      bytesUploaded: uploadResult.ciphertextSizeBytes,
      durationMs,
      versionId: uploadResult.versionId
    });

    historyRepo.record({
      bytes_uploaded: uploadResult.ciphertextSizeBytes,
      duration_ms: durationMs,
      error_code: null,
      error_message: null,
      finished_at: new Date().toISOString(),
      network_type: networkTypeAtStart,
      plaintext_size_bytes: snapshot.sizeBytes,
      result: "success",
      salon_id: salonId,
      started_at: startedIso,
      trigger,
      version_id: uploadResult.versionId
    });

    return {
      ciphertextSizeBytes: uploadResult.ciphertextSizeBytes,
      durationMs,
      result: "success",
      versionId: uploadResult.versionId
    };
  } catch (err) {
    if (err instanceof BackupCancelledError) {
      const durationMs = Date.now() - startedWallClock;
      historyRepo.record({
        bytes_uploaded: 0,
        duration_ms: durationMs,
        error_code: "cancelled",
        error_message: err.message,
        finished_at: new Date().toISOString(),
        network_type: networkTypeAtStart,
        plaintext_size_bytes: 0,
        result: "cancelled",
        salon_id: salonId,
        started_at: startedIso,
        trigger,
        version_id: null
      });
      return { durationMs, result: "cancelled" };
    }

    const { code, message } = mapError(err);
    const durationMs = Date.now() - startedWallClock;

    eventBus.emit("backup:failed", { errorCode: code, message, trigger });
    historyRepo.record({
      bytes_uploaded: 0,
      duration_ms: durationMs,
      error_code: code,
      error_message: message,
      finished_at: new Date().toISOString(),
      network_type: networkTypeAtStart,
      plaintext_size_bytes: 0,
      result: "failed",
      salon_id: salonId,
      started_at: startedIso,
      trigger,
      version_id: null
    });

    return { durationMs, errorCode: code, message, result: "failed" };
  } finally {
    // Always clean up the temp file, even on cancellation / failure.
    if (cacheFile.current && cacheFile.current.exists) {
      try {
        cacheFile.current.delete();
      } catch {
        // Non-fatal — the OS will reclaim cache eventually.
      }
    }
    inFlight = false;
  }
}

// ─── error classification ─────────────────────────────────────────────────

export class BackupCancelledError extends Error {
  constructor() {
    super("Backup cancelled by caller");
    this.name = "BackupCancelledError";
  }
}

function throwIfCancelled(token: CancelToken | undefined): void {
  if (token?.isCancelled) throw new BackupCancelledError();
}

function mapError(err: unknown): { code: string; message: string } {
  const message = err instanceof Error ? err.message : String(err);
  if (err instanceof SnapshotError) return { code: `snapshot:${err.code}`, message };
  if (err instanceof PackError) return { code: `pack:${err.code}`, message };
  if (err instanceof CloudBackupError) return { code: `cloud:${err.code}`, message };
  if (err instanceof DeviceLockError) return { code: `lock:${err.code}`, message };
  if (err instanceof NetworkTimeoutError) return { code: "network:timeout", message };
  return { code: "unknown", message };
}

function classifyNetwork(): NetworkType {
  const s = getNetworkState();
  if (!s.isOnline) return "unknown";
  return s.isWifi ? "wifi" : "cellular";
}
