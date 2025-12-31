import { describe, expect, it } from "vitest";

import { normalizePhoneE164Admin } from "./phone";

describe("normalizePhoneE164Admin", () => {
  it("retorna string vazia para entrada vazia", () => {
    expect(normalizePhoneE164Admin("")).toBe("");
    expect(normalizePhoneE164Admin("   ")).toBe("");
  });

  it("mantém números com + e remove espaços", () => {
    expect(normalizePhoneE164Admin("+55 11 99999 0000")).toBe("+5511999990000");
  });

  it("prefixa +55 quando não há DDI", () => {
    expect(normalizePhoneE164Admin("(11) 99999-0000")).toBe("+5511999990000");
  });

  it("prefixa + quando já inicia com 55", () => {
    expect(normalizePhoneE164Admin("55 11 99999 0000")).toBe("+5511999990000");
  });
});

