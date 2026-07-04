// Soft ambient shadows with a purple tint — matching the brand palette.
// Increase shadowOpacity or elevation here to make shadows more prominent globally.
export const shadows = {
  sm: {
    elevation: 2,
    shadowColor: "#6739B7",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 8
  },
  md: {
    elevation: 4,
    shadowColor: "#6739B7",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12
  },
  lg: {
    elevation: 8,
    shadowColor: "#6739B7",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 20
  }
} as const;