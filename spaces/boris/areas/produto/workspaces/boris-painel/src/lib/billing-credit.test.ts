import { describe, expect, it } from "vitest";

import { resolveBillingCreditState } from "./billing-credit";

describe("resolveBillingCreditState", () => {
  it("mantem credito ativo por 30 dias apos pagamento", () => {
    const state = resolveBillingCreditState({
      subscriptionStatus: "canceled",
      lastPaidAt: "2026-03-10T12:00:00.000Z",
      now: "2026-03-26T12:00:00.000Z",
    });

    expect(state.effectiveStatus).toBe("active");
    expect(state.isDelinquent).toBe(false);
    expect(state.hasActiveCredit).toBe(true);
    expect(state.creditExpiresAt).toBe("2026-04-09T12:00:00.000Z");
  });

  it("marca como inadimplente quando o credito ja venceu", () => {
    const state = resolveBillingCreditState({
      subscriptionStatus: "canceled",
      lastPaidAt: "2026-02-01T12:00:00.000Z",
      now: "2026-03-26T12:00:00.000Z",
    });

    expect(state.effectiveStatus).toBe("unpaid");
    expect(state.isDelinquent).toBe(true);
    expect(state.hasActiveCredit).toBe(false);
  });

  it("mantem trial como trial quando ainda nao houve pagamento", () => {
    const state = resolveBillingCreditState({
      subscriptionStatus: "trialing",
      currentPeriodEnd: "2026-03-30T12:00:00.000Z",
      now: "2026-03-26T12:00:00.000Z",
    });

    expect(state.effectiveStatus).toBe("trialing");
    expect(state.isDelinquent).toBe(false);
    expect(state.accessEndsAt).toBe("2026-03-30T12:00:00.000Z");
  });
});
