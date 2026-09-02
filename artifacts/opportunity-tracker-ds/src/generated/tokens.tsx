/* GENERATED FROM tokens.json -- DO NOT EDIT. Run scripts/build-tokens.mjs. */
// Portable design tokens (colors as hex). Web consumes the theme via
// src/index.css; mobile (Expo) and any other platform import this object so the
// whole product shares one source of truth.
export const tokens = {
  "color": {
    "light": {
      "background": "#181935",
      "foreground": "#f4effa",
      "border": "#766b9b",
      "card": "#292952",
      "cardForeground": "#f4effa",
      "popover": "#292952",
      "popoverForeground": "#f4effa",
      "primary": "#f3e5ab",
      "primaryForeground": "#181935",
      "secondary": "#7c6c9b",
      "secondaryForeground": "#f4effa",
      "muted": "#4a4570",
      "mutedForeground": "#dcd6e8",
      "accent": "#a88fca",
      "accentForeground": "#181935",
      "destructive": "#d86a7b",
      "destructiveForeground": "#ffffff",
      "input": "#6d638e",
      "ring": "#f3e5ab",
      "chart1": "#f3e5ab",
      "chart2": "#a88fca",
      "chart3": "#9fd8d2",
      "chart4": "#f09a88",
      "chart5": "#d6b3ef",
      "sidebar": "#0e0d22",
      "sidebarForeground": "#f4effa",
      "sidebarBorder": "#423b65",
      "sidebarPrimary": "#f3e5ab",
      "sidebarPrimaryForeground": "#181935",
      "sidebarAccent": "#292952",
      "sidebarAccentForeground": "#f4effa",
      "sidebarRing": "#f3e5ab"
    },
    "dark": {
      "background": "#0e0d22",
      "foreground": "#f8f5ff",
      "border": "#4a4570",
      "card": "#181935",
      "cardForeground": "#f8f5ff",
      "popover": "#181935",
      "popoverForeground": "#f8f5ff",
      "primary": "#f3e5ab",
      "primaryForeground": "#0e0d22",
      "secondary": "#4a4570",
      "secondaryForeground": "#f4effa",
      "muted": "#292952",
      "mutedForeground": "#a8a0be",
      "accent": "#bba9dc",
      "accentForeground": "#0e0d22",
      "destructive": "#d0526b",
      "destructiveForeground": "#ffffff",
      "input": "#4a4570",
      "ring": "#f3e5ab",
      "chart1": "#f3e5ab",
      "chart2": "#bba9dc",
      "chart3": "#9fd8d2",
      "chart4": "#f09a88",
      "chart5": "#d6b3ef",
      "sidebar": "#080719",
      "sidebarForeground": "#f8f5ff",
      "sidebarBorder": "#292952",
      "sidebarPrimary": "#f3e5ab",
      "sidebarPrimaryForeground": "#0e0d22",
      "sidebarAccent": "#181935",
      "sidebarAccentForeground": "#f8f5ff",
      "sidebarRing": "#f3e5ab"
    }
  },
  "fontFamily": {
    "sans": [
      "Plus Jakarta Sans",
      "Inter",
      "system-ui",
      "sans-serif"
    ],
    "serif": [
      "Cormorant Garamond",
      "Georgia",
      "serif"
    ],
    "mono": [
      "Plus Jakarta Sans",
      "Inter",
      "sans-serif"
    ]
  },
  "radius": "0.75rem",
  "spacing": "0.25rem"
} as const;

export type Tokens = typeof tokens;
export default tokens;
