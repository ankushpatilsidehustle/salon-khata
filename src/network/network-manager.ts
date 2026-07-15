import NetInfo, {
  NetInfoState,
  NetInfoStateType
} from "@react-native-community/netinfo";

import { eventBus } from "@/application/event-bus";

/**
 * Thin connectivity layer used by the BackupScheduler and RestorePipeline.
 *
 * Responsibilities:
 *   - Maintain a cached view of "am I online right now" so callers don't
 *     have to await an async round-trip on every write.
 *   - Broadcast changes through `eventBus.emit("network:changed", …)`.
 *   - Expose `waitForOnline(timeoutMs)` so the pipeline can pause between
 *     retry attempts instead of hard-looping.
 *
 * Design notes:
 *   - We treat `isConnected && isInternetReachable !== false` as "online".
 *     `isInternetReachable` can be `null` on cold-start; treating that as
 *     "online" avoids blocking the very first backup on a slow probe.
 *   - `isMetered` is derived from `type === 'cellular'` OR the platform's
 *     explicit `isConnectionExpensive` hint. Used by the Wi-Fi-only
 *     preference.
 *   - The subscription is process-lifetime: registered once at app start,
 *     torn down only from tests via `__stopForTests()`.
 */

export type NetworkState = {
  isOnline: boolean;
  isWifi: boolean;
  isMetered: boolean;
};

const UNKNOWN_STATE: NetworkState = {
  isOnline: false,
  isMetered: false,
  isWifi: false
};

let current: NetworkState = UNKNOWN_STATE;
let unsubscribe: (() => void) | null = null;
const onlineWaiters = new Set<() => void>();

/**
 * Subscribe to NetInfo and cache the latest state. Safe to call more than
 * once — subsequent calls no-op. Should be invoked once during app start.
 */
export function startNetworkManager(): void {
  if (unsubscribe) return;

  unsubscribe = NetInfo.addEventListener((state) => {
    applyState(state);
  });

  // Seed the cache eagerly — the initial event can lag a few hundred ms.
  NetInfo.fetch()
    .then(applyState)
    .catch(() => {
      // Non-fatal — the event listener will supply the first real update.
    });
}

/** Cached snapshot. Use inside hot paths that can't await. */
export function getNetworkState(): NetworkState {
  return current;
}

/** Convenience — most callers only care about this. */
export function isOnline(): boolean {
  return current.isOnline;
}

/**
 * Resolve when the device is online, or reject after `timeoutMs`. Resolves
 * immediately if already online. `timeoutMs = 0` waits forever.
 */
export function waitForOnline(timeoutMs = 0): Promise<void> {
  if (current.isOnline) return Promise.resolve();

  return new Promise((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout> | null = null;

    const done = () => {
      onlineWaiters.delete(waiter);
      if (timer) clearTimeout(timer);
      resolve();
    };
    const waiter = () => done();
    onlineWaiters.add(waiter);

    if (timeoutMs > 0) {
      timer = setTimeout(() => {
        onlineWaiters.delete(waiter);
        reject(new NetworkTimeoutError(timeoutMs));
      }, timeoutMs);
    }
  });
}

export class NetworkTimeoutError extends Error {
  constructor(public readonly timeoutMs: number) {
    super(`Timed out after ${timeoutMs}ms waiting for network`);
    this.name = "NetworkTimeoutError";
  }
}

/**
 * Test-only hook — stop listening and reset cached state.
 * @internal
 */
export function __stopForTests(): void {
  unsubscribe?.();
  unsubscribe = null;
  current = UNKNOWN_STATE;
  onlineWaiters.clear();
}

// ─── internals ─────────────────────────────────────────────────────────────

function applyState(state: NetInfoState): void {
  const next = deriveState(state);
  const changed =
    next.isOnline !== current.isOnline ||
    next.isWifi !== current.isWifi ||
    next.isMetered !== current.isMetered;

  current = next;

  if (!changed) return;

  eventBus.emit("network:changed", next);

  // Flush any `waitForOnline` promises. Copy first — handlers unsubscribe
  // themselves and would mutate the set mid-iteration.
  if (next.isOnline && onlineWaiters.size > 0) {
    const waiters = Array.from(onlineWaiters);
    onlineWaiters.clear();
    for (const w of waiters) w();
  }
}

function deriveState(s: NetInfoState): NetworkState {
  const reachable = s.isInternetReachable;
  const isOnline = !!s.isConnected && reachable !== false;
  const isWifi = s.type === NetInfoStateType.wifi;
  // `isConnectionExpensive` is the platform's hint (some Android carriers
  // flag Wi-Fi hotspots as expensive too). Treat cellular as always metered.
  const isMetered =
    s.type === NetInfoStateType.cellular ||
    // Details object shape varies by connection type — guard defensively.
    (s.details as { isConnectionExpensive?: boolean } | null)
      ?.isConnectionExpensive === true;

  return { isMetered, isOnline, isWifi };
}
