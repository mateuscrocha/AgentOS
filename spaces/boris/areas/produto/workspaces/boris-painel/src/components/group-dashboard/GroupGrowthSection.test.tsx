import { beforeEach, describe, expect, it } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { MemoryRouter } from "react-router-dom";
import { GroupGrowthSection } from "./GroupGrowthSection";

const baseProps = {
  groupId: "00000000-0000-4000-8000-000000000000",
  entriesPerDay: [],
  exitsPerDay: [],
  currentMembers: 12,
  daysWithActivity: 3,
  periodDays: 7,
  memberEvents: [
    {
      id: "evt-1",
      occurredAt: "2026-03-10T12:00:00.000Z",
      eventType: "MEMBER_JOINED",
      kind: "entrada" as const,
      memberId: "member-1",
      memberName: "Ana",
      memberAvatarUrl: null,
      externalMemberId: "ext-1",
      source: "system",
    },
    {
      id: "evt-2",
      occurredAt: "2026-03-09T12:00:00.000Z",
      eventType: "MEMBER_JOINED",
      kind: "entrada" as const,
      memberId: "member-2",
      memberName: "Bia",
      memberAvatarUrl: null,
      externalMemberId: "ext-2",
      source: "system",
    },
    {
      id: "evt-3",
      occurredAt: "2026-03-08T12:00:00.000Z",
      eventType: "MEMBER_LEFT",
      kind: "saida" as const,
      memberId: "member-3",
      memberName: "Caio",
      memberAvatarUrl: null,
      externalMemberId: "ext-3",
      source: "system",
    },
    {
      id: "evt-4",
      occurredAt: "2026-03-07T12:00:00.000Z",
      eventType: "MEMBER_JOINED",
      kind: "entrada" as const,
      memberId: "member-4",
      memberName: "Dani",
      memberAvatarUrl: null,
      externalMemberId: "ext-4",
      source: "system",
    },
    {
      id: "evt-5",
      occurredAt: "2026-03-06T12:00:00.000Z",
      eventType: "MEMBER_LEFT",
      kind: "saida" as const,
      memberId: "member-5",
      memberName: "Eli",
      memberAvatarUrl: null,
      externalMemberId: "ext-5",
      source: "system",
    },
    {
      id: "evt-6",
      occurredAt: "2026-03-05T12:00:00.000Z",
      eventType: "MEMBER_JOINED",
      kind: "entrada" as const,
      memberId: "member-6",
      memberName: "Fê",
      memberAvatarUrl: null,
      externalMemberId: "ext-6",
      source: "system",
    },
  ],
};

describe("GroupGrowthSection", () => {
  beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  });

  it("oculta o link de histórico completo para não-system-admin", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <GroupGrowthSection {...baseProps} canViewFullHistory={false} />
        </MemoryRouter>,
      );
    });

    expect(container.textContent).toContain("Histórico de eventos");
    expect(container.textContent).not.toContain("Ver histórico completo");
    expect(container.querySelector('a[href="/groups/00000000-0000-4000-8000-000000000000/events"]')).toBeNull();

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("exibe o link de histórico completo para system-admin", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <GroupGrowthSection {...baseProps} canViewFullHistory />
        </MemoryRouter>,
      );
    });

    expect(container.textContent).toContain("Ver histórico completo");
    expect(container.querySelector('a[href="/groups/00000000-0000-4000-8000-000000000000/events"]')).not.toBeNull();

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
