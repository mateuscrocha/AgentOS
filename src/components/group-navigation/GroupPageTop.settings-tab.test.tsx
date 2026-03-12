import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { MemoryRouter } from "react-router-dom";
import { GroupPageTop } from "./GroupPageTop";
import { GroupTabs } from "./GroupTabs";

let canEditValue = false;
let isSystemAdminValue = false;

vi.mock("@/hooks/use-user-roles", () => {
  return {
    useUserRoles: () => ({
      isLoading: false,
      canEditGroup: () => canEditValue,
      isSystemAdmin: isSystemAdminValue,
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

vi.mock("@/components/ui/tabs", () => {
  return {
    Tabs: ({ children }: { children: any }) => <div>{children}</div>,
    TabsList: ({ children }: { children: any }) => <div>{children}</div>,
    TabsTrigger: ({ children, ...props }: { children: any } & Record<string, any>) => <button type="button" {...props}>{children}</button>,
  };
});

describe("GroupPageTop — aba Configurações", () => {
  beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    canEditValue = false;
    isSystemAdminValue = false;
  });

  it("não exibe Configurações mesmo quando o usuário pode editar o grupo", async () => {
    canEditValue = true;
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <GroupPageTop
            breadcrumbItems={[{ label: "Central de Comando", href: "/" }]}
            group={{
              groupId: "00000000-0000-4000-8000-000000000000",
              organizationId: "00000000-0000-4000-8000-000000000001",
              name: "Grupo X",
              provider: "",
              totalMembers: 10,
              lastMessageAt: null,
              syncStatus: null,
            }}
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

  it("não exibe Configurações quando o usuário não pode editar o grupo", async () => {
    canEditValue = false;
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <GroupPageTop
            breadcrumbItems={[{ label: "Central de Comando", href: "/" }]}
            group={{
              groupId: "00000000-0000-4000-8000-000000000000",
              organizationId: "00000000-0000-4000-8000-000000000001",
              name: "Grupo X",
              provider: "",
              totalMembers: 10,
              lastMessageAt: null,
              syncStatus: null,
            }}
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

describe("GroupTabs — remoção da aba Atividade", () => {
  beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    isSystemAdminValue = false;
  });

  it("não exibe a aba Atividade", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <GroupTabs groupId="00000000-0000-4000-8000-000000000000" activeTab="painel" />
        </MemoryRouter>
      );
    });

    expect(container.textContent).not.toContain("Atividade");

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("não exibe Configurações para não-system-admin", async () => {
    isSystemAdminValue = false;
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <GroupTabs groupId="00000000-0000-4000-8000-000000000000" activeTab="painel" />
        </MemoryRouter>
      );
    });

    expect(container.textContent).not.toContain("Configurações");

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("exibe Configurações desabilitado para SYSTEM_ADMIN", async () => {
    isSystemAdminValue = true;
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <GroupTabs groupId="00000000-0000-4000-8000-000000000000" activeTab="painel" />
        </MemoryRouter>
      );
    });

    expect(container.textContent).toContain("Configurações");
    const settingsButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Configurações"),
    );
    expect(settingsButton?.hasAttribute("disabled")).toBe(true);

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
