import { describe, expect, it } from "vitest";
import { formatDateSimpleBR, formatDateTickBR, isValidDate } from "./date";

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

describe("date formatting in Sao Paulo timezone", () => {
  it("mantém o mesmo dia para strings YYYY-MM-DD no tick do gráfico", () => {
    expect(formatDateTickBR("2026-03-31")).toBe("31/03");
  });

  it("mantém o mesmo dia para strings YYYY-MM-DD na data simples", () => {
    expect(formatDateSimpleBR("2026-03-31")).toBe("31/03/2026");
  });
});
