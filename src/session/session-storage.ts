import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Persisted salon-id shim so background tasks (which run without a hydrated
 * AuthProvider) can still identify the active salon.
 *
 * The in-memory `DEV_SALON_ID` in [src/session/current-salon.ts](src/session/current-salon.ts)
 * remains the authoritative value for feature code that runs below the auth
 * gate. This module is used by:
 *   - `BackupScheduler` / `BackupPipeline` when running from a background
 *     task, before React has mounted.
 *   - Recovery flows that need to know which salon to restore into before
 *     the user signs in on a new device.
 *
 * The AuthProvider mirrors every `setCurrentSalonId()` call to this store
 * so the two never drift.
 */

const KEY = "SalonKhata.session.currentSalonId";

/** Write. `null` clears the entry. */
export async function persistSalonId(id: string | null): Promise<void> {
  if (id === null) {
    await AsyncStorage.removeItem(KEY);
    return;
  }
  await AsyncStorage.setItem(KEY, id);
}

/** Read. Resolves to `null` when unset. Never throws. */
export async function getPersistedSalonId(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(KEY);
  } catch {
    return null;
  }
}
