/**
 * Thin wrapper around react-native-razorpay.
 * Requires a custom dev client rebuild after adding the native module.
 */

import { Linking } from "react-native";

export type RazorpayCheckoutOptions = {
  keyId: string;
  subscriptionId: string;
  name: string;
  description: string;
  amountPaise: number;
  currency: string;
  themeColor: string;
  prefillContact?: string | null;
  shortUrl?: string | null;
};

export type RazorpayCheckoutSuccess = {
  razorpay_payment_id: string;
  razorpay_subscription_id: string;
  razorpay_signature: string;
};

export type RazorpayCheckoutFailure = {
  code: "cancelled" | "failed" | "unavailable";
  description: string;
};

type RazorpayModule = {
  open: (
    options: Record<string, unknown>
  ) => Promise<Record<string, unknown>>;
};

function loadRazorpay(): RazorpayModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("react-native-razorpay");
    return (mod?.default ?? mod) as RazorpayModule;
  } catch {
    return null;
  }
}

/**
 * Open Razorpay subscription checkout.
 * Falls back to short_url in the system browser when the native SDK
 * is unavailable (e.g. Expo Go / missing rebuild).
 */
export async function openRazorpayCheckout(
  options: RazorpayCheckoutOptions
): Promise<
  | { ok: true; data: RazorpayCheckoutSuccess }
  | { ok: false; error: RazorpayCheckoutFailure }
> {
  const RazorpayCheckout = loadRazorpay();

  if (!RazorpayCheckout?.open) {
    if (options.shortUrl) {
      try {
        await Linking.openURL(options.shortUrl);
        return {
          ok: false,
          error: {
            code: "unavailable",
            description:
              "Opened Razorpay in the browser. Pull to refresh after paying."
          }
        };
      } catch {
        // fall through
      }
    }
    return {
      ok: false,
      error: {
        code: "unavailable",
        description:
          "Razorpay native checkout is unavailable. Rebuild the dev client."
      }
    };
  }

  try {
    const result = await RazorpayCheckout.open({
      key: options.keyId,
      subscription_id: options.subscriptionId,
      name: options.name,
      description: options.description,
      currency: options.currency,
      amount: String(options.amountPaise),
      theme: { color: options.themeColor },
      prefill: options.prefillContact
        ? { contact: options.prefillContact }
        : undefined
    });

    const paymentId = String(result.razorpay_payment_id ?? "");
    const subscriptionId = String(
      result.razorpay_subscription_id ?? options.subscriptionId
    );
    const signature = String(result.razorpay_signature ?? "");

    if (!paymentId || !signature) {
      return {
        ok: false,
        error: {
          code: "failed",
          description: "Payment response incomplete"
        }
      };
    }

    return {
      ok: true,
      data: {
        razorpay_payment_id: paymentId,
        razorpay_subscription_id: subscriptionId,
        razorpay_signature: signature
      }
    };
  } catch (err) {
    const description =
      err && typeof err === "object" && "description" in err
        ? String((err as { description: unknown }).description)
        : err instanceof Error
          ? err.message
          : "Payment failed";
    const codeRaw =
      err && typeof err === "object" && "code" in err
        ? Number((err as { code: unknown }).code)
        : NaN;

    // Razorpay uses code 0 / 2 for user cancel on Android/iOS variants.
    if (
      codeRaw === 0 ||
      codeRaw === 2 ||
      /cancel/i.test(description)
    ) {
      return {
        ok: false,
        error: { code: "cancelled", description }
      };
    }

    return {
      ok: false,
      error: { code: "failed", description }
    };
  }
}
