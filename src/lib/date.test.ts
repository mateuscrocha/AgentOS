import { describe, expect, it } from "vitest";
import { isValidDate } from "./date";

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
