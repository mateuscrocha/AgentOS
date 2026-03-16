export const borisColors = {
  brand: {
    primary: "#F97316",
    primaryHover: "#EA580C",
    soft: "#FDE68A",
  },
  neutral: {
    0: "#FFFFFF",
    50: "#FAFAFA",
    100: "#F4F4F5",
    200: "#E4E4E7",
    300: "#D4D4D8",
    400: "#A1A1AA",
    500: "#71717A",
    700: "#3F3F46",
    900: "#27272A",
    950: "#111111",
  },
  surface: {
    canvas: "#FAFAFA",
    panel: "#FFFFFF",
    subtle: "#F4F4F5",
    elevated: "#FCFCFD",
  },
  text: {
    strong: "#111111",
    default: "#27272A",
    muted: "#71717A",
    disabled: "#A1A1AA",
    inverse: "#FFFFFF",
  },
  border: {
    subtle: "#F4F4F5",
    default: "#E4E4E7",
    strong: "#D4D4D8",
    focus: "#F97316",
  },
  feedback: {
    success: "#16A34A",
    warning: "#D97706",
    danger: "#DC2626",
    info: "#2563EB",
  },
  chart: {
    primary: "#F97316",
    blue: "#0891B2",
    green: "#16A34A",
    amber: "#D97706",
    violet: "#7C3AED",
  },
} as const;

export type BorisColors = typeof borisColors;
