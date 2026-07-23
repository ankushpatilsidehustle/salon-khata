import { newId } from "@/domain/id";

let sessionId = newId();
let sessionStartedAt = Date.now();
let firstScreen: string | null = null;
let lastScreen: string | null = null;

export function startSession(): string {
  sessionId = newId();
  sessionStartedAt = Date.now();
  firstScreen = null;
  lastScreen = null;
  return sessionId;
}

export function getSessionId(): string {
  return sessionId;
}

export function getSessionDurationMs(): number {
  return Date.now() - sessionStartedAt;
}

export function noteScreen(screenName: string): void {
  if (!firstScreen) firstScreen = screenName;
  lastScreen = screenName;
}

export function getFirstScreen(): string | null {
  return firstScreen;
}

export function getLastScreen(): string | null {
  return lastScreen;
}

export function getSessionSnapshot(): {
  session_id: string;
  duration_ms: number;
  first_screen: string | null;
  last_screen: string | null;
} {
  return {
    session_id: sessionId,
    duration_ms: getSessionDurationMs(),
    first_screen: firstScreen,
    last_screen: lastScreen
  };
}
