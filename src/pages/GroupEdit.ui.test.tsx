import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const refetchMock = vi.fn();
const insertEventMock = vi.fn(async () => ({ error: null }));
let groupEditData: any | undefined;
let initialGroupEditData: any | undefined;
let GroupEditComponent: any;
let isSystemAdminValue = true;

function setNativeValue(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto = Object.getPrototypeOf(element);
  const descriptor = Object.getOwnPropertyDescriptor(proto, "value");
  descriptor?.set?.call(element, value);
}

vi.mock("@/hooks/use-auth", () => {
  return {
    useAuth: () => ({ loading: false, isAuthenticated: true, user: { id: "00000000-0000-4000-8000-000000000099" } }),
  };
});

vi.mock("@/hooks/use-user-roles", () => {
  return {
    useUserRoles: () => ({
      isLoading: false,
      isSystemAdmin: isSystemAdminValue,
    }),
  };
});

vi.mock("@/components/layout/AdminLayout", () => {
  return {
    AdminLayout: ({ children }: { children: any }) => <div>{children}</div>,
  };
});

vi.mock("@/components/group-navigation/GroupPageTop", () => {
  return {
    GroupPageTop: () => null,
  };
});

vi.mock("@/components/ui/select", () => {
  return {
    Select: ({ children }: { children: any }) => <div>{children}</div>,
    SelectGroup: ({ children }: { children: any }) => <div>{children}</div>,
    SelectTrigger: ({ children }: { children: any }) => <div>{children}</div>,
    SelectValue: () => null,
    SelectContent: ({ children }: { children: any }) => <div>{children}</div>,
    SelectLabel: ({ children }: { children: any }) => <div>{children}</div>,
    SelectItem: ({ children }: { children: any }) => <div>{children}</div>,
    SelectSeparator: () => <div />,
  };
});

vi.mock("@/components/ui/switch", () => {
  return {
    Switch: () => <div />,
  };
});

vi.mock("@/integrations/supabase/client", () => {
  return {
    supabase: {
      from: () => ({
        insert: insertEventMock,
      }),
    },
  };
});

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual<any>("@tanstack/react-query");

  const mockGroup = {
    id: "00000000-0000-4000-8000-000000000000",
    name: "Grupo Teste",
    description: "",
    status: "active",
    is_archived: false,
    metadata: {
      language: "pt-BR",
      timezone: "America/Sao_Paulo",
      operations: {
        summary_time: "08:00",
        frequency: "diária",
        privacy: "privada",
      },
      features: {},
    },
    organization_id: "00000000-0000-4000-8000-000000000001",
    invite_link: null,
    provider: "",
    sync_status: null,
    group_settings: {
      group_id: "00000000-0000-4000-8000-000000000000",
      welcome_message_enabled: false,
      audio_transcription_enabled: false,
      daily_summary_enabled: true,
      daily_summary_time: "08:00:00",
      daily_topics_enabled: true,
      peak_moment_enabled: false,
      polls_enabled: false,
      updated_at: new Date().toISOString(),
    },
  };

  initialGroupEditData = mockGroup;
  groupEditData = mockGroup;

  return {
    ...actual,
    useQuery: (opts: any) => {
      const key = Array.isArray(opts?.queryKey) ? opts.queryKey[0] : opts?.queryKey;
      if (key === "group-edit") {
        return { data: groupEditData, isLoading: false, error: null, refetch: refetchMock };
      }
      if (key === "group-members-count") {
        return { data: 0 };
      }
      if (key === "group-last-activity") {
        return { data: null };
      }
      return { data: undefined };
    },
    useMutation: () => ({ mutate: vi.fn(), isPending: false }),
    useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  };
});

describe("GroupEdit — ajustes de UI", () => {
  beforeEach(async () => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    refetchMock.mockReset();
    insertEventMock.mockClear();
    isSystemAdminValue = true;
    groupEditData = initialGroupEditData;
    GroupEditComponent = (await import("./GroupEdit")).default;
  });

  it("não quebra quando dados do grupo ainda não carregaram", async () => {
    groupEditData = undefined;
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <MemoryRouter
          initialEntries={["/groups/00000000-0000-4000-8000-000000000000/edit"]}
          future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        >
          <Routes>
            <Route path="/groups/:groupId/edit" element={<GroupEditComponent />} />
          </Routes>
        </MemoryRouter>,
      );
    });

    expect(container.textContent).toContain("Carregando");

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("mantém nome como somente leitura e remove Frequência/Privacidade", async () => {
    groupEditData = initialGroupEditData;
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <MemoryRouter
          initialEntries={["/groups/00000000-0000-4000-8000-000000000000/edit"]}
          future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        >
          <Routes>
            <Route path="/groups/:groupId/edit" element={<GroupEditComponent />} />
          </Routes>
        </MemoryRouter>
      );
    });

    expect(container.textContent).toContain("Nome do grupo");
    expect(container.textContent).not.toContain("Frequência");
    expect(container.textContent).not.toContain("Privacidade");

    const nameInput = container.querySelector('input[value="Grupo Teste"]') as HTMLInputElement | null;
    expect(nameInput).not.toBeNull();
    expect(nameInput?.readOnly).toBe(true);

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("bloqueia acesso para não-SYSTEM_ADMIN e registra evento", async () => {
    isSystemAdminValue = false;
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <MemoryRouter
          initialEntries={["/groups/00000000-0000-4000-8000-000000000000/edit"]}
          future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        >
          <Routes>
            <Route path="/groups/:groupId/edit" element={<GroupEditComponent />} />
          </Routes>
        </MemoryRouter>
      );
    });

    expect(container.textContent).toContain("Acesso restrito");
    expect(container.textContent).toContain("SYSTEM_ADMIN");
    expect(insertEventMock).toHaveBeenCalled();

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("mostra erros de validação e desabilita salvar para timezone/horário inválidos", async () => {
    groupEditData = {
      ...initialGroupEditData,
      metadata: {
        ...(initialGroupEditData?.metadata || {}),
        timezone: "Invalid/Timezone",
      },
      group_settings: {
        ...(initialGroupEditData?.group_settings || {}),
        daily_summary_time: "25:99:00",
      },
    };
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <MemoryRouter
          initialEntries={["/groups/00000000-0000-4000-8000-000000000000/edit"]}
          future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        >
          <Routes>
            <Route path="/groups/:groupId/edit" element={<GroupEditComponent />} />
          </Routes>
        </MemoryRouter>
      );
    });

    expect(container.textContent).toContain("Timezone inválido");
    expect(container.textContent).toContain("Horário inválido");

    const saveButton = Array.from(container.querySelectorAll("button")).find((b) => b.textContent?.includes("Salvar alterações"));
    expect(saveButton).toBeDefined();
    expect((saveButton as HTMLButtonElement).disabled).toBe(true);

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("preserva rascunho local após refetch parcial da query", async () => {
    groupEditData = {
      ...initialGroupEditData,
      description: "",
      invite_link: null,
    };

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    const renderPage = async () => {
      await act(async () => {
        root.render(
          <MemoryRouter
            initialEntries={["/groups/00000000-0000-4000-8000-000000000000/edit"]}
            future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
          >
            <Routes>
              <Route path="/groups/:groupId/edit" element={<GroupEditComponent />} />
            </Routes>
          </MemoryRouter>
        );
      });
    };

    await renderPage();

    const descriptionTextarea = container.querySelector("#group-description") as HTMLTextAreaElement | null;
    expect(descriptionTextarea).not.toBeNull();

    await act(async () => {
      setNativeValue(descriptionTextarea!, "Rascunho local");
      descriptionTextarea!.dispatchEvent(new Event("input", { bubbles: true }));
      descriptionTextarea!.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(descriptionTextarea?.value).toBe("Rascunho local");

    groupEditData = {
      ...groupEditData,
      invite_link: "https://chat.whatsapp.com/updated-on-server",
      sync_status: "ok",
    };

    await renderPage();

    const descriptionAfterRerender = container.querySelector("#group-description") as HTMLTextAreaElement | null;
    expect(descriptionAfterRerender?.value).toBe("Rascunho local");

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
