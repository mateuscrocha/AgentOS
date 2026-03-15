import { beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";

async function flushPromises() {
  await Promise.resolve();
  await new Promise((r) => setTimeout(r, 0));
}

describe("useActivityTracking", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it("registra login quando ORG_ADMIN faz SIGNED_IN", async () => {
    const rpcMock = vi.fn().mockResolvedValue({ data: null, error: null });
    let authCallback: ((event: string, session: any) => void) | null = null;
    const path = "/auth";
    const authState = {
      userId: null as string | null,
      accessToken: null as string | null,
      isAuthenticated: false,
    };

    vi.doMock("react-router-dom", async () => {
      const actual = await vi.importActual<any>("react-router-dom");
      return { ...actual, useLocation: () => ({ pathname: path }) };
    });

    vi.doMock("@/hooks/use-auth", () => {
      return {
        useAuth: () => ({
          user: authState.userId ? { id: authState.userId } : null,
          session: authState.accessToken ? { access_token: authState.accessToken } : null,
          isAuthenticated: authState.isAuthenticated,
        }),
      };
    });

    vi.doMock("@/hooks/use-user-roles", () => {
      return {
        useUserRoles: () => ({
          roles: [{ role: "ORG_ADMIN", organization_id: "org-1" }],
          isLoading: false,
          isSystemAdmin: false,
          isOrgAdmin: true,
        }),
      };
    });

    vi.doMock("@/integrations/supabase/client", () => {
      return {
        supabase: {
          auth: {
            onAuthStateChange: (cb: any) => {
              authCallback = cb;
              return { data: { subscription: { unsubscribe: vi.fn() } } };
            },
          },
          rpc: (...args: any[]) => rpcMock(...args),
        },
      };
    });

    const { useActivityTracking } = await import("@/hooks/use-activity-tracking");

    function TestApp() {
      useActivityTracking();
      return null;
    }

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<TestApp />);
    });

    await act(async () => {
      authCallback?.("SIGNED_IN", { user: { id: "u-1" } });
      authState.userId = "u-1";
      authState.accessToken = "t-1";
      authState.isAuthenticated = true;
      root.render(<TestApp />);
      await flushPromises();
    });

    expect(rpcMock).toHaveBeenCalledWith("record_user_activity", {
      _event_type: "login",
      _route: "/auth",
      _session_id: "u-1:t-1",
      _metadata: { pathname: "/auth" },
    });

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("registra page_view quando rota muda para página rastreada", async () => {
    const rpcMock = vi.fn().mockResolvedValue({ data: null, error: null });
    let path = "/";

    vi.doMock("react-router-dom", async () => {
      const actual = await vi.importActual<any>("react-router-dom");
      return { ...actual, useLocation: () => ({ pathname: path }) };
    });

    vi.doMock("@/hooks/use-auth", () => {
      return {
        useAuth: () => ({
          user: { id: "u-1" },
          session: { access_token: "t-1" },
          isAuthenticated: true,
        }),
      };
    });

    vi.doMock("@/hooks/use-user-roles", () => {
      return {
        useUserRoles: () => ({
          roles: [{ role: "ORG_ADMIN", organization_id: "org-1" }],
          isLoading: false,
          isSystemAdmin: false,
          isOrgAdmin: true,
        }),
      };
    });

    vi.doMock("@/integrations/supabase/client", () => {
      return {
        supabase: {
          auth: {
            onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
          },
          rpc: (...args: any[]) => rpcMock(...args),
        },
      };
    });

    const { useActivityTracking } = await import("@/hooks/use-activity-tracking");

    function TestApp() {
      useActivityTracking();
      return null;
    }

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<TestApp />);
    });

    await act(async () => {
      await flushPromises();
    });

    rpcMock.mockClear();

    path = "/settings";
    await act(async () => {
      root.render(<TestApp />);
    });

    await act(async () => {
      await flushPromises();
    });

    expect(rpcMock).toHaveBeenCalledWith("record_user_activity", {
      _event_type: "page_view",
      _page: "configuracoes",
      _route: "/settings",
      _session_id: "u-1:t-1",
      _metadata: { pathname: "/settings" },
    });

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("registra rota organizacional interna mantendo a URL exata", async () => {
    const rpcMock = vi.fn().mockResolvedValue({ data: null, error: null });

    vi.doMock("react-router-dom", async () => {
      const actual = await vi.importActual<any>("react-router-dom");
      return { ...actual, useLocation: () => ({ pathname: "/organization/org-1/keywords" }) };
    });

    vi.doMock("@/hooks/use-auth", () => {
      return {
        useAuth: () => ({
          user: { id: "u-org-1" },
          session: { access_token: "org-token-1234567890" },
          isAuthenticated: true,
        }),
      };
    });

    vi.doMock("@/hooks/use-user-roles", () => {
      return {
        useUserRoles: () => ({
          roles: [{ role: "ORG_ADMIN", organization_id: "org-1" }],
          isLoading: false,
          isSystemAdmin: false,
          isOrgAdmin: true,
        }),
      };
    });

    vi.doMock("@/integrations/supabase/client", () => {
      return {
        supabase: {
          auth: {
            onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
          },
          rpc: (...args: any[]) => rpcMock(...args),
        },
      };
    });

    const { useActivityTracking } = await import("@/hooks/use-activity-tracking");

    function TestApp() {
      useActivityTracking();
      return null;
    }

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<TestApp />);
      await flushPromises();
    });

    expect(rpcMock).toHaveBeenNthCalledWith(2, "record_user_activity", {
      _event_type: "page_view",
      _page: "dashboard",
      _route: "/organization/org-1/keywords",
      _session_id: "u-org-1:n-1234567890",
      _metadata: { pathname: "/organization/org-1/keywords" },
    });

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("registra organizations como page_view dedicado", async () => {
    const rpcMock = vi.fn().mockResolvedValue({ data: null, error: null });

    vi.doMock("react-router-dom", async () => {
      const actual = await vi.importActual<any>("react-router-dom");
      return { ...actual, useLocation: () => ({ pathname: "/system/organizations" }) };
    });

    vi.doMock("@/hooks/use-auth", () => {
      return {
        useAuth: () => ({
          user: { id: "sys-orgs-1" },
          session: { access_token: "system-organizations-token" },
          isAuthenticated: true,
        }),
      };
    });

    vi.doMock("@/hooks/use-user-roles", () => {
      return {
        useUserRoles: () => ({
          roles: [{ role: "SYSTEM_ADMIN", organization_id: null }],
          isLoading: false,
          isSystemAdmin: true,
        }),
      };
    });

    vi.doMock("@/integrations/supabase/client", () => {
      return {
        supabase: {
          auth: {
            onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
          },
          rpc: (...args: any[]) => rpcMock(...args),
        },
      };
    });

    const { useActivityTracking } = await import("@/hooks/use-activity-tracking");

    function TestApp() {
      useActivityTracking();
      return null;
    }

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<TestApp />);
      await flushPromises();
    });

    expect(rpcMock).toHaveBeenNthCalledWith(2, "record_user_activity", {
      _event_type: "page_view",
      _page: "organizacoes",
      _route: "/system/organizations",
      _session_id: "sys-orgs-1:ations-token",
      _metadata: { pathname: "/system/organizations" },
    });

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("preserva summaries fora do bucket generico de grupos", async () => {
    const rpcMock = vi.fn().mockResolvedValue({ data: null, error: null });

    vi.doMock("react-router-dom", async () => {
      const actual = await vi.importActual<any>("react-router-dom");
      return { ...actual, useLocation: () => ({ pathname: "/groups/group-1/summaries" }) };
    });

    vi.doMock("@/hooks/use-auth", () => {
      return {
        useAuth: () => ({
          user: { id: "group-summary-1" },
          session: { access_token: "group-summary-token-123456" },
          isAuthenticated: true,
        }),
      };
    });

    vi.doMock("@/hooks/use-user-roles", () => {
      return {
        useUserRoles: () => ({
          roles: [{ role: "GROUP_MANAGER", organization_id: "org-1", group_id: "group-1" }],
          isLoading: false,
          isSystemAdmin: false,
        }),
      };
    });

    vi.doMock("@/integrations/supabase/client", () => {
      return {
        supabase: {
          auth: {
            onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
          },
          rpc: (...args: any[]) => rpcMock(...args),
        },
      };
    });

    const { useActivityTracking } = await import("@/hooks/use-activity-tracking");

    function TestApp() {
      useActivityTracking();
      return null;
    }

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<TestApp />);
      await flushPromises();
    });

    expect(rpcMock).toHaveBeenNthCalledWith(2, "record_user_activity", {
      _event_type: "page_view",
      _page: "resumos",
      _route: "/groups/group-1/summaries",
      _session_id: "group-summary-1:token-123456",
      _metadata: { pathname: "/groups/group-1/summaries" },
    });

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("distingue mensagens de grupo como page_view proprio", async () => {
    const rpcMock = vi.fn().mockResolvedValue({ data: null, error: null });

    vi.doMock("react-router-dom", async () => {
      const actual = await vi.importActual<any>("react-router-dom");
      return { ...actual, useLocation: () => ({ pathname: "/groups/group-1/messages" }) };
    });

    vi.doMock("@/hooks/use-auth", () => {
      return {
        useAuth: () => ({
          user: { id: "group-messages-1" },
          session: { access_token: "group-messages-token-654321" },
          isAuthenticated: true,
        }),
      };
    });

    vi.doMock("@/hooks/use-user-roles", () => {
      return {
        useUserRoles: () => ({
          roles: [{ role: "GROUP_MANAGER", organization_id: "org-1", group_id: "group-1" }],
          isLoading: false,
          isSystemAdmin: false,
        }),
      };
    });

    vi.doMock("@/integrations/supabase/client", () => {
      return {
        supabase: {
          auth: {
            onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
          },
          rpc: (...args: any[]) => rpcMock(...args),
        },
      };
    });

    const { useActivityTracking } = await import("@/hooks/use-activity-tracking");

    function TestApp() {
      useActivityTracking();
      return null;
    }

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<TestApp />);
      await flushPromises();
    });

    expect(rpcMock).toHaveBeenNthCalledWith(2, "record_user_activity", {
      _event_type: "page_view",
      _page: "mensagens",
      _route: "/groups/group-1/messages",
      _session_id: "group-messages-1:token-654321",
      _metadata: { pathname: "/groups/group-1/messages" },
    });

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("registra login para gestor de grupo com escopo de organizacao", async () => {
    const rpcMock = vi.fn().mockResolvedValue({ data: null, error: null });

    vi.doMock("react-router-dom", async () => {
      const actual = await vi.importActual<any>("react-router-dom");
      return { ...actual, useLocation: () => ({ pathname: "/groups/group-1" }) };
    });

    vi.doMock("@/hooks/use-auth", () => {
      return {
        useAuth: () => ({
          user: { id: "group-manager-1" },
          session: { access_token: "group-manager-token-123456" },
          isAuthenticated: true,
        }),
      };
    });

    vi.doMock("@/hooks/use-user-roles", () => {
      return {
        useUserRoles: () => ({
          roles: [{ role: "GROUP_MANAGER", organization_id: "org-1", group_id: "group-1" }],
          isLoading: false,
          isSystemAdmin: false,
        }),
      };
    });

    vi.doMock("@/integrations/supabase/client", () => {
      return {
        supabase: {
          auth: {
            onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
          },
          rpc: (...args: any[]) => rpcMock(...args),
        },
      };
    });

    const { useActivityTracking } = await import("@/hooks/use-activity-tracking");

    function TestApp() {
      useActivityTracking();
      return null;
    }

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<TestApp />);
      await flushPromises();
    });

    expect(rpcMock).toHaveBeenNthCalledWith(1, "record_user_activity", {
      _event_type: "login",
      _route: "/groups/group-1",
      _session_id: "group-manager-1:token-123456",
      _metadata: { pathname: "/groups/group-1" },
    });

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("registra eventos também para SYSTEM_ADMIN", async () => {
    const rpcMock = vi.fn().mockResolvedValue({ data: null, error: null });
    let authCallback: ((event: string, session: any) => void) | null = null;
    const authState = {
      userId: "u-1",
      accessToken: "t-1",
      isAuthenticated: true,
    };

    vi.doMock("react-router-dom", async () => {
      const actual = await vi.importActual<any>("react-router-dom");
      return { ...actual, useLocation: () => ({ pathname: "/settings" }) };
    });

    vi.doMock("@/hooks/use-auth", () => {
      return {
        useAuth: () => ({
          user: authState.userId ? { id: authState.userId } : null,
          session: authState.accessToken ? { access_token: authState.accessToken } : null,
          isAuthenticated: authState.isAuthenticated,
        }),
      };
    });

    vi.doMock("@/hooks/use-user-roles", () => {
      return {
        useUserRoles: () => ({
          roles: [{ role: "SYSTEM_ADMIN", organization_id: null }],
          isLoading: false,
          isSystemAdmin: true,
          isOrgAdmin: false,
        }),
      };
    });

    vi.doMock("@/integrations/supabase/client", () => {
      return {
        supabase: {
          auth: {
            onAuthStateChange: (cb: any) => {
              authCallback = cb;
              return { data: { subscription: { unsubscribe: vi.fn() } } };
            },
          },
          rpc: (...args: any[]) => rpcMock(...args),
        },
      };
    });

    const { useActivityTracking } = await import("@/hooks/use-activity-tracking");

    function TestApp() {
      useActivityTracking();
      return null;
    }

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<TestApp />);
    });

    await act(async () => {
      authCallback?.("SIGNED_IN", { user: { id: "u-1" } });
      root.render(<TestApp />);
      await flushPromises();
    });

    expect(rpcMock).toHaveBeenCalled();

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("registra system admin em rota do system", async () => {
    const rpcMock = vi.fn().mockResolvedValue({ data: null, error: null });

    vi.doMock("react-router-dom", async () => {
      const actual = await vi.importActual<any>("react-router-dom");
      return { ...actual, useLocation: () => ({ pathname: "/system/users" }) };
    });

    vi.doMock("@/hooks/use-auth", () => {
      return {
        useAuth: () => ({
          user: { id: "sys-1" },
          session: { access_token: "system-token-1234567890" },
          isAuthenticated: true,
        }),
      };
    });

    vi.doMock("@/hooks/use-user-roles", () => {
      return {
        useUserRoles: () => ({
          roles: [{ role: "SYSTEM_ADMIN", organization_id: null }],
          isLoading: false,
          isSystemAdmin: true,
          isOrgAdmin: false,
        }),
      };
    });

    vi.doMock("@/integrations/supabase/client", () => {
      return {
        supabase: {
          auth: {
            onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
          },
          rpc: (...args: any[]) => rpcMock(...args),
        },
      };
    });

    const { useActivityTracking } = await import("@/hooks/use-activity-tracking");

    function TestApp() {
      useActivityTracking();
      return null;
    }

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<TestApp />);
      await flushPromises();
    });

    expect(rpcMock).toHaveBeenCalledWith("record_user_activity", {
      _event_type: "page_view",
      _page: "usuarios",
      _route: "/system/users",
      _session_id: "sys-1:n-1234567890",
      _metadata: { pathname: "/system/users" },
    });

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("registra login no primeiro mount autenticado mesmo sem evento SIGNED_IN ativo", async () => {
    const rpcMock = vi.fn().mockResolvedValue({ data: null, error: null });

    vi.doMock("react-router-dom", async () => {
      const actual = await vi.importActual<any>("react-router-dom");
      return { ...actual, useLocation: () => ({ pathname: "/system/activity" }) };
    });

    vi.doMock("@/hooks/use-auth", () => {
      return {
        useAuth: () => ({
          user: { id: "sys-bootstrap" },
          session: { access_token: "bootstrap-token-123456" },
          isAuthenticated: true,
        }),
      };
    });

    vi.doMock("@/hooks/use-user-roles", () => {
      return {
        useUserRoles: () => ({
          roles: [{ role: "SYSTEM_ADMIN", organization_id: null }],
          isLoading: false,
          isSystemAdmin: true,
          isOrgAdmin: false,
        }),
      };
    });

    vi.doMock("@/integrations/supabase/client", () => {
      return {
        supabase: {
          auth: {
            onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
          },
          rpc: (...args: any[]) => rpcMock(...args),
        },
      };
    });

    const { useActivityTracking } = await import("@/hooks/use-activity-tracking");

    function TestApp() {
      useActivityTracking();
      return null;
    }

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<TestApp />);
      await flushPromises();
    });

    expect(rpcMock).toHaveBeenNthCalledWith(1, "record_user_activity", {
      _event_type: "login",
      _route: "/system/activity",
      _session_id: "sys-bootstrap:token-123456",
      _metadata: { pathname: "/system/activity" },
    });

    await act(async () => {
      root.render(<TestApp />);
      await flushPromises();
    });

    expect(rpcMock).toHaveBeenCalledTimes(2);

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
