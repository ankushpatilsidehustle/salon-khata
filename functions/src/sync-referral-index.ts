import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions/v2";

import {
  normalizeReferralCode,
  referralIndexRef
} from "./firestore-helpers";

/**
 * Keep `/referral_index/{CODE}` in sync with salon referral_codes entities.
 *
 * Clients sync referral_codes under their salon tree; this trigger publishes
 * the global lookup table that claimReferral uses (Admin-only writes).
 */
export const syncReferralIndex = onDocumentWritten(
  "salons/{salonId}/entities/referral_codes/records/{recordId}",
  async (event) => {
    const after = event.data?.after;
    const before = event.data?.before;
    const salonId = event.params.salonId as string;

    if (!after?.exists) {
      // Soft-delete or hard-delete — deactivate index entry if we know the code.
      const beforeData = before?.data();
      const code =
        typeof beforeData?.code === "string"
          ? normalizeReferralCode(beforeData.code)
          : "";
      if (!code) return;
      const idx = await referralIndexRef(code).get();
      if (idx.exists && idx.data()?.salon_id === salonId) {
        await referralIndexRef(code).set(
          { is_active: false, updated_at: new Date().toISOString() },
          { merge: true }
        );
        logger.info("syncReferralIndex: deactivated", { code, salonId });
      }
      return;
    }

    const data = after.data() ?? {};
    const code =
      typeof data.code === "string" ? normalizeReferralCode(data.code) : "";
    if (!code) {
      logger.warn("syncReferralIndex: missing code", { salonId });
      return;
    }

    const deleted = data.deleted_at != null && data.deleted_at !== "";
    const isActive = !deleted && data.is_active !== 0 && data.is_active !== false;

    await referralIndexRef(code).set(
      {
        code,
        salon_id: salonId,
        is_active: isActive,
        record_id: event.params.recordId,
        updated_at: new Date().toISOString()
      },
      { merge: true }
    );

    logger.info("syncReferralIndex: upserted", { code, salonId, isActive });
  }
);
