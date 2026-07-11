import { useCallback, useRef, useState } from "react";
import { Alert } from "react-native";
import type { View } from "react-native";
import { captureRef } from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import { useTranslation } from "react-i18next";

/**
 * Provides a stable ref to attach to a `ReceiptCard` plus a `shareReceipt`
 * callback that captures the view as a PNG and opens the native share sheet.
 *
 * The share sheet lets the user pick WhatsApp (and any specific chat) with
 * the receipt image attached — no separate deep link needed. The customer's
 * phone number is not passed through the share intent because WhatsApp share
 * intents on iOS/Android don't accept an image + a pre-selected chat in one
 * call. Owners can still see the phone in the app for reference.
 */
export function useShareReceipt() {
  const { t } = useTranslation();
  const ref = useRef<View>(null);
  const [sharing, setSharing] = useState(false);

  const shareReceipt = useCallback(async () => {
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
  }, [sharing, t]);

  return { receiptRef: ref, shareReceipt, sharing } as const;
}
