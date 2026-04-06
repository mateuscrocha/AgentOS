import { createClient } from "@supabase/supabase-js";

const GROUP_ID = "169296ea-fdb7-457f-8c3f-9a7be66d5db9";
const TARGET_DATE = "2026-03-26";

function requireEnv(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error(`Env ausente: ${name}`);
  return value;
}

function toTimestampMs(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value > 1_000_000_000_000 ? value : value * 1000;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function parseJsonArray(text) {
  const raw = String(text || "").trim();
  const candidates = [raw];
  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");
  if (start >= 0 && end > start) {
    candidates.push(raw.slice(start, end + 1));
  }

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      // try next candidate
    }
  }

  return [];
}

function normalizeTopicDescription(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeTopicTitle(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

async function createOpenAiTextResponse({ apiKey, model, input }) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, input }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error?.message || `OpenAI falhou (${response.status})`);
  }

  const direct = String(payload?.output_text || "").trim();
  if (direct) return direct;

  const output = Array.isArray(payload?.output) ? payload.output : [];
  const parts = [];
  for (const item of output) {
    if (item?.type !== "message") continue;
    const content = Array.isArray(item?.content) ? item.content : [];
    for (const block of content) {
      if (block?.type === "output_text" && typeof block.text === "string") {
        parts.push(block.text);
      }
    }
  }
  const text = parts.join("\n").trim();
  if (!text) throw new Error("OpenAI não retornou texto");
  return text;
}

const TOPICS_PROMPT = `Você é um assistente especialista em análise de grupos de WhatsApp.

Entrada:
1. Descrição do grupo.
2. Mensagens das últimas 24 horas.

Tarefa:
- Encontre os 5 assuntos mais debatidos.
- Classifique cada item no formato "<Dor|Desejo|Objeção>: Título resumido".
- A descrição deve ter entre 60 e 120 palavras, em linguagem impessoal, sem nomes e sem telefones.

Responda somente com JSON válido:
[
  {
    "topic": "<Dor|Desejo|Objeção>: Título resumido 1",
    "description": "Texto com 60-120 palavras."
  }
]

Descrição do grupo:
{{GROUP_DESCRIPTION}}

Mensagens:
{{MESSAGES_JSON}}`;

const KEYWORDS_PROMPT = `Você é um assistente especialista em análise de grupos de WhatsApp.

Sua tarefa é listar até 10 palavras-chave que resumem os assuntos do dia, alinhadas à descrição do grupo.

Responda somente com JSON válido:
[
  "palavra-chave 1",
  "palavra-chave 2"
]

Descrição do grupo:
{{GROUP_DESCRIPTION}}

Mensagens:
{{MESSAGES_JSON}}`;

async function main() {
  const supabaseUrl = requireEnv("VITE_SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const openAiApiKey = requireEnv("OPENAI_API_KEY");

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: group, error: groupError } = await supabase
    .from("groups")
    .select("id, name, description")
    .eq("id", GROUP_ID)
    .maybeSingle();

  if (groupError) throw groupError;
  if (!group?.id) throw new Error("Grupo não encontrado");

  const endDate = new Date(`${TARGET_DATE}T23:59:59-03:00`);
  const start24 = new Date(endDate.getTime() - 24 * 60 * 60 * 1000);

  const { data: messagesData, error: messagesError } = await supabase
    .from("v_messages_with_members")
    .select("message_created_at, message_ts, text, content, media_caption, display_name, member_name, sender_name, phone_e164")
    .eq("group_id", GROUP_ID)
    .gte("message_created_at", start24.toISOString())
    .lte("message_created_at", endDate.toISOString())
    .order("message_created_at", { ascending: true });

  if (messagesError) throw messagesError;

  const messages = (messagesData || [])
    .map((row) => ({
      timestamp: row?.message_created_at || row?.message_ts || null,
      sender: row?.display_name || row?.member_name || row?.sender_name || row?.phone_e164 || "Membro",
      text: String(row?.text || row?.content || row?.media_caption || "").trim(),
    }))
    .filter((item) => item.text);

  if (!messages.length) {
    throw new Error("Nenhuma mensagem encontrada para o período");
  }

  const groupDescription = String(group.description || "");
  const messagesJson = JSON.stringify(messages);

  const [topicsRaw, keywordsRaw] = await Promise.all([
    createOpenAiTextResponse({
      apiKey: openAiApiKey,
      model: "gpt-4o",
      input: TOPICS_PROMPT.replace("{{GROUP_DESCRIPTION}}", groupDescription).replace("{{MESSAGES_JSON}}", messagesJson),
    }),
    createOpenAiTextResponse({
      apiKey: openAiApiKey,
      model: "gpt-4o",
      input: KEYWORDS_PROMPT.replace("{{GROUP_DESCRIPTION}}", groupDescription).replace("{{MESSAGES_JSON}}", messagesJson),
    }),
  ]);

  const topicsParsed = parseJsonArray(topicsRaw)
    .filter((item) => item && typeof item === "object")
    .slice(0, 5)
    .map((item, index) => ({
      group_id: GROUP_ID,
      topic_date: TARGET_DATE,
      rank: index + 1,
      title: normalizeTopicTitle(item.topic || item.title || ""),
      content: normalizeTopicDescription(item.description || item.content || ""),
    }))
    .filter((item) => item.title && item.content);

  const keywordsParsed = parseJsonArray(keywordsRaw)
    .filter((item) => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 10)
    .map((keyword, index) => ({
      group_id: GROUP_ID,
      keyword_date: TARGET_DATE,
      keyword,
      rank: index + 1,
      mentions_count: 0,
      messages_count: 0,
      participants_count: 0,
    }));

  const [{ error: deleteTopicsError }, { error: deleteKeywordsError }] = await Promise.all([
    supabase.from("group_daily_topics").delete().eq("group_id", GROUP_ID).eq("topic_date", TARGET_DATE),
    supabase.from("group_daily_keywords").delete().eq("group_id", GROUP_ID).eq("keyword_date", TARGET_DATE),
  ]);

  if (deleteTopicsError) throw deleteTopicsError;
  if (deleteKeywordsError) throw deleteKeywordsError;

  if (topicsParsed.length) {
    const { error } = await supabase.from("group_daily_topics").insert(topicsParsed);
    if (error) throw error;
  }

  if (keywordsParsed.length) {
    const { error } = await supabase.from("group_daily_keywords").insert(keywordsParsed);
    if (error) throw error;
  }

  console.log(JSON.stringify({
    success: true,
    groupId: GROUP_ID,
    targetDate: TARGET_DATE,
    topicsCount: topicsParsed.length,
    keywordsCount: keywordsParsed.length,
    firstTopic: topicsParsed[0]?.title || null,
    firstKeyword: keywordsParsed[0]?.keyword || null,
    topicsRawPreview: topicsRaw.slice(0, 220),
    keywordsRawPreview: keywordsRaw.slice(0, 220),
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
