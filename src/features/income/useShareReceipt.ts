import { useCallback, useRef, useState } from "react";
import { Alert } from "react-native";
import type { View } from "react-native";
import { captureRef } from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import { useTranslation } from "react-i18next";

/**
 * Lazily require `react-native-share` so a missing native module (dev bundle
 * loaded before `npx expo prebuild && run:android`) doesn't crash the app at
 * bundle load. We only touch it when the user actually shares.
 */
function loadRNShare():
  | typeof import("react-native-share")
  | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("react-native-share");
  } catch {
    return null;
  }
}

/**
 * Provides a stable ref to attach to a `ReceiptCard` plus a `shareReceipt`
 * callback that captures the view as a PNG.
 *
 * When `phone` is supplied, the image is sent DIRECTLY to that WhatsApp
 * number (Android opens the specific chat; iOS opens WhatsApp to that
 * registered number). Falls back to the generic OS share sheet when:
 *  - no phone is given
 *  - WhatsApp is not installed
 *  - `react-native-share` throws or isn't linked
 */
export function useShareReceipt() {
  const { t } = useTranslation();
  const ref = useRef<View>(null);
  const [sharing, setSharing] = useState(false);

  const shareReceipt = useCallback(
    async (options?: { phone?: string | null }) => {
      if (sharing) return;
      const current = ref.current;
      if (!current) return;

      setSharing(true);
      try {
        const uri = await captureRef(current, {
          format: "png",
          quality: 1,
          result: "tmpfile"
        });

        const phone = options?.phone ?? null;

        if (phone) {
          const shareMod = loadRNShare();
          if (shareMod) {
            const Share = shareMod.default;
            const Social = shareMod.Social;
            // Normalise: ensure international format with leading "+"
            const normalised = phone.startsWith("+") ? phone : `+${phone}`;
            try {
              await Share.shareSingle({
                social: Social.Whatsapp,
                // whatsAppNumber is not in v12 TS types — cast to bypass
                whatsAppNumber: normalised,
                url: uri,
                type: "image/png",
                failOnCancel: false
              } as Parameters<typeof Share.shareSingle>[0]);
              return; // success — skip generic fallback
            } catch {
              // WhatsApp not installed or share cancelled — fall through
            }
          }
        }

        // Generic OS share sheet fallback
        if (!(await Sharing.isAvailableAsync())) {
          Alert.alert(t("receipt.shareUnavailable"));
          return;
        }
        await Sharing.shareAsync(uri, {
          mimeType: "image/png",
          dialogTitle: t("receipt.shareTitle"),
          UTI: "public.png"
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        Alert.alert(t("receipt.shareFailed"), message);
      } finally {
        setSharing(false);
      }
    },
    [sharing, t]
  );

  return { receiptRef: ref, shareReceipt, sharing } as const;
}


