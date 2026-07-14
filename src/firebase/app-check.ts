import {
  getToken,
  initializeAppCheck as fbInitializeAppCheck,
  ReactNativeFirebaseAppCheckProvider
} from "@react-native-firebase/app-check";
import { getApp } from "@react-native-firebase/app";
import { Platform } from "react-native";

let initialized = false;

/**
 * Initialize Firebase App Check. Called once from `AppRoot` **before** any
 * auth call so `signInWithPhone` requests are attested and Firebase's abuse
 * quota kicks in.
 *
 * - `__DEV__` → Debug provider. The generated token is printed to native
 *   logs on first launch; paste it into Firebase console → App Check → Apps
 *   → Manage debug tokens to allow-list your dev build.
 * - Production → Play Integrity (Android) / DeviceCheck (iOS).
 *
 * Failures are soft-logged: initialization errors shouldn't block the app.
 * Any downstream Auth call will surface its own error if attestation fails.
 */
export async function initializeAppCheck(): Promise<void> {
  if (initialized) return;

  try {
    const provider = new ReactNativeFirebaseAppCheckProvider();
    provider.configure({
      android: {
        provider: __DEV__ ? "debug" : "playIntegrity",
        debugToken: undefined
      },
      apple: {
        provider: __DEV__ ? "debug" : "deviceCheck",
        debugToken: undefined
      }
    });

    const appCheckInstance = await fbInitializeAppCheck(getApp(), {
      provider,
      isTokenAutoRefreshEnabled: true
    });

    initialized = true;

    if (__DEV__) {
      // Trigger a token fetch so the debug token appears in adb/xcode logs.
      // Look for `Enter this debug secret into the Firebase console`.
      try {
        await getToken(appCheckInstance, true);
      } catch (tokenErr) {
        console.warn(
          "[app-check] Debug-token fetch failed; check Firebase console.",
          tokenErr
        );
      }
    }
  } catch (err) {
    // Never block startup on App Check. Auth calls will surface a clearer
    // error if attestation is truly required and unavailable.
    console.warn(
      `[app-check] Init failed on ${Platform.OS}. Continuing without attestation.`,
      err
    );
  }
}
