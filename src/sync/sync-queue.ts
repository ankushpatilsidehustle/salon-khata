import { database } from "@/database/sqlite-client";
import { getUtcTimestamp } from "@/domain/dates";

export type SyncOperation = "create" | "update" | "delete";

export type EnqueueSyncInput = {
  id: string;
  salonId: string;
  entityType: string;
  entityId: string;
  operation: SyncOperation;
  payload: unknown;
  deviceId: string;
};

export function enqueueSync(input: EnqueueSyncInput) {
  const now = getUtcTimestamp();

  database.runSync(
    `INSERT INTO sync_queue (
      id, salon_id, entity_type, entity_id, operation, payload, status,
      attempt_count, created_at, updated_at, device_id
    ) VALUES (?, ?, ?, ?, ?, ?, 'queued', 0, ?, ?, ?)`,
    [
      input.id,
      input.salonId,
      input.entityType,
      input.entityId,
      input.operation,
      JSON.stringify(input.payload),
      now,
      now,
      input.deviceId
    ]
  );
}