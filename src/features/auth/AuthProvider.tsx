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

  // Recompute the salon-resolution for the given firebase user.
  const resolveSalonFor = useCallback((nextUser: AuthUser | null) => {
    if (!nextUser) {
      clearCurrentSalonId();
      setSalonId(null);
      setStatus("signed-out");
      return;
    }
    const salon = salonRepo.findByOwnerUid(nextUser.uid);
    if (salon) {
      setCurrentSalonId(salon.id);
      setSalonId(salon.id);
      setStatus("signed-in");
    } else {
      clearCurrentSalonId();
      setSalonId(null);
      setStatus("signed-in-no-salon");
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
