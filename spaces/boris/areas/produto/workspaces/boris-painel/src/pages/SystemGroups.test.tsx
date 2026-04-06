import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const navigateMock = vi.fn();
const invalidateQueriesMock = vi.fn(async () => {});
const statusMutateMock = vi.fn();
const inviteMutateMock = vi.fn();

let statusMutationState: any;
let inviteMutationState: any;
let useMutationCallCount = 0;

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

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({ update: () => ({ eq: vi.fn(async () => ({ error: null })) }) }),
    functions: { invoke: vi.fn(async () => ({ error: null })) },
    rpc: vi.fn(async () => ({ data: null, error: null })),
  },
}));

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual<any>("@tanstack/react-query");
  return {
    ...actual,
    useQueryClient: () => ({ invalidateQueries: invalidateQueriesMock }),
    useQuery: (opts: any) => {
      const key = Array.isArray(opts?.queryKey) ? opts.queryKey[0] : opts?.queryKey;
      if (key === "groups-organizations-filter-options") {
        return { data: [{ id: "org-1", name: "Org Teste" }] };
      }
      if (key === "system-groups") {
        return {
          data: {
            items: [{
              id: "grp-1",
              name: "Grupo Alfa",
              provider: "whatsapp",
              status: "active",
              organization_id: "org-1",
              organizations: { name: "Org Teste" },
              invite_link: null,
              created_at: "2026-02-01T00:00:00.000Z",
              last_access_at: null,
              members_count: 12,
            }],
            count: 1,
          },
          isLoading: false,
          error: null,
          refetch: vi.fn(),
        };
      }
      if (key === "system-groups-overview") {
        return {
          data: { total: 1, active: 1, inactive: 0, avgMembers: 12 },
          isLoading: false,
        };
      }
      return { data: undefined, isLoading: false, error: null };
    },
    useMutation: () => {
      useMutationCallCount += 1;
      return useMutationCallCount === 1 ? statusMutationState : inviteMutationState;
    },
  };
});

vi.mock("@/components/layout/AdminLayout", () => ({
  AdminLayout: ({ children }: { children: any }) => <div>{children}</div>,
}));

vi.mock("@/components/layout/AdminPageHeader", () => ({
  AdminPageHeader: ({ title, generalKpis, filters, showClearFilters, onClearFilters }: any) => (
    <div>
      <div>{title}</div>
      <div>{generalKpis}</div>
      <div>{filters}</div>
      {showClearFilters ? <button onClick={onClearFilters}>Limpar filtros</button> : null}
    </div>
  ),
}));

vi.mock("@/components/dashboard/StatsCard", () => ({
  StatsCard: ({ title, value }: any) => <div>{title}:{value}</div>,
}));

vi.mock("@/components/ui/boris-table", () => ({
  BorisTable: ({ columns, data }: any) => (
    <div>
      {data.map((row: any) => (
        <div key={row.id}>
          {columns.map((col: any) => (
            <div key={col.key}>{col.render ? col.render(row) : null}</div>
          ))}
        </div>
      ))}
    </div>
  ),
  RowActions: ({ children }: { children: any }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick, disabled, type = "button", ...rest }: any) => (
    <button type={type} onClick={onClick} disabled={disabled} {...rest}>{children}</button>
  ),
}));

vi.mock("@/components/ui/loading-state", () => ({ LoadingState: ({ message }: any) => <div>{message}</div> }));
vi.mock("@/components/ui/error-state", () => ({ ErrorState: ({ message }: any) => <div>{message}</div> }));
vi.mock("@/components/ui/empty-state", () => ({ EmptyState: ({ title }: any) => <div>{title}</div> }));
vi.mock("@/components/ui/skeleton", () => ({ Skeleton: () => <div /> }));
vi.mock("@/components/ui/badge", () => ({ Badge: ({ children }: any) => <span>{children}</span> }));
vi.mock("@/components/ui/status-tag", () => ({ StatusTag: ({ children }: any) => <span>{children}</span> }));
vi.mock("@/components/ui/sonner", () => ({ notify: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ children }: any) => <div>{children}</div>,
  SheetContent: ({ children }: any) => <div>{children}</div>,
  SheetHeader: ({ children }: any) => <div>{children}</div>,
  SheetTitle: ({ children }: any) => <div>{children}</div>,
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

vi.mock("./AccessDenied", () => ({
  default: () => <div>Acesso negado</div>,
}));

function flush() {
  return new Promise((r) => setTimeout(r, 0));
}

async function renderPage() {
  const Page = (await import("./SystemGroups")).default;
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Page />
      </MemoryRouter>,
    );
    await flush();
  });

  return { container, root };
}

describe("SystemGroups page", () => {
  beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    vi.clearAllMocks();
    useMutationCallCount = 0;
    statusMutationState = {
      mutate: statusMutateMock,
      isPending: false,
      variables: undefined,
    };
    inviteMutationState = {
      mutate: inviteMutateMock,
      isPending: false,
      variables: undefined,
    };
  });

  it("mostra o nome do grupo nos modais de arquivar e excluir", async () => {
    const { container, root } = await renderPage();

    const archiveButton = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "Arquivar");
    await act(async () => {
      archiveButton?.click();
      await flush();
    });
    expect(container.textContent).toContain("Grupo Alfa");
    expect(container.textContent).toContain("arquivado");

    const closeArchive = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "Cancelar");
    await act(async () => {
      closeArchive?.click();
      await flush();
    });

    const deleteButton = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "Excluir grupo");
    await act(async () => {
      deleteButton?.click();
      await flush();
    });
    expect(container.textContent).toContain("Grupo Alfa");
    expect(container.textContent).toContain("irreversível");

    await act(async () => root.unmount());
    container.remove();
  });

  it("valida link de convite antes de salvar", async () => {
    const { container, root } = await renderPage();

    const editInviteButton = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "Editar convite");
    await act(async () => {
      editInviteButton?.click();
      await flush();
    });

    const input = container.querySelector('input[placeholder*="chat.whatsapp.com"]') as HTMLInputElement;
    expect(input).toBeTruthy();

    await act(async () => {
      const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      valueSetter?.call(input, "https://example.com/invalido");
      input.dispatchEvent(new Event("input", { bubbles: true }));
      await flush();
    });

    const saveButton = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "Salvar");
    await act(async () => {
      saveButton?.click();
      await flush();
    });

    expect(inviteMutateMock).not.toHaveBeenCalled();
    expect(container.textContent).toContain("Cole um link de convite válido do WhatsApp.");

    await act(async () => root.unmount());
    container.remove();
  });

  it("remove querystring do link de convite ao salvar", async () => {
    const { container, root } = await renderPage();

    const editInviteButton = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "Editar convite");
    await act(async () => {
      editInviteButton?.click();
      await flush();
    });

    const input = container.querySelector('input[placeholder*="chat.whatsapp.com"]') as HTMLInputElement;
    expect(input).toBeTruthy();

    await act(async () => {
      const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      valueSetter?.call(input, "https://chat.whatsapp.com/ITDRgqTtYBOAWL0wYB5cLv?mode=gi_t");
      input.dispatchEvent(new Event("input", { bubbles: true }));
      await flush();
    });

    const saveButton = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "Salvar");
    await act(async () => {
      saveButton?.click();
      await flush();
    });

    expect(inviteMutateMock).toHaveBeenCalledWith({
      id: "grp-1",
      invite_link: "https://chat.whatsapp.com/ITDRgqTtYBOAWL0wYB5cLv",
    });

    await act(async () => root.unmount());
    container.remove();
  });

  it("desabilita ações em loading e mostra rótulos de progresso", async () => {
    statusMutationState = {
      mutate: statusMutateMock,
      isPending: true,
      variables: { id: "grp-1", status: "inactive" },
    };
    inviteMutationState = {
      mutate: inviteMutateMock,
      isPending: true,
      variables: { id: "grp-1" },
    };

    const { container, root } = await renderPage();

    const statusButton = Array.from(container.querySelectorAll("button")).find((b) => b.textContent?.includes("Atualizando"));
    expect(statusButton).toBeTruthy();
    expect(statusButton?.disabled).toBe(true);

    const editInviteButton = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "Editar convite");
    await act(async () => {
      editInviteButton?.click();
      await flush();
    });

    const savingButton = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "Salvando...");
    expect(savingButton).toBeTruthy();
    expect(savingButton?.disabled).toBe(true);

    await act(async () => root.unmount());
    container.remove();
  });
});
