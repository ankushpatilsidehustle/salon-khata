import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";

import {
  deleteAccount as fbDeleteAccount,
  signOut as fbSignOut,
  subscribeAuthState,
  type AuthUser
} from "@/firebase/auth";
import { SalonRepository } from "@/repositories/salon-repository";
import {
  clearCurrentSalonId,
  setCurrentSalonId
} from "@/session/current-salon";
import { persistSalonId } from "@/session/session-storage";
import { clearLockState } from "@/session/lock-state";
import { backupScheduler } from "@/backup/backup-scheduler";
import { unregisterBackgroundBackupTask } from "@/backup/background-task";
import { syncScheduler } from "@/sync/sync-scheduler";
import { unregisterBackgroundSyncTask } from "@/sync/background-sync-task";
import { releaseLock } from "@/cloud/device-lock";
import { ensureSalonMembership } from "@/cloud/salon-membership";
import { ensureSalonBillingBootstrap } from "@/repositories/subscription-bootstrap";
import {
  Events,
  identifyUser,
  logger,
  recordNonFatal,
  setCrashAttributes,
  setUserProperties,
  track
} from "@/observability";
import { getDeviceIdentity } from "@/device/device-identity";

/**
 * Auth lifecycle states:
 *
 * - `loading` — Firebase hasn't reported its cached auth state yet. Show a splash.
 * - `signed-out` — no user; render `AuthNavigator`.
 * - `signed-in-no-salon` — user is authenticated but has no salon row locally.
 *   Render `OnboardingNavigator`; onboarding's finish step creates the salon
 *   with `id = uid` and calls `refreshSalon()`.
 * - `signed-in` — user + salon are both resolved. Render `AppNavigator`.
 */
export type AuthStatus =
  | "loading"
  | "signed-out"
  | "signed-in-no-salon"
  | "signed-in";

export type AuthContextValue = {
  status: AuthStatus;
  user: AuthUser | null;
  salonId: string | null;
  /** Called by onboarding's finish step once it has inserted the salon row. */
  refreshSalon: () => void;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const salonRepo = new SalonRepository();

/** Cold-start splash timeout — if Firebase hasn't reported by then, assume signed-out. */
const SPLASH_TIMEOUT_MS = 3000;

type AuthProviderProps = {
  children: ReactNode;
};

export function AuthProvider({ children }: AuthProviderProps) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [salonId, setSalonId] = useState<string | null>(null);
  // Track the last resolved salon id so `resolveSalonFor` can release its
  // cloud lock on sign-out without depending on the `salonId` state (which
  // would cause the Firebase-auth `useEffect` to re-subscribe every time
  // the resolver identity changed).
  const previousSalonIdRef = useRef<string | null>(null);
  const statusRef = useRef<AuthStatus>("loading");
  statusRef.current = status;

  // Recompute the salon-resolution for the given firebase user.
  const resolveSalonFor = useCallback((nextUser: AuthUser | null) => {
    if (!nextUser) {
      const previousSalonId = previousSalonIdRef.current;
      const hadSession = previousSalonId != null || statusRef.current !== "signed-out";
      previousSalonIdRef.current = null;
      clearCurrentSalonId();
      setSalonId(null);
      setStatus("signed-out");
      identifyUser(null);
      setCrashAttributes({ salon_id: "none", user_id: "none" });
      if (hadSession) {
        track(Events.auth.logout);
      }
      // Tear down backup subscriptions + persistent salon id + OS-level
      // background task on sign-out so a signed-out device stops trying
      // to upload. Best-effort release of the cloud device lock so
      // another device can take over without waiting for the 24h lease
      // to expire.
      backupScheduler.stop();
      syncScheduler.stop();
      clearLockState();
      void persistSalonId(null);
      // Defensive — the Phase-7 backup engine no longer registers this
      // task on boot, but a stale registration from a previous app
      // version could still exist on the device. Cheap idempotent call.
      void unregisterBackgroundBackupTask();
      void unregisterBackgroundSyncTask();
      if (previousSalonId) void releaseLock(previousSalonId);
      return;
    }
    const salon = salonRepo.findByOwnerUid(nextUser.uid);
    identifyUser(nextUser.uid);
    setCrashAttributes({ user_id: nextUser.uid });

    let installId: string | null = null;
    try {
      installId = getDeviceIdentity().installId;
    } catch {
      installId = null;
    }

    if (salon) {
      previousSalonIdRef.current = salon.id;
      setCurrentSalonId(salon.id);
      setSalonId(salon.id);
      setStatus("signed-in");
      track(Events.auth.sessionRestored, { has_salon: 1 });
      setCrashAttributes({
        salon_id: salon.id,
        user_role: "owner"
      });
      setUserProperties({
        userId: nextUser.uid,
        salonId: salon.id,
        installId,
        userRole: "owner",
        salonType: salon.salon_type ?? null,
        preferredLanguage: salon.language ?? null,
        country: "IN"
      });
      // Trial + referral code bootstrap is local and idempotent. Must run
      // before feature screens read entitlements.
      try {
        ensureSalonBillingBootstrap(salon.id);
      } catch (err) {
        // Non-fatal — screens fall back to locked entitlements until retry.
        logger.warn("billing bootstrap failed", { category: "auth" });
        recordNonFatal(err, "auth", { extra: { stage: "billing_bootstrap" } });
      }
      // Mirror the resolved salon id to persistent storage so the
      // background task worker can pick it up when the app isn't running,
      // then start the scheduler for the foreground triggers.
      void persistSalonId(salon.id);
      backupScheduler.start(salon.id);
      syncScheduler.start(salon.id);
      // Ensure the /salons/{sid} top-level doc carries owner_uid +
      // member_uids so Security Rules can authorize per-record sync
      // writes. Idempotent; fire-and-forget — failure just means the
      // next attempt will retry, and the app remains usable offline.
      void ensureSalonMembership(salon.id, nextUser.uid).catch(() => {
        // Non-fatal — rules will deny writes until we succeed, and the
        // sync engine surfaces those as retryable errors in Sync Status.
      });
    } else {
      previousSalonIdRef.current = null;
      clearCurrentSalonId();
      setSalonId(null);
      setStatus("signed-in-no-salon");
      track(Events.auth.sessionRestored, { has_salon: 0 });
      setCrashAttributes({ salon_id: "none" });
      setUserProperties({
        userId: nextUser.uid,
        salonId: null,
        installId,
        userRole: "owner",
        country: "IN"
      });
      // Onboarding hasn't completed yet — no salon means nothing to
      // back up. The scheduler stays stopped until `refreshSalon()`.
      backupScheduler.stop();
      syncScheduler.stop();
      clearLockState();
      void persistSalonId(null);
    }
  }, []);

  const refreshSalon = useCallback(() => {
    // Read the *current* firebase user via the state ref to avoid stale closures.
    resolveSalonFor(user);
  }, [resolveSalonFor, user]);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    // If Firebase never reports (e.g. first cold start while offline), fall
    // back to signed-out after a short splash so the UI isn't stuck.
    timeoutRef.current = setTimeout(() => {
      setStatus((prev) => (prev === "loading" ? "signed-out" : prev));
    }, SPLASH_TIMEOUT_MS);

    const unsubscribe = subscribeAuthState((nextUser) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      setUser(nextUser);
      resolveSalonFor(nextUser);
    });

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      unsubscribe();
    };
  }, [resolveSalonFor]);

  const signOut = useCallback(async () => {
    await fbSignOut();
    // onAuthStateChanged will fire and drive us to signed-out.
  }, []);

  const deleteAccount = useCallback(async () => {
    await fbDeleteAccount();
    // On success, onAuthStateChanged fires with null → signed-out.
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, salonId, refreshSalon, signOut, deleteAccount }),
    [status, user, salonId, refreshSalon, signOut, deleteAccount]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Available anywhere below `AuthProvider`. */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth() called outside <AuthProvider>");
  }
  return ctx;
}

/**
 * Convenience hook for authed subtrees: throws if the user is not signed in.
 * Only use this inside `AppNavigator` / `OnboardingNavigator` — never above
 * the auth gate.
 */
export function useAuthUser(): AuthUser {
  const { user } = useAuth();
  if (!user) {
    throw new Error("useAuthUser() called while signed-out");
  }
  return user;
}
