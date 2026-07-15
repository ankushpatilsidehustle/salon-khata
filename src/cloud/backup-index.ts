import firestore, {
  FirebaseFirestoreTypes
} from "@react-native-firebase/firestore";

import type {
  CloudBackupIndexEntry,
  SnapshotMetadata
} from "@/cloud/cloud-backup-client";

/**
 * Firestore-backed metadata index for cloud snapshots.
 *
 * Two document families under each salon:
 *
 *   /salons/{sid}/backups/{versionId}            (subcollection, one per snapshot)
 *      {
 *        versionId, plaintextSha256, ciphertextSha256, schemaVersion,
 *        appVersion, plaintextSizeBytes, ciphertextSizeBytes,
 *        deviceInstallId, deviceLabel, changeCountAtSnapshot,
 *        createdAt: serverTimestamp,
 *      }
 *
 *   /salons/{sid}                                (existing salon doc)
 *      backup_index: {
 *        latestVersionId: string | null,
 *        latestCreatedAt: serverTimestamp,
 *        latestSizeBytes: number,
 *      }
 *
 * The `create()` call at write time acts as replay/duplicate protection:
 * writing metadata is idempotent per `versionId`, so a retried upload
 * won't create a second row for the same snapshot.
 *
 * All timestamps are Firestore `serverTimestamp` so the value is authoritative
 * even when device clocks are skewed. `createdAt` is projected back into
 * `CloudBackupIndexEntry.createdAt` as an ISO string for the mobile client.
 */

const SALONS_COLLECTION = "salons";
const BACKUPS_SUBCOLLECTION = "backups";
const BACKUP_INDEX_FIELD = "backup_index";

/**
 * Write the metadata document for a freshly-uploaded snapshot and update
 * the salon's `backup_index.latestVersionId` pointer in a single
 * transaction. Fails cleanly if `versionId` already exists (duplicate
 * upload after a retry that partially succeeded).
 */
export async function commitBackupMetadata(
  salonId: string,
  metadata: SnapshotMetadata
): Promise<void> {
  const salonRef = firestore().collection(SALONS_COLLECTION).doc(salonId);
  const backupRef = salonRef
    .collection(BACKUPS_SUBCOLLECTION)
    .doc(metadata.versionId);

  await firestore().runTransaction(async (tx) => {
    // Verify no existing doc — a retried upload must not silently overwrite
    // a version already committed by a peer request.
    const existing = await tx.get(backupRef);
    if (existing.exists()) {
      throw new BackupMetadataConflictError(metadata.versionId);
    }

    tx.set(backupRef, {
      versionId: metadata.versionId,
      plaintextSha256: metadata.plaintextSha256,
      ciphertextSha256: metadata.ciphertextSha256,
      schemaVersion: metadata.schemaVersion,
      appVersion: metadata.appVersion,
      plaintextSizeBytes: metadata.plaintextSizeBytes,
      ciphertextSizeBytes: metadata.ciphertextSizeBytes,
      deviceInstallId: metadata.deviceInstallId,
      deviceLabel: metadata.deviceLabel,
      changeCountAtSnapshot: metadata.changeCountAtSnapshot,
      createdAt: firestore.FieldValue.serverTimestamp()
    });

    // Refresh the salon-level pointer. `set(..., {merge: true})` lets us
    // touch only the backup_index sub-object without disturbing the rest
    // of the salon doc.
    tx.set(
      salonRef,
      {
        [BACKUP_INDEX_FIELD]: {
          latestVersionId: metadata.versionId,
          latestCreatedAt: firestore.FieldValue.serverTimestamp(),
          latestSizeBytes: metadata.ciphertextSizeBytes
        }
      },
      { merge: true }
    );
  });
}

/**
 * Fetch metadata for one version. Returns null when the doc is missing —
 * the caller then decides whether to fall back to `list()[0]` or ask the
 * user to pick from history.
 */
export async function fetchBackupMetadata(
  salonId: string,
  versionId: string
): Promise<SnapshotMetadata | null> {
  const doc = await firestore()
    .collection(SALONS_COLLECTION)
    .doc(salonId)
    .collection(BACKUPS_SUBCOLLECTION)
    .doc(versionId)
    .get();

  if (!doc.exists()) return null;
  return mapToSnapshotMetadata(doc);
}

/**
 * List backups for a salon, newest first. `limit` caps the query at up to
 * 100 rows to keep the payload small on the Backups screen.
 */
export async function listBackups(
  salonId: string,
  limit = 50
): Promise<CloudBackupIndexEntry[]> {
  const capped = Math.max(1, Math.min(limit, 100));
  const snap = await firestore()
    .collection(SALONS_COLLECTION)
    .doc(salonId)
    .collection(BACKUPS_SUBCOLLECTION)
    .orderBy("createdAt", "desc")
    .limit(capped)
    .get();

  return snap.docs.map(mapToIndexEntry);
}

/** Read the pointer set by `commitBackupMetadata`. */
export async function getLatestVersionId(
  salonId: string
): Promise<string | null> {
  const salonDoc = await firestore()
    .collection(SALONS_COLLECTION)
    .doc(salonId)
    .get();

  const data = salonDoc.data();
  const idx = (data?.[BACKUP_INDEX_FIELD] ?? null) as
    | { latestVersionId?: string | null }
    | null;
  return idx?.latestVersionId ?? null;
}

/**
 * Idempotent metadata delete. Silent if the doc is missing. Does NOT touch
 * the `backup_index.latestVersionId` pointer — the caller is responsible
 * for recomputing it after a batch prune (retention policy).
 */
export async function deleteBackupMetadata(
  salonId: string,
  versionId: string
): Promise<void> {
  await firestore()
    .collection(SALONS_COLLECTION)
    .doc(salonId)
    .collection(BACKUPS_SUBCOLLECTION)
    .doc(versionId)
    .delete()
    .catch((err: unknown) => {
      // Firestore surfaces missing-doc deletes as success on both platforms,
      // but log any unexpected error for observability.
      // eslint-disable-next-line no-console
      console.warn(`[backup-index] delete metadata failed: ${describeError(err)}`);
    });
}

/**
 * Thrown when `commitBackupMetadata` finds an existing doc for the same
 * versionId. The caller can treat this as a benign duplicate (the earlier
 * request already committed) and skip the retry.
 */
export class BackupMetadataConflictError extends Error {
  constructor(public readonly versionId: string) {
    super(`Backup metadata for ${versionId} already exists`);
    this.name = "BackupMetadataConflictError";
  }
}

// ─── internal helpers ─────────────────────────────────────────────────────

function mapToSnapshotMetadata(
  doc: FirebaseFirestoreTypes.DocumentSnapshot
): SnapshotMetadata {
  const d = doc.data() as Record<string, unknown>;
  return {
    versionId: str(d.versionId, doc.id),
    plaintextSha256: str(d.plaintextSha256),
    ciphertextSha256: str(d.ciphertextSha256),
    schemaVersion: num(d.schemaVersion),
    appVersion: str(d.appVersion, ""),
    plaintextSizeBytes: num(d.plaintextSizeBytes),
    ciphertextSizeBytes: num(d.ciphertextSizeBytes),
    deviceInstallId: str(d.deviceInstallId, ""),
    deviceLabel: str(d.deviceLabel, ""),
    changeCountAtSnapshot: num(d.changeCountAtSnapshot)
  };
}

function mapToIndexEntry(
  doc: FirebaseFirestoreTypes.QueryDocumentSnapshot
): CloudBackupIndexEntry {
  const d = doc.data() as Record<string, unknown>;
  return {
    versionId: str(d.versionId, doc.id),
    createdAt: toIso(d.createdAt),
    ciphertextSizeBytes: num(d.ciphertextSizeBytes),
    deviceInstallId: str(d.deviceInstallId, ""),
    deviceLabel: str(d.deviceLabel, ""),
    schemaVersion: num(d.schemaVersion)
  };
}

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function num(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/**
 * Firestore `serverTimestamp` values come back as `Timestamp` objects with
 * a `toDate()` method. When the write hasn't yet been acknowledged by the
 * server the value can be null in offline cache reads — handled here.
 */
function toIso(value: unknown): string {
  if (
    value &&
    typeof value === "object" &&
    typeof (value as { toDate?: () => Date }).toDate === "function"
  ) {
    return (value as { toDate(): Date }).toDate().toISOString();
  }
  return new Date().toISOString();
}

function describeError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
