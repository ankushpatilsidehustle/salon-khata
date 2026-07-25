import { initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { logger } from "firebase-functions/v2";
import { onSchedule } from "firebase-functions/v2/scheduler";

initializeApp();

export { claimReferral } from "./claim-referral";
export { syncReferralIndex } from "./sync-referral-index";
export { processReferralClaimRequest } from "./process-referral-claim-request";
export {
  recordPaidSubscription,
  recordPaidSubscriptionWebhook
} from "./record-paid-subscription";
export { processBillingCheckoutRequest } from "./razorpay/process-checkout-request";
export { processBillingVerifyRequest } from "./razorpay/process-verify-request";
export { razorpayWebhook } from "./razorpay/webhook";

/**
 * Tombstone garbage collection — nightly job that hard-deletes cloud
 * records marked as soft-deleted more than TOMBSTONE_RETENTION_DAYS ago.
 *
 * Why we keep tombstones at all: a device offline for weeks needs to
 * pull the tombstone to learn the row was deleted. Without them, an
 * old device would keep the row alive locally and re-push it on next
 * sync (resurrecting a deleted record). 90 days is our correctness
 * envelope — a device offline longer than that must go through the
 * whole-DB DR restore path instead.
 *
 * Query shape (requires the composite index declared in
 * `firestore.indexes.json`):
 *
 *   db.collectionGroup('records')
 *     .where('_sync.tombstone', '==', true)
 *     .where('_sync.serverUpdatedAt', '<', cutoffTimestamp)
 *
 * Safety caps:
 *   - Per-batch: 500 deletes (Firestore batch write limit).
 *   - Per-invocation: MAX_BATCHES_PER_RUN batches, so worst-case one
 *     nightly run handles 500 * MAX_BATCHES tombstones.
 *   - Timeout: 540 s (Firebase function ceiling).
 *
 * Deploy:
 *   firebase deploy --only functions:tombstoneGc
 *
 * View logs:
 *   firebase functions:log --only tombstoneGc
 */

const TOMBSTONE_RETENTION_DAYS = 90;
const BATCH_SIZE = 500;
const MAX_BATCHES_PER_RUN = 50;

export const tombstoneGc = onSchedule(
  {
    memory: "512MiB",
    // 03:00 UTC daily — off-peak for both AP and NA salon hours.
    schedule: "0 3 * * *",
    timeoutSeconds: 540,
    timeZone: "UTC"
  },
  async () => {
    const db = getFirestore();
    const cutoff = new Date(
      Date.now() - TOMBSTONE_RETENTION_DAYS * 24 * 60 * 60 * 1000
    );
    const cutoffTs = Timestamp.fromDate(cutoff);

    let totalDeleted = 0;
    let batchNumber = 0;

    while (batchNumber < MAX_BATCHES_PER_RUN) {
      const snap = await db
        .collectionGroup("records")
        .where("_sync.tombstone", "==", true)
        .where("_sync.serverUpdatedAt", "<", cutoffTs)
        .limit(BATCH_SIZE)
        .get();

      if (snap.empty) break;

      const batch = db.batch();
      for (const doc of snap.docs) {
        batch.delete(doc.ref);
      }
      await batch.commit();

      totalDeleted += snap.docs.length;
      batchNumber++;

      // Early exit if the query returned less than a full page — nothing
      // left within the cap. Avoids one extra empty round-trip.
      if (snap.docs.length < BATCH_SIZE) break;
    }

    logger.info("tombstoneGc: deletion complete", {
      batches: batchNumber,
      cutoffIso: cutoff.toISOString(),
      totalDeleted
    });

    if (batchNumber === MAX_BATCHES_PER_RUN) {
      logger.warn(
        "tombstoneGc: hit MAX_BATCHES_PER_RUN — some tombstones remain and will be processed on the next scheduled run"
      );
    }
  }
);
