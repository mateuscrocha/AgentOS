import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

let roleState = {
  isSystemAdmin: true,
};

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({
    loading: false,
    isAuthenticated: true,
    user: { id: "user-1" },
  }),
}));

vi.mock("@/hooks/use-user-roles", () => ({
  useUserRoles: () => ({
    isLoading: false,
    ...roleState,
  }),
}));

vi.mock("@/hooks/use-crm", () => ({
  CRM_ACCOUNT_STATUS_META: {
    lead: { label: "Lead", tone: "" },
    prospect: { label: "Prospect", tone: "" },
    customer: { label: "Cliente", tone: "" },
    inactive: { label: "Inativo", tone: "" },
  },
  CRM_STAGE_META: {
    new_lead: { label: "Novo lead", shortLabel: "Lead", tone: "" },
    qualification: { label: "Em negociação", shortLabel: "Negociação", tone: "" },
    meeting: { label: "Em negociação", shortLabel: "Negociação", tone: "" },
    proposal: { label: "Em negociação", shortLabel: "Negociação", tone: "" },
    customer: { label: "Cliente", shortLabel: "Cliente", tone: "" },
    lost: { label: "Perdido", shortLabel: "Perdido", tone: "" },
  },
  CRM_PIPELINE_STAGES: ["new_lead", "meeting", "customer", "lost"],
  CRM_TASK_TYPE_META: {
    note: { label: "Nota", tone: "" },
    task: { label: "Tarefa", tone: "" },
    next_step: { label: "Próximo passo", tone: "" },
  },
  getAccountFinanceSummary: () => null,
  getAccountStripeSyncState: () => ({
    canSync: false,
    sourceLabel: "Sem sync",
    missingReason: "Mock sem Stripe",
  }),
  getContactFullName: (contact: any) => [contact.first_name, contact.last_name].filter(Boolean).join(" "),
  useCRM: () => ({
    accounts: [],
    contacts: [],
    opportunities: [],
    timelineItems: [],
    tasks: [],
    organizations: [],
    profiles: [],
    accountById: new Map(),
    contactById: new Map(),
    profileById: new Map(),
    contactsByAccountId: new Map(),
    timelineByEntity: { accountMap: new Map(), opportunityMap: new Map() },
    metrics: { openOpportunities: 0, totalPipelineValue: 0, openTasks: 0, customers: 0, accountsWithContacts: 0, accountsWithoutContacts: 0 },
    isLoading: false,
    isFetching: false,
    error: null,
    refreshAll: vi.fn(),
    saveAccountMutation: { isPending: false, mutateAsync: vi.fn() },
    deleteAccountMutation: { mutateAsync: vi.fn() },
    syncAccountMutation: { mutateAsync: vi.fn() },
    saveContactMutation: { isPending: false, mutateAsync: vi.fn() },
    deleteContactMutation: { mutateAsync: vi.fn() },
    saveOpportunityMutation: { isPending: false, mutateAsync: vi.fn() },
    moveOpportunityMutation: { mutateAsync: vi.fn() },
    deleteOpportunityMutation: { mutateAsync: vi.fn() },
    saveTimelineItemMutation: { isPending: false, mutateAsync: vi.fn() },
    deleteTimelineItemMutation: { mutateAsync: vi.fn() },
    completeTaskMutation: { mutateAsync: vi.fn() },
  }),
}));

vi.mock("@/components/layout/AdminLayout", () => ({
  AdminLayout: ({ children }: any) => <div>{children}</div>,
}));

vi.mock("@/components/layout/AdminPageHeader", () => ({
  AdminPageHeader: ({ title }: any) => <div>{title}</div>,
}));

vi.mock("@/components/dashboard/StatsCard", () => ({
  StatsCard: ({ title }: any) => <div>{title}</div>,
}));

vi.mock("@/components/ui/loading-state", () => ({ LoadingState: ({ message }: any) => <div>{message}</div> }));
vi.mock("@/components/ui/error-state", () => ({ ErrorState: ({ title }: any) => <div>{title}</div> }));
vi.mock("@/components/ui/empty-state", () => ({ EmptyState: ({ title }: any) => <div>{title}</div> }));
vi.mock("@/components/ui/boris-table", () => ({ BorisTable: () => <div>Tabela</div> }));
vi.mock("@/components/ui/button", () => ({ Button: ({ children, ...props }: any) => <button {...props}>{children}</button> }));
vi.mock("@/components/ui/input", () => ({ Input: (props: any) => <input {...props} /> }));
vi.mock("@/components/ui/badge", () => ({ Badge: ({ children }: any) => <span>{children}</span> }));
vi.mock("@/components/ui/separator", () => ({ Separator: () => <hr /> }));
vi.mock("@/components/ui/sonner", () => ({ notify: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/components/crm/CRMDialogs", () => ({
  CRMAccountDialog: () => null,
  CRMContactDialog: () => null,
  CRMOpportunityDialog: () => null,
  CRMTimelineItemDialog: () => null,
}));
vi.mock("@/components/crm/CRMEntityDrawer", () => ({ CRMEntityDrawer: () => null }));
vi.mock("./AccessDenied", () => ({
  default: ({ message }: any) => <div>{message}</div>,
}));

describe("SystemCRM permissions", () => {
  beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    roleState = { isSystemAdmin: true };
  });

  it("bloqueia acesso para usuários sem SYSTEM_ADMIN", async () => {
    roleState = { isSystemAdmin: false };
    const SystemCRM = (await import("./SystemCRM")).default;
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/system/crm/pipeline"]}>
          <Routes>
            <Route path="/system/crm/pipeline" element={<SystemCRM />} />
          </Routes>
        </MemoryRouter>,
      );
    });

    expect(container.textContent).toContain("restrito a usuários com perfil system admin");

    await act(async () => root.unmount());
    container.remove();
  });
});
