import { describe, expect, it } from "vitest";
import { getHourSP } from "@/lib/date";
import { buildHourlyActivitySummary, buildParticipantPresenceIndex } from "./group-dashboard-activity";

describe("buildHourlyActivitySummary", () => {
  it("agrega mensagens por hora e identifica pico", () => {
    const summary = buildHourlyActivitySummary([
      { created_at: "2025-02-14T10:00:00.000Z" },
      { created_at: "2025-02-14T10:30:00.000Z" },
      { created_at: "2025-02-14T11:00:00.000Z" },
    ]);

    expect(summary.activityByHour).toHaveLength(24);
    expect(summary.peakHour).not.toBeNull();
    expect(summary.peakHourMessages).toBe(2);
    expect(summary.activityByHour.reduce((a, b) => a + b.count, 0)).toBe(3);
  });

  it("retorna pico nulo quando não há dados", () => {
    const summary = buildHourlyActivitySummary([]);
    expect(summary.peakHour).toBeNull();
    expect(summary.peakHourMessages).toBe(0);
  });
});

describe("buildParticipantPresenceIndex", () => {
  it("deduplica participantes por dia e por hora", () => {
    const result = buildParticipantPresenceIndex([
      { member_id: "m1", member_avatar: null, created_at: "2025-02-14T10:00:00.000Z" },
      { member_id: "m1", member_avatar: "https://img/m1.png", created_at: "2025-02-14T10:15:00.000Z" },
      { member_id: "m2", member_avatar: null, created_at: "2025-02-14T10:30:00.000Z" },
      { member_id: "m1", member_avatar: null, created_at: "2025-02-14T11:00:00.000Z" },
      { member_id: null, member_avatar: null, created_at: "2025-02-14T11:30:00.000Z" },
    ]);

    const dayLists = Object.values(result.participantsByDay);
    expect(dayLists).toHaveLength(1);
    expect(dayLists[0].map((p) => p.id).sort()).toEqual(["m1", "m2"]);

    const hourA = getHourSP("2025-02-14T10:00:00.000Z");
    const hourB = getHourSP("2025-02-14T11:00:00.000Z");
    const totalHourBucketsWithData = Object.values(result.participantsByHour).filter((arr) => arr.length > 0).length;
    expect(totalHourBucketsWithData).toBe(2);
    expect(result.participantsByHour[hourA].map((p) => p.id).sort()).toEqual(["m1", "m2"]);
    expect(result.participantsByHour[hourB].map((p) => p.id)).toEqual(["m1"]);
  });
});
