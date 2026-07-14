import auth, {
  FirebaseAuthTypes,
  getAuth,
  onAuthStateChanged,
  signInWithPhoneNumber,
  signOut as firebaseSignOut
} from "@react-native-firebase/auth";

// -----------------------------------------------------------------------------
// Public error surface
// -----------------------------------------------------------------------------

export type AuthErrorCode =
  | "invalid-phone"
  | "invalid-code"
  | "code-expired"
  | "too-many-requests"
  | "network-request-failed"
  | "requires-recent-login"
  | "session-expired"
  | "quota-exceeded"
  | "unknown";

export class AuthError extends Error {
  readonly code: AuthErrorCode;
  readonly cause?: unknown;

  constructor(code: AuthErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = "AuthError";
    this.code = code;
    this.cause = cause;
  }
}

/**
 * Map Firebase's string error codes onto our closed union so UI code only has
 * to switch over a small set. Everything unknown surfaces as `"unknown"`.
 */
function mapAuthError(err: unknown): AuthError {
  const firebaseCode =
    typeof err === "object" && err !== null && "code" in err
      ? String((err as { code: unknown }).code)
      : "";
  const message =
    typeof err === "object" && err !== null && "message" in err
      ? String((err as { message: unknown }).message)
      : "Authentication error";

  switch (firebaseCode) {
    case "auth/invalid-phone-number":
    case "auth/missing-phone-number":
      return new AuthError("invalid-phone", message, err);
    case "auth/invalid-verification-code":
    case "auth/missing-verification-code":
    case "auth/invalid-verification-id":
      return new AuthError("invalid-code", message, err);
    case "auth/code-expired":
      return new AuthError("code-expired", message, err);
    case "auth/too-many-requests":
      return new AuthError("too-many-requests", message, err);
    case "auth/network-request-failed":
      return new AuthError("network-request-failed", message, err);
    case "auth/requires-recent-login":
      return new AuthError("requires-recent-login", message, err);
    case "auth/user-token-expired":
    case "auth/session-expired":
      return new AuthError("session-expired", message, err);
    case "auth/quota-exceeded":
      return new AuthError("quota-exceeded", message, err);
    default:
      return new AuthError("unknown", message, err);
  }
}

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type PhoneConfirmation = FirebaseAuthTypes.ConfirmationResult;
export type AuthUser = FirebaseAuthTypes.User;

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

/**
 * Send an OTP to the given E.164-formatted phone number. Returns a
 * `PhoneConfirmation` handle that must be passed back to `verifyOtp` along
 * with the code the user typed.
 *
 * On Android with Play Services, Firebase attempts *silent* verification via
 * Play Integrity — no visible reCAPTCHA. On iOS, silent verification uses
 * APNs + DeviceCheck when configured.
 */
export async function signInWithPhone(
  e164Phone: string
): Promise<PhoneConfirmation> {
  try {
    return await signInWithPhoneNumber(getAuth(), e164Phone);
  } catch (err) {
    throw mapAuthError(err);
  }
}

/** Complete OTP verification. Success flips `onAuthStateChanged` to a user. */
export async function verifyOtp(
  confirmation: PhoneConfirmation,
  code: string
): Promise<AuthUser> {
  try {
    const credential = await confirmation.confirm(code);
    if (!credential?.user) {
      throw new AuthError("unknown", "No user returned from confirm()");
    }
    return credential.user;
  } catch (err) {
    if (err instanceof AuthError) throw err;
    throw mapAuthError(err);
  }
}

/** Sign the current user out. Local SQLite data is preserved. */
export async function signOut(): Promise<void> {
  try {
    await firebaseSignOut(getAuth());
  } catch (err) {
    throw mapAuthError(err);
  }
}

/**
 * Delete the currently signed-in Firebase account. Throws with
 * `code === "requires-recent-login"` when the session is too old — callers
 * should route the user back through the OTP flow and retry.
 *
 * NOTE: this only removes the Firebase Auth user. Any Firestore / cloud data
 * cleanup + local SQLite reset is the caller's responsibility.
 */
export async function deleteAccount(): Promise<void> {
  const user = getAuth().currentUser;
  if (!user) {
    throw new AuthError("session-expired", "No signed-in user to delete.");
  }
  try {
    await user.delete();
  } catch (err) {
    throw mapAuthError(err);
  }
}

/**
 * Subscribe to auth-state changes. Returns the RN Firebase unsubscribe fn.
 * Fires once on subscription with the current state (null or user).
 */
export function subscribeAuthState(
  cb: (user: AuthUser | null) => void
): () => void {
  return onAuthStateChanged(getAuth(), cb);
}

/** Convenience getter — synchronous read of the cached current user. */
export function getCurrentAuthUser(): AuthUser | null {
  return getAuth().currentUser;
}

// Re-export the auth module in case call sites need advanced access.
export { auth };
