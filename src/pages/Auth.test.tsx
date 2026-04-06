import { beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";

const navigateMock = vi.fn();
const notifySuccessMock = vi.fn();
const notifyInfoMock = vi.fn();
const notifyErrorMock = vi.fn();

const signInWithPasswordMock = vi.fn();
const resetPasswordForEmailMock = vi.fn();
const updateUserMock = vi.fn();
const invokeMock = vi.fn();
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
      error: (...args: any[]) => notifyErrorMock(...args),
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
      functions: {
        invoke: (...args: any[]) => invokeMock(...args),
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
    invokeMock.mockReset();
    notifyErrorMock.mockReset();
    authStateChangeCallback = null;
    localStorage.clear();
  });

  async function renderAuth() {
    const Auth = (await import("./Auth")).default;
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Auth />
        </MemoryRouter>,
      );
    });

    return { container, root };
  }

  it("faz login com email/senha e navega para /", async () => {
    signInWithPasswordMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });

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
    signInWithPasswordMock.mockResolvedValue({ data: { user: null }, error: new Error("Invalid login credentials") });

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

  it("mostra erro por campo e foca email quando email é inválido", async () => {
    const { container, root } = await renderAuth();
    const emailInput = container.querySelector('input[type="email"]') as HTMLInputElement;
    const passwordInput = container.querySelector('input[autocomplete="current-password"]') as HTMLInputElement;
    const form = container.querySelector("form") as HTMLFormElement;

    await act(async () => {
      setInputValue(emailInput, "invalido");
      setInputValue(passwordInput, "123456");
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      await flushPromises();
    });

    expect(container.textContent).toContain("Email inválido");
    expect(emailInput.getAttribute("aria-invalid")).toBe("true");
    expect(document.activeElement).toBe(emailInput);

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("permite alternar mostrar/ocultar senha no login", async () => {
    const { container, root } = await renderAuth();
    const passwordInput = container.querySelector('input[autocomplete="current-password"]') as HTMLInputElement;
    const toggleButton = Array.from(container.querySelectorAll("button")).find((b) =>
      b.getAttribute("aria-label") === "Mostrar senha"
    ) as HTMLButtonElement;

    expect(passwordInput.type).toBe("password");

    await act(async () => {
      toggleButton.click();
      await flushPromises();
    });

    expect(passwordInput.type).toBe("text");
    expect(toggleButton.getAttribute("aria-label")).toBe("Ocultar senha");

    await act(async () => {
      toggleButton.click();
      await flushPromises();
    });

    expect(passwordInput.type).toBe("password");

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("foca confirmação de senha no recovery quando senhas não coincidem", async () => {
    const { container, root } = await renderAuth();

    await act(async () => {
      authStateChangeCallback?.("PASSWORD_RECOVERY");
      await flushPromises();
    });

    const inputs = container.querySelectorAll('input[autocomplete="new-password"]');
    const newPasswordInput = inputs[0] as HTMLInputElement;
    const confirmPasswordInput = inputs[1] as HTMLInputElement;
    const form = container.querySelector("form") as HTMLFormElement;

    await act(async () => {
      setInputValue(newPasswordInput, "SenhaMuitoBoa123!");
      setInputValue(confirmPasswordInput, "SenhaDiferente123!");
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      await flushPromises();
    });

    expect(container.textContent).toContain("As senhas não coincidem");
    expect(confirmPasswordInput.getAttribute("aria-invalid")).toBe("true");
    expect(document.activeElement).toBe(confirmPasswordInput);

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("conclui onboarding pendente após login e entra no grupo provisionado", async () => {
    localStorage.setItem(
      "boris-onboarding:pending-v1",
      JSON.stringify({
        fullName: "Ana Souza",
        organizationName: "Operação Ana",
        email: "user@example.com",
        whatsappPhone: "(11) 99999-1111",
        inviteLink: "https://chat.whatsapp.com/convite",
        userId: "user-1",
        validatedGroup: {
          provider_phone: "120363@g.us",
          whatsapp_provider_id: "120363@g.us",
          group_name: "Grupo Alfa",
          participants: [{ phone: "+5511999991111", name: "Ana", is_admin: true }],
        },
      }),
    );

    signInWithPasswordMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    invokeMock.mockResolvedValue({
      data: { success: true, group_id: "group-1" },
      error: null,
    });

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

    expect(invokeMock).toHaveBeenCalledWith("provision-onboarding", expect.any(Object));
    expect(navigateMock).toHaveBeenCalledWith("/groups/group-1", { replace: true });
    expect(localStorage.getItem("boris-onboarding:pending-v1")).toBeNull();

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("manda o erro de onboarding de volta para a tela de cadastro", async () => {
    localStorage.setItem(
      "boris-onboarding:pending-v1",
      JSON.stringify({
        fullName: "Ana Souza",
        organizationName: "Operação Ana",
        email: "user@example.com",
        whatsappPhone: "(11) 99999-1111",
        inviteLink: "https://chat.whatsapp.com/convite",
        userId: "user-1",
        validatedGroup: {
          provider_phone: "120363@g.us",
          whatsapp_provider_id: "120363@g.us",
          group_name: "Grupo Alfa",
          participants: [{ phone: "+5511999991111", name: "Ana", is_admin: true }],
        },
      }),
    );

    signInWithPasswordMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    invokeMock.mockResolvedValue({
      data: null,
      error: new Error('Esse grupo já foi cadastrado como "Bóris - Testes". (GROUP_ALREADY_PROVISIONED)'),
    });

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

    expect(navigateMock).toHaveBeenCalledWith(
      "/signup?onboarding_error=Esse+grupo+j%C3%A1+foi+cadastrado+como+%22B%C3%B3ris+-+Testes%22.+%28GROUP_ALREADY_PROVISIONED%29&email=user%40example.com",
      { replace: true },
    );
    expect(container.textContent).not.toContain("Esse grupo já foi cadastrado");

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
