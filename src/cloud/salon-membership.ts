import firestore from "@react-native-firebase/firestore";

/**
 * Salon membership — the shared cloud "ACL" that Firestore Security Rules
 * consult to decide whether the caller may read/write records under
 * `/salons/{sid}/entities/**`.
 *
 * Current usage (Phase 6): single-writer stays the default. The owner is
 * the only authorized user; `member_uids` is populated with an empty
 * array on first sign-in so future member-invite flows can `arrayUnion`
 * into it without a schema migration.
 *
 * Rule shape (see `firestore.rules`):
 *
 *   allow read, write:
 *     request.auth.uid == resource.data.owner_uid ||
 *     request.auth.uid in resource.data.member_uids;
 *
 * The `/salons/{sid}` **top-level** doc is different from the salon row
 * that syncs under `/salons/{sid}/entities/salons/records/{sid}`. The
 * top-level doc is the security-rules pivot and also holds `backup_index`
 * (from `src/cloud/backup-index.ts`). It must exist before any
 * per-record sync happens, so `ensureSalonMembership` is called from
 * `AuthProvider` on every sign-in resolution.
 *
 * All writes are non-transactional and idempotent (`set(..., {merge:true})`)
 * — safe to call repeatedly and safe to fire-and-forget from the auth
 * lifecycle.
 */

const SALONS_COLLECTION = "salons";
const OWNER_UID_FIELD = "owner_uid";
const MEMBER_UIDS_FIELD = "member_uids";

/** Snapshot of who currently has access to a salon. */
export type SalonMembership = {
  ownerUid: string | null;
  memberUids: string[];
};

/**
 * Ensure the `/salons/{sid}` top-level doc exists with `owner_uid` set
 * and a `member_uids` array present (default empty). Idempotent — safe
 * on every sign-in.
 *
 * The owner_uid is written on every call so a device that has been
 * signed out and back in with the same account re-asserts ownership.
 * `member_uids` is set only when missing (via `arrayUnion` on an empty
 * value, which is a no-op if the field exists — keeps any invited
 * members intact across owner re-authentications).
 */
export async function ensureSalonMembership(
  salonId: string,
  ownerUid: string
): Promise<void> {
  await firestore()
    .collection(SALONS_COLLECTION)
    .doc(salonId)
    .set(
      {
        [OWNER_UID_FIELD]: ownerUid,
        // arrayUnion([]) preserves existing values; if the field is missing
        // it initializes to an empty array so security-rule `in` checks
        // don't hit `undefined`.
        [MEMBER_UIDS_FIELD]: firestore.FieldValue.arrayUnion()
      },
      { merge: true }
    );
}

/**
 * Add a member uid to the salon. arrayUnion is a no-op when the uid is
 * already present. No UI wired to this in Phase 6 — future member-invite
 * flow will call it.
 */
export async function addMember(
  salonId: string,
  uid: string
): Promise<void> {
  await firestore()
    .collection(SALONS_COLLECTION)
    .doc(salonId)
    .set(
      { [MEMBER_UIDS_FIELD]: firestore.FieldValue.arrayUnion(uid) },
      { merge: true }
    );
}

/**
 * Remove a member uid from the salon. arrayRemove is a no-op when the uid
 * is missing. The owner cannot be removed via this API — Security Rules
 * enforce that owner_uid remains authoritative regardless of member list.
 */
export async function removeMember(
  salonId: string,
  uid: string
): Promise<void> {
  await firestore()
    .collection(SALONS_COLLECTION)
    .doc(salonId)
    .set(
      { [MEMBER_UIDS_FIELD]: firestore.FieldValue.arrayRemove(uid) },
      { merge: true }
    );
}

/**
 * Read the current membership snapshot. Returns nulls / empty arrays for
 * missing fields rather than throwing so callers can render "not yet
 * shared" state without a special-case.
 */
export async function listMembers(salonId: string): Promise<SalonMembership> {
  const doc = await firestore()
    .collection(SALONS_COLLECTION)
    .doc(salonId)
    .get();
  const data = doc.data() ?? {};
  return {
    memberUids: Array.isArray(data[MEMBER_UIDS_FIELD])
      ? (data[MEMBER_UIDS_FIELD] as unknown[]).filter(
          (u): u is string => typeof u === "string"
        )
      : [],
    ownerUid:
      typeof data[OWNER_UID_FIELD] === "string"
        ? (data[OWNER_UID_FIELD] as string)
        : null
  };
}
