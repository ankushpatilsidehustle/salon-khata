import { createHmac, timingSafeEqual } from "crypto";

import { getRazorpayKeySecret, getRazorpayWebhookSecret } from "./config";

function safeEqualHex(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/** Checkout signature for subscriptions: payment_id|subscription_id */
export function verifySubscriptionPaymentSignature(params: {
  paymentId: string;
  subscriptionId: string;
  signature: string;
}): boolean {
  const secret = getRazorpayKeySecret();
  if (!secret) return false;
  const payload = `${params.paymentId}|${params.subscriptionId}`;
  const expected = createHmac("sha256", secret)
    .update(payload)
    .digest("hex");
  return safeEqualHex(expected, params.signature.trim());
}

/** Checkout signature for orders: order_id|payment_id */
export function verifyOrderPaymentSignature(params: {
  orderId: string;
  paymentId: string;
  signature: string;
}): boolean {
  const secret = getRazorpayKeySecret();
  if (!secret) return false;
  const payload = `${params.orderId}|${params.paymentId}`;
  const expected = createHmac("sha256", secret)
    .update(payload)
    .digest("hex");
  return safeEqualHex(expected, params.signature.trim());
}

/** Webhook body HMAC (raw body string). */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string
): boolean {
  const secret = getRazorpayWebhookSecret();
  if (!secret) return false;
  const expected = createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");
  return safeEqualHex(expected, signatureHeader.trim());
}
