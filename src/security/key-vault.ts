import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";

/**
 * Per-salon 256-bit Data Encryption Key (DEK) used to encrypt uploaded
 * database snapshots. The key never leaves the device.
 *
 * Storage strategy (envelope encryption, per the file-sync plan):
 *   - DEK generated once with a CSPRNG on the first backup.
 *   - Persisted in the OS-managed secure enclave via `expo-secure-store`
 *     under the salon-scoped key `dek:{salonId}`.
 *   - Marked `WHEN_UNLOCKED_THIS_DEVICE_ONLY` so it cannot be restored to
 *     another device via iCloud / Google backup. A phone-replacement flow
 *     will introduce a separate password-wrapped DEK backup (Phase 5+),
 *     kept intentionally out of scope here.
 *
 * Only key management lives in this module — the actual AES-256-GCM
 * encrypt / decrypt pipeline consumes the returned `Uint8Array` DEK and
 * is implemented in `src/backup/pack.ts` (Phase 2).
 *
 * `resetDek(salonId)` is used for account deletion / test cleanup.
 */

const DEK_BYTES = 32; // 256-bit key for AES-256-GCM
const SECURE_STORE_PREFIX = "salon-khata.dek:";

const dekCache = new Map<string, Uint8Array>();

/**
 * Return the DEK for the given salon, generating one on first use.
 * Returned array is a defensive copy — callers may not mutate the cached
 * key.
 */
export async function getOrCreateDek(salonId: string): Promise<Uint8Array> {
  const cached = dekCache.get(salonId);
  if (cached) return cloneBytes(cached);

  const existing = await readDekFromStore(salonId);
  if (existing) {
    dekCache.set(salonId, existing);
    return cloneBytes(existing);
  }

  const fresh = Crypto.getRandomBytes(DEK_BYTES);
  await writeDekToStore(salonId, fresh);
  dekCache.set(salonId, fresh);
  return cloneBytes(fresh);
}

/**
 * Explicitly discard the DEK for a salon — used for account deletion so a
 * subsequent restore can never decrypt lingering cloud snapshots. Safe to
 * call when no key exists.
 */
export async function resetDek(salonId: string): Promise<void> {
  dekCache.delete(salonId);
  try {
    await SecureStore.deleteItemAsync(secureKey(salonId));
  } catch {
    // No-op — deletion is best-effort. On some Android OEMs the keystore
    // can throw when the entry is already absent.
  }
}

/**
 * Test-only hook — clear the in-memory cache without touching Secure Store.
 * @internal
 */
export function __resetCacheForTests(): void {
  dekCache.clear();
}

// ─── internals ─────────────────────────────────────────────────────────────

function secureKey(salonId: string): string {
  return `${SECURE_STORE_PREFIX}${salonId}`;
}

async function readDekFromStore(salonId: string): Promise<Uint8Array | null> {
  try {
    const b64 = await SecureStore.getItemAsync(secureKey(salonId));
    if (!b64) return null;
    const bytes = base64ToBytes(b64);
    // Reject anything that isn't exactly 256 bits — a corrupted value
    // shouldn't silently produce a weaker key.
    if (bytes.length !== DEK_BYTES) {
      // eslint-disable-next-line no-console
      console.warn(
        `[key-vault] Discarding malformed DEK for ${salonId} (${bytes.length} bytes)`
      );
      return null;
    }
    return bytes;
  } catch {
    // eslint-disable-next-line no-console
    console.warn("[key-vault] Secure Store read failed");
    return null;
  }
}

async function writeDekToStore(salonId: string, dek: Uint8Array): Promise<void> {
  const b64 = bytesToBase64(dek);
  await SecureStore.setItemAsync(secureKey(salonId), b64, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY
  });
}

function cloneBytes(src: Uint8Array): Uint8Array {
  const copy = new Uint8Array(src.length);
  copy.set(src);
  return copy;
}

// Minimal base64 helpers — kept local to avoid pulling in `buffer` polyfill.
// React Native's global `btoa`/`atob` operate on binary strings, which is
// exactly what we need for a 32-byte key round-trip.

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  // eslint-disable-next-line no-undef
  return globalThis.btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  // eslint-disable-next-line no-undef
  const binary = globalThis.atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}
