import { describe, expect, it } from "vitest";

import { deriveAccountCommercialClassification } from "./use-crm";

describe("deriveAccountCommercialClassification", () => {
  it("mantem paying_customer como cliente mesmo sem vinculo Stripe", () => {
    expect(
      deriveAccountCommercialClassification({
        status: "prospect",
        stage: "meeting",
        hasStripeLink: false,
        relationshipType: "paying_customer",
      }),
    ).toEqual({
      status: "customer",
      stage: "customer",
    });
  });

  it("mantem conta paying_customer inativa fora da coluna de cliente", () => {
    expect(
      deriveAccountCommercialClassification({
        status: "inactive",
        stage: "lost",
        hasStripeLink: false,
        relationshipType: "paying_customer",
      }),
    ).toEqual({
      status: "inactive",
      stage: "lost",
    });
  });

  it("continua tratando Stripe como cliente para leads sem organization", () => {
    expect(
      deriveAccountCommercialClassification({
        status: "lead",
        stage: "proposal",
        hasStripeLink: true,
        relationshipType: null,
      }),
    ).toEqual({
      status: "customer",
      stage: "customer",
    });
  });
});
