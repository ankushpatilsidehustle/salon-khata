import * as SecureStore from "expo-secure-store";
import * as Application from "expo-application";

import { getMeta, setMeta } from "@/database/db-meta";
import { newId } from "@/domain/id";

/**
 * Per-install device identity used by the backup engine to:
 *   - Own the active-device lock in Firestore.
 *   - Stamp every uploaded snapshot with its origin.
 *   - Distinguish "this device" from "another device" after a restore.
 *
 * The identity is a UUID v4 generated on first launch and stored in **two**
 * places so the app can recover it in every scenario:
 *
 *   1. **Keychain / Android Keystore** via `expo-secure-store` — survives
 *      DB restore, DB corruption, and reinstall-with-Keychain-backup on iOS.
 *      This is the authoritative source.
 *   2. **`db_meta.install_id`** in SQLite — visible to SQL joins and survives
 *      OS-level Keychain wipes (which do happen on some Android factory
 *      resets). Rehydrated from Secure Store on every launch.
 *
 * When the two disagree (e.g. after a cloud restore of another device's DB),
 * Secure Store wins and `db_meta.install_id` is overwritten so the local
 * device keeps its stable identity.
 *
 * `deviceLabel` is a best-effort human-readable name used in the "Backups"
 * screen and the take-over prompt ("Backed up from iPhone 15 Pro"). It is
 * not authoritative — never compared for equality.
 */

const SECURE_STORE_KEY = "salon-khata.install_id";
const DB_META_KEY = "install_id";

export type DeviceIdentity = {
  installId: string;
  deviceLabel: string;
};

let cached: DeviceIdentity | null = null;

/**
 * Load the identity, generating one on the very first launch. Idempotent.
 * Safe to call from React render (returns the cached value after the first
 * successful resolve).
 */
export async function loadDeviceIdentity(): Promise<DeviceIdentity> {
  if (cached) return cached;

  const installId = await resolveInstallId();
  const deviceLabel = resolveDeviceLabel();

  cached = { installId, deviceLabel };
  return cached;
}

/**
 * Synchronous read after `loadDeviceIdentity()` has resolved once. Throws
 * if called before initialization — the app root awaits `loadDeviceIdentity`
 * during startup so feature code can safely rely on this being ready.
 */
export function getDeviceIdentity(): DeviceIdentity {
  if (!cached) {
    throw new Error(
      "DeviceIdentity not initialized — call loadDeviceIdentity() during app startup"
    );
  }
  return cached;
}

/**
 * Test-only hook to reset the singleton. Not exported from the barrel.
 * @internal
 */
export function __resetForTests(): void {
  cached = null;
}

// ─── internals ─────────────────────────────────────────────────────────────

async function resolveInstallId(): Promise<string> {
  const secure = await readSecureStore();
  const dbValue = getMeta(DB_META_KEY);

  if (secure) {
    // Secure Store is authoritative — reconcile db_meta if it drifted (e.g.
    // after a cloud DB restore that carried another device's install_id).
    if (dbValue !== secure) {
      setMeta(DB_META_KEY, secure);
    }
    return secure;
  }

  // Secure Store is empty. Two sub-cases:
  //   (a) Fresh install — generate a new UUID and persist to both stores.
  //   (b) Keychain was wiped (rare) but db_meta still has a valid UUID —
  //       adopt it so the device keeps its old identity in the cloud.
  const installId = dbValue ?? newId();
  await writeSecureStore(installId);
  if (dbValue !== installId) {
    setMeta(DB_META_KEY, installId);
  }
  return installId;
}

async function readSecureStore(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(SECURE_STORE_KEY);
  } catch {
    // Secure Store can throw on emulators without a keychain; fall back to
    // db_meta so the app still works, at the cost of the identity being
    // wiped by a DB restore. Logged for diagnostics.
    // eslint-disable-next-line no-console
    console.warn("[device-identity] Secure Store read failed");
    return null;
  }
}

async function writeSecureStore(value: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(SECURE_STORE_KEY, value, {
      // Device-only: never restored to a different device via iCloud/Google
      // backup — a restored device should get a fresh install_id and be
      // treated as a new device by the lock service.
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY
    });
  } catch {
    // eslint-disable-next-line no-console
    console.warn(
      "[device-identity] Secure Store write failed — identity only in db_meta"
    );
  }
}

/**
 * Best-effort human label. iOS returns the device name (e.g. "Riya's iPhone")
 * when the user has granted permission; otherwise a generic string. Never
 * empty — the caller can render it directly in confirmation prompts.
 */
function resolveDeviceLabel(): string {
  const os = Application.applicationName ?? "Salon Khata";
  const version = Application.nativeApplicationVersion ?? "";
  return version ? `${os} ${version}` : os;
}
