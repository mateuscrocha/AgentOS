import { describe, expect, it } from "vitest";

import {
  normalizePhoneToE164,
  validatePublicOnboardingForm,
} from "./public-onboarding";

describe("public onboarding helpers", () => {
  it("normaliza telefone brasileiro para E.164", () => {
    expect(normalizePhoneToE164("(11) 99876-1234")).toBe("+5511998761234");
    expect(normalizePhoneToE164("+55 11 99876-1234")).toBe("+5511998761234");
  });

  it("valida os campos obrigatórios do onboarding público", () => {
    const errors = validatePublicOnboardingForm({
      fullName: "",
      organizationName: "",
      email: "invalido",
      whatsappPhone: "",
      password: "fraca",
      confirmPassword: "outra",
      inviteLink: "https://example.com",
    });

    expect(errors.fullName).toContain("Nome");
    expect(errors.organizationName).toContain("organização");
    expect(errors.email).toContain("Email");
    expect(errors.whatsappPhone).toContain("WhatsApp");
    expect(errors.password).toBeTruthy();
    expect(errors.confirmPassword).toContain("coincidem");
    expect(errors.inviteLink).toContain("WhatsApp");
  });
});
