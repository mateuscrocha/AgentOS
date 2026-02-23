import { describe, expect, it } from "vitest";
import { buildMemberEngagementDistribution, countUniqueExternalMembers } from "./group-dashboard-member-metrics";

describe("buildMemberEngagementDistribution", () => {
  it("classifica membros em recorrentes, esporádicos e inativos", () => {
    const members = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];
    const messages = [
      { member_id: "a" },
      { member_id: "a" },
      { member_id: "a" },
      { member_id: "a" },
      { member_id: "a" },
      { member_id: "b" },
      { member_id: "c" },
      { member_id: null },
    ];

    expect(buildMemberEngagementDistribution(members, messages)).toEqual({
      recorrentes: 1,
      esporadicos: 2,
      inativos: 1,
    });
  });

  it("retorna zeros quando members é nulo", () => {
    expect(buildMemberEngagementDistribution(null, [{ member_id: "a" }])).toEqual({
      recorrentes: 0,
      esporadicos: 0,
      inativos: 0,
    });
  });
});

describe("countUniqueExternalMembers", () => {
  it("conta ids externos únicos ignorando vazios", () => {
    const total = countUniqueExternalMembers([
      { member_lid: " abc " },
      { member_lid: "abc" },
      { member_lid: "def" },
      { member_lid: "" },
      { member_lid: null },
    ]);

    expect(total).toBe(2);
  });
});
