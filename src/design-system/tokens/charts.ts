export const borisChartTokens = {
  categorical: ["#F97316", "#0891B2", "#16A34A", "#D97706", "#7C3AED"],
  sequentialWarm: ["#FFF7ED", "#FDBA74", "#F97316", "#EA580C"],
  threshold: {
    positive: "#16A34A",
    warning: "#D97706",
    negative: "#DC2626",
  },
} as const;

export type BorisChartTokens = typeof borisChartTokens;
