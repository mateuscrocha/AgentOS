export class OpenAiResponsesError extends Error {
  code: string;
  status?: number;
  body?: string;

  constructor(args: { code: string; message: string; status?: number; body?: string }) {
    super(args.message);
    this.code = args.code;
    this.status = args.status;
    this.body = args.body;
  }
}

function truncateText(text: string, limit = 2000) {
  return text.length > limit ? `${text.slice(0, limit)}…` : text;
}

function extractOutputText(payload: any): string {
  const direct = String(payload?.output_text || "").trim();
  if (direct) return direct;

  const output = Array.isArray(payload?.output) ? payload.output : [];
  const parts: string[] = [];

  for (const item of output) {
    if (item?.type !== "message") continue;
    const content = Array.isArray(item?.content) ? item.content : [];
    for (const block of content) {
      if (block?.type === "output_text" && typeof block.text === "string") {
        parts.push(block.text);
      }
    }
  }

  return parts.join("\n").trim();
}

export async function createOpenAiTextResponse(args: {
  apiKey: string;
  model: string;
  input: string;
  fetchImpl?: typeof fetch;
  instructions?: string;
  timeoutMs?: number;
}) {
  const fetchImpl = args.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), args.timeoutMs ?? 30_000);

  try {
    const res = await fetchImpl("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${args.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: args.model,
        instructions: args.instructions,
        input: args.input,
      }),
      signal: controller.signal,
    });

    const raw = await res.text().catch(() => "");
    const bodyText = truncateText(raw || "");
    let parsed: any = null;
    try {
      parsed = raw ? JSON.parse(raw) : null;
    } catch {
      parsed = null;
    }

    if (!res.ok) {
      throw new OpenAiResponsesError({
        code: res.status === 401 || res.status === 403 ? "OPENAI_AUTH_FAILED" : "OPENAI_RESPONSES_FAILED",
        message: `OpenAI Responses retornou erro (HTTP ${res.status} ${res.statusText})`,
        status: res.status,
        body: bodyText,
      });
    }

    const outputText = extractOutputText(parsed);
    if (!outputText) {
      throw new OpenAiResponsesError({
        code: "OPENAI_RESPONSE_INVALID",
        message: "OpenAI Responses não retornou texto",
        status: res.status,
        body: bodyText,
      });
    }

    return {
      outputText,
      raw: parsed,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}
