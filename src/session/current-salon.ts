/**
 * Runtime session salon id.
 *
 * `DEV_SALON_ID` is intentionally an `export let` — Babel's CommonJS
 * transform emits a getter for these, so every consumer sees the current
 * value on each read. `AuthProvider` calls `setCurrentSalonId(salonId)`
 * once the user's salon row is resolved (either loaded via
 * `SalonRepository.findByOwnerUid(uid)` or created by onboarding).
 *
 * Feature code can either import `DEV_SALON_ID` directly (legacy pattern)
 * or call `getCurrentSalonId()` (preferred; throws if unset). All feature
 * screens are mounted below the auth gate, so by the time they render the
 * salon id is guaranteed to be set.
 */

/** Sentinel: any DB query keyed on this returns no rows — safe if leaked. */
const UNSET_SENTINEL = "__salon_id_not_initialized__";

// eslint-disable-next-line prefer-const
export let DEV_SALON_ID: string = UNSET_SENTINEL;

export function setCurrentSalonId(id: string): void {
  DEV_SALON_ID = id;
}

export function clearCurrentSalonId(): void {
  DEV_SALON_ID = UNSET_SENTINEL;
}

/** Preferred accessor. Throws in dev if reads happen before auth resolves. */
export function getCurrentSalonId(): string {
  if (DEV_SALON_ID === UNSET_SENTINEL) {
    throw new Error(
      "getCurrentSalonId() called before AuthProvider resolved the session salon."
    );
  }
  return DEV_SALON_ID;
}

export function hasCurrentSalonId(): boolean {
  return DEV_SALON_ID !== UNSET_SENTINEL;
}
