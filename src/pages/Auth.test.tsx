import { beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";

const navigateMock = vi.fn();
const notifySuccessMock = vi.fn();
const notifyInfoMock = vi.fn();

const signInWithPasswordMock = vi.fn();
const resetPasswordForEmailMock = vi.fn();
const updateUserMock = vi.fn();
let authStateChangeCallback: ((event: string, session?: any) => void) | null = null;

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<any>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock("@/hooks/use-auth", () => {
  return {
    useAuth: () => ({
      isAuthenticated: false,
      loading: false,
    }),
  };
});

vi.mock("@/components/ui/sonner", () => {
  return {
    notify: {
      success: (...args: any[]) => notifySuccessMock(...args),
      info: (...args: any[]) => notifyInfoMock(...args),
      error: vi.fn(),
    },
  };
});

vi.mock("@/lib/utils", async () => {
  const actual = await vi.importActual<any>("@/lib/utils");
  return {
    ...actual,
    getAppUrl: () => "https://app.example.com",
  };
});

vi.mock("@/integrations/supabase/client", () => {
  return {
    supabase: {
      auth: {
        signInWithPassword: (...args: any[]) => signInWithPasswordMock(...args),
        resetPasswordForEmail: (...args: any[]) => resetPasswordForEmailMock(...args),
        updateUser: (...args: any[]) => updateUserMock(...args),
        onAuthStateChange: (cb: any) => {
          authStateChangeCallback = cb;
          return { data: { subscription: { unsubscribe: vi.fn() } } };
        },
      },
    },
  };
});

async function flushPromises() {
  await Promise.resolve();
  await new Promise((r) => setTimeout(r, 0));
}

function setInputValue(input: HTMLInputElement, value: string) {
  const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  valueSetter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("Auth page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    navigateMock.mockReset();
    notifySuccessMock.mockReset();
    notifyInfoMock.mockReset();
    signInWithPasswordMock.mockReset();
    resetPasswordForEmailMock.mockReset();
    updateUserMock.mockReset();
    authStateChangeCallback = null;
  });

  async function renderAuth() {
    const Auth = (await import("./Auth")).default;
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <MemoryRouter>
          <Auth />
        </MemoryRouter>,
      );
    });

    return { container, root };
  }

  it("faz login com email/senha e navega para /", async () => {
    signInWithPasswordMock.mockResolvedValue({ error: null });

    const { container, root } = await renderAuth();
    const emailInput = container.querySelector('input[type="email"]') as HTMLInputElement;
    const passwordInput = container.querySelector('input[autocomplete="current-password"]') as HTMLInputElement;
    const form = container.querySelector("form") as HTMLFormElement;

    await act(async () => {
      setInputValue(emailInput, "user@example.com");
      setInputValue(passwordInput, "123456");
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      await flushPromises();
    });

    expect(signInWithPasswordMock).toHaveBeenCalledWith({
      email: "user@example.com",
      password: "123456",
    });
    expect(notifySuccessMock).toHaveBeenCalledWith("Login realizado", "Bem-vindo de volta.");
    expect(navigateMock).toHaveBeenCalledWith("/");

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("mostra mensagem amigável para credenciais inválidas", async () => {
    signInWithPasswordMock.mockResolvedValue({ error: new Error("Invalid login credentials") });

    const { container, root } = await renderAuth();
    const emailInput = container.querySelector('input[type="email"]') as HTMLInputElement;
    const passwordInput = container.querySelector('input[autocomplete="current-password"]') as HTMLInputElement;
    const form = container.querySelector("form") as HTMLFormElement;

    await act(async () => {
      setInputValue(emailInput, "user@example.com");
      setInputValue(passwordInput, "123456");
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      await flushPromises();
    });

    expect(container.textContent).toContain("Email ou senha incorretos");

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("envia recuperação de senha com redirect para /auth", async () => {
    resetPasswordForEmailMock.mockResolvedValue({ error: null });

    const { container, root } = await renderAuth();
    const emailInput = container.querySelector('input[type="email"]') as HTMLInputElement;
    const forgotBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Esqueci minha senha")
    ) as HTMLButtonElement;

    await act(async () => {
      setInputValue(emailInput, "user@example.com");
      forgotBtn.click();
      await flushPromises();
    });

    expect(resetPasswordForEmailMock).toHaveBeenCalledWith("user@example.com", {
      redirectTo: "https://app.example.com/auth",
    });
    expect(notifyInfoMock).toHaveBeenCalledWith("Link enviado", "Verifique seu email para recuperar a senha.");

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("entra em modo recovery quando recebe PASSWORD_RECOVERY", async () => {
    const { container, root } = await renderAuth();

    await act(async () => {
      authStateChangeCallback?.("PASSWORD_RECOVERY");
      await flushPromises();
    });

    expect(container.textContent).toContain("Defina sua nova senha");
    expect(container.textContent).toContain("Nova senha");
    const recoveryInputs = container.querySelectorAll('input[autocomplete="new-password"]');
    expect(recoveryInputs.length).toBe(2);

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
