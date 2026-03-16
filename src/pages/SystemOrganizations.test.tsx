import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const navigateMock = vi.fn();
const notifyMock = {
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
};

const mutateAsyncMock = vi.fn();
const refreshAllMock = vi.fn(async () => {});
const deleteEqMock = vi.fn(async () => ({ error: null }));
const functionsInvokeMock = vi.fn(async () => ({ error: null }));

let hookCalls: any[] = [];
let hookState: any;
let editModalSnapshots: Array<{ open: boolean; name: string | null }> = [];

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<any>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ isAuthenticated: true, loading: false }),
}));

vi.mock("@/hooks/use-user-roles", () => ({
  useUserRoles: () => ({ isSystemAdmin: true, isLoading: false }),
}));

vi.mock("@/hooks/use-system-organizations", () => ({
  useSystemOrganizations: (args: any) => {
    hookCalls.push(args);
    return hookState;
  },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      delete: () => ({
        eq: (...args: any[]) => deleteEqMock(...args),
      }),
    }),
    functions: {
      invoke: (...args: any[]) => functionsInvokeMock(...args),
    },
  },
}));

vi.mock("@/components/layout/AdminLayout", () => ({
  AdminLayout: ({ children }: { children: any }) => <div>{children}</div>,
}));

vi.mock("./AccessDenied", () => ({
  default: () => <div>Acesso Negado</div>,
}));

vi.mock("@/components/ui/boris-table", () => ({
  BorisTable: ({ page, onPageChange }: any) => (
    <div>
      <div data-testid="boris-table-page">page:{page}</div>
      <button onClick={() => onPageChange?.(page + 1)}>next-page</button>
    </div>
  ),
  RowActions: ({ children }: { children: any }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenuItem: ({ children, onSelect, onClick, disabled }: any) => (
    <button
      disabled={disabled}
      onClick={(event) => {
        if (disabled) return;
        onClick?.(event);
        onSelect?.(event);
      }}
    >
      {children}
    </button>
  ),
  DropdownMenuLabel: ({ children }: any) => <div>{children}</div>,
  DropdownMenuSeparator: () => <div />,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick, type = "button", disabled, ...rest }: any) => (
    <button type={type} disabled={disabled} onClick={onClick} {...rest}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/dashboard/StatsCard", () => ({
  StatsCard: ({ title, value }: any) => <div>{title}:{value}</div>,
}));

vi.mock("@/components/ui/breadcrumbs", () => ({ Breadcrumbs: () => null }));
vi.mock("@/components/ui/loading-state", () => ({ LoadingState: ({ message }: any) => <div>{message}</div> }));
vi.mock("@/components/ui/error-state", () => ({ ErrorState: ({ title }: any) => <div>{title}</div> }));
vi.mock("@/components/ui/empty-state", () => ({ EmptyState: ({ title }: any) => <div>{title}</div> }));
vi.mock("@/components/ui/skeleton", () => ({ Skeleton: () => <div /> }));
vi.mock("@/components/ui/badge", () => ({ Badge: ({ children }: any) => <span>{children}</span> }));
vi.mock("@/components/ui/select", () => ({
  Select: ({ children, value, onValueChange }: any) => (
    <select value={value} onChange={(e) => onValueChange?.(e.target.value)}>
      {children}
    </select>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: any) => <>{children}</>,
  SelectItem: ({ children, value }: any) => <option value={value}>{children}</option>,
}));

vi.mock("@/components/ui/drawer", () => ({
  Drawer: ({ children }: any) => <div>{children}</div>,
  DrawerClose: ({ children }: any) => <div>{children}</div>,
  DrawerContent: ({ children }: any) => <div>{children}</div>,
  DrawerDescription: ({ children }: any) => <div>{children}</div>,
  DrawerFooter: ({ children }: any) => <div>{children}</div>,
  DrawerHeader: ({ children }: any) => <div>{children}</div>,
  DrawerTitle: ({ children }: any) => <div>{children}</div>,
}));

vi.mock("@/components/ui/alert-dialog", () => ({
  AlertDialog: ({ open, children }: any) => (open ? <div>{children}</div> : null),
  AlertDialogContent: ({ children }: any) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: any) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: any) => <div>{children}</div>,
  AlertDialogDescription: ({ children }: any) => <div>{children}</div>,
  AlertDialogFooter: ({ children }: any) => <div>{children}</div>,
  AlertDialogCancel: ({ children, onClick }: any) => <button onClick={onClick}>{children}</button>,
  AlertDialogAction: ({ children, onClick, disabled }: any) => <button disabled={disabled} onClick={onClick}>{children}</button>,
}));

vi.mock("@/components/modals/EditOrganizationModal", () => ({
  EditOrganizationModal: ({ organization, open }: any) => {
    editModalSnapshots.push({ open: !!open, name: organization?.name ?? null });
    return open ? <div>EDIT_MODAL:{organization?.name ?? "nova"}</div> : null;
  },
}));

vi.mock("@/components/ui/sonner", () => ({
  notify: notifyMock,
}));

function createHookState() {
  return {
    orgsQuery: {
      data: {
        items: [
          {
            id: "org-1",
            name: "Org 1",
            status: "active",
            created_at: "2026-02-22T00:00:00.000Z",
            settings: { description: "desc" },
          },
        ],
        count: 11,
      },
      isLoading: false,
      isFetching: false,
      error: null,
      refetch: vi.fn(),
    },
    overviewQuery: {
      data: { orgsTotal: 1, orgsActive: 1, orgsInactive: 0, orgsSuspended: 0, groupsTotal: 0 },
      isLoading: false,
    },
    orgGroupCountsQuery: {
      data: { "org-1": 0 },
    },
    updateStatusMutation: {
      mutateAsync: mutateAsyncMock,
      isPending: false,
      variables: undefined,
    },
    refreshAll: refreshAllMock,
  };
}

async function flush() {
  await Promise.resolve();
  await new Promise((r) => setTimeout(r, 0));
}

async function renderPage() {
  const Page = (await import("./SystemOrganizations")).default;
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(
      <MemoryRouter>
        <Page />
      </MemoryRouter>,
    );
    await flush();
  });

  return { container, root };
}

describe("SystemOrganizations page", () => {
  beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    vi.clearAllMocks();
    hookCalls = [];
    editModalSnapshots = [];
    hookState = createHookState();
  });

  it("expõe filtro de suspensas e atualiza página ao paginar", async () => {
    const { container, root } = await renderPage();

    expect(container.textContent).not.toContain("Suspensas:0");
    const statusSelect = Array.from(container.querySelectorAll("select")).find((s) =>
      Array.from(s.options).some((o) => o.value === "suspended"),
    );
    expect(statusSelect).toBeTruthy();

    const nextBtn = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "next-page");
    await act(async () => {
      nextBtn?.click();
      await flush();
    });

    expect(hookCalls.some((c) => c.page === 2)).toBe(true);

    await act(async () => root.unmount());
    container.remove();
  });

  it("abre modal de edição pela ação da linha", async () => {
    const { container, root } = await renderPage();

    const editButton = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "Editar");
    await act(async () => {
      editButton?.click();
      await flush();
    });

    expect(container.textContent).toContain("EDIT_MODAL:Org 1");
    expect(editModalSnapshots.some((s) => s.open && s.name === "Org 1")).toBe(true);

    await act(async () => root.unmount());
    container.remove();
  });

  it("bloqueia exclusão simples quando há grupos vinculados", async () => {
    hookState.orgGroupCountsQuery.data = { "org-1": 2 };
    const { container, root } = await renderPage();

    const deleteButton = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent === "Excluir organização",
    );
    expect(deleteButton).toBeTruthy();
    expect(deleteButton?.disabled).toBe(false);

    await act(async () => {
      deleteButton?.click();
      await flush();
    });

    expect(container.textContent).toContain("Digite o nome da organização para confirmar");
    expect(deleteEqMock).not.toHaveBeenCalled();

    await act(async () => root.unmount());
    container.remove();
  });

  it("mostra erro contextual ao falhar alteração de status por permissão", async () => {
    mutateAsyncMock.mockRejectedValueOnce({ code: "42501", message: "new row violates policy" });
    const { container, root } = await renderPage();

    const statusButton = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "Desativar");
    await act(async () => {
      statusButton?.click();
      await flush();
    });

    expect(notifyMock.error).toHaveBeenCalledWith("Sem permissão", "Você não tem permissão para concluir esta ação.");

    await act(async () => root.unmount());
    container.remove();
  });
});
