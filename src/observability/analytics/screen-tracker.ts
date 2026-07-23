import type { NavigationState, PartialState } from "@react-navigation/native";

import { isAnalyticsEnabled } from "@/observability/consent/consent-manager";
import { getFirebaseAnalyticsAdapter } from "@/observability/adapters/firebase-analytics";
import { noteScreen, getSessionId } from "@/observability/analytics/session-manager";
import { track } from "@/observability/analytics/analytics-service";
import { ScreenEvents } from "@/observability/events/catalog";
import { setCrashAttribute } from "@/observability/crash/crash-reporter";
import { logger } from "@/observability/logging/logger";

let currentScreen: string | null = null;
let previousScreen: string | null = null;
let screenOpenedAt = Date.now();

export function getCurrentScreen(): string | null {
  return currentScreen;
}

export function getPreviousScreen(): string | null {
  return previousScreen;
}

/** Resolve the deepest active route name from a navigation state tree. */
export function getActiveRouteName(
  state: NavigationState | PartialState<NavigationState> | undefined
): string | null {
  if (!state || typeof state.index !== "number") return null;
  const route = state.routes[state.index];
  if (!route) return null;
  if (route.state) {
    return getActiveRouteName(route.state) ?? route.name;
  }
  return route.name;
}

function fireAndForget(task: () => Promise<void>): void {
  void task().catch(() => {
    /* swallow */
  });
}

/**
 * Call from each NavigationContainer's `onStateChange`.
 * Emits Firebase screen_view + custom screen_open / screen_close with duration.
 */
export function onNavigationStateChange(
  state: NavigationState | PartialState<NavigationState> | undefined
): void {
  const next = getActiveRouteName(state);
  if (!next || next === currentScreen) return;

  const now = Date.now();
  const durationMs = now - screenOpenedAt;

  if (currentScreen && isAnalyticsEnabled()) {
    track(ScreenEvents.close, {
      screen_name: currentScreen,
      duration_ms: durationMs,
      next_screen: next
    });
  }

  previousScreen = currentScreen;
  currentScreen = next;
  screenOpenedAt = now;
  noteScreen(next);
  setCrashAttribute("current_screen", next);

  if (!isAnalyticsEnabled()) return;

  track(ScreenEvents.open, {
    screen_name: next,
    previous_screen: previousScreen,
    session_id: getSessionId()
  });

  fireAndForget(async () => {
    await getFirebaseAnalyticsAdapter().logScreenView(next, {
      previous_screen: previousScreen,
      session_id: getSessionId()
    });
  });

  logger.debug(`navigated to ${next}`, {
    category: "navigation",
    previous_screen: previousScreen
  });
}

/** Sheet / modal that is not a route — Phase 2 helper. */
export function trackSheet(
  sheetName: string,
  action: "opened" | "closed",
  params?: Record<string, string | number | boolean | null | undefined>
): void {
  if (!isAnalyticsEnabled()) return;
  track(action === "opened" ? "sheet_opened" : "sheet_closed", {
    sheet_name: sheetName,
    ...params
  });
}
