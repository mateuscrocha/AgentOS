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
  });

  it("registra login quando ORG_ADMIN faz SIGNED_IN", async () => {
    const insertMock = vi.fn().mockResolvedValue({ data: null, error: null });
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
          from: () => ({ insert: (...args: any[]) => insertMock(...args) }),
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

    expect(insertMock).toHaveBeenCalledWith({
      user_id: "u-1",
      org_id: "org-1",
      role: "org_admin",
      event_type: "login",
    });

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("registra page_view quando rota muda para página rastreada", async () => {
    const insertMock = vi.fn().mockResolvedValue({ data: null, error: null });
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
        }),
      };
    });

    vi.doMock("@/integrations/supabase/client", () => {
      return {
        supabase: {
          auth: {
            onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
          },
          from: () => ({ insert: (...args: any[]) => insertMock(...args) }),
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

    insertMock.mockClear();

    path = "/settings";
    await act(async () => {
      root.render(<TestApp />);
    });

    await act(async () => {
      await flushPromises();
    });

    expect(insertMock).toHaveBeenCalledWith({
      user_id: "u-1",
      org_id: "org-1",
      role: "org_admin",
      event_type: "page_view",
      page: "configuracoes",
    });

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("não registra eventos quando usuário não é ORG_ADMIN", async () => {
    const insertMock = vi.fn().mockResolvedValue({ data: null, error: null });
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
          from: () => ({ insert: (...args: any[]) => insertMock(...args) }),
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

    expect(insertMock).not.toHaveBeenCalled();

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
