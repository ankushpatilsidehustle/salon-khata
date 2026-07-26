/**
 * Razorpay webhook — source of truth for subscription lifecycle.
 * Verifies X-Razorpay-Signature over the raw body.
 */

import { onRequest } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/v2";

import { APP_PLANS, isPurchaseablePlanCode } from "./config";
import { grantPaidSubscription } from "./grant-paid-subscription";
import { verifyWebhookSignature } from "./signature";
import {
  markSubscriptionCancelled,
  markSubscriptionExpired,
  markWebhookEventProcessed,
  recordFailedPayment,
  resolveSalonFromRazorpaySubscription,
  upsertRazorpaySubscriptionMapping
} from "./subscription-lifecycle";

type RazorpayEntity = Record<string, unknown>;

function asRecord(value: unknown): RazorpayEntity | null {
  if (value && typeof value === "object") return value as RazorpayEntity;
  return null;
}

function nestedEntity(payload: RazorpayEntity, key: string): RazorpayEntity | null {
  const payment = asRecord(payload.payment);
  if (payment) {
    const entity = asRecord(payment.entity);
    if (entity) return entity;
  }
  const subscription = asRecord(payload.subscription);
  if (subscription) {
    const entity = asRecord(subscription.entity);
    if (entity) return entity;
  }
  const direct = asRecord(payload[key]);
  if (direct) {
    const entity = asRecord(direct.entity);
    if (entity) return entity;
    return direct;
  }
  return null;
}

function notesOf(entity: RazorpayEntity | null): Record<string, unknown> | null {
  if (!entity) return null;
  return asRecord(entity.notes);
}

export const razorpayWebhook = onRequest(
  {
    cors: false,
    // Need raw body for HMAC. Firebase provides rawRequest.
  },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).send("Method not allowed");
      return;
    }

    const signature = req.get("x-razorpay-signature") ?? "";
    const rawBody =
      typeof req.rawBody === "object" && Buffer.isBuffer(req.rawBody)
        ? req.rawBody.toString("utf8")
        : typeof req.body === "string"
          ? req.body
          : JSON.stringify(req.body ?? {});

    if (!verifyWebhookSignature(rawBody, signature)) {
      logger.warn("razorpay webhook invalid signature");
      res.status(401).json({ ok: false, reason: "invalid_signature" });
      return;
    }

    let body: RazorpayEntity;
    try {
      body =
        typeof req.body === "object" && req.body !== null
          ? (req.body as RazorpayEntity)
          : (JSON.parse(rawBody) as RazorpayEntity);
    } catch {
      res.status(400).json({ ok: false, reason: "invalid_json" });
      return;
    }

    const event = String(body.event ?? "");
    const eventId =
      String(body.id ?? "").trim() ||
      `${event}:${signature.slice(0, 24)}:${Date.now()}`;

    const firstTime = await markWebhookEventProcessed(eventId, {
      event,
      received_at: new Date().toISOString()
    });
    if (!firstTime) {
      res.status(200).json({ ok: true, duplicate: true });
      return;
    }

    const payload = asRecord(body.payload) ?? {};
    const paymentEntity = nestedEntity(payload, "payment");
    const subscriptionEntity = nestedEntity(payload, "subscription");

    try {
      switch (event) {
        case "subscription.authenticated":
        case "subscription.activated":
        case "subscription.charged":
        case "subscription.completed":
        case "payment.captured": {
          const subId = String(
            subscriptionEntity?.id ??
              paymentEntity?.subscription_id ??
              ""
          ).trim();
          const paymentId = String(paymentEntity?.id ?? "").trim();
          const notes =
            notesOf(subscriptionEntity) ?? notesOf(paymentEntity);
          const resolved = subId
            ? await resolveSalonFromRazorpaySubscription(subId, notes)
            : notes &&
                typeof notes.salon_id === "string" &&
                typeof notes.plan_code === "string"
              ? {
                  salonId: String(notes.salon_id),
                  planCode: String(notes.plan_code)
                }
              : null;

          if (event === "subscription.authenticated" || event === "subscription.activated") {
            if (resolved && subId) {
              await upsertRazorpaySubscriptionMapping({
                razorpaySubscriptionId: subId,
                salonId: resolved.salonId,
                planCode: resolved.planCode,
                status: String(subscriptionEntity?.status ?? event)
              });
            }
            // Activation without a payment id is informational; charged/captured grants.
            if (!paymentId) {
              res.status(200).json({ ok: true, handled: event });
              return;
            }
          }

          if (event === "subscription.completed") {
            if (resolved && subId) {
              await markSubscriptionExpired({
                salonId: resolved.salonId,
                externalSubscriptionId: subId,
                eventType: event
              });
            }
            res.status(200).json({ ok: true, handled: event });
            return;
          }

          if (!resolved || !paymentId) {
            logger.warn("razorpay webhook missing mapping", {
              event,
              subId,
              paymentId
            });
            res.status(200).json({ ok: true, skipped: "unmapped" });
            return;
          }

          if (!isPurchaseablePlanCode(resolved.planCode)) {
            res.status(200).json({ ok: true, skipped: "invalid_plan" });
            return;
          }

          const plan = APP_PLANS[resolved.planCode];
          const amount =
            typeof paymentEntity?.amount === "number"
              ? paymentEntity.amount
              : plan.amountPaise;

          const result = await grantPaidSubscription({
            salonId: resolved.salonId,
            planCode: resolved.planCode,
            externalPaymentId: paymentId,
            externalSubscriptionId: subId || null,
            externalOrderId:
              typeof paymentEntity?.order_id === "string"
                ? paymentEntity.order_id
                : null,
            paymentProvider: "razorpay",
            amountPaise: amount,
            currency:
              typeof paymentEntity?.currency === "string"
                ? paymentEntity.currency
                : plan.currency,
            billingCycle: plan.period,
            eventType: event
          });

          if (subId) {
            await upsertRazorpaySubscriptionMapping({
              razorpaySubscriptionId: subId,
              salonId: resolved.salonId,
              planCode: resolved.planCode,
              status: "active"
            });
          }

          res.status(200).json({
            ok: true,
            handled: event,
            alreadyProcessed: result.alreadyProcessed
          });
          return;
        }

        case "subscription.pending":
        case "subscription.halted":
        case "payment.failed":
        case "subscription.payment_failed": {
          const subId = String(
            subscriptionEntity?.id ??
              paymentEntity?.subscription_id ??
              ""
          ).trim();
          const paymentId =
            String(paymentEntity?.id ?? "").trim() ||
            `failed:${eventId}`;
          const notes =
            notesOf(subscriptionEntity) ?? notesOf(paymentEntity);
          const resolved = subId
            ? await resolveSalonFromRazorpaySubscription(subId, notes)
            : null;

          if (resolved) {
            await recordFailedPayment({
              salonId: resolved.salonId,
              planCode: resolved.planCode,
              externalPaymentId: paymentId,
              externalSubscriptionId: subId || null,
              amountPaise:
                typeof paymentEntity?.amount === "number"
                  ? paymentEntity.amount
                  : undefined,
              failureReason:
                typeof paymentEntity?.error_description === "string"
                  ? paymentEntity.error_description
                  : event,
              eventType: event
            });
            if (subId) {
              await upsertRazorpaySubscriptionMapping({
                razorpaySubscriptionId: subId,
                salonId: resolved.salonId,
                planCode: resolved.planCode,
                status: String(subscriptionEntity?.status ?? "pending")
              });
            }
          }

          res.status(200).json({ ok: true, handled: event });
          return;
        }

        case "subscription.cancelled": {
          const subId = String(subscriptionEntity?.id ?? "").trim();
          const notes = notesOf(subscriptionEntity);
          const resolved = subId
            ? await resolveSalonFromRazorpaySubscription(subId, notes)
            : null;
          if (resolved && subId) {
            await markSubscriptionCancelled({
              salonId: resolved.salonId,
              externalSubscriptionId: subId,
              eventType: event
            });
          }
          res.status(200).json({ ok: true, handled: event });
          return;
        }

        default: {
          logger.info("razorpay webhook ignored event", { event });
          res.status(200).json({ ok: true, ignored: event });
        }
      }
    } catch (err) {
      logger.error("razorpay webhook handler failed", { event, err });
      // Return 500 so Razorpay retries; event marker already written —
      // delete marker on failure so retry can re-process.
      try {
        const { db } = await import("../firestore-helpers");
        await db().collection("razorpay_webhook_events").doc(eventId).delete();
      } catch {
        // best-effort
      }
      res.status(500).json({ ok: false, reason: "internal" });
    }
  }
);
