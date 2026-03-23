export const colors = {
  navy900: "#1E3A5F",
  blue600: "#2E86C1",
  green500: "#27AE60",
  red500: "#E74C3C",
  yellow500: "#F39C12",
  sky100: "#E8F3FF",
  white: "#FFFFFF",
  ink900: "#15263A"
} as const;

export const spacing = {
  s1: 4,
  s2: 8,
  s3: 12,
  s4: 16,
  s6: 24,
  s8: 32,
  s12: 48
} as const;

export const radius = {
  sm: 8,
  md: 16,
  lg: 24,
  pill: 999
} as const;

export const typography = {
  english: "DM Sans",
  chinese: "HarmonyOS Sans SC"
} as const;

export const theme = {
  colors,
  spacing,
  radius,
  typography
} as const;

export type Theme = typeof theme;
