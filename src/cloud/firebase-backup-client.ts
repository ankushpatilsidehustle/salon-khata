import { File, Paths } from "expo-file-system";
import storage from "@react-native-firebase/storage";

import {
  CloudBackupError,
  type CancelToken,
  type CloudBackupClient,
  type CloudBackupIndexEntry,
  type SnapshotMetadata,
  type UploadResult
} from "@/cloud/cloud-backup-client";
import {
  commitBackupMetadata,
  deleteBackupMetadata,
  fetchBackupMetadata,
  getLatestVersionId,
  listBackups
} from "@/cloud/backup-index";

/**
 * Firebase Storage + Firestore implementation of `CloudBackupClient`.
 *
 * Object layout:
 *
 *   gs://<bucket>/salons/{salonId}/backups/{versionId}.db.gz.enc
 *
 * The blob is the raw envelope produced by `pack.ts` (magic + version +
 * nonce + AES-GCM ciphertext). Metadata (schema version, SHAs, device
 * info, size) is stored in Firestore under
 *
 *   /salons/{salonId}/backups/{versionId}
 *
 * Storage is treated as **content-addressed**: the versionId is unique per
 * attempt, and the metadata doc is created BEFORE the storage upload (via
 * `commitBackupMetadata` inside the pipeline) so a duplicate upload can't
 * silently overwrite. That ordering also lets Storage security rules
 * cross-check the caller against Firestore.
 *
 * All operations are auth-gated by Firebase Security Rules — this client
 * carries no credentials itself; it relies on `@react-native-firebase/auth`
 * having a signed-in user.
 */

const STORAGE_PREFIX = "salons";
const STORAGE_SUFFIX = ".db.gz.enc";

export class FirebaseBackupClient implements CloudBackupClient {
  async upload(params: {
    salonId: string;
    localBlobPath: string;
    metadata: SnapshotMetadata;
    cancelToken?: CancelToken;
  }): Promise<UploadResult> {
    const { salonId, localBlobPath, metadata, cancelToken } = params;
    const remotePath = buildRemotePath(salonId, metadata.versionId);
    const ref = storage().ref(remotePath);

    const startedAt = Date.now();
    const task = ref.putFile(localBlobPath, {
      contentType: "application/octet-stream",
      // customMetadata lets Storage rules cross-check the caller against
      // the Firestore metadata doc without a separate function.
      customMetadata: toCustomMetadataStrings(metadata)
    });

    // Wire the CancelToken to the resumable task. Cancellation flips the
    // task to state 'cancelled' which rejects the returned promise.
    let cancelUnsub: (() => void) | null = null;
    if (cancelToken) {
      const cancelIfNeeded = () => {
        if (cancelToken.isCancelled) task.cancel();
      };
      cancelIfNeeded();
      // Poll only once per state change — good enough for a background upload.
      const off = task.on("state_changed", () => cancelIfNeeded());
      // The RN Firebase Task#on returns an unsubscriber function.
      cancelUnsub = typeof off === "function" ? off : null;
    }

    try {
      await task;
    } catch (err) {
      throw wrapFirebaseError(err);
    } finally {
      cancelUnsub?.();
    }

    return {
      versionId: metadata.versionId,
      ciphertextSizeBytes: metadata.ciphertextSizeBytes,
      durationMs: Date.now() - startedAt
    };
  }

  async download(params: {
    salonId: string;
    versionId: string;
    destinationPath: string;
    cancelToken?: CancelToken;
  }): Promise<void> {
    const { salonId, versionId, destinationPath, cancelToken } = params;
    const remotePath = buildRemotePath(salonId, versionId);
    const ref = storage().ref(remotePath);

    // Ensure the destination directory exists and no stale file blocks us.
    const dest = new File(destinationPath);
    if (dest.exists) dest.delete();

    const task = ref.writeToFile(destinationPath);

    let cancelUnsub: (() => void) | null = null;
    if (cancelToken) {
      const cancelIfNeeded = () => {
        if (cancelToken.isCancelled) task.cancel();
      };
      cancelIfNeeded();
      const off = task.on("state_changed", () => cancelIfNeeded());
      cancelUnsub = typeof off === "function" ? off : null;
    }

    try {
      await task;
    } catch (err) {
      throw wrapFirebaseError(err);
    } finally {
      cancelUnsub?.();
    }
  }

  async list(params: {
    salonId: string;
    limit?: number;
  }): Promise<CloudBackupIndexEntry[]> {
    return listBackups(params.salonId, params.limit);
  }

  async delete(params: {
    salonId: string;
    versionId: string;
  }): Promise<void> {
    const { salonId, versionId } = params;
    const remotePath = buildRemotePath(salonId, versionId);

    // Best-effort blob delete. `object-not-found` is normalised to a no-op.
    try {
      await storage().ref(remotePath).delete();
    } catch (err) {
      if (!isNotFound(err)) {
        // eslint-disable-next-line no-console
        console.warn(
          `[firebase-backup] delete blob failed: ${describeError(err)}`
        );
      }
    }

    // Always drop the metadata doc too so the two stores stay aligned.
    await deleteBackupMetadata(salonId, versionId);
  }

  async getMetadata(params: {
    salonId: string;
    versionId: string;
  }): Promise<SnapshotMetadata | null> {
    return fetchBackupMetadata(params.salonId, params.versionId);
  }

  async getLatestVersionId(params: {
    salonId: string;
  }): Promise<string | null> {
    return getLatestVersionId(params.salonId);
  }
}

/**
 * Compose a fresh unique `versionId`. Format:
 *   YYYYMMDDTHHMMSSZ-<8-hex>
 *
 * The timestamp prefix makes newest-first ordering trivial by string sort
 * (Firestore ordering also uses `createdAt`, but callers occasionally
 * need to sort a local array by version id alone).
 */
export function buildVersionId(now: Date = new Date()): string {
  const iso = now.toISOString();
  const timestamp = iso.replace(/[-:.]/g, "").slice(0, 15) + "Z";
  // Small random suffix to avoid a collision if two devices happen to
  // resolve to the same second (locks prevent it, but this is cheap).
  const rand = Math.floor(Math.random() * 0xffffffff)
    .toString(16)
    .padStart(8, "0");
  return `${timestamp}-${rand}`;
}

/** Convenience for callers that want a File in the cache dir. */
export function cacheFileFor(versionId: string): File {
  return new File(Paths.cache, `${versionId}${STORAGE_SUFFIX}`);
}

// ─── internals ─────────────────────────────────────────────────────────────

function buildRemotePath(salonId: string, versionId: string): string {
  return `${STORAGE_PREFIX}/${salonId}/backups/${versionId}${STORAGE_SUFFIX}`;
}

/**
 * Firebase custom-metadata values must be strings. Numbers are stringified
 * verbatim so a future backend replacement can parse them back.
 */
function toCustomMetadataStrings(m: SnapshotMetadata): Record<string, string> {
  return {
    versionId: m.versionId,
    plaintextSha256: m.plaintextSha256,
    ciphertextSha256: m.ciphertextSha256,
    schemaVersion: String(m.schemaVersion),
    appVersion: m.appVersion,
    plaintextSizeBytes: String(m.plaintextSizeBytes),
    ciphertextSizeBytes: String(m.ciphertextSizeBytes),
    deviceInstallId: m.deviceInstallId,
    deviceLabel: m.deviceLabel,
    changeCountAtSnapshot: String(m.changeCountAtSnapshot)
  };
}

function wrapFirebaseError(err: unknown): CloudBackupError {
  const message = describeError(err);
  const code = codeOf(err);
  if (code === "storage/canceled" || code === "storage/cancelled") {
    return new CloudBackupError(message, "cancelled");
  }
  if (code === "storage/unauthenticated" || code === "storage/unauthorized") {
    return new CloudBackupError(message, "auth-required");
  }
  if (code === "storage/object-not-found") {
    return new CloudBackupError(message, "not-found");
  }
  if (
    code === "storage/retry-limit-exceeded" ||
    code === "storage/network-request-failed" ||
    code === "storage/server-file-wrong-size"
  ) {
    return new CloudBackupError(message, "network");
  }
  return new CloudBackupError(message, "unknown");
}

function isNotFound(err: unknown): boolean {
  return codeOf(err) === "storage/object-not-found";
}

function codeOf(err: unknown): string | null {
  if (err && typeof err === "object" && "code" in err) {
    const c = (err as { code: unknown }).code;
    return typeof c === "string" ? c : null;
  }
  return null;
}

function describeError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
