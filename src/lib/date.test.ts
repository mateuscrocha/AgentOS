import { describe, expect, it } from "vitest";
import { isValidDate } from "./date";
import { getProvisioningErrorMessage, isGroupValidationSuccessful } from "@/utils/onboarding";

describe("isValidDate", () => {
  it("retorna true para Date válido", () => {
    expect(isValidDate(new Date())).toBe(true);
  });

  it("retorna false para Date inválido", () => {
    expect(isValidDate(new Date("not-a-date"))).toBe(false);
  });

  it("retorna false para tipos não-Date", () => {
    expect(isValidDate("2025-01-01")).toBe(false);
    expect(isValidDate(null)).toBe(false);
    expect(isValidDate(undefined)).toBe(false);
  });
});

describe("getProvisioningErrorMessage", () => {
  it("retorna mensagem amigável para grupo já provisionado", () => {
    expect(getProvisioningErrorMessage("GROUP_ALREADY_PROVISIONED")).toBe(
      "Esse grupo já foi cadastrado. Faça login para continuar."
    );
  });

  it("retorna null para código desconhecido", () => {
    expect(getProvisioningErrorMessage("SOMETHING_ELSE")).toBe(null);
  });

  it("retorna null para código vazio", () => {
    expect(getProvisioningErrorMessage(undefined)).toBe(null);
    expect(getProvisioningErrorMessage(null)).toBe(null);
    expect(getProvisioningErrorMessage("")).toBe(null);
  });
});

describe("isGroupValidationSuccessful", () => {
  it("retorna true quando validação é bem-sucedida", () => {
    expect(
      isGroupValidationSuccessful({
        is_valid: true,
        is_boris_in_group: true,
        data_incomplete: false,
      })
    ).toBe(true);
  });

  it("retorna false quando link é inválido", () => {
    expect(isGroupValidationSuccessful({ is_valid: false, is_boris_in_group: false })).toBe(false);
  });

  it("retorna false quando Bóris não está no grupo", () => {
    expect(isGroupValidationSuccessful({ is_valid: true, is_boris_in_group: false })).toBe(false);
  });

  it("retorna false quando dados estão incompletos", () => {
    expect(isGroupValidationSuccessful({ is_valid: true, is_boris_in_group: true, data_incomplete: true })).toBe(false);
  });

  it("retorna false quando não há resultado", () => {
    expect(isGroupValidationSuccessful(null)).toBe(false);
    expect(isGroupValidationSuccessful(undefined)).toBe(false);
  });
});
