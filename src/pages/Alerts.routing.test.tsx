import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const navigateMock = vi.fn();

let roleState = {
  isSystemAdmin: true,
  isOrgAdmin: false,
  isGroupManager: false,
};
const accessibleOrgIds = ["org-1"];
const accessibleGroupIds = ["group-1"];
const getAccessibleOrgIds = () => accessibleOrgIds;
const getAccessibleGroupIds = () => accessibleGroupIds;
const emptyQueryResult = { data: undefined, isLoading: false, error: null } as const;

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<any>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

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
    getAccessibleOrgIds,
    getAccessibleGroupIds,
  }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        order: () => ({
          range: async () => ({ data: [], error: null, count: 0 }),
        }),
        in: () => ({
          order: async () => ({ data: [], error: null }),
        }),
        gte: () => ({
          lte: () => ({
            order: () => ({
              range: async () => ({ data: [], error: null, count: 0 }),
            }),
          }),
        }),
        eq: async () => ({ count: 0, error: null }),
      }),
      update: () => ({ eq: async () => ({ error: null }) }),
      upsert: () => ({
        select: () => ({
          single: async () => ({ data: null, error: null }),
        }),
      }),
      insert: () => ({
        select: () => ({
          single: async () => ({ data: null, error: null }),
        }),
      }),
      delete: () => ({ eq: async () => ({ error: null }) }),
    }),
  },
}));

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual<any>("@tanstack/react-query");
  return {
    ...actual,
    useQueryClient: () => ({ invalidateQueries: vi.fn(async () => {}) }),
    useQuery: () => emptyQueryResult,
    useMutation: () => ({
      mutate: vi.fn(),
      mutateAsync: vi.fn(),
      isPending: false,
    }),
  };
});

vi.mock("@/components/layout/AdminLayout", () => ({
  AdminLayout: ({ children }: any) => <div>{children}</div>,
}));

vi.mock("@/components/layout/AdminPageHeader", () => ({
  AdminPageHeader: ({ title }: any) => <div>{title}</div>,
}));

vi.mock("@/components/ui/boris-table", () => ({
  BorisTable: () => <div>Tabela</div>,
  RowActions: ({ children }: any) => <div>{children}</div>,
}));

vi.mock("@/components/ui/loading-state", () => ({ LoadingState: ({ message }: any) => <div>{message}</div> }));
vi.mock("@/components/dashboard/StatsCard", () => ({ StatsCard: ({ title }: any) => <div>{title}</div> }));
vi.mock("@/components/group-dashboard/PeriodFilter", () => ({ PeriodFilter: () => <div>PeriodFilter</div> }));
vi.mock("@/components/ui/tabs", () => ({
  Tabs: ({ children }: any) => <div>{children}</div>,
  TabsList: ({ children }: any) => <div>{children}</div>,
  TabsTrigger: ({ children }: any) => <button>{children}</button>,
  TabsContent: ({ children }: any) => <div>{children}</div>,
}));
vi.mock("@/components/ui/select", () => ({
  Select: ({ children }: any) => <div>{children}</div>,
  SelectContent: ({ children }: any) => <div>{children}</div>,
  SelectItem: ({ children }: any) => <div>{children}</div>,
  SelectTrigger: ({ children }: any) => <button>{children}</button>,
  SelectValue: () => <span />,
}));
vi.mock("@/components/ui/input", () => ({ Input: (props: any) => <input {...props} /> }));
vi.mock("@/components/ui/button", () => ({ Button: ({ children, ...props }: any) => <button {...props}>{children}</button> }));
vi.mock("@/components/ui/badge", () => ({ Badge: ({ children }: any) => <span>{children}</span> }));
vi.mock("@/components/ui/card", () => ({
  Card: ({ children }: any) => <div>{children}</div>,
  CardContent: ({ children }: any) => <div>{children}</div>,
}));
vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children }: any) => <div>{children}</div>,
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogDescription: ({ children }: any) => <div>{children}</div>,
  DialogFooter: ({ children }: any) => <div>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <div>{children}</div>,
}));
vi.mock("@/components/ui/switch", () => ({ Switch: () => <button type="button">switch</button> }));
vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenuItem: ({ children, onSelect }: any) => <button onClick={onSelect}>{children}</button>,
  DropdownMenuSeparator: () => <hr />,
}));
vi.mock("@/components/ui/sonner", () => ({
  notify: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));
vi.mock("@/components/ui/alert-dialog", () => ({
  AlertDialog: ({ children }: any) => <div>{children}</div>,
  AlertDialogAction: ({ children }: any) => <button>{children}</button>,
  AlertDialogCancel: ({ children }: any) => <button>{children}</button>,
  AlertDialogContent: ({ children }: any) => <div>{children}</div>,
  AlertDialogDescription: ({ children }: any) => <div>{children}</div>,
  AlertDialogFooter: ({ children }: any) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: any) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: any) => <div>{children}</div>,
}));

vi.mock("./AccessDenied", () => ({
  default: () => <div>Acesso negado</div>,
}));

async function flush() {
  await Promise.resolve();
  await new Promise((r) => setTimeout(r, 0));
}

async function renderAlerts(initialPath: string) {
  const Alerts = (await import("./Alerts")).default;
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/alerts" element={<Alerts />} />
          <Route path="/system/alerts" element={<Alerts />} />
        </Routes>
      </MemoryRouter>,
    );
    await flush();
  });

  return { root, container };
}

describe("Alerts page canonical routing", () => {
  beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    vi.clearAllMocks();
    roleState = { isSystemAdmin: true, isOrgAdmin: false, isGroupManager: false };
  });

  it("redireciona system admin de /alerts para /system/alerts preservando query/hash", async () => {
    const { root, container } = await renderAlerts("/alerts?status=unread#filtros");

    expect(navigateMock).toHaveBeenCalledWith("/system/alerts?status=unread#filtros", { replace: true });

    await act(async () => root.unmount());
    container.remove();
  });

  it("redireciona usuário não-system de /system/alerts para /alerts", async () => {
    roleState = { isSystemAdmin: false, isOrgAdmin: true, isGroupManager: false };
    const { root, container } = await renderAlerts("/system/alerts");

    expect(navigateMock).toHaveBeenCalledWith("/alerts", { replace: true });

    await act(async () => root.unmount());
    container.remove();
  });
});
