import firestore from "@react-native-firebase/firestore";

import { getDeviceIdentity } from "@/device/device-identity";

/**
 * Active-device lock service.
 *
 * Only one device at a time may write to the cloud snapshot for a given
 * salon. The lock is a Firestore document under
 *
 *   /salons/{salonId}/device/lock
 *
 * with the shape:
 *
 *   {
 *     ownerInstallId:  string,    // UUID from expo-secure-store
 *     ownerDeviceLabel: string,   // human-readable, best-effort
 *     acquiredAt:      Timestamp, // when the current holder first grabbed it
 *     expiresAt:       Timestamp, // acquiredAt + LEASE_MS (or last renewal + LEASE_MS)
 *     lastHeartbeatAt: Timestamp  // last time the owner refreshed
 *   }
 *
 * Rules the client and Firestore Security Rules enforce together:
 *   - Any client can `read` the doc (needed to render "backed up from Riya's
 *     iPhone" and to detect the take-over prompt).
 *   - `write` allowed only if the caller is the current owner, OR the
 *     current owner's lease has expired (`expiresAt <= now`), OR the
 *     document does not yet exist.
 *
 * Everything is transactional so two devices reconnecting simultaneously
 * cannot both believe they own the lock.
 *
 * Lease policy (also called out in the file-sync plan):
 *   - LEASE_MS = 24 h. Long enough that a device offline overnight keeps
 *     writing when it comes back online in the morning.
 *   - HEARTBEAT_MS = 30 min. Renews the lease so it doesn't slip past
 *     expiry while the app is in active daily use.
 *   - MIN_REFRESH_INTERVAL_MS = 5 min. Local debounce: idempotent
 *     `heartbeatIfDue()` calls that fire more often than this skip the
 *     Firestore round-trip.
 */

const SALONS_COLLECTION = "salons";
const DEVICE_SUBCOLLECTION = "device";
const LOCK_DOC = "lock";

/** 24 hours — the lease duration. */
const LEASE_MS = 24 * 60 * 60 * 1000;

/** 5 minutes — client-side debounce for `heartbeatIfDue`. */
const MIN_REFRESH_INTERVAL_MS = 5 * 60 * 1000;

export type DeviceLock = {
  ownerInstallId: string;
  ownerDeviceLabel: string;
  acquiredAt: string; // ISO UTC
  expiresAt: string; // ISO UTC
  lastHeartbeatAt: string; // ISO UTC
};

/**
 * Ownership stance of the current device relative to the lock document.
 *   - `own`     — this device holds a non-expired lease.
 *   - `other`   — a different device holds a non-expired lease. Our
 *                 device is effectively read-only until it takes over.
 *   - `free`    — no doc exists, or the existing lease is expired. Next
 *                 backup attempt will acquire it.
 *   - `unknown` — we haven't been able to reach Firestore yet.
 */
export type LockStance = "own" | "other" | "free" | "unknown";

export type LockCheckResult = {
  stance: LockStance;
  /** The current lock document, or null when `free` / `unknown`. */
  lock: DeviceLock | null;
};

export class DeviceLockError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "conflict"
      | "network"
      | "auth-required"
      | "unknown"
  ) {
    super(message);
    this.name = "DeviceLockError";
  }
}

/**
 * Tracks the last time we successfully wrote to the lock doc, so
 * `heartbeatIfDue` can skip redundant round-trips inside the debounce
 * window. Scoped per-salon in case the process ever handles multiple.
 */
const lastAcquireAtMs = new Map<string, number>();

/**
 * Read the lock document without modifying it. Returns `stance: "unknown"`
 * on network / auth failures so the caller can decide whether to proceed
 * optimistically or wait for a retry.
 */
export async function fetchLockState(salonId: string): Promise<LockCheckResult> {
  const identity = getDeviceIdentity();
  try {
    const snap = await docRef(salonId).get();
    if (!snap.exists()) return { lock: null, stance: "free" };
    const lock = mapLock(snap.data());
    if (!lock) return { lock: null, stance: "free" };
    return { lock, stance: classify(lock, identity.installId) };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      `[device-lock] fetch failed: ${err instanceof Error ? err.message : String(err)}`
    );
    return { lock: null, stance: "unknown" };
  }
}

/**
 * Acquire or renew the lock for this device.
 *
 * Success cases (returns `{ stance: "own", lock }`):
 *   1. No existing doc.
 *   2. Doc exists, we already own it — bumps `lastHeartbeatAt` and extends
 *      `expiresAt` by another lease window.
 *   3. Doc exists, another device owned it, lease has expired — steals it.
 *      This is safe because the previous owner has been out of contact
 *      for 24h and should re-check ownership on its next foreground.
 *
 * Failure case: doc exists, another device owns a non-expired lease.
 * Returns `{ stance: "other", lock }` — pipeline treats this as a
 * `skipped:not-lock-owner` result.
 *
 * Every successful path bumps `lastAcquireAtMs[salonId]` so downstream
 * `heartbeatIfDue()` calls can no-op until MIN_REFRESH_INTERVAL_MS passes.
 */
export async function acquireOrRefreshLock(
  salonId: string
): Promise<LockCheckResult> {
  const identity = getDeviceIdentity();

  try {
    const outcome: LockCheckResult = await firestore().runTransaction(
      async (tx) => {
        const ref = docRef(salonId);
        const snap = await tx.get(ref);

        const nowMs = Date.now();
        const nowIso = new Date(nowMs).toISOString();
        const expiresIso = new Date(nowMs + LEASE_MS).toISOString();

        if (!snap.exists()) {
          const fresh: DeviceLock = {
            acquiredAt: nowIso,
            expiresAt: expiresIso,
            lastHeartbeatAt: nowIso,
            ownerDeviceLabel: identity.deviceLabel,
            ownerInstallId: identity.installId
          };
          tx.set(ref, fresh);
          return { lock: fresh, stance: "own" };
        }

        const existing = mapLock(snap.data());
        if (!existing) {
          // Malformed doc — overwrite. This handles the "we shipped a
          // broken schema and want to recover" corner case.
          const fresh: DeviceLock = {
            acquiredAt: nowIso,
            expiresAt: expiresIso,
            lastHeartbeatAt: nowIso,
            ownerDeviceLabel: identity.deviceLabel,
            ownerInstallId: identity.installId
          };
          tx.set(ref, fresh);
          return { lock: fresh, stance: "own" };
        }

        const isMine = existing.ownerInstallId === identity.installId;
        const isExpired = Date.parse(existing.expiresAt) <= nowMs;

        if (isMine) {
          // Renew — keep `acquiredAt` stable so we can show "acquired X ago".
          const renewed: DeviceLock = {
            ...existing,
            expiresAt: expiresIso,
            lastHeartbeatAt: nowIso,
            // Update label opportunistically in case the device name changed.
            ownerDeviceLabel: identity.deviceLabel
          };
          tx.update(ref, {
            expiresAt: renewed.expiresAt,
            lastHeartbeatAt: renewed.lastHeartbeatAt,
            ownerDeviceLabel: renewed.ownerDeviceLabel
          });
          return { lock: renewed, stance: "own" };
        }

        if (isExpired) {
          // Steal a stale lock. This is the "device replacement" path
          // when the old device has been offline for 24h+.
          const stolen: DeviceLock = {
            acquiredAt: nowIso,
            expiresAt: expiresIso,
            lastHeartbeatAt: nowIso,
            ownerDeviceLabel: identity.deviceLabel,
            ownerInstallId: identity.installId
          };
          tx.set(ref, stolen);
          return { lock: stolen, stance: "own" };
        }

        // Locked by another device with an active lease.
        return { lock: existing, stance: "other" };
      }
    );

    if (outcome.stance === "own") {
      lastAcquireAtMs.set(salonId, Date.now());
    }
    return outcome;
  } catch (err) {
    throw wrapFirebaseError(err);
  }
}

/**
 * Cheap heartbeat: no-op if we've refreshed within the last
 * `MIN_REFRESH_INTERVAL_MS`. Otherwise delegates to `acquireOrRefreshLock`.
 * Returns the freshest known stance so callers can react.
 */
export async function heartbeatIfDue(
  salonId: string
): Promise<LockCheckResult> {
  const last = lastAcquireAtMs.get(salonId);
  if (last !== undefined && Date.now() - last < MIN_REFRESH_INTERVAL_MS) {
    // Within debounce — pretend we still own it. If we actually don't,
    // the next real attempt will discover the truth.
    return fetchLockState(salonId);
  }
  return acquireOrRefreshLock(salonId);
}

/**
 * Explicitly forcibly take the lock, regardless of the current holder.
 * Used by the take-over flow (Phase 5): the user has confirmed they want
 * this device to become primary, and the restore has already been
 * performed successfully.
 *
 * Runs inside a transaction so a stray foreground refresh from the old
 * device can't overwrite us mid-write.
 */
export async function forceTakeOverLock(
  salonId: string
): Promise<LockCheckResult> {
  const identity = getDeviceIdentity();
  try {
    const outcome: LockCheckResult = await firestore().runTransaction(
      async (tx) => {
        const ref = docRef(salonId);
        const nowMs = Date.now();
        const nowIso = new Date(nowMs).toISOString();
        const stolen: DeviceLock = {
          acquiredAt: nowIso,
          expiresAt: new Date(nowMs + LEASE_MS).toISOString(),
          lastHeartbeatAt: nowIso,
          ownerDeviceLabel: identity.deviceLabel,
          ownerInstallId: identity.installId
        };
        tx.set(ref, stolen);
        return { lock: stolen, stance: "own" };
      }
    );
    lastAcquireAtMs.set(salonId, Date.now());
    return outcome;
  } catch (err) {
    throw wrapFirebaseError(err);
  }
}

/**
 * Release ownership. Called on sign-out and account deletion. Best-effort:
 * a missing doc / network failure is silently ignored so sign-out is
 * never blocked on cloud round-trips.
 *
 * Non-owners never touch the doc — a signed-out secondary device leaving
 * the lock alone is exactly what we want.
 */
export async function releaseLock(salonId: string): Promise<void> {
  const identity = getDeviceIdentity();
  lastAcquireAtMs.delete(salonId);
  try {
    await firestore().runTransaction(async (tx) => {
      const ref = docRef(salonId);
      const snap = await tx.get(ref);
      if (!snap.exists()) return;
      const existing = mapLock(snap.data());
      if (!existing) return;
      if (existing.ownerInstallId !== identity.installId) return;
      tx.delete(ref);
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.info(
      `[device-lock] release skipped: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

/**
 * Test hook — drop the debounce cache so acquire runs even in fast tests.
 * @internal
 */
export function __resetDeviceLockDebounceForTests(): void {
  lastAcquireAtMs.clear();
}

// ─── internals ─────────────────────────────────────────────────────────────

function docRef(salonId: string) {
  return firestore()
    .collection(SALONS_COLLECTION)
    .doc(salonId)
    .collection(DEVICE_SUBCOLLECTION)
    .doc(LOCK_DOC);
}

function mapLock(raw: unknown): DeviceLock | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const ownerInstallId = str(r.ownerInstallId);
  if (!ownerInstallId) return null;
  return {
    acquiredAt: toIso(r.acquiredAt),
    expiresAt: toIso(r.expiresAt),
    lastHeartbeatAt: toIso(r.lastHeartbeatAt),
    ownerDeviceLabel: str(r.ownerDeviceLabel, ""),
    ownerInstallId
  };
}

function classify(lock: DeviceLock, myInstallId: string): LockStance {
  const isExpired = Date.parse(lock.expiresAt) <= Date.now();
  if (isExpired) return "free";
  return lock.ownerInstallId === myInstallId ? "own" : "other";
}

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

/**
 * Firestore Timestamp → ISO string. Handles the case where the value was
 * written from JS as a plain string (older versions of this app) or a
 * server timestamp that hasn't yet materialised in the local cache.
 */
function toIso(value: unknown): string {
  if (typeof value === "string") return value;
  if (
    value &&
    typeof value === "object" &&
    typeof (value as { toDate?: () => Date }).toDate === "function"
  ) {
    return (value as { toDate(): Date }).toDate().toISOString();
  }
  return new Date().toISOString();
}

function wrapFirebaseError(err: unknown): DeviceLockError {
  const message = err instanceof Error ? err.message : String(err);
  const code = codeOf(err);
  if (code === "permission-denied" || code === "unauthenticated") {
    return new DeviceLockError(message, "auth-required");
  }
  if (code === "unavailable" || code === "deadline-exceeded") {
    return new DeviceLockError(message, "network");
  }
  if (code === "aborted" || code === "failed-precondition") {
    return new DeviceLockError(message, "conflict");
  }
  return new DeviceLockError(message, "unknown");
}

function codeOf(err: unknown): string | null {
  if (err && typeof err === "object" && "code" in err) {
    const c = (err as { code: unknown }).code;
    return typeof c === "string" ? c : null;
  }
  return null;
}
