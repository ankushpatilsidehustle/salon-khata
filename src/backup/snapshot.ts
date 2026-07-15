import { File, Paths } from "expo-file-system";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";

import { database } from "@/database/sqlite-client";
import { getMeta } from "@/database/db-meta";

/**
 * Take a consistent snapshot of the live SQLite database.
 *
 * Steps:
 *   1. Force any WAL frames back into the main DB file with
 *      `PRAGMA wal_checkpoint(TRUNCATE)`. TRUNCATE also shrinks the
 *      `-wal` sidecar to zero bytes so the copy doesn't include stale
 *      pages. Because the entire JS thread is single-threaded and the
 *      write path is `runInTransaction(() => …)`, no writer can slip in
 *      between the checkpoint and the file read.
 *   2. Read the DB file at `<Paths.document>/SQLite/salon-khata.db` into
 *      memory as a `Uint8Array`. expo-sqlite always creates the file
 *      there when opened by name.
 *   3. Sanity-check the SQLite magic header (`"SQLite format 3\0"`) so a
 *      truncated or filesystem-corrupted file is rejected before we spend
 *      time compressing + encrypting it.
 *   4. Compute a plaintext SHA-256 for end-to-end integrity verification
 *      during restore.
 *
 * The returned bytes are owned by the caller — the pipeline gzips + encrypts
 * them and then drops the reference so the memory can be reclaimed.
 *
 * NOTE: We hold the whole DB in memory. That's fine for the current target
 * (small-business salons, DB expected < 20 MB for years). A future
 * refactor could stream via `File.open()` + `FileHandle.readBytes(len)` if
 * benchmarks show pressure on low-RAM Android devices.
 */

/** File name expo-sqlite uses under `<documentDirectory>/SQLite/`. */
export const SQLITE_FILE_NAME = "salon-khata.db";

/** Magic header of every valid SQLite 3 database file. */
const SQLITE_MAGIC = new Uint8Array([
  0x53, 0x51, 0x4c, 0x69, 0x74, 0x65, 0x20, 0x66, 0x6f, 0x72, 0x6d, 0x61, 0x74,
  0x20, 0x33, 0x00
]); // "SQLite format 3\0"

export type Snapshot = {
  /** Raw DB file bytes, ready to gzip. */
  bytes: Uint8Array;
  /** Hex-encoded SHA-256 of `bytes` — verified again after restore. */
  plaintextSha256: string;
  /** Size in bytes (== `bytes.length`, exposed for logging). */
  sizeBytes: number;
  /** Schema version read from `db_meta.schema_version` at snapshot time. */
  schemaVersion: number;
};

export class SnapshotError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "checkpoint-failed"
      | "file-missing"
      | "bad-header"
      | "empty-file"
  ) {
    super(message);
    this.name = "SnapshotError";
  }
}

/**
 * Take a snapshot of the live DB. Synchronous — safe to call from within
 * an already-synchronous flow, but callers should typically dispatch this
 * off the render thread via a microtask because reading a multi-MB file
 * blocks briefly.
 */
export function takeSnapshot(): Snapshot {
  // ── Step 1: checkpoint WAL so the main .db file is complete ──────────
  try {
    // TRUNCATE variant blocks briefly if readers are active but returns
    // the WAL to zero bytes, which we want.
    database.execSync(`PRAGMA wal_checkpoint(TRUNCATE)`);
  } catch (err) {
    throw new SnapshotError(
      `WAL checkpoint failed: ${errorMessage(err)}`,
      "checkpoint-failed"
    );
  }

  // ── Step 2: locate + read the DB file ────────────────────────────────
  const dbFile = new File(Paths.document, "SQLite", SQLITE_FILE_NAME);
  if (!dbFile.exists) {
    throw new SnapshotError(
      `SQLite file not found at ${dbFile.uri}`,
      "file-missing"
    );
  }

  const bytes = dbFile.bytesSync();
  if (bytes.length === 0) {
    throw new SnapshotError("SQLite file is empty", "empty-file");
  }

  // ── Step 3: verify magic header ──────────────────────────────────────
  if (!startsWith(bytes, SQLITE_MAGIC)) {
    throw new SnapshotError(
      "SQLite header magic missing — file is corrupt or not a SQLite DB",
      "bad-header"
    );
  }

  // ── Step 4: hash + gather metadata ───────────────────────────────────
  const plaintextSha256 = bytesToHex(sha256(bytes));
  const schemaVersion = Number(getMeta("schema_version") ?? "0");

  return {
    bytes,
    plaintextSha256,
    schemaVersion,
    sizeBytes: bytes.length
  };
}

function startsWith(haystack: Uint8Array, needle: Uint8Array): boolean {
  if (haystack.length < needle.length) return false;
  for (let i = 0; i < needle.length; i++) {
    if (haystack[i] !== needle[i]) return false;
  }
  return true;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
