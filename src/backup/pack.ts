import * as Crypto from "expo-crypto";
import { gcm } from "@noble/ciphers/aes.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import pako from "pako";

/**
 * Envelope for the encrypted cloud snapshot.
 *
 * On-disk layout (single self-describing blob):
 *
 *   +------------+---------+-----------+--------------------+
 *   | magic 4B   | ver 1B  | nonce 12B | ciphertext + tag N |
 *   +------------+---------+-----------+--------------------+
 *   | "SKBK"     | 0x01    | 96-bit    | AES-256-GCM output |
 *
 * The GCM tag is appended to the ciphertext by `@noble/ciphers`
 * (`gcm(...).encrypt`) and stripped again on decrypt with integrity check.
 * That check plus the plaintext SHA-256 (computed by the snapshot module)
 * gives defence-in-depth: tampering, storage corruption, or a decoder bug
 * are all caught before the DB is swapped in.
 *
 * Flow producer side (Phase 2 backup pipeline):
 *   1. Snapshot bytes  (plaintextSha256 already computed upstream)
 *   2. `pako.gzip`     → compressed bytes
 *   3. AES-256-GCM     → sealed bytes (with 16-byte tag suffix)
 *   4. Prepend header  → final blob suitable for upload
 *
 * Consumer side (Phase 5 restore pipeline):
 *   1. Parse header, extract nonce + sealed body
 *   2. `gcm(...).decrypt` verifies the tag and returns compressed bytes
 *   3. `pako.ungzip` → plaintext DB bytes
 *   4. Verify plaintext SHA-256 against the metadata doc
 */

const MAGIC = new Uint8Array([0x53, 0x4b, 0x42, 0x4b]); // "SKBK"
const ENVELOPE_VERSION = 0x01;
const NONCE_BYTES = 12; // 96-bit, the recommended IV size for AES-GCM
const HEADER_BYTES = MAGIC.length + 1 + NONCE_BYTES; // 4 + 1 + 12 = 17

export type PackedSnapshot = {
  /** Full envelope, ready to upload as-is. */
  blob: Uint8Array;
  /** Hex SHA-256 of `blob` — verified after download. */
  ciphertextSha256: string;
  /** Size of `blob` in bytes. */
  ciphertextSize: number;
  /** Compressed-but-unencrypted body size — useful for compression-ratio stats. */
  compressedSize: number;
  /** Nonce used; also embedded in the blob header. Returned for logging only. */
  nonce: Uint8Array;
};

export class PackError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "gzip-failed"
      | "encrypt-failed"
      | "bad-key-length"
  ) {
    super(message);
    this.name = "PackError";
  }
}

export class UnpackError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "bad-magic"
      | "bad-version"
      | "truncated"
      | "decrypt-failed"
      | "gunzip-failed"
      | "checksum-mismatch"
      | "bad-key-length"
  ) {
    super(message);
    this.name = "UnpackError";
  }
}

/**
 * Compress + encrypt the given plaintext (DB bytes). The 32-byte DEK must
 * come from `KeyVault.getOrCreateDek()`. Nonce is generated fresh per call.
 */
export function packSnapshot(
  plaintext: Uint8Array,
  dek: Uint8Array
): PackedSnapshot {
  if (dek.length !== 32) {
    throw new PackError(
      `AES-256-GCM requires a 32-byte key; got ${dek.length}`,
      "bad-key-length"
    );
  }

  // Step 1 — compress. pako's default level (6) balances speed/ratio well
  // and matches what browser gzip streams do.
  let compressed: Uint8Array;
  try {
    compressed = pako.gzip(plaintext);
  } catch (err) {
    throw new PackError(
      `gzip failed: ${errorMessage(err)}`,
      "gzip-failed"
    );
  }

  // Step 2 — encrypt. `gcm(key, nonce).encrypt(pt)` returns ciphertext with
  // the 16-byte tag already appended.
  const nonce = Crypto.getRandomBytes(NONCE_BYTES);
  let sealed: Uint8Array;
  try {
    sealed = gcm(dek, nonce).encrypt(compressed);
  } catch (err) {
    throw new PackError(
      `AES-GCM encrypt failed: ${errorMessage(err)}`,
      "encrypt-failed"
    );
  }

  // Step 3 — assemble the envelope.
  const blob = new Uint8Array(HEADER_BYTES + sealed.length);
  blob.set(MAGIC, 0);
  blob[MAGIC.length] = ENVELOPE_VERSION;
  blob.set(nonce, MAGIC.length + 1);
  blob.set(sealed, HEADER_BYTES);

  return {
    blob,
    ciphertextSha256: bytesToHex(sha256(blob)),
    ciphertextSize: blob.length,
    compressedSize: compressed.length,
    nonce
  };
}

/**
 * Reverse `packSnapshot`. Verifies:
 *   1. Magic + version match.
 *   2. Ciphertext SHA-256 (if `expectedCiphertextSha256` provided).
 *   3. GCM auth tag (implicit in `.decrypt` — throws on tamper).
 *   4. Plaintext SHA-256 (if `expectedPlaintextSha256` provided).
 *
 * All four checks are cheap; the caller should always pass both hashes so
 * corruption anywhere in the pipeline is caught before we overwrite the
 * live DB.
 */
export function unpackSnapshot(
  blob: Uint8Array,
  dek: Uint8Array,
  expected: {
    ciphertextSha256?: string;
    plaintextSha256?: string;
  } = {}
): Uint8Array {
  if (dek.length !== 32) {
    throw new UnpackError(
      `AES-256-GCM requires a 32-byte key; got ${dek.length}`,
      "bad-key-length"
    );
  }

  if (blob.length < HEADER_BYTES + 16 /* GCM tag */) {
    throw new UnpackError("Envelope shorter than header + tag", "truncated");
  }

  // Verify ciphertext hash first — cheapest way to catch a truncated /
  // corrupted download before we bother decrypting.
  if (expected.ciphertextSha256) {
    const actual = bytesToHex(sha256(blob));
    if (actual !== expected.ciphertextSha256) {
      throw new UnpackError(
        `Ciphertext SHA mismatch (expected ${expected.ciphertextSha256}, got ${actual})`,
        "checksum-mismatch"
      );
    }
  }

  // Parse header
  for (let i = 0; i < MAGIC.length; i++) {
    if (blob[i] !== MAGIC[i]) {
      throw new UnpackError("Envelope magic bytes mismatch", "bad-magic");
    }
  }
  const version = blob[MAGIC.length];
  if (version !== ENVELOPE_VERSION) {
    throw new UnpackError(
      `Unknown envelope version ${version}; app supports ${ENVELOPE_VERSION}`,
      "bad-version"
    );
  }
  const nonce = blob.subarray(MAGIC.length + 1, HEADER_BYTES);
  const sealed = blob.subarray(HEADER_BYTES);

  // Decrypt
  let compressed: Uint8Array;
  try {
    compressed = gcm(dek, nonce).decrypt(sealed);
  } catch (err) {
    throw new UnpackError(
      `AES-GCM decrypt failed (tamper or wrong key): ${errorMessage(err)}`,
      "decrypt-failed"
    );
  }

  // Decompress
  let plaintext: Uint8Array;
  try {
    plaintext = pako.ungzip(compressed);
  } catch (err) {
    throw new UnpackError(
      `gunzip failed: ${errorMessage(err)}`,
      "gunzip-failed"
    );
  }

  // Final integrity check — redundant with the GCM tag but catches any bug
  // in the pipeline (gzip, envelope framing) before the caller trusts the bytes.
  if (expected.plaintextSha256) {
    const actual = bytesToHex(sha256(plaintext));
    if (actual !== expected.plaintextSha256) {
      throw new UnpackError(
        `Plaintext SHA mismatch (expected ${expected.plaintextSha256}, got ${actual})`,
        "checksum-mismatch"
      );
    }
  }

  return plaintext;
}

/**
 * Compute the SHA-256 of an arbitrary byte buffer. Re-exported here so the
 * BackupPipeline can hash download responses without pulling in @noble
 * directly.
 */
export function sha256Hex(bytes: Uint8Array): string {
  return bytesToHex(sha256(bytes));
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
