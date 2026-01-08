import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import Group from "./Group";

vi.mock("@/components/layout/AdminLayout", () => {
  return {
    AdminLayout: ({ children }: { children: any }) => <div>{children}</div>,
  };
});

vi.mock("@/components/group-navigation/GroupPageTop", () => {
  return {
    GroupPageTop: ({ filters }: { filters: any }) => <div>{filters}</div>,
  };
});

vi.mock("@/components/group-dashboard/PeriodFilter", () => {
  return {
    PeriodFilter: () => null,
  };
});

vi.mock("@/components/ui/sheet", () => {
  return {
    Sheet: ({ children }: { children: any }) => <div>{children}</div>,
    SheetContent: ({ children }: { children: any }) => <div>{children}</div>,
    SheetHeader: ({ children }: { children: any }) => <div>{children}</div>,
    SheetTitle: ({ children }: { children: any }) => <div>{children}</div>,
    SheetDescription: ({ children }: { children: any }) => <div>{children}</div>,
  };
});

vi.mock("@/components/modals/EditIkigaiModal", () => {
  return {
    EditIkigaiModal: () => null,
  };
});

vi.mock("@/hooks/use-auth", () => {
  return {
    useAuth: () => ({ loading: false, isAuthenticated: true }),
  };
});

vi.mock("@/hooks/use-user-roles", () => {
  return {
    useUserRoles: () => ({ isLoading: false }),
  };
});

vi.mock("@/hooks/use-group-dashboard", () => {
  return {
    useGroupDashboard: () => {
      return {
        group: {
          id: "00000000-0000-4000-8000-000000000000",
          name: "Grupo X",
          organization_id: "00000000-0000-4000-8000-000000000001",
          provider: "",
          sync_status: null,
          metadata: {},
        },
        orgName: "Org",
        stats: {
          totalMembers: 80,
          totalMessages7d: 120,
          activeMembers7d: 20,
          engagementRate: 0.3,
          topParticipant: null,
          lastMessageAt: null,
        },
        previousStats: {
          totalMessages7d: 100,
          activeMembers7d: 18,
          engagementRate: 0.25,
          topParticipant: null,
          totalMembersSnapshot: 80,
        },
        messagesPerDay: [],
        activeMembersPerDay: [],
        membersOverview: [],
        memberEntriesPerDay: [],
        memberExitsPerDay: [],
        memberEvents: [],
        currentMembers: 80,
        membersAtPeriodStart: 80,
        daysWithActivity: 0,
        topParticipants: [],
        memberEngagement: { recorrentes: 10, esporadicos: 10, inativos: 60 },
        previousMemberEngagement: { recorrentes: 9, esporadicos: 9, inativos: 62 },
        atRiskMembers: [],
        newMembersCount: 0,
        previousNewMembersCount: 0,
        exitedMembersCount: 0,
        previousExitedMembersCount: 0,
        isLoading: false,
        groupLoading: false,
        error: null,
        periodDays: 7,
        alignedMessagesPercent: 0,
        hasIkigai: false,
        activePercent: 0,
        activeDaysPercent: 0,
        lowEffortPercent: 0,
        recurringPercent: 0,
        ikigaiKeywordsList: [],
        ikigaiSuggestions: { themes: [], keywords: [] },
        trendingBigrams: [{ phrase: "foco total", count: 10, delta: 42 }],
      };
    },
  };
});

vi.mock("@/components/group-dashboard", async () => {
  const period = await vi.importActual<any>("@/components/group-dashboard/PeriodReport");

  return {
    SummarySection: () => null,
    ConversationRhythmSection: () => null,
    PeakMomentSection: () => null,
    PeopleSection: () => null,
    GroupGrowthSection: () => null,
    EffortNoiseSection: () => null,
    PurposeAlignmentSection: () => null,
    PeriodReport: period.PeriodReport,
  };
});

describe("Group dashboard — Temas em destaque", () => {
  beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    localStorage.clear();
  });

  it("exibe Temas em destaque com texto idêntico ao original", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/groups/00000000-0000-4000-8000-000000000000"]}>
          <Routes>
            <Route path="/groups/:groupId" element={<Group />} />
          </Routes>
        </MemoryRouter>,
      );
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent).toContain("Temas em destaque");
    expect(container.textContent).toContain("“foco total” — +42%");
    expect(container.textContent).toContain("Estes temas apareceram com muito mais frequência neste período.");

    await act(async () => {
      root.unmount();
    });

    container.remove();
  });
});
