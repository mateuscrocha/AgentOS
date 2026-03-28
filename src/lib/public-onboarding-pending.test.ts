import { describe, expect, it, beforeEach } from "vitest";

import {
  clearPendingOnboardingDraft,
  readPendingOnboardingDraft,
  savePendingOnboardingDraft,
} from "./public-onboarding-pending";

describe("pending onboarding draft", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("salva e recupera o rascunho do onboarding", () => {
    savePendingOnboardingDraft({
      values: {
        fullName: "Ana Souza",
        organizationName: "Operação Ana",
        email: "ana@example.com",
        whatsappPhone: "(11) 99999-1111",
        password: "Senha!12345",
        confirmPassword: "Senha!12345",
        inviteLink: "https://chat.whatsapp.com/convite",
      },
      userId: "user-1",
      validatedGroup: {
        provider_phone: "120363@g.us",
        group_name: "Grupo Alfa",
        participants: [],
      },
    });

    expect(readPendingOnboardingDraft()).toMatchObject({
      email: "ana@example.com",
      userId: "user-1",
      organizationName: "Operação Ana",
    });
  });

  it("remove o rascunho salvo", () => {
    localStorage.setItem("boris-onboarding:pending-v1", JSON.stringify({ email: "ana@example.com", userId: "user-1", inviteLink: "x" }));
    clearPendingOnboardingDraft();
    expect(readPendingOnboardingDraft()).toBeNull();
  });
});
