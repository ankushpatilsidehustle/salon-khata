export type SyncStatus = "pending" | "synced" | "failed" | "conflict";

export type SharedColumns = {
  id: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  sync_status: SyncStatus;
  device_id: string;
};