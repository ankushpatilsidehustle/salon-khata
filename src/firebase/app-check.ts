import {
  getToken,
  initializeAppCheck as fbInitializeAppCheck,
  ReactNativeFirebaseAppCheckProvider
} from "@react-native-firebase/app-check";
import { getApp } from "@react-native-firebase/app";
import { Platform } from "react-native";

import { logger } from "@/observability/logging/logger";

let initialized = false;

/**
 * Sideloaded / internal EAS preview APKs cannot pass Play Integrity.
 * Set `EXPO_PUBLIC_APP_CHECK_DEBUG=1` on those profiles (see eas.json).
 */
function useDebugAppCheck(): boolean {
  if (__DEV__) return true;
  return process.env.EXPO_PUBLIC_APP_CHECK_DEBUG === "1";
}

/**
 * Initialize Firebase App Check. Called once from `AppRoot` **before** any
 * auth call so `signInWithPhone` requests are attested and Firebase's abuse
 * quota kicks in.
 *
 * - Debug (`__DEV__` or `EXPO_PUBLIC_APP_CHECK_DEBUG=1`) → Debug provider.
 *   Paste the logged token into Firebase console → App Check → Manage debug tokens.
 * - Production → Play Integrity (Android) / DeviceCheck (iOS).
 *
 * Failures are soft-logged: initialization errors shouldn't block the app.
 * Any downstream Auth call will surface its own error if attestation fails.
 */
export async function initializeAppCheck(): Promise<void> {
  if (initialized) return;

  const debug = useDebugAppCheck();

  try {
    const provider = new ReactNativeFirebaseAppCheckProvider();
    provider.configure({
      android: {
        provider: debug ? "debug" : "playIntegrity",
        debugToken: undefined
      },
      apple: {
        provider: debug ? "debug" : "deviceCheck",
        debugToken: undefined
      }
    });

    const appCheckInstance = await fbInitializeAppCheck(getApp(), {
      provider,
      isTokenAutoRefreshEnabled: true
    });

    initialized = true;

    if (debug) {
      // Trigger a token fetch so the debug token appears in device logs.
      // Look for `Enter this debug secret into the Firebase console`.
      try {
        await getToken(appCheckInstance, true);
      } catch (tokenErr) {
        logger.warn(
          "App Check debug-token fetch failed; check Firebase console.",
          {
            category: "auth",
            err_code:
              tokenErr instanceof Error
                ? tokenErr.message.slice(0, 80)
                : "unknown"
          }
        );
      }
    }
  } catch (err) {
    // Never block startup on App Check. Auth calls will surface a clearer
    // error if attestation is truly required and unavailable.
    logger.warn(
      `App Check init failed on ${Platform.OS}. Continuing without attestation.`,
      {
        category: "auth",
        err_code: err instanceof Error ? err.message.slice(0, 80) : "unknown"
      }
    );
  }
}
