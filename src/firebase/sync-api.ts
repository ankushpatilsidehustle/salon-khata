export type PushSyncPayload = {
  operationId: string;
  salonId: string;
  deviceId: string;
  entityType: string;
  entityId: string;
  operation: "create" | "update" | "delete";
  payload: unknown;
  clientUpdatedAt: string;
};

export type PushSyncResponse = {
  accepted: boolean;
  entityId: string;
  revision: number;
  serverUpdatedAt: string;
  conflict: null | {
    policy: "last_write_wins";
    winner: "local" | "cloud";
    auditLogId: string;
  };
};

export async function pushSyncOperation(payload: PushSyncPayload): Promise<PushSyncResponse> {
  return {
    accepted: true,
    conflict: null,
    entityId: payload.entityId,
    revision: 0,
    serverUpdatedAt: new Date().toISOString()
  };
}