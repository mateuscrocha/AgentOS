import { FunctionsFetchError, FunctionsHttpError } from "@supabase/supabase-js";

export type InvokeErrorDetails = {
  message: string;
  code?: string;
  counts?: Record<string, number>;
  debugShape?: unknown;
  debugPayload?: unknown;
};

export function getFriendlyValidateGroupMessage(details: Pick<InvokeErrorDetails, "code" | "message">) {
  if (details.code === "GROUP_METADATA_FORBIDDEN") {
    return "Encontramos o grupo, mas o Bóris ainda não está nele. Adicione o Bóris ao grupo e tente novamente em instantes.";
  }

  if (details.code === "BORIS_NOT_IN_GROUP") {
    return "O Bóris ainda não está nesse grupo. Adicione o Bóris ao grupo, gere um novo link de convite e tente novamente.";
  }

  if (details.code === "INVALID_GROUP") {
    return "Não conseguimos validar esse grupo. Revise o link do convite e tente novamente.";
  }

  if (details.code === "VALIDATION_TIMEOUT") {
    return "A validação do grupo demorou mais do que o esperado. Tente novamente em instantes.";
  }

  return details.message;
}

export async function parseSupabaseFunctionInvokeError(err: any): Promise<InvokeErrorDetails> {
  let message = err?.message || "Algo deu errado. Tente novamente.";
  let code: string | undefined;
  let counts: Record<string, number> | undefined;
  let debugShape: unknown;
  let debugPayload: unknown;

  if (err instanceof FunctionsHttpError && (err as any).context) {
    try {
      const body = await (err as any).context.json();
      if (body?.message) message = body.message;
      if (typeof body?.code === "string") code = body.code;
      if (body?.details?.counts && typeof body.details.counts === "object") counts = body.details.counts;
      if ("debug_shape" in (body || {})) debugShape = body.debug_shape;
      if ("debug_payload" in (body || {})) debugPayload = body.debug_payload;
    } catch {
      void 0;
    }
  }

  const isFetchError =
    err instanceof FunctionsFetchError ||
    err?.name === "FunctionsFetchError" ||
    /failed to send a request to the edge function/i.test(message) ||
    /fetch failed/i.test(message) ||
    /networkerror/i.test(message);

  if (!code && isFetchError) {
    const isOffline = typeof navigator !== "undefined" && navigator?.onLine === false;
    code = "NETWORK_ERROR";
    message = isOffline
      ? "Sem conexão com a internet."
      : "Não foi possível comunicar com o servidor. Verifique sua conexão/VPN e tente novamente.";
  }

  return { message, code, counts, debugShape, debugPayload };
}
