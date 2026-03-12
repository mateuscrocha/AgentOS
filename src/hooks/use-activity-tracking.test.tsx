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
