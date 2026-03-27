export const BILLING_CREDIT_WINDOW_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

type BillingTimestamp = string | number | null | undefined;

export type BillingCreditState = {
  rawStatus: string | null;
  effectiveStatus: string | null;
  isDelinquent: boolean;
  hasActiveCredit: boolean;
  lastPaidAt: string | null;
  creditExpiresAt: string | null;
  accessEndsAt: string | null;
};

export function toTimestampMs(value: BillingTimestamp): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    if (value > 1_000_000_000_000) return value;
    return value * 1000;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function toIso(valueMs: number | null) {
  return valueMs != null ? new Date(valueMs).toISOString() : null;
}

export function resolveBillingCreditState(input: {
  subscriptionStatus?: string | null;
  currentPeriodEnd?: BillingTimestamp;
  lastPaidAt?: BillingTimestamp;
  now?: BillingTimestamp;
}): BillingCreditState {
  const rawStatus = input.subscriptionStatus ?? null;
  const nowMs = toTimestampMs(input.now) ?? Date.now();
  const lastPaidAtMs = toTimestampMs(input.lastPaidAt);
  const stripePeriodEndMs = toTimestampMs(input.currentPeriodEnd);
  const creditExpiresAtMs = lastPaidAtMs != null ? lastPaidAtMs + BILLING_CREDIT_WINDOW_DAYS * DAY_MS : null;
  const hasActiveCredit = creditExpiresAtMs != null && creditExpiresAtMs > nowMs;
  const hasFallbackStripeAccess =
    lastPaidAtMs == null &&
    stripePeriodEndMs != null &&
    stripePeriodEndMs > nowMs &&
    (rawStatus === "active" || rawStatus === "trialing");

  let effectiveStatus = rawStatus;
  let isDelinquent = false;
  let accessEndsAtMs = creditExpiresAtMs;

  if (hasActiveCredit) {
    effectiveStatus = "active";
  } else if (lastPaidAtMs != null) {
    effectiveStatus = "unpaid";
    isDelinquent = true;
  } else if (rawStatus === "trialing" && stripePeriodEndMs != null && stripePeriodEndMs > nowMs) {
    effectiveStatus = "trialing";
    accessEndsAtMs = stripePeriodEndMs;
  } else if (hasFallbackStripeAccess) {
    effectiveStatus = "active";
    accessEndsAtMs = stripePeriodEndMs;
  } else if (rawStatus === "past_due" || rawStatus === "unpaid" || rawStatus === "incomplete") {
    effectiveStatus = "unpaid";
    isDelinquent = true;
  }

  return {
    rawStatus,
    effectiveStatus,
    isDelinquent,
    hasActiveCredit: hasActiveCredit || hasFallbackStripeAccess,
    lastPaidAt: toIso(lastPaidAtMs),
    creditExpiresAt: toIso(creditExpiresAtMs),
    accessEndsAt: toIso(accessEndsAtMs),
  };
}
