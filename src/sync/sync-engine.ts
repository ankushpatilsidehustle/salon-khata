export type SyncResult = {
  pushed: number;
  pulled: number;
  failed: number;
};

export class SyncEngine {
  async runOnce(): Promise<SyncResult> {
    return {
      failed: 0,
      pulled: 0,
      pushed: 0
    };
  }
}