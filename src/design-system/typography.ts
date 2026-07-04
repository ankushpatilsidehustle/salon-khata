import type { TextStyle } from "react-native";

const tabular: TextStyle["fontVariant"] = ["tabular-nums"];

export const typography = {
  display: {
    fontSize: 32,
    fontWeight: "700",
    letterSpacing: 0,
    lineHeight: 40
  },
  h1: {
    fontSize: 24,
    fontWeight: "700",
    letterSpacing: 0,
    lineHeight: 32
  },
  h2: {
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: 0,
    lineHeight: 28
  },
  h3: {
    fontSize: 18,
    fontWeight: "600",
    letterSpacing: 0,
    lineHeight: 24
  },
  body: {
    fontSize: 16,
    fontWeight: "400",
    letterSpacing: 0,
    lineHeight: 24
  },
  bodyEmphasis: {
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: 0,
    lineHeight: 24
  },
  bodySmall: {
    fontSize: 14,
    fontWeight: "400",
    letterSpacing: 0,
    lineHeight: 20
  },
  caption: {
    fontSize: 13,
    fontWeight: "500",
    letterSpacing: 0,
    lineHeight: 18
  },
  overline: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.6,
    lineHeight: 16,
    textTransform: "uppercase" as const
  },
  button: {
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0,
    lineHeight: 20
  },
  moneyHero: {
    fontSize: 32,
    fontWeight: "700",
    letterSpacing: 0,
    lineHeight: 40,
    fontVariant: tabular
  },
  moneyLarge: {
    fontSize: 24,
    fontWeight: "700",
    letterSpacing: 0,
    lineHeight: 32,
    fontVariant: tabular
  },
  moneyMedium: {
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: 0,
    lineHeight: 28,
    fontVariant: tabular
  },
  moneyBody: {
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: 0,
    lineHeight: 24,
    fontVariant: tabular
  },
  moneySmall: {
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: 0,
    lineHeight: 20,
    fontVariant: tabular
  }
} as const;