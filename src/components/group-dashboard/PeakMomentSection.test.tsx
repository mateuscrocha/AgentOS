import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const rpcMock = vi.fn();
const navigateMock = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<any>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock("@/integrations/supabase/client", () => {
  return {
    supabase: {
      rpc: (...args: any[]) => rpcMock(...args),
    },
  };
});

vi.mock("@/hooks/use-auth", () => {
  return {
    useAuth: () => ({ isAuthenticated: true }),
  };
});

vi.mock("@/components/ui/tooltip", () => {
  return {
    Tooltip: ({ children }: { children: any }) => <>{children}</>,
    TooltipTrigger: ({ children }: { children: any }) => <>{children}</>,
    TooltipContent: ({ children }: { children: any }) => <>{children}</>,
  };
});

vi.mock("@/components/messages/MessageDetailsDrawer", () => {
  return {
    MessageDetailsDrawer: ({ open, messageId }: { open: boolean; messageId: string | null }) => (
      <div data-testid="drawer" data-open={open ? "true" : "false"} data-message-id={messageId || ""} />
    ),
  };
});

describe("PeakMomentSection", () => {
  beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    rpcMock.mockReset();
    navigateMock.mockReset();
  });

  it("não exibe o bloco 'Como a conversa se desenrolou'", async () => {
    rpcMock.mockResolvedValue({
      data: {
        interval: {
          start_pico: "2026-01-07T13:00:00-03:00",
          end_pico: "2026-01-07T14:00:00-03:00",
        },
        kpis: {
          total_messages: 40,
          unique_participants: 5,
          intensity: 40,
        },
        top_terms: [],
        representative_messages: [
          {
            message_id: "m2",
            sender_name: "Bia",
            created_at: "2026-01-07T13:20:00-03:00",
            preview_text: "Checa isso aqui",
          },
          {
            message_id: "m1",
            sender_name: "Ana",
            created_at: "2026-01-07T13:05:00-03:00",
            preview_text: "Alguém sabe como fazer?",
          },
          {
            message_id: "m3",
            sender_name: "Caio",
            created_at: "2026-01-07T13:55:00-03:00",
            preview_text: "Boa! Funcionou pra mim.",
          },
        ],
        summary: null,
      },
      error: null,
    });

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    const { PeakMomentSection } = await import("./PeakMomentSection");

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <PeakMomentSection
            groupId="00000000-0000-4000-8000-000000000000"
            startDate={new Date("2026-01-01T00:00:00-03:00")}
            endDate={new Date("2026-01-08T00:00:00-03:00")}
            messagesPerDay={[{ date: "2026-01-06", count: 60 }]}
            isDashboardLoading={false}
          />
        </QueryClientProvider>,
      );
    });

    await act(async () => {
      await Promise.resolve();
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(container.textContent).toContain("Momento de Pico");
    expect(container.textContent).toContain("40 mensagens em 1 hora");
    expect(container.textContent).not.toContain("Como a conversa se desenrolou");
    expect(container.textContent).not.toContain("Insight");
    expect(container.textContent).not.toContain("Ver mais mensagens desse momento");

    await act(async () => {
      root.unmount();
    });

    container.remove();
  });

  it("não exibe bubbles nem abre drawer", async () => {
    rpcMock.mockResolvedValue({
      data: {
        interval: {
          start_pico: "2026-01-07T13:00:00-03:00",
          end_pico: "2026-01-07T14:00:00-03:00",
        },
        kpis: {
          total_messages: 40,
          unique_participants: 5,
          intensity: 40,
        },
        top_terms: [],
        representative_messages: [
          {
            message_id: "m1",
            sender_name: "Ana",
            created_at: "2026-01-07T13:05:00-03:00",
            preview_text: "Alguém sabe como fazer?",
          },
        ],
        summary: null,
      },
      error: null,
    });

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    const { PeakMomentSection } = await import("./PeakMomentSection");

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <PeakMomentSection
            groupId="00000000-0000-4000-8000-000000000000"
            startDate={new Date("2026-01-01T00:00:00-03:00")}
            endDate={new Date("2026-01-08T00:00:00-03:00")}
            messagesPerDay={[]}
            isDashboardLoading={false}
          />
        </QueryClientProvider>,
      );
    });

    await act(async () => {
      await Promise.resolve();
      await new Promise((r) => setTimeout(r, 0));
    });

    const bubble = container.querySelector("div.bg-emerald-50");
    expect(bubble).toBeFalsy();

    const btn = container.querySelector('button[aria-label="Ver no contexto"]') as HTMLButtonElement | null;
    expect(btn).toBeFalsy();

    await act(async () => {
      root.unmount();
    });

    container.remove();
  });

  it("não exibe CTA de navegação para mensagens do pico", async () => {
    rpcMock.mockResolvedValue({
      data: {
        interval: {
          start_pico: "2026-01-07T13:00:00-03:00",
          end_pico: "2026-01-07T14:00:00-03:00",
        },
        kpis: {
          total_messages: 40,
          unique_participants: 5,
          intensity: 40,
        },
        top_terms: [],
        representative_messages: [
          {
            message_id: "m1",
            sender_name: "Ana",
            created_at: "2026-01-07T13:05:00-03:00",
            preview_text: "Alguém sabe como fazer?",
          },
        ],
        summary: null,
      },
      error: null,
    });

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    const { PeakMomentSection } = await import("./PeakMomentSection");

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <PeakMomentSection
            groupId="00000000-0000-4000-8000-000000000000"
            startDate={new Date("2026-01-01T00:00:00-03:00")}
            endDate={new Date("2026-01-08T00:00:00-03:00")}
            messagesPerDay={[]}
            isDashboardLoading={false}
          />
        </QueryClientProvider>,
      );
    });

    await act(async () => {
      await Promise.resolve();
      await new Promise((r) => setTimeout(r, 0));
    });

    const cta = Array.from(container.querySelectorAll("button")).find((b) =>
      (b.textContent || "").includes("Ver mais mensagens desse momento"),
    );
    expect(cta).toBeFalsy();
    expect(navigateMock).not.toHaveBeenCalled();

    await act(async () => {
      root.unmount();
    });

    container.remove();
  });
});
