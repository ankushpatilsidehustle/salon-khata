/**
 * Human-friendly referral codes.
 * Format: 6–8 uppercase alphanumeric characters (no ambiguous 0/O/1/I).
 */

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function normalizeReferralCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function isValidReferralCodeFormat(code: string): boolean {
  const normalized = normalizeReferralCode(code);
  return normalized.length >= 6 && normalized.length <= 10;
}

/**
 * Build a salon referral code from an optional name hint + random suffix.
 * Uniqueness is enforced by the repository (retry on collision).
 */
export function generateReferralCode(seedName?: string | null): string {
  const prefix = lettersFromName(seedName);
  const suffixLen = Math.max(4, 8 - prefix.length);
  return `${prefix}${randomChunk(suffixLen)}`;
}

function lettersFromName(seedName?: string | null): string {
  if (!seedName) return "";
  const letters = seedName
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 4);
  return letters;
}

function randomChunk(length: number): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += ALPHABET.charAt(Math.floor(Math.random() * ALPHABET.length));
  }
  return out;
}
