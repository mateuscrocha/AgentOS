import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { MemoryRouter } from "react-router-dom";

let isSystemAdminValue = false;

vi.mock("@/hooks/use-user-roles", () => {
  return {
    useUserRoles: () => ({
      isSystemAdmin: isSystemAdminValue,
      getAccessibleOrgIds: () => ["00000000-0000-4000-8000-000000000001"],
      getAccessibleGroupIds: () => ["00000000-0000-4000-8000-000000000000"],
    }),
  };
});

vi.mock("@/components/ui/sidebar", () => {
  const Wrap = ({ children }: { children: any }) => <div>{children}</div>;
  return {
    Sidebar: Wrap,
    SidebarHeader: Wrap,
    SidebarContent: Wrap,
    SidebarFooter: Wrap,
    SidebarMenu: Wrap,
    SidebarMenuItem: Wrap,
    SidebarMenuButton: ({ children }: { children: any }) => <div>{children}</div>,
    SidebarSeparator: () => <div />,
    SidebarRail: () => <div />,
    SidebarTrigger: () => <div />,
  };
});

vi.mock("@/components/ui/collapsible", () => {
  const Wrap = ({ children }: { children: any }) => <div>{children}</div>;
  return {
    Collapsible: Wrap,
    CollapsibleContent: Wrap,
    CollapsibleTrigger: Wrap,
  };
});

describe("AdminSidebar — menu do grupo", () => {
  beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    isSystemAdminValue = false;
  });

  it("não exibe Configurações do grupo para não-system-admin", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    const { AdminSidebar } = await import("./AdminSidebar");

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/groups/00000000-0000-4000-8000-000000000000"]}>
          <AdminSidebar />
        </MemoryRouter>
      );
    });

    expect(container.textContent).toContain("Painel do grupo");
    expect(container.textContent).toContain("Mensagens");
    expect(container.textContent).not.toContain("Configurações do grupo");
    expect(container.textContent).not.toContain("Atividade");

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("exibe Configurações do grupo para SYSTEM_ADMIN", async () => {
    isSystemAdminValue = true;
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    const { AdminSidebar } = await import("./AdminSidebar");

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/groups/00000000-0000-4000-8000-000000000000"]}>
          <AdminSidebar />
        </MemoryRouter>
      );
    });

    expect(container.textContent).toContain("Configurações do grupo");

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
