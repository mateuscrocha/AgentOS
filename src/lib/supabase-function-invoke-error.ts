import { FunctionsFetchError, FunctionsHttpError } from "@supabase/supabase-js";

export type InvokeErrorDetails = {
  message: string;
  code?: string;
  counts?: Record<string, number>;
};

export async function parseSupabaseFunctionInvokeError(err: any): Promise<InvokeErrorDetails> {
  let message = err?.message || "Algo deu errado. Tente novamente.";
  let code: string | undefined;
  let counts: Record<string, number> | undefined;

  if (err instanceof FunctionsHttpError && (err as any).context) {
    try {
      const body = await (err as any).context.json();
      if (body?.message) message = body.message;
      if (typeof body?.code === "string") code = body.code;
      if (body?.details?.counts && typeof body.details.counts === "object") counts = body.details.counts;
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

  return { message, code, counts };
}
