import { MalformedResponseError, TimeoutError } from "./polls-request-utils";

type Copy = { title: string; message: string };

const getString = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));

export function getGroupPollsErrorCopy(error: unknown): Copy {
  if (error instanceof TimeoutError) {
    return {
      title: "Tempo limite excedido",
      message: "A requisição demorou mais do que o esperado. Tente novamente.",
    };
  }

  if (error instanceof MalformedResponseError) {
    return {
      title: "Resposta inesperada",
      message: "O servidor retornou dados fora do formato esperado. Tente novamente.",
    };
  }

  const anyErr = error as any;
  const code = getString(anyErr?.code);
  const msg = getString(anyErr?.message);

  if (code === "PGRST301" || msg.toLowerCase().includes("permission")) {
    return {
      title: "Acesso negado",
      message: "Você não tem permissão para acessar as enquetes deste grupo.",
    };
  }

  const lower = msg.toLowerCase();
  const isSchema =
    code === "42703" ||
    code === "PGRST204" ||
    lower.includes("does not exist") ||
    lower.includes("column") ||
    lower.includes("schema");

  if (isSchema) {
    return {
      title: "Atualização pendente",
      message: "O servidor ainda não está atualizado para esta versão. Tente novamente em instantes.",
    };
  }

  const isNetwork =
    lower.includes("failed to fetch") ||
    lower.includes("networkerror") ||
    lower.includes("fetch failed") ||
    lower.includes("load failed");

  if (isNetwork) {
    return {
      title: "Falha de conexão",
      message: "Não foi possível conectar ao servidor. Verifique sua internet e tente novamente.",
    };
  }

  if (getString(anyErr?.name) === "AbortError") {
    return {
      title: "Requisição cancelada",
      message: "A requisição foi interrompida. Tente novamente.",
    };
  }

  return {
    title: "Não foi possível carregar as enquetes",
    message: "Tente novamente.",
  };
}
