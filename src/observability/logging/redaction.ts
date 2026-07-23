/**
 * Strip or replace values that must never leave the device in logs,
 * analytics params, or crash reports.
 */

const PII_KEY_PATTERN =
  /^(phone|mobile|otp|code|name|customer_name|employee_name|address|notes|upi|email|password|token|secret)$/i;

const E164_PATTERN = /\+?\d{10,15}/g;

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

/** Deep-clone a plain object while redacting known PII keys and phone-like strings. */
export function redactParams(
  params: Record<string, unknown> | undefined
): Record<string, JsonPrimitive> {
  if (!params) return {};
  const out: Record<string, JsonPrimitive> = {};
  for (const [key, value] of Object.entries(params)) {
    if (PII_KEY_PATTERN.test(key)) {
      out[key] = "[redacted]";
      continue;
    }
    if (typeof value === "string") {
      out[key] = value.replace(E164_PATTERN, "[phone]");
    } else if (
      typeof value === "number" ||
      typeof value === "boolean" ||
      value === null
    ) {
      out[key] = value;
    } else if (value === undefined) {
      // skip
    } else {
      // Nested objects / arrays are stringified length-only to avoid PII leaks.
      out[key] = "[omitted]";
    }
  }
  return out;
}

/** Safe one-line message for crash/log sinks. */
export function redactMessage(message: string): string {
  return message.replace(E164_PATTERN, "[phone]").slice(0, 500);
}
