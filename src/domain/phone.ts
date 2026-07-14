/**
 * Phone-number helpers dedicated to the auth flow.
 *
 * The existing `normalizePhone(input)` in `customer-repository.ts` returns
 * the last-10 digits (India-focused, used for de-duping customer records).
 * Auth needs a stricter E.164 conversion (`+91XXXXXXXXXX`) because that's
 * what Firebase Phone Auth expects.
 */

const DEFAULT_COUNTRY_CODE = "+91";

/**
 * Convert a user-typed phone into E.164 format for Firebase auth.
 * - Strips all non-digits.
 * - Exactly 10 digits → prepends `+91` (India default).
 * - 11+ digits → treats leading digits as the country code, prepends `+`.
 * - Fewer than 10 digits → returns null (caller should show a validation error).
 *
 * @example
 *   toE164("98765 43210") // "+919876543210"
 *   toE164("+91 98765 43210") // "+919876543210"
 *   toE164("1 555 123 4567") // "+15551234567"
 *   toE164("12345") // null
 */
export function toE164(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  if (digits.length < 10) return null;
  if (digits.length === 10) return `${DEFAULT_COUNTRY_CODE}${digits}`;
  return `+${digits}`;
}

/**
 * Human-friendly rendering of an E.164 phone for confirmation screens.
 * `+919876543210` → `+91 98765 43210`.
 */
export function formatE164ForDisplay(e164: string): string {
  if (!e164.startsWith("+")) return e164;
  const digits = e164.slice(1);
  // Indian mobile → 2-digit country code + 5-5 grouping.
  if (digits.length === 12 && digits.startsWith("91")) {
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  }
  return e164;
}
