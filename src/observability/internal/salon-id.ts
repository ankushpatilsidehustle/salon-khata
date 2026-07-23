/**
 * Soft read of the current salon id for observability context.
 * Avoids hard-coupling the logger to session module throw paths.
 */
export function getCurrentSalonIdSafe(): string | null {
  try {
    // Lazy require to keep module graph light at import time.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getCurrentSalonId } = require("@/session/current-salon") as {
      getCurrentSalonId: () => string;
    };
    return getCurrentSalonId();
  } catch {
    return null;
  }
}
