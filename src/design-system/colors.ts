// ─── Palette ─────────────────────────────────────────────────────────────────
// PhonePe-inspired fintech theme — deep purple on a neutral canvas.
// To change the theme, update the hex values here; all components inherit them
// via semantic tokens (colors.brand.primary, colors.text.secondary, etc.).
// For structural overrides use `createTheme()` from @/design-system/tokens.

export const colors = {
  brand: {
    /** Primary action, AppBar (brand variant), center nav button  */
    primary: "#6739B7",
    primaryPressed: "#5A2FA0",
    /** Deep purple — dark backgrounds, high-contrast text */
    secondary: "#372163",
    secondaryPressed: "#2D1A52",
    /** Lighter purple — active tab icons/labels, selected states */
    accent: "#9967D1",
    /** Softest purple — subtle chips, tinted backgrounds */
    accentLight: "#CEBCD5"
  },
  background: {
    default: "#F5F6FA",
    subtle: "#EEF0F8"
  },
  surface: {
    default: "#FFFFFF",
    raised: "#FAFAFE",
    sunken: "#EEEEF5"
  },
  text: {
    primary: "#212121",
    secondary: "#757575",
    muted: "#9E9E9E",
    inverse: "#FFFFFF",
    link: "#6739B7"
  },
  border: {
    subtle: "#E0E0E8",
    strong: "#BDBDCE"
  },
  divider: "#EEEEEE",
  status: {
    success: "#15833E",
    successBg: "#E8F5E9",
    warning: "#F59E0B",
    warningBg: "#FFFBEB",
    danger: "#D32F2F",
    dangerBg: "#FFEBEE",
    info: "#2563EB",
    infoBg: "#EFF6FF"
  },
  interactive: {
    pressed: "rgba(103,57,183,0.12)",
    selected: "rgba(103,57,183,0.10)",
    disabled: "#E0E0E0",
    disabledText: "#9E9E9E"
  },
  overlay: {
    scrim: "rgba(33,33,33,0.48)",
    sheet: "rgba(33,33,33,0.32)"
  }
} as const;