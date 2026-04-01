import { act } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";

const navigateMock = vi.fn();
const notifySuccessMock = vi.fn();
const notifyInfoMock = vi.fn();
const notifyErrorMock = vi.fn();
const signUpMock = vi.fn();
const invokeMock = vi.fn();
const useAuthMock = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<any>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock("@/components/ui/sonner", () => ({
  notify: {
    success: (...args: any[]) => notifySuccessMock(...args),
    info: (...args: any[]) => notifyInfoMock(...args),
    error: (...args: any[]) => notifyErrorMock(...args),
  },
}));

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock("@/lib/utils", async () => {
  const actual = await vi.importActual<any>("@/lib/utils");
  return {
    ...actual,
    getAppUrl: () => "https://app.example.com",
  };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      signUp: (...args: any[]) => signUpMock(...args),
    },
    functions: {
      invoke: (...args: any[]) => invokeMock(...args),
    },
  },
}));

async function flushPromises() {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function setInputValue(input: HTMLInputElement, value: string) {
  const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  valueSetter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

function getButtonByText(container: HTMLDivElement, text: string) {
  return Array.from(container.querySelectorAll("button")).find((item) => item.textContent?.includes(text)) as
    | HTMLButtonElement
    | undefined;
}

describe("Onboarding page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    navigateMock.mockReset();
    notifySuccessMock.mockReset();
    notifyInfoMock.mockReset();
    notifyErrorMock.mockReset();
    signUpMock.mockReset();
    invokeMock.mockReset();
    useAuthMock.mockReset();
    useAuthMock.mockReturnValue({
      isAuthenticated: false,
      user: null,
    });
    localStorage.clear();
  });

  async function renderPage(initialEntry = "/signup") {
    const Onboarding = (await import("./Onboarding")).default;
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={[initialEntry]}>
          <Onboarding />
        </MemoryRouter>,
      );
    });

    return { container, root };
  }

  async function fillNewOnboardingWizard(container: HTMLDivElement) {
    await act(async () => {
      const profileInputs = Array.from(container.querySelectorAll("input")) as HTMLInputElement[];
      const [fullName, organizationName, email, whatsappPhone] = profileInputs;
      setInputValue(fullName, "Ana Souza");
      setInputValue(organizationName, "Operação Ana");
      setInputValue(email, "ana@example.com");
      setInputValue(whatsappPhone, "(11) 99999-1111");
      await flushPromises();
    });

    await act(async () => {
      getButtonByText(container, "Continuar")?.click();
      await flushPromises();
    });

    await act(async () => {
      const passwordInputs = Array.from(container.querySelectorAll("input")) as HTMLInputElement[];
      const [password, confirmPassword] = passwordInputs;
      setInputValue(password, "Senha!12345");
      setInputValue(confirmPassword, "Senha!12345");
      await flushPromises();
    });

    await act(async () => {
      getButtonByText(container, "Continuar")?.click();
      await flushPromises();
    });

    await act(async () => {
      const groupInput = container.querySelector("input") as HTMLInputElement;
      setInputValue(groupInput, "https://chat.whatsapp.com/convite");
      await flushPromises();
    });
  }

  async function advanceResumedWizardToGroup(container: HTMLDivElement, inviteLink = "https://chat.whatsapp.com/convite-novo") {
    await act(async () => {
      getButtonByText(container, "Continuar")?.click();
      await flushPromises();
    });

    await act(async () => {
      const groupInput = container.querySelector("input") as HTMLInputElement;
      setInputValue(groupInput, inviteLink);
      await flushPromises();
    });
  }

  it("valida grupo, cria usuário e provisiona onboarding", async () => {
    invokeMock
      .mockResolvedValueOnce({
        data: {
          success: true,
          is_valid: true,
          is_boris_in_group: true,
          provider: "whatsapp",
          provider_phone: "120363@g.us",
          whatsapp_provider_id: "120363@g.us",
          group_name: "Grupo Alfa",
          participants_count: 2,
          participants: [
            { phone: "+5511999991111", name: "Ana", is_admin: true, is_super_admin: true },
          ],
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          success: true,
          group_id: "group-1",
        },
        error: null,
      });

    signUpMock.mockResolvedValue({
      data: {
        user: { id: "user-1" },
        session: { access_token: "token" },
      },
      error: null,
    });

    const { container, root } = await renderPage();
    await fillNewOnboardingWizard(container);

    const form = container.querySelector("form") as HTMLFormElement;
    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      await flushPromises();
    });

    expect(invokeMock).toHaveBeenNthCalledWith(1, "validate-whatsapp-group", {
      body: { invite_link: "https://chat.whatsapp.com/convite" },
    });
    expect(signUpMock).toHaveBeenCalled();
    expect(invokeMock).toHaveBeenNthCalledWith(2, "provision-onboarding", expect.objectContaining({}));
    expect(navigateMock).toHaveBeenCalledWith("/groups/group-1", { replace: true });
    expect(notifySuccessMock).toHaveBeenCalled();

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("redireciona para login quando signup exige confirmação de email", async () => {
    invokeMock
      .mockResolvedValueOnce({
        data: {
          success: true,
          is_valid: true,
          is_boris_in_group: true,
          provider_phone: "120363@g.us",
          whatsapp_provider_id: "120363@g.us",
          group_name: "Grupo Alfa",
          participants: [{ phone: "+5511999991111", name: "Ana", is_admin: true }],
        },
        error: null,
      })
    signUpMock.mockResolvedValue({
      data: {
        user: { id: "user-1" },
        session: null,
      },
      error: null,
    });

    const { container, root } = await renderPage();
    await fillNewOnboardingWizard(container);

    const form = container.querySelector("form") as HTMLFormElement;
    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      await flushPromises();
    });

    expect(navigateMock).toHaveBeenCalledWith("/auth?email=ana%40example.com&onboarding=success", { replace: true });
    expect(notifyInfoMock).toHaveBeenCalled();
    expect(invokeMock).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem("boris-onboarding:pending-v1")).toContain("user-1");

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("mostra erro amigável quando a validação do grupo falha", async () => {
    invokeMock.mockResolvedValueOnce({
      data: {
        success: false,
        message: "Grupo inválido",
      },
      error: null,
    });

    const { container, root } = await renderPage();
    await fillNewOnboardingWizard(container);

    const form = container.querySelector("form") as HTMLFormElement;
    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      await flushPromises();
    });

    expect(container.textContent).toContain("Não conseguimos validar esse grupo");
    expect(notifyErrorMock).toHaveBeenCalled();

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("apresenta timeout de validação com mensagem em português", async () => {
    const { container, root } = await renderPage("/signup?onboarding_error=Validation%20timed%20out%20%28VALIDATION_TIMEOUT%29");

    expect(container.textContent).toContain("Não conseguimos validar o grupo agora");
    expect(container.textContent).toContain("A validação do link demorou mais do que o esperado.");
    expect(container.textContent).toContain("VALIDATION_TIMEOUT");

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("apresenta grupo inválido com orientação para revisar o link", async () => {
    const { container, root } = await renderPage("/signup?onboarding_error=Grupo%20inv%C3%A1lido%20%28INVALID_GROUP%29");

    expect(container.textContent).toContain("Não conseguimos validar esse grupo");
    expect(container.textContent).toContain("O link informado parece inválido");
    expect(container.textContent).toContain("Trocar link do grupo");

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("apresenta ausência do Bóris no grupo com próximo passo claro", async () => {
    const { container, root } = await renderPage("/signup?onboarding_error=B%C3%B3ris%20n%C3%A3o%20est%C3%A1%20no%20grupo%20%28BORIS_NOT_IN_GROUP%29");

    expect(container.textContent).toContain("O Bóris ainda não está nesse grupo");
    expect(container.textContent).toContain("Adicione o Bóris ao grupo");
    expect(container.textContent).toContain("Trocar link do grupo");

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("retoma o cadastro autenticado e mostra o erro na própria tela de onboarding", async () => {
    useAuthMock.mockReturnValue({
      isAuthenticated: true,
      user: { id: "user-1", email: "ana@example.com" },
    });

    localStorage.setItem(
      "boris-onboarding:pending-v1",
      JSON.stringify({
        fullName: "Ana Souza",
        organizationName: "Operação Ana",
        email: "ana@example.com",
        whatsappPhone: "(11) 99999-1111",
        inviteLink: "https://chat.whatsapp.com/convite-antigo",
        userId: "user-1",
        validatedGroup: {
          provider_phone: "120363@g.us",
          whatsapp_provider_id: "120363@g.us",
          group_name: "Grupo Antigo",
          participants: [{ phone: "+5511999991111", name: "Ana", is_admin: true }],
        },
      }),
    );

    invokeMock
      .mockResolvedValueOnce({
        data: {
          success: true,
          is_valid: true,
          is_boris_in_group: true,
          provider_phone: "999999@g.us",
          whatsapp_provider_id: "999999@g.us",
          group_name: "Grupo Novo",
          participants: [{ phone: "+5511999991111", name: "Ana", is_admin: true }],
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          success: true,
          group_id: "group-2",
        },
        error: null,
      });

    const { container, root } = await renderPage("/signup?onboarding_error=Esse%20grupo%20j%C3%A1%20foi%20cadastrado");

    expect(container.textContent).toContain("Esse grupo já foi cadastrado");
    expect(container.textContent).toContain("Continuar cadastro");
    expect(container.textContent).not.toContain("Senha do app");
    expect(container.textContent).toContain("Conecte seu grupo");

    await advanceResumedWizardToGroup(container);

    const form = container.querySelector("form") as HTMLFormElement;
    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      await flushPromises();
    });

    expect(signUpMock).not.toHaveBeenCalled();
    expect(invokeMock).toHaveBeenNthCalledWith(2, "provision-onboarding", expect.any(Object));
    expect(navigateMock).toHaveBeenCalledWith("/groups/group-2", { replace: true });
    expect(localStorage.getItem("boris-onboarding:pending-v1")).toBeNull();

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("encerra a retomada do onboarding e volta para o login", async () => {
    useAuthMock.mockReturnValue({
      isAuthenticated: true,
      user: { id: "user-1", email: "ana@example.com" },
    });

    localStorage.setItem(
      "boris-onboarding:pending-v1",
      JSON.stringify({
        fullName: "Ana Souza",
        organizationName: "Operação Ana",
        email: "ana@example.com",
        whatsappPhone: "(11) 99999-1111",
        inviteLink: "https://chat.whatsapp.com/convite-antigo",
        userId: "user-1",
        validatedGroup: {
          provider_phone: "120363@g.us",
          whatsapp_provider_id: "120363@g.us",
          group_name: "Grupo Antigo",
          participants: [{ phone: "+5511999991111", name: "Ana", is_admin: true }],
        },
      }),
    );

    const { container, root } = await renderPage("/signup?onboarding_error=Esse%20grupo%20j%C3%A1%20foi%20cadastrado");

    const button = Array.from(container.querySelectorAll("button")).find((item) =>
      item.textContent?.includes("Ir para o login"),
    ) as HTMLButtonElement;

    await act(async () => {
      button.click();
      await flushPromises();
    });

    expect(localStorage.getItem("boris-onboarding:pending-v1")).toBeNull();
    expect(navigateMock).toHaveBeenCalledWith("/auth", { replace: true });

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
