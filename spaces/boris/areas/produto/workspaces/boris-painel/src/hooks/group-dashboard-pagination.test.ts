import { describe, expect, it, vi } from "vitest";
import { fetchAllPages } from "./group-dashboard-pagination";

describe("fetchAllPages", () => {
  it("busca todas as páginas até encontrar uma página incompleta", async () => {
    const fetchPage = vi.fn(async (from: number, to: number) => {
      const all = Array.from({ length: 2505 }, (_, index) => ({ id: index + 1 }));
      return {
        data: all.slice(from, to + 1),
        error: null,
      };
    });

    const result = await fetchAllPages(fetchPage);

    expect(result).toHaveLength(2505);
    expect(fetchPage).toHaveBeenCalledTimes(3);
    expect(fetchPage).toHaveBeenNthCalledWith(1, 0, 999);
    expect(fetchPage).toHaveBeenNthCalledWith(2, 1000, 1999);
    expect(fetchPage).toHaveBeenNthCalledWith(3, 2000, 2999);
  });

  it("propaga erros da consulta", async () => {
    await expect(
      fetchAllPages(async () => ({
        data: null,
        error: new Error("boom"),
      })),
    ).rejects.toThrow("boom");
  });
});
