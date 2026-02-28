import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

let isSystemAdminValue = false;
let isOrgAdminValue = false;
let isGroupManagerValue = false;

vi.mock("@/hooks/use-user-roles", () => {
  return {
    useUserRoles: () => ({
      isSystemAdmin: isSystemAdminValue,
      isOrgAdmin: isOrgAdminValue,
      isGroupManager: isGroupManagerValue,
      getAccessibleOrgIds: () => ["00000000-0000-4000-8000-000000000001"],
      getAccessibleGroupIds: () => ["00000000-0000-4000-8000-000000000000"],
    }),
  };
});

vi.mock("@/integrations/supabase/client", () => {
  const chain = {
    select: () => chain,
    eq: () => Promise.resolve({ count: 0, error: null }),
  };
  return {
    supabase: {
      from: () => chain,
    },
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
    isOrgAdminValue = false;
    isGroupManagerValue = false;
  });

  it("não exibe Configurações do grupo para não-system-admin", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const { AdminSidebar } = await import("./AdminSidebar");

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter
            initialEntries={["/groups/00000000-0000-4000-8000-000000000000"]}
            future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
          >
            <AdminSidebar />
          </MemoryRouter>
        </QueryClientProvider>
      );
    });

    expect(container.textContent).toContain("Painel do grupo");
    expect(container.textContent).toContain("Atendimento");
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
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const { AdminSidebar } = await import("./AdminSidebar");

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter
            initialEntries={["/groups/00000000-0000-4000-8000-000000000000"]}
            future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
          >
            <AdminSidebar />
          </MemoryRouter>
        </QueryClientProvider>
      );
    });

    expect(container.textContent).toContain("Configurações do grupo");

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("para group admin remove 'Grupos' e exibe 'Minha organização'", async () => {
    isGroupManagerValue = true;
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const { AdminSidebar } = await import("./AdminSidebar");

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter
            initialEntries={["/groups/00000000-0000-4000-8000-000000000000/messages"]}
            future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
          >
            <AdminSidebar />
          </MemoryRouter>
        </QueryClientProvider>
      );
    });

    expect(container.textContent).toContain("Minha organização");
    expect(container.textContent).not.toContain("Grupos");

    const orgLink = Array.from(container.querySelectorAll("a")).find((a) =>
      a.textContent?.includes("Minha organização"),
    );
    expect(orgLink?.getAttribute("href")).toBe("/organization/00000000-0000-4000-8000-000000000001/dashboard");

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("navega de Alertas para Organizações ao clicar no link", async () => {
    isSystemAdminValue = true;
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const { AdminSidebar } = await import("./AdminSidebar");

    const LocationProbe = () => {
      const location = useLocation();
      return <div data-testid="location-probe">{location.pathname}</div>;
    };

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter
            initialEntries={["/system/alerts"]}
            future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
          >
            <AdminSidebar />
            <LocationProbe />
          </MemoryRouter>
        </QueryClientProvider>
      );
    });

    expect(container.textContent).toContain("Alertas");
    expect(container.textContent).toContain("Organizações");
    expect(container.querySelector('[data-testid="location-probe"]')?.textContent).toBe("/system/alerts");

    const orgLink = Array.from(container.querySelectorAll("a")).find((a) => a.textContent?.includes("Organizações"));
    expect(orgLink).toBeTruthy();

    await act(async () => {
      orgLink?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
    });

    expect(container.querySelector('[data-testid="location-probe"]')?.textContent).toBe("/system/organizations");

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("navega de Organizações para Alertas ao clicar no link", async () => {
    isSystemAdminValue = true;
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const { AdminSidebar } = await import("./AdminSidebar");

    const LocationProbe = () => {
      const location = useLocation();
      return <div data-testid="location-probe">{location.pathname}</div>;
    };

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter
            initialEntries={["/system/organizations"]}
            future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
          >
            <AdminSidebar />
            <LocationProbe />
          </MemoryRouter>
        </QueryClientProvider>
      );
    });

    expect(container.textContent).toContain("Alertas");
    expect(container.textContent).toContain("Organizações");
    expect(container.querySelector('[data-testid="location-probe"]')?.textContent).toBe("/system/organizations");

    const alertsLink = Array.from(container.querySelectorAll("a")).find((a) => a.textContent?.includes("Alertas"));
    expect(alertsLink).toBeTruthy();

    await act(async () => {
      alertsLink?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
    });

    expect(container.querySelector('[data-testid="location-probe"]')?.textContent).toBe("/system/alerts");

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
