// src/design-system/theme.ts
//
// The single source of truth for the active design theme.
//
// ─── How to customise ────────────────────────────────────────────────────────
// • To change a single color: update the hex value in colors.ts.
//   All components inherit it automatically via semantic tokens.
//
// • To create a full custom theme (white-label, dark mode, A/B test):
//   1. Duplicate colors.ts / shadows.ts with your overrides.
//   2. Call `createTheme({ colors: myColors, shadows: myShadows })`.
//   3. Pass the result to a ThemeContext provider (future work).
//
// • To swap the active theme globally, replace `activeTheme` below.
// ─────────────────────────────────────────────────────────────────────────────

import { colors } from "./colors";
import { radius } from "./radius";
import { shadows } from "./shadows";
import { spacing } from "./spacing";
import { typography } from "./typography";

export type DesignTheme = {
  /** Human-readable name (useful for debugging / analytics). */
  name: string;
  colors: typeof colors;
  radius: typeof radius;
  shadows: typeof shadows;
  spacing: typeof spacing;
  typography: typeof typography;
};

/**
 * PhonePe-inspired fintech theme.
 * Brand: deep purple (#6739B7) on a clean neutral canvas (#F5F6FA).
 */
export const activeTheme: DesignTheme = {
  name: "phonePeInspired",
  colors,
  radius,
  shadows,
  spacing,
  typography
};

/**
 * Derive a custom theme by merging partial overrides on top of `activeTheme`.
 *
 * Example:
 * ```ts
 * const redTheme = createTheme({
 *   name: "danger",
 *   colors: { brand: { primary: "#D32F2F" } } as any,
 * });
 * ```
 */
export function createTheme(
  overrides: Partial<DesignTheme>
): DesignTheme {
  return {
    ...activeTheme,
    ...overrides,
    colors: overrides.colors
      ? { ...activeTheme.colors, ...overrides.colors }
      : activeTheme.colors,
    shadows: overrides.shadows
      ? { ...activeTheme.shadows, ...overrides.shadows }
      : activeTheme.shadows
  } as DesignTheme;
}
