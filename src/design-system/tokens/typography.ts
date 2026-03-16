export const borisTypography = {
  fontFamily: {
    sans: ["Inter", "system-ui", "sans-serif"],
    mono: ["JetBrains Mono", "monospace"],
  },
  fontSize: {
    "display-lg": ["2rem", { lineHeight: "2.5rem", fontWeight: "700", letterSpacing: "-0.02em" }],
    "display-md": ["1.75rem", { lineHeight: "2.25rem", fontWeight: "700", letterSpacing: "-0.02em" }],
    "heading-xl": ["1.5rem", { lineHeight: "2rem", fontWeight: "600", letterSpacing: "-0.02em" }],
    "heading-lg": ["1.25rem", { lineHeight: "1.75rem", fontWeight: "600", letterSpacing: "-0.01em" }],
    "heading-md": ["1.125rem", { lineHeight: "1.5rem", fontWeight: "600", letterSpacing: "-0.01em" }],
    "heading-sm": ["1rem", { lineHeight: "1.5rem", fontWeight: "600" }],
    "body-md": ["0.875rem", { lineHeight: "1.375rem", fontWeight: "400" }],
    "body-sm": ["0.8125rem", { lineHeight: "1.25rem", fontWeight: "400" }],
    "label-md": ["0.8125rem", { lineHeight: "1.125rem", fontWeight: "500" }],
    "label-sm": ["0.75rem", { lineHeight: "1rem", fontWeight: "500" }],
    "metric-xl": ["1.875rem", { lineHeight: "2rem", fontWeight: "700", letterSpacing: "-0.03em" }],
    "metric-lg": ["1.5rem", { lineHeight: "1.75rem", fontWeight: "700", letterSpacing: "-0.02em" }],
    "metric-sm": ["1.125rem", { lineHeight: "1.5rem", fontWeight: "600" }],
  },
} as const;

export type BorisTypography = typeof borisTypography;
