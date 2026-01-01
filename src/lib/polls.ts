export function normalizeVotedOptions(votedOptions: unknown): string[] {
  if (Array.isArray(votedOptions)) {
    return votedOptions
      .filter((v) => typeof v === "string")
      .map((v) => v.trim())
      .filter(Boolean);
  }

  if (typeof votedOptions === "string") {
    const trimmed = votedOptions.trim();
    return trimmed ? [trimmed] : [];
  }

  if (votedOptions && typeof votedOptions === "object") {
    return Object.values(votedOptions as Record<string, unknown>)
      .filter((v) => typeof v === "string")
      .map((v) => v.trim())
      .filter(Boolean);
  }

  return [];
}

export function computePollPercent(votesCount: number, totalVotes: number, decimals = 0): number {
  if (!Number.isFinite(votesCount) || !Number.isFinite(totalVotes) || totalVotes <= 0) return 0;

  const raw = (votesCount / totalVotes) * 100;
  const pow = 10 ** Math.max(0, decimals);
  const rounded = Math.round(raw * pow) / pow;
  return Math.min(100, Math.max(0, rounded));
}

