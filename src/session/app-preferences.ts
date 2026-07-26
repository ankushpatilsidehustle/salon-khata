import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  isAppLanguageCode,
  type AppLanguageCode
} from "@/i18n/languages";

/**
 * Device-level prefs for the pre-auth journey (language + getting-started tour).
 * Independent of salon rows so signed-out users still keep their language and
 * do not re-see the intro carousel after first completion.
 */

const LANGUAGE_KEY = "SalonKhata.prefs.preferredLanguage";
const GETTING_STARTED_KEY = "SalonKhata.prefs.hasCompletedGettingStarted";

export type AppPreferences = {
  preferredLanguage: AppLanguageCode | null;
  hasCompletedGettingStarted: boolean;
};

const DEFAULT_PREFS: AppPreferences = {
  preferredLanguage: null,
  hasCompletedGettingStarted: false
};

let cache: AppPreferences = { ...DEFAULT_PREFS };
let loaded = false;

export function getAppPreferencesSync(): AppPreferences {
  return cache;
}

export function hasLoadedAppPreferences(): boolean {
  return loaded;
}

/** Hydrate cache from AsyncStorage. Safe to call multiple times. */
export async function loadAppPreferences(): Promise<AppPreferences> {
  try {
    const [langRaw, tourRaw] = await Promise.all([
      AsyncStorage.getItem(LANGUAGE_KEY),
      AsyncStorage.getItem(GETTING_STARTED_KEY)
    ]);
    cache = {
      preferredLanguage:
        langRaw && isAppLanguageCode(langRaw) ? langRaw : null,
      hasCompletedGettingStarted: tourRaw === "1"
    };
  } catch {
    cache = { ...DEFAULT_PREFS };
  }
  loaded = true;
  return cache;
}

export async function setPreferredLanguage(
  code: AppLanguageCode
): Promise<void> {
  cache = { ...cache, preferredLanguage: code };
  try {
    await AsyncStorage.setItem(LANGUAGE_KEY, code);
  } catch {
    // Best-effort persistence; in-memory value still wins for this session.
  }
}

export async function setGettingStartedCompleted(
  completed = true
): Promise<void> {
  cache = { ...cache, hasCompletedGettingStarted: completed };
  try {
    if (completed) {
      await AsyncStorage.setItem(GETTING_STARTED_KEY, "1");
    } else {
      await AsyncStorage.removeItem(GETTING_STARTED_KEY);
    }
  } catch {
    // Best-effort.
  }
}

/** Clears pre-auth prefs (dev reset / account wipe). */
export async function clearAppPreferences(): Promise<void> {
  cache = { ...DEFAULT_PREFS };
  loaded = true;
  try {
    await Promise.all([
      AsyncStorage.removeItem(LANGUAGE_KEY),
      AsyncStorage.removeItem(GETTING_STARTED_KEY)
    ]);
  } catch {
    // ignore
  }
}

/** Resolve language for salon create / UI when prefs may be unset. */
export function resolvePreferredLanguage(
  fallback: AppLanguageCode = "en"
): AppLanguageCode {
  return cache.preferredLanguage ?? fallback;
}
