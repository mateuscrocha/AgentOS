import { createClient } from "npm:@supabase/supabase-js@2.88.0";
import { createOpenAiTextResponse } from "../supabase/functions/_shared/openai-responses.ts";
import { GROUP_SUMMARY_FULL_PROMPT } from "../supabase/functions/_shared/group-ai-prompts.ts";

const groupId = Deno.env.get("GROUP_ID") || "";
const summaryDate = Deno.env.get("SUMMARY_DATE") || "";

if (!groupId || !summaryDate) {
  console.error("Missing GROUP_ID or SUMMARY_DATE");
  Deno.exit(1);
}

const supabaseUrl = Deno.env.get("SUPABASE_URL") || Deno.env.get("VITE_SUPABASE_URL") || "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const openAiApiKey = Deno.env.get("OPENAI_API_KEY") || "";

if (!supabaseUrl || !serviceRoleKey || !openAiApiKey) {
  console.error("Missing SUPABASE_URL/VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or OPENAI_API_KEY");
  Deno.exit(1);
}

function saoPauloDateTimeToUtc(dateKey: string, time: string) {
  return new Date(`${dateKey}T${time}-03:00`);
}

function normalizeMessage(row: any) {
  const text = String(row?.text || row?.content || row?.media_caption || "").trim();
  return {
    timestamp: row?.message_created_at || row?.message_ts || null,
    sender: row?.display_name || row?.member_name || row?.sender_name || row?.phone_e164 || "Membro",
    text,
  };
}

function sortMessagesNewestFirst(rows: any[]) {
  return [...rows].sort((a, b) => String(b?.timestamp || "").localeCompare(String(a?.timestamp || "")));
}

function formatWhatsappSummary(text: string) {
  let formatted = String(text || "").replace(/#+\s*/g, "");
  formatted = formatted.replace(/\*\*(.*?)\*\*/g, "*$1*");
  return formatted.trim();
}

function cleanupGeneratedSummary(text: string) {
  let cleaned = formatWhatsappSummary(text);
  const lines = cleaned.split("\n");

  while (lines.length > 0 && !lines[lines.length - 1].trim()) {
    lines.pop();
  }

  const genericClosers = [
    /^esse (resumo|registro|apanhado|texto|conteudo|conteúdo)/i,
    /^esse foi/i,
    /^esses foram/i,
    /^fiquem atentos/i,
    /^se algu[eé]m tiver/i,
    /^o papo /i,
    /^a energia /i,
    /^sigamos nesse ritmo/i,
    /^vamos (seguir|pra cima)/i,
  ];

  while (lines.length > 0) {
    const last = lines[lines.length - 1].trim();
    if (!last) {
      lines.pop();
      continue;
    }
    if (genericClosers.some((pattern) => pattern.test(last))) {
      lines.pop();
      continue;
    }
    break;
  }

  return lines.join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\n[ \t]*🔗 \*(Informações adicionais|Conteúdos compartilhados|Links e conteúdos úteis|Links Compartilhados)\*:[ \t]*\n[ \t]*(Nenhum link|Não houve links)[^]*$/i, "")
    .replace(/\n[ \t]*🌐 \*(Informações adicionais|Conteúdos compartilhados|Links e conteúdos úteis|Links Compartilhados)\*:[ \t]*\n[ \t]*- \(?(Nenhum link|Não houve links)[^]*$/i, "")
    .trim();
}

function renderFullPrompt(messagesJson: string, groupName: string, groupDescription: string, summaryDate: string) {
  return GROUP_SUMMARY_FULL_PROMPT
    .replace("{{SUMMARY_DATE}}", summaryDate)
    .replace("{{ $('Aggregate Last 24 hours Messages').item.json.data.toJsonString().substring(0,250000) }}", messagesJson)
    .replace("{{ $('Workflow Variables').item.json.group_name }}", groupName)
    .replace("{{ $('Workflow Variables').item.json.group_description }}", groupDescription);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);
const endDate = saoPauloDateTimeToUtc(summaryDate, "23:59:59");
const start24 = new Date(endDate.getTime() - 24 * 60 * 60 * 1000);

const { data: group, error: groupError } = await supabase
  .from("groups")
  .select("id, name, description")
  .eq("id", groupId)
  .maybeSingle();

if (groupError || !group) {
  console.error(JSON.stringify({ groupError: groupError?.message || "Group not found" }, null, 2));
  Deno.exit(1);
}

const { data: messages, error: messagesError } = await supabase
  .from("v_messages_with_members")
  .select("group_id, message_created_at, message_ts, text, content, media_caption, display_name, member_name, sender_name, phone_e164")
  .eq("group_id", groupId)
  .gte("message_created_at", start24.toISOString())
  .lte("message_created_at", endDate.toISOString())
  .order("message_created_at", { ascending: false });

if (messagesError) {
  console.error(JSON.stringify({ messagesError: messagesError.message }, null, 2));
  Deno.exit(1);
}

const normalized = sortMessagesNewestFirst((messages ?? []).map(normalizeMessage));
const prompt = renderFullPrompt(
  JSON.stringify(normalized).slice(0, 250000),
  String(group.name || ""),
  String(group.description || ""),
  summaryDate,
);

const ai = await createOpenAiTextResponse({
  apiKey: openAiApiKey,
  model: "gpt-4o-mini",
  input: prompt,
});

console.log(JSON.stringify({
  groupId,
  groupName: group.name,
  summaryDate,
  messageCount: normalized.length,
  summary: cleanupGeneratedSummary(ai.outputText),
}, null, 2));
