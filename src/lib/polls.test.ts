import { describe, expect, it } from "vitest";

import { computePollPercent, normalizeVotedOptions } from "./polls";

describe("normalizeVotedOptions", () => {
  it("normaliza array de strings", () => {
    expect(normalizeVotedOptions([" Opção 1 ", ""]).join("|"))
      .toBe("Opção 1");
  });

  it("normaliza string", () => {
    expect(normalizeVotedOptions("  Opção 2  ")).toEqual(["Opção 2"]);
  });

  it("normaliza objeto", () => {
    expect(normalizeVotedOptions({ 0: " Opção 1 ", 1: "Opção 2" })).toEqual(["Opção 1", "Opção 2"]);
  });

  it("ignora valores não-string em objeto", () => {
    expect(normalizeVotedOptions({ 0: " Opção 1 ", 1: 2, 2: null })).toEqual(["Opção 1"]);
  });

  it("retorna vazio para entradas inválidas", () => {
    expect(normalizeVotedOptions(null)).toEqual([]);
    expect(normalizeVotedOptions(undefined)).toEqual([]);
    expect(normalizeVotedOptions(123)).toEqual([]);
  });
});

describe("computePollPercent", () => {
  it("arredonda com casas decimais", () => {
    expect(computePollPercent(1, 3, 1)).toBe(33.3);
  });

  it("retorna 0 quando total é inválido", () => {
    expect(computePollPercent(1, 0, 1)).toBe(0);
    expect(computePollPercent(1, -1, 1)).toBe(0);
  });

  it("limita entre 0 e 100", () => {
    expect(computePollPercent(10, 1, 0)).toBe(100);
    expect(computePollPercent(-1, 10, 0)).toBe(0);
  });

  it("trata decimais negativas como 0", () => {
    expect(computePollPercent(1, 3, -2)).toBe(33);
  });
});
