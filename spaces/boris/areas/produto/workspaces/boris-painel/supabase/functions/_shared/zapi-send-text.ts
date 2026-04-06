function readEnv(env: { get: (key: string) => string | undefined }, key: string): string {
  return String(env.get(key) || "").trim();
}

export class ZapiSendError extends Error {
  code: string;
  status?: number;

  constructor(args: { code: string; message: string; status?: number }) {
    super(args.message);
    this.code = args.code;
    this.status = args.status;
  }
}

export async function sendZapiText(args: {
  env: { get: (key: string) => string | undefined };
  phone: string;
  message: string;
  fetchImpl?: typeof fetch;
}) {
  const fetchImpl = args.fetchImpl ?? fetch;
  const zapiInstance = readEnv(args.env, "ZAPI_INSTANCE");
  const zapiToken = readEnv(args.env, "ZAPI_TOKEN");
  const zapiClientToken = readEnv(args.env, "ZAPI_CLIENT_TOKEN");
  const zapiBaseUrl = readEnv(args.env, "ZAPI_BASE_URL") || "https://api.z-api.io";

  if (!zapiInstance || !zapiToken || !zapiClientToken) {
    throw new ZapiSendError({
      code: "ZAPI_NOT_CONFIGURED",
      message: "Z-API não configurada",
    });
  }

  const response = await fetchImpl(
    `${zapiBaseUrl.replace(/\/+$/, "")}/instances/${encodeURIComponent(zapiInstance)}/token/${encodeURIComponent(zapiToken)}/send-text`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Client-Token": zapiClientToken,
      },
      body: JSON.stringify({
        phone: args.phone,
        message: args.message,
      }),
    }
  );

  const raw = await response.text().catch(() => "");
  let parsed: any = null;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    parsed = null;
  }

  if (!response.ok) {
    throw new ZapiSendError({
      code: "ZAPI_SEND_FAILED",
      message:
        (typeof parsed?.message === "string" && parsed.message.trim()) ||
        raw.trim() ||
        `Falha ao enviar mensagem via Z-API (HTTP ${response.status})`,
      status: response.status,
    });
  }

  return parsed;
}
