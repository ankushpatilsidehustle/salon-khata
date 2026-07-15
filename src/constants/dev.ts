// The salon id is resolved at runtime from the signed-in Firebase user;
// `DEV_SALON_ID` is re-exported from the session module and updated by
// `AuthProvider` — legacy call sites see fresh values on each access.
export { DEV_SALON_ID } from "@/session/current-salon";
