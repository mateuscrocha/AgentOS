export function getString(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

export function asNoonUTCFromDateOnly(dateOnly: string): string {
  const raw = (dateOnly || "").trim();
  if (!raw) return raw;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return `${raw}T12:00:00.000Z`;
  return raw;
}

export function dateKey(value: unknown): string {
  if (typeof value === "string") {
    const m = value.match(/\d{4}-\d{2}-\d{2}/);
    return m?.[0] ?? value.trim();
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  return getString(value);
}

export function normalizeWhitespace(input: string): string {
  return (input || "").replace(/\s+/g, " ").trim();
}

export function stripEmojis(input: string): string {
  const raw = (input || "").toString();
  return raw.replace(/\u200D|\uFE0F/g, "").replace(/\p{Extended_Pictographic}/gu, "");
}

export function cleanPreviewText(input: string): string {
  const raw = (input || "").toString();
  const withoutCodeBlocks = raw.replace(/```[\s\S]*?```/g, " ");
  const lines = withoutCodeBlocks
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(?:[-•]|\d+\.)\s+/, "").trim())
    .filter(Boolean);
  const joined = lines.join(" ");
  const withoutUrls = joined.replace(/https?:\/\/[^\s)\]}>,]+/gi, " ");
  const withoutMarkers = withoutUrls.replace(/[*_~`]+/g, " ");
  const withoutEmojis = stripEmojis(withoutMarkers);
  return normalizeWhitespace(withoutEmojis);
}

export function pickPreviewText(text: string): string {
  const normalized = cleanPreviewText(text);
  if (!normalized) return "";
  const min = 180;
  const max = 220;
  if (normalized.length <= max) return normalized;

  const window = normalized.slice(0, max + 1);
  let cut = -1;
  for (let i = Math.min(window.length - 1, max); i >= min; i--) {
    const ch = window[i];
    if (ch === "." || ch === "!" || ch === "?" || ch === "…") {
      cut = i + 1;
      break;
    }
  }

  if (cut === -1) {
    cut = max;
    const sliced = normalized.slice(0, cut);
    return sliced.replace(/\s+\S*$/, "").trimEnd() + "…";
  }

  return normalized.slice(0, cut).trimEnd() + "…";
}

export function pickTopicPreview(text: string): string {
  const normalized = cleanPreviewText(text);
  if (!normalized) return "";
  const max = 160;
  if (normalized.length <= max) return normalized;
  const sliced = normalized.slice(0, max);
  return sliced.replace(/\s+\S*$/, "").trimEnd() + "…";
}

export function joinHumanList(items: string[]): string {
  const clean = items.map((s) => normalizeWhitespace(s)).filter(Boolean);
  if (clean.length === 0) return "";
  if (clean.length === 1) return clean[0];
  if (clean.length === 2) return `${clean[0]} e ${clean[1]}`;
  return `${clean.slice(0, -1).join(", ")} e ${clean[clean.length - 1]}`;
}

export function pickHumanDaySummary(
  topics: Array<{ title?: string | null }> = [],
  keywords: Array<{ keyword?: string | null }> = [],
): string {
  const titles = Array.from(
    new Set(
      (topics || [])
        .map((t) => cleanInlineLabel(t.title || ""))
        .filter(Boolean)
        .slice(0, 3),
    ),
  ).slice(0, 2);

  if (titles.length > 0) {
    return `O dia girou em torno de ${joinHumanList(titles)}.`;
  }

  const terms = Array.from(
    new Set(
      (keywords || [])
        .map((kw) => cleanInlineLabel(kw.keyword || ""))
        .filter(Boolean)
        .slice(0, 3),
    ),
  );

  if (terms.length > 0) {
    return `O dia girou em torno de ${joinHumanList(terms)}.`;
  }

  return "Dia com conversas variadas entre os membros.";
}

export function cleanInlineLabel(input: string): string {
  return normalizeWhitespace(stripEmojis(input));
}

export function countLinks(text: string): number {
  const raw = (text || "").toString();
  const matches = raw.match(/https?:\/\/[^\s)\]}>,]+/gi);
  return matches?.length ?? 0;
}

export type TopicKind = "dor" | "desejo" | "tema";

export function classifyTopic(topic: { title?: string | null; content?: string | null }): TopicKind {
  const hay = `${topic.title || ""} ${topic.content || ""}`.toLowerCase();

  const isPain =
    /\b(dor|dores|problema|problemas|reclama|reclamação|reclamações|dificuldade|dificuldades|bug|erro|erros|falha|falhas)\b/i.test(
      hay,
    );
  if (isPain) return "dor";

  const isDesire =
    /\b(desejo|quer|querem|queria|queriam|gostaria|gostariam|oportunidade|oportunidades|melhoria|melhorias)\b/i.test(
      hay,
    );
  if (isDesire) return "desejo";

  return "tema";
}

export function isObjectionTopic(topic: { title?: string | null; content?: string | null }): boolean {
  const hay = `${topic.title || ""} ${topic.content || ""}`.toLowerCase();
  return /\b(objeção|objeções|resistência|resistências|discorda|discordam|discordância|contra|contrário|não quero|não queremos|não gostei|não gostam)\b/i.test(
    hay,
  );
}

export function formatCount(value: number, singular: string, plural: string): string {
  return `${value} ${value === 1 ? singular : plural}`;
}

export function getIntensityLevel(total: number): { level: 1 | 2 | 3; label: string } {
  if (total >= 12) return { level: 3, label: "Alta" };
  if (total >= 6) return { level: 2, label: "Média" };
  return { level: 1, label: "Baixa" };
}

export function toPlainText(text: string): string {
  const raw = (text || "").toString();
  const withoutCodeBlocks = raw.replace(/```[\s\S]*?```/g, " ");
  const withoutInlineCode = withoutCodeBlocks.replace(/`([^`]+?)`/g, "$1");
  const withoutMarkers = withoutInlineCode.replace(/[*_~]+/g, "");
  return withoutMarkers.replace(/\r\n/g, "\n").trim();
}

export function getGroupSummariesErrorCopy(
  error: unknown,
): { title: string; message: string; isAccessDenied?: boolean } {
  const anyErr = error as any;
  const code = getString(anyErr?.code);
  const msg = getString(anyErr?.message);
  const lower = msg.toLowerCase();

  const isAccessDenied =
    code === "PGRST301" ||
    code === "42501" ||
    code === "401" ||
    code === "403" ||
    lower.includes("permission") ||
    lower.includes("not authorized") ||
    lower.includes("jwt") ||
    lower.includes("unauthorized");

  if (isAccessDenied) {
    return {
      title: "Acesso negado",
      message: "Você não tem permissão para acessar as conversas deste grupo.",
      isAccessDenied: true,
    };
  }

  const isSchema =
    code === "42P01" ||
    code === "42703" ||
    code === "PGRST204" ||
    lower.includes("does not exist") ||
    lower.includes("relation") ||
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

  return {
    title: "Não foi possível carregar as conversas",
    message: "Tente novamente.",
  };
}
