export const borisShadows = {
  xs: "0 1px 2px rgba(0, 0, 0, 0.04)",
  sm: "0 4px 12px rgba(17, 17, 17, 0.06)",
  md: "0 12px 32px rgba(17, 17, 17, 0.08)",
  focus: "0 0 0 2px rgba(249, 115, 22, 0.18)",
} as const;

export type BorisShadows = typeof borisShadows;
