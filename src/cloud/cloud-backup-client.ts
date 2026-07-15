/**
 * Cloud-agnostic contract for uploading + downloading encrypted DB snapshots.
 *
 * The backup pipeline talks only to this interface so a future NestJS + S3
 * backend can replace `FirebaseBackupClient` without touching feature code.
 * Everything about auth, transport, resumable uploads, and custom metadata
 * is hidden behind the four methods below.
 *
 * Contract:
 *   - `upload` is expected to be resumable and to fail cleanly on network
 *     loss (implementations should surface a typed error, not hang).
 *   - `download` is expected to write to `destinationPath` atomically —
 *     partial writes should either fully overwrite or throw.
 *   - `list` returns objects newest-first so retention pruning is cheap.
 *   - `delete` is idempotent: deleting a version that doesn't exist should
 *     resolve, not reject.
 *
 * All paths use forward slashes and the salon-scoped prefix
 * `salons/{salonId}/backups/`. Callers never touch the raw URI.
 */

/** Metadata stored alongside every uploaded snapshot. */
export type SnapshotMetadata = {
  /** Unique per-attempt id (`<iso-timestamp>-<short-hash>`). */
  versionId: string;
  /** Hex SHA-256 of the plaintext DB before compression. */
  plaintextSha256: string;
  /** Hex SHA-256 of the ciphertext blob as uploaded. */
  ciphertextSha256: string;
  /** DB schema version at snapshot time (matches `db_meta.schema_version`). */
  schemaVersion: number;
  /** App semver at upload time (from `expo-application`). */
  appVersion: string;
  /** Plaintext DB size in bytes. */
  plaintextSizeBytes: number;
  /** Uploaded blob size in bytes. */
  ciphertextSizeBytes: number;
  /** UUID of the device that produced the snapshot. */
  deviceInstallId: string;
  /** Human-readable device label ("iPhone 15", "Pixel 8"). */
  deviceLabel: string;
  /** `db_meta.change_count` at snapshot time. Used for optimistic-concurrency. */
  changeCountAtSnapshot: number;
};

/** Row returned by `list`. Slim projection of `SnapshotMetadata`. */
export type CloudBackupIndexEntry = {
  versionId: string;
  createdAt: string; // ISO UTC
  ciphertextSizeBytes: number;
  deviceInstallId: string;
  deviceLabel: string;
  schemaVersion: number;
};

/** Result of a successful `upload`. */
export type UploadResult = {
  versionId: string;
  ciphertextSizeBytes: number;
  durationMs: number;
};

/** Cancels an in-flight `upload` or `download`. */
export type CancelToken = {
  cancel(): void;
  readonly isCancelled: boolean;
};

/** Factory for a fresh cancellable operation. */
export function createCancelToken(): CancelToken {
  let cancelled = false;
  return {
    cancel() {
      cancelled = true;
    },
    get isCancelled() {
      return cancelled;
    }
  };
}

export class CloudBackupError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "auth-required"
      | "not-found"
      | "network"
      | "cancelled"
      | "unknown"
  ) {
    super(message);
    this.name = "CloudBackupError";
  }
}

export interface CloudBackupClient {
  /**
   * Upload `localBlobPath` (a file containing the already-packed envelope)
   * to `salons/{salonId}/backups/{versionId}.db.gz.enc` and attach the
   * given metadata. Returns the recorded version + measured duration.
   *
   * Progress reporting is intentionally omitted from v1 — the plan calls
   * for a simple "last backup: X ago" UI, not a per-byte progress bar.
   */
  upload(params: {
    salonId: string;
    localBlobPath: string;
    metadata: SnapshotMetadata;
    cancelToken?: CancelToken;
  }): Promise<UploadResult>;

  /**
   * Download the snapshot with the given `versionId` into `destinationPath`,
   * overwriting any existing file at that path.
   */
  download(params: {
    salonId: string;
    versionId: string;
    destinationPath: string;
    cancelToken?: CancelToken;
  }): Promise<void>;

  /**
   * List snapshots for a salon, newest first. `limit` is a hint; the
   * implementation may return fewer rows. Used by retention pruning and
   * the Backups screen.
   */
  list(params: {
    salonId: string;
    limit?: number;
  }): Promise<CloudBackupIndexEntry[]>;

  /**
   * Idempotent delete. Never throws for a missing version.
   */
  delete(params: { salonId: string; versionId: string }): Promise<void>;

  /**
   * Fetch full metadata for a specific version (used by the restore
   * pipeline to know which SHAs to expect before decrypting).
   */
  getMetadata(params: {
    salonId: string;
    versionId: string;
  }): Promise<SnapshotMetadata | null>;

  /**
   * The version currently marked as "latest" for the salon. Callers can
   * fall back to `list()[0]` when this returns null.
   */
  getLatestVersionId(params: { salonId: string }): Promise<string | null>;
}
