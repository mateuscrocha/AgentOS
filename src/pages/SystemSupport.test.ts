import { describe, expect, it } from "vitest";

import { buildSupportNowSummary } from "@/lib/support-now";

describe("SystemSupport now summary", () => {
  it("classifica grupos por estado operacional atual", () => {
    const summary = buildSupportNowSummary({
      filteredGroupIds: ["g-await", "g-progress", "g-customer", "g-inactive"],
      nowMessagesSample: [
        { group_id: "g-await", member_id: "client-1", sender_phone: "+5511999991111", created_at: "2026-03-18T13:00:00.000Z" },
        { group_id: "g-progress", member_id: "client-2", sender_phone: "+5511999992222", created_at: "2026-03-18T14:00:00.000Z" },
        { group_id: "g-progress", member_id: "support-1", sender_phone: null, created_at: "2026-03-18T14:20:00.000Z" },
        { group_id: "g-customer", member_id: "client-3", sender_phone: "+5511999993333", created_at: "2026-03-17T15:00:00.000Z" },
        { group_id: "g-customer", member_id: "support-1", sender_phone: null, created_at: "2026-03-17T15:15:00.000Z" },
      ],
      supportIdentityKeysByGroup: new Map([
        ["g-await", new Set(["phone:+5511888880000"])],
        ["g-progress", new Set(["phone:+5511888880000"])],
        ["g-customer", new Set(["phone:+5511888880000"])],
        ["g-inactive", new Set(["phone:+5511888880000"])],
      ]),
      memberIdentityById: new Map([["support-1", "phone:+5511888880000"]]),
      groupById: new Map([
        ["g-await", { id: "g-await", name: "Grupo A", organization_id: "org-1" }],
        ["g-progress", { id: "g-progress", name: "Grupo B", organization_id: "org-1" }],
        ["g-customer", { id: "g-customer", name: "Grupo C", organization_id: "org-2" }],
        ["g-inactive", { id: "g-inactive", name: "Grupo D", organization_id: "org-2" }],
      ]),
      overviewByGroupId: new Map([
        ["g-await", { group_id: "g-await", last_access_at: "2026-03-18T13:00:00.000Z" }],
        ["g-progress", { group_id: "g-progress", last_access_at: "2026-03-18T14:20:00.000Z" }],
        ["g-customer", { group_id: "g-customer", last_access_at: "2026-03-17T15:15:00.000Z" }],
        ["g-inactive", { group_id: "g-inactive", last_access_at: "2026-03-01T10:00:00.000Z" }],
      ]),
      responseSlaBusinessMinutes: 30,
      now: new Date("2026-03-18T16:00:00.000Z"),
    });

    expect(summary.counts.awaiting_attendant).toBe(1);
    expect(summary.counts.in_progress).toBe(1);
    expect(summary.counts.awaiting_customer).toBe(1);
    expect(summary.counts.inactive).toBe(1);

    expect(summary.items.find((item) => item.groupId === "g-await")?.slaBreached).toBe(true);
    expect(summary.items.find((item) => item.groupId === "g-progress")?.status).toBe("in_progress");
    expect(summary.items.find((item) => item.groupId === "g-customer")?.status).toBe("awaiting_customer");
    expect(summary.items.find((item) => item.groupId === "g-inactive")?.status).toBe("inactive");
  });
});
