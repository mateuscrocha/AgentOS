import { describe, expect, it } from "vitest";
import { buildStoredPeriod, parseStoredPeriod } from "./period-utils";

describe("parseStoredPeriod", () => {
  it("cai no fallback quando valor não é objeto", () => {
    const parsed = parseStoredPeriod(null, "7d");
    expect(parsed).toEqual({ period: "7d", isValid: false });
  });

  it("aceita periodos válidos sem range", () => {
    const parsed = parseStoredPeriod({ period: "30d" }, "7d");
    expect(parsed).toEqual({ period: "30d", isValid: true });
  });

  it("aceita custom válido com range", () => {
    const parsed = parseStoredPeriod(
      { period: "custom", from: "2025-01-01T00:00:00.000Z", to: "2025-01-02T00:00:00.000Z" },
      "7d"
    );

    expect(parsed.period).toBe("custom");
    expect(parsed.isValid).toBe(true);
    expect(parsed.range?.from.toISOString()).toBe("2025-01-01T00:00:00.000Z");
    expect(parsed.range?.to.toISOString()).toBe("2025-01-02T00:00:00.000Z");
  });

  it("cai no fallback quando custom tem datas inválidas", () => {
    const parsed = parseStoredPeriod({ period: "custom", from: "x", to: "2025-01-02T00:00:00.000Z" }, "7d");
    expect(parsed).toEqual({ period: "7d", isValid: false });
  });

  it("cai no fallback quando period é inválido", () => {
    const parsed = parseStoredPeriod({ period: "unknown" }, "7d");
    expect(parsed).toEqual({ period: "7d", isValid: false });
  });
});

describe("buildStoredPeriod", () => {
  it("inclui from/to apenas para custom com datas válidas", () => {
    const range = {
      from: new Date("2025-01-01T00:00:00.000Z"),
      to: new Date("2025-01-02T00:00:00.000Z"),
    };
    expect(buildStoredPeriod("custom", range)).toEqual({
      period: "custom",
      from: "2025-01-01T00:00:00.000Z",
      to: "2025-01-02T00:00:00.000Z",
    });
  });

  it("não inclui from/to quando range é inválido", () => {
    const range = { from: new Date("invalid"), to: new Date("2025-01-02T00:00:00.000Z") };
    expect(buildStoredPeriod("custom", range as any)).toEqual({ period: "custom" });
  });
});
