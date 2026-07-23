/**
 * Shared Firestore helpers for Salon Khata Cloud Functions.
 *
 * Entity docs must match the client sync layout:
 *   /salons/{sid}/entities/{entityType}/records/{docId}
 * with `_sync.version` / `serverUpdatedAt` so devices pull the grant.
 */

import {
  FieldValue,
  getFirestore,
  type Firestore,
  type Transaction
} from "firebase-admin/firestore";

export const REFERRAL_REWARD_DAYS = 30;
export const REFERRAL_REWARD_PLAN_ID = "monthly";

export type BillingState = {
  current_subscription_id: string | null;
  plan_code: string | null;
  status: string | null;
  end_at: string | null;
  grace_end_at: string | null;
  updated_at: string;
};

export function db(): Firestore {
  return getFirestore();
}

export function entityRecordRef(
  salonId: string,
  entityType: string,
  recordId: string
) {
  return db()
    .collection("salons")
    .doc(salonId)
    .collection("entities")
    .doc(entityType)
    .collection("records")
    .doc(recordId);
}

export function billingStateRef(salonId: string) {
  return db().collection("salons").doc(salonId).collection("billing").doc("state");
}

export function referralIndexRef(code: string) {
  return db().collection("referral_index").doc(code);
}

export function referralDocRef(referralId: string) {
  return db().collection("referrals").doc(referralId);
}

export function normalizeReferralCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function isValidReferralCodeFormat(code: string): boolean {
  const normalized = normalizeReferralCode(code);
  return normalized.length >= 6 && normalized.length <= 10;
}

export function addDaysIso(startIso: string, days: number): string {
  const ms = Date.parse(startIso);
  const base = Number.isFinite(ms) ? ms : Date.now();
  return new Date(base + days * 24 * 60 * 60 * 1000).toISOString();
}

export function newId(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/**
 * Write/merge a sync entity record, bumping `_sync.version`.
 * Must be called inside an existing transaction when atomicity is required.
 */
export async function upsertEntityInTx(
  tx: Transaction,
  params: {
    salonId: string;
    entityType: string;
    recordId: string;
    payload: Record<string, unknown>;
    authoredBy?: string;
  }
): Promise<number> {
  const ref = entityRecordRef(
    params.salonId,
    params.entityType,
    params.recordId
  );
  const snap = await tx.get(ref);
  const prev = snap.exists ? snap.data() : undefined;
  const prevVersion =
    typeof prev?._sync?.version === "number" ? prev._sync.version : 0;
  const nextVersion = prevVersion + 1;
  const nowIso = new Date().toISOString();
  const authoredBy = params.authoredBy ?? "cloud-functions";

  tx.set(
    ref,
    {
      ...params.payload,
      id: params.recordId,
      _sync: {
        version: nextVersion,
        authoredBy,
        createdBy:
          typeof prev?._sync?.createdBy === "string"
            ? prev._sync.createdBy
            : authoredBy,
        authoredAt: nowIso,
        tombstone: params.payload.deleted_at != null,
        serverUpdatedAt: FieldValue.serverTimestamp()
      }
    },
    { merge: true }
  );

  return nextVersion;
}

export async function readBillingStateInTx(
  tx: Transaction,
  salonId: string
): Promise<BillingState | null> {
  const snap = await tx.get(billingStateRef(salonId));
  if (!snap.exists) return null;
  return snap.data() as BillingState;
}

export function writeBillingStateInTx(
  tx: Transaction,
  salonId: string,
  state: BillingState
): void {
  tx.set(billingStateRef(salonId), state, { merge: true });
}
