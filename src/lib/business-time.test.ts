import { describe, expect, it } from "vitest";

import { businessMsBetween, DEFAULT_SUPPORT_BUSINESS_HOURS } from "./business-time";

describe("businessMsBetween", () => {
  it("calcula intervalo no mesmo dia dentro do horário comercial", () => {
    const start = "2026-02-23T13:00:00.000Z"; // 10:00 SP
    const end = "2026-02-23T13:30:00.000Z"; // 10:30 SP
    expect(businessMsBetween(start, end, DEFAULT_SUPPORT_BUSINESS_HOURS)).toBe(30 * 60 * 1000);
  });

  it("desconsidera tempo fora do horário comercial", () => {
    const start = "2026-02-23T20:30:00.000Z"; // 17:30 SP
    const end = "2026-02-23T22:00:00.000Z"; // 19:00 SP
    expect(businessMsBetween(start, end, DEFAULT_SUPPORT_BUSINESS_HOURS)).toBe(30 * 60 * 1000);
  });

  it("desconsidera fim de semana", () => {
    const start = "2026-02-27T20:00:00.000Z"; // Sexta 17:00 SP
    const end = "2026-03-02T12:00:00.000Z"; // Segunda 09:00 SP
    const expected = 2 * 60 * 60 * 1000; // 1h sexta + 1h segunda
    expect(businessMsBetween(start, end, DEFAULT_SUPPORT_BUSINESS_HOURS)).toBe(expected);
  });
});

