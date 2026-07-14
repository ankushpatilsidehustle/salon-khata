// Placeholder device id used until per-device registration exists.
// The salon id is resolved at runtime from the signed-in Firebase user;
// `DEV_SALON_ID` is re-exported from the session module and updated by
// `AuthProvider` — legacy call sites see fresh values on each access.
export const DEV_DEVICE_ID = "dev-device-1";

export { DEV_SALON_ID } from "@/session/current-salon";
