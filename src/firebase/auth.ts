import { getAuth, PhoneAuthProvider, signInWithCredential } from "firebase/auth";

export async function signInWithOtpVerification(verificationId: string, otpCode: string) {
  const credential = PhoneAuthProvider.credential(verificationId, otpCode);

  return signInWithCredential(getAuth(), credential);
}