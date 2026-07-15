import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * User-facing backup preferences.
 *
 * Stored in AsyncStorage (not `db_meta`) so they:
 *   - Survive a cloud restore (a device's own preferences shouldn't be
 *     replaced by whatever the other device had configured).
 *   - Are readable from the expo-background-task worker without opening
 *     the SQLite database.
 *
 * All values are optional and default sensibly for a first-run user:
 *   - `backupsEnabled` — the master kill-switch. Defaults **true**; user
 *     can flip it off in Settings if they want to opt out entirely.
 *   - `wifiOnly` — refuse to upload over cellular. Defaults **false** so
 *     small salons on data plans still get their nightly backup; users
 *     with tight quotas can enable it.
 *   - (Charging-only is on the roadmap but deferred until we add
 *     `expo-battery`; the plan calls this out.)
 *
 * Reads are cheap and cached in-memory after the first hit. Writes flush
 * both the cache and AsyncStorage before resolving.
 */

const KEY_ENABLED = "SalonKhata.backup.enabled";
const KEY_WIFI_ONLY = "SalonKhata.backup.wifiOnly";

export type BackupPreferences = {
  backupsEnabled: boolean;
  wifiOnly: boolean;
};

const DEFAULTS: BackupPreferences = {
  backupsEnabled: true,
  wifiOnly: false
};

let cached: BackupPreferences | null = null;

/**
 * Load preferences, populating the in-memory cache. Callers can then use
 * the sync `getBackupPreferences()` inside hot paths.
 */
export async function loadBackupPreferences(): Promise<BackupPreferences> {
  if (cached) return { ...cached };

  const [enabledRaw, wifiRaw] = await Promise.all([
    AsyncStorage.getItem(KEY_ENABLED).catch(() => null),
    AsyncStorage.getItem(KEY_WIFI_ONLY).catch(() => null)
  ]);

  cached = {
    backupsEnabled: parseBool(enabledRaw, DEFAULTS.backupsEnabled),
    wifiOnly: parseBool(wifiRaw, DEFAULTS.wifiOnly)
  };
  return { ...cached };
}

/**
 * Synchronous read of the last loaded preferences. Falls back to
 * `DEFAULTS` when `loadBackupPreferences()` hasn't resolved yet — safe
 * because both defaults are the permissive choice.
 */
export function getBackupPreferences(): BackupPreferences {
  return cached ? { ...cached } : { ...DEFAULTS };
}

/** Partial-update: only the provided keys are written. */
export async function setBackupPreferences(
  patch: Partial<BackupPreferences>
): Promise<BackupPreferences> {
  const next = { ...getBackupPreferences(), ...patch };
  await Promise.all([
    patch.backupsEnabled !== undefined
      ? AsyncStorage.setItem(KEY_ENABLED, next.backupsEnabled ? "1" : "0")
      : Promise.resolve(),
    patch.wifiOnly !== undefined
      ? AsyncStorage.setItem(KEY_WIFI_ONLY, next.wifiOnly ? "1" : "0")
      : Promise.resolve()
  ]);
  cached = next;
  return { ...next };
}

/**
 * Test-only cache reset.
 * @internal
 */
export function __resetBackupPreferencesCacheForTests(): void {
  cached = null;
}

function parseBool(raw: string | null, fallback: boolean): boolean {
  if (raw === "1") return true;
  if (raw === "0") return false;
  return fallback;
}
