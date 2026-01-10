import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { MemoryRouter } from "react-router-dom";
import { GroupPageTop } from "./GroupPageTop";

let canEditValue = false;

vi.mock("@/hooks/use-user-roles", () => {
  return {
    useUserRoles: () => ({
      isLoading: false,
      canEditGroup: () => canEditValue,
    }),
  };
});

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual<any>("@tanstack/react-query");
  return {
    ...actual,
    useQuery: () => ({ data: [] }),
  };
});

vi.mock("@/integrations/supabase/client", () => {
  return {
    supabase: {},
  };
});

vi.mock("@/components/ui/breadcrumbs", () => {
  return {
    Breadcrumbs: () => null,
  };
});

vi.mock("@/components/group-dashboard/GroupHeader", () => {
  return {
    GroupHeader: () => null,
  };
});

vi.mock("@/components/ui/button", () => {
  return {
    Button: ({ children }: { children: any }) => <div>{children}</div>,
  };
});

describe("GroupPageTop — aba Configurações", () => {
  beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    canEditValue = false;
  });

  it("exibe Configurações quando o usuário pode editar o grupo", async () => {
    canEditValue = true;
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <MemoryRouter>
          <GroupPageTop
            breadcrumbItems={[{ label: "Central do Bóris", href: "/" }]}
            group={{
              groupId: "00000000-0000-4000-8000-000000000000",
              organizationId: "00000000-0000-4000-8000-000000000001",
              name: "Grupo X",
              provider: "",
              totalMembers: 10,
              lastMessageAt: null,
              syncStatus: null,
            }}
            activeTab="painel"
          />
        </MemoryRouter>
      );
    });

    expect(container.textContent).toContain("Configurações");

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("não exibe Configurações quando o usuário não pode editar o grupo", async () => {
    canEditValue = false;
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <MemoryRouter>
          <GroupPageTop
            breadcrumbItems={[{ label: "Central do Bóris", href: "/" }]}
            group={{
              groupId: "00000000-0000-4000-8000-000000000000",
              organizationId: "00000000-0000-4000-8000-000000000001",
              name: "Grupo X",
              provider: "",
              totalMembers: 10,
              lastMessageAt: null,
              syncStatus: null,
            }}
            activeTab="painel"
          />
        </MemoryRouter>
      );
    });

    expect(container.textContent).not.toContain("Configurações");

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
