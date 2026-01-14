import { beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { useEffect } from "react";

async function flushPromises() {
  await Promise.resolve();
  await new Promise((r) => setTimeout(r, 0));
}

describe("logout", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  it("encerra sessão global, limpa storage e limpa cache", async () => {
    const signOutMock = vi.fn().mockResolvedValue({ error: null });
    const cancelQueriesMock = vi.fn().mockResolvedValue(undefined);
    const clearMock = vi.fn();
    const onAuthStateChangeMock = vi.fn().mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });
    const getSessionMock = vi.fn().mockResolvedValue({ data: { session: null } });

    vi.doMock("@/integrations/supabase/client", () => {
      return {
        supabase: {
          auth: {
            signOut: (...args: any[]) => signOutMock(...args),
            onAuthStateChange: (...args: any[]) => onAuthStateChangeMock(...args),
            getSession: (...args: any[]) => getSessionMock(...args),
          },
        },
      };
    });

    vi.doMock("@/lib/query-client", () => {
      return {
        queryClient: {
          cancelQueries: (...args: any[]) => cancelQueriesMock(...args),
          clear: (...args: any[]) => clearMock(...args),
        },
      };
    });

    const { useAuth } = await import("@/hooks/use-auth");

    localStorage.setItem("sb-test-auth-token", "token");
    localStorage.setItem("system-admin-period", "{\"period\":\"7d\"}");
    localStorage.setItem("org-period:123", "{\"period\":\"30d\"}");
    localStorage.setItem("group-period:456", "{\"period\":\"30d\"}");
    localStorage.setItem("theme", "dark");
    sessionStorage.setItem("tmp", "1");

    const done = vi.fn();

    function TestApp() {
      const { signOut } = useAuth();
      useEffect(() => {
        signOut().finally(() => done());
      }, [signOut]);
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

    expect(done).toHaveBeenCalled();
    expect(signOutMock).toHaveBeenCalledWith({ scope: "global" });
    expect(cancelQueriesMock).toHaveBeenCalled();
    expect(clearMock).toHaveBeenCalled();

    expect(localStorage.getItem("sb-test-auth-token")).toBeNull();
    expect(localStorage.getItem("system-admin-period")).toBeNull();
    expect(localStorage.getItem("org-period:123")).toBeNull();
    expect(localStorage.getItem("group-period:456")).toBeNull();
    expect(localStorage.getItem("theme")).toBe("dark");
    expect(sessionStorage.getItem("tmp")).toBeNull();

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("não dispara 'Sessão expirada' em logout explícito", async () => {
    const navigateMock = vi.fn();
    const notifyErrorMock = vi.fn();
    let authCallback: ((event: string) => void) | null = null;

    vi.doMock("react-router-dom", async () => {
      const actual = await vi.importActual<any>("react-router-dom");
      return {
        ...actual,
        useNavigate: () => navigateMock,
        useLocation: () => ({ pathname: "/system" }),
      };
    });

    vi.doMock("@/components/ui/sonner", () => {
      return {
        notify: {
          error: (...args: any[]) => notifyErrorMock(...args),
        },
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
        },
      };
    });

    vi.doMock("@/hooks/use-auth", () => {
      return {
        useAuth: () => ({ isAuthenticated: true, loading: false }),
        isExplicitSignOutRecent: () => true,
      };
    });

    const { AuthGuard } = await import("@/components/auth/AuthGuard");

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <AuthGuard>
          <div>ok</div>
        </AuthGuard>,
      );
    });

    await act(async () => {
      authCallback?.("SIGNED_OUT");
    });

    expect(notifyErrorMock).not.toHaveBeenCalled();
    expect(navigateMock).not.toHaveBeenCalled();

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});

