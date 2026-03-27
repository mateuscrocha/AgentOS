import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import {
  DEFAULT_GROUP_AI_PROMPTS,
  GROUP_AI_PROMPT_KEYS,
  loadGroupAiPrompts,
} from "../_shared/group-ai-prompts.ts";
import { createOpenAiTextResponse, OpenAiResponsesError } from "../_shared/openai-responses.ts";

const DenoRef = (globalThis as any).Deno;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SAO_PAULO_OFFSET_MS = 3 * 60 * 60 * 1000;

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function readEnv(env: { get: (key: string) => string | undefined }, key: string): string {
  return String(env.get(key) || "").trim();
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value || "");
}

function toSaoPauloShifted(date: Date) {
  return new Date(date.getTime() - SAO_PAULO_OFFSET_MS);
}

function getSaoPauloDateKey(date: Date) {
  return toSaoPauloShifted(date).toISOString().slice(0, 10);
}

function normalizeMessage(row: any) {
  const text = String(row?.text || row?.content || row?.media_caption || "").trim();
  return {
    timestamp: row?.message_created_at || row?.message_ts || null,
    sender: row?.display_name || row?.member_name || row?.sender_name || row?.phone_e164 || "Membro",
    text,
  };
}

function renderPrompt(template: string, context: Record<string, string>) {
  let output = template;
  for (const [key, value] of Object.entries(context)) {
    output = output.split(key).join(value);
  }
  return output;
}

function parseJsonArray(text: string) {
  const trimmed = String(text || "").trim();
  try {
    const parsed = JSON.parse(trimmed);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function isGroupPaused(group: { is_active?: boolean | null; status?: string | null }) {
  if (group.is_active === false) return true;
  return String(group.status || "").trim().toLowerCase() === "inactive";
}

async function resolveAuth(args: {
  req: Request;
  env: { get: (key: string) => string | undefined };
  createClientImpl: typeof createClient;
  groupId: string;
}) {
  const { req, env, createClientImpl, groupId } = args;
  const inboundApiKey = readEnv(env, "GROUP_AI_CRON_API_KEY");
  const providedApiKey = String(req.headers.get("x-api-key") || "").trim();
  if (inboundApiKey && providedApiKey && providedApiKey === inboundApiKey) {
    return { mode: "api_key" as const };
  }

  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return { mode: "unauthorized" as const };

  const supabaseUrl = readEnv(env, "SUPABASE_URL");
  const supabaseAnonKey = readEnv(env, "SUPABASE_ANON_KEY");
  if (!supabaseUrl || !supabaseAnonKey) return { mode: "config_error" as const };

  const supabaseUser = createClientImpl(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userError } = await supabaseUser.auth.getUser();
  if (userError || !userData?.user?.id) return { mode: "unauthorized" as const };

  const requesterId = String(userData.user.id);
  const { data: isAdmin } = await (supabaseUser as any).rpc("is_system_admin", { _user_id: requesterId });
  if (isAdmin) return { mode: "user" as const };

  const { data: canEdit } = await (supabaseUser as any).rpc("can_edit_group", {
    _user_id: requesterId,
    _group_id: groupId,
  });

  return { mode: canEdit ? ("user" as const) : ("forbidden" as const) };
}

type Deps = {
  createClientImpl?: typeof createClient;
  env?: { get: (key: string) => string | undefined };
  fetchImpl?: typeof fetch;
  now?: () => Date;
};

export function createGenerateGroupTopicsKeywordsHandler(deps: Deps = {}) {
  const createClientImpl = deps.createClientImpl ?? createClient;
  const env = deps.env ?? DenoRef.env;
  const fetchImpl = deps.fetchImpl ?? fetch;
  const now = deps.now ?? (() => new Date());

  return async (req: Request) => {
    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      if (req.method !== "POST") {
        return json({ success: false, code: "METHOD_NOT_ALLOWED", message: "Method Not Allowed" }, 405);
      }

      const body = await req.json().catch(() => null) as {
        groupId?: string;
        targetDate?: string;
      } | null;

      const groupId = String(body?.groupId || "").trim();
      const targetDate = String(body?.targetDate || "").trim() || getSaoPauloDateKey(now());
      if (!isUuid(groupId)) {
        return json({ success: false, code: "VALIDATION_ERROR", message: "groupId inválido" }, 400);
      }

      const auth = await resolveAuth({ req, env, createClientImpl, groupId });
      if (auth.mode === "config_error") return json({ success: false, code: "SUPABASE_NOT_CONFIGURED", message: "Supabase não configurado" }, 500);
      if (auth.mode === "unauthorized") return json({ success: false, code: "UNAUTHORIZED", message: "Unauthorized" }, 401);
      if (auth.mode === "forbidden") return json({ success: false, code: "FORBIDDEN", message: "Forbidden" }, 403);

      const supabaseUrl = readEnv(env, "SUPABASE_URL");
      const serviceRoleKey = readEnv(env, "SUPABASE_SERVICE_ROLE_KEY");
      const openAiApiKey = readEnv(env, "OPENAI_API_KEY");
      if (!supabaseUrl || !serviceRoleKey) return json({ success: false, code: "SUPABASE_NOT_CONFIGURED", message: "Supabase não configurado" }, 500);
      if (!openAiApiKey) return json({ success: false, code: "OPENAI_NOT_CONFIGURED", message: "OpenAI não configurada" }, 500);

      const supabase = createClientImpl(supabaseUrl, serviceRoleKey);
      const { data: group, error: groupError } = await supabase
        .from("groups")
        .select("id, name, description, is_active, status")
        .eq("id", groupId)
        .maybeSingle();

      if (groupError) return json({ success: false, code: "GROUP_LOOKUP_FAILED", message: groupError.message }, 500);
      if (!group?.id) return json({ success: false, code: "GROUP_NOT_FOUND", message: "Grupo não encontrado" }, 404);
      if (isGroupPaused(group)) {
        return json({
          success: true,
          skipped: true,
          code: "GROUP_PAUSED",
          message: "Grupo pausado. Tópicos e keywords não gerados.",
          groupId,
          targetDate,
          topics: [],
          keywords: [],
        });
      }

      const currentNow = now();
      const currentDateKey = getSaoPauloDateKey(currentNow);
      const endDate = targetDate === currentDateKey ? currentNow : new Date(`${targetDate}T23:59:59-03:00`);
      const start24 = new Date(endDate.getTime() - 24 * 60 * 60 * 1000);

      const { data: messagesData, error: messagesError } = await (supabase as any)
        .from("v_messages_with_members")
        .select("message_created_at, message_ts, text, content, media_caption, display_name, member_name, sender_name, phone_e164")
        .eq("group_id", groupId)
        .gte("message_created_at", start24.toISOString())
        .lte("message_created_at", endDate.toISOString())
        .order("message_created_at", { ascending: true });

      if (messagesError) return json({ success: false, code: "MESSAGES_LOOKUP_FAILED", message: messagesError.message }, 500);

      const messages = (messagesData ?? []).map(normalizeMessage).filter((item: { text: string }) => item.text);
      if (messages.length === 0) {
        return json({
          success: true,
          groupId,
          targetDate,
          topics: [],
          keywords: [],
          skipped: true,
          reason: "NO_MESSAGES",
        });
      }

      const promptMap = await loadGroupAiPrompts({
        supabase,
        groupId,
        keys: [GROUP_AI_PROMPT_KEYS.topicsDaily, GROUP_AI_PROMPT_KEYS.keywordsDaily],
      });

      const topicsPromptConfig = promptMap.get(GROUP_AI_PROMPT_KEYS.topicsDaily) ?? DEFAULT_GROUP_AI_PROMPTS[GROUP_AI_PROMPT_KEYS.topicsDaily];
      const keywordsPromptConfig = promptMap.get(GROUP_AI_PROMPT_KEYS.keywordsDaily) ?? DEFAULT_GROUP_AI_PROMPTS[GROUP_AI_PROMPT_KEYS.keywordsDaily];

      const messagesJson = JSON.stringify(messages);
      const groupDescription = String(group.description || "");

      const [topicsResponse, keywordsResponse] = await Promise.all([
        createOpenAiTextResponse({
          apiKey: openAiApiKey,
          model: String(topicsPromptConfig.model || "gpt-4o"),
          input: renderPrompt(String(topicsPromptConfig.prompt_text || ""), {
            "{{GROUP_DESCRIPTION}}": groupDescription,
            "{{MESSAGES_JSON}}": messagesJson,
          }),
          fetchImpl,
        }),
        createOpenAiTextResponse({
          apiKey: openAiApiKey,
          model: String(keywordsPromptConfig.model || "gpt-4o"),
          input: renderPrompt(String(keywordsPromptConfig.prompt_text || ""), {
            "{{GROUP_DESCRIPTION}}": groupDescription,
            "{{MESSAGES_JSON}}": messagesJson,
          }),
          fetchImpl,
        }),
      ]);

      const topicsParsed = parseJsonArray(topicsResponse.outputText)
        .filter((item) => item && typeof item === "object")
        .slice(0, 5)
        .map((item: any, index: number) => ({
          group_id: groupId,
          topic_date: targetDate,
          rank: index + 1,
          title: String(item.topic || "").trim(),
          content: String(item.description || "").trim(),
        }))
        .filter((item) => item.title && item.content);

      const keywordsParsed = parseJsonArray(keywordsResponse.outputText)
        .filter((item) => typeof item === "string")
        .map((item: string) => item.trim())
        .filter(Boolean)
        .slice(0, 10)
        .map((keyword: string, index: number) => ({
          group_id: groupId,
          keyword_date: targetDate,
          keyword,
          rank: index + 1,
          mentions_count: 0,
          messages_count: 0,
          participants_count: 0,
        }));

      await Promise.all([
        supabase.from("group_daily_topics").delete().eq("group_id", groupId).eq("topic_date", targetDate),
        supabase.from("group_daily_keywords").delete().eq("group_id", groupId).eq("keyword_date", targetDate),
      ]);

      if (topicsParsed.length > 0) {
        const { error } = await supabase.from("group_daily_topics").insert(topicsParsed);
        if (error) return json({ success: false, code: "TOPICS_SAVE_FAILED", message: error.message }, 500);
      }

      if (keywordsParsed.length > 0) {
        const { error } = await supabase.from("group_daily_keywords").insert(keywordsParsed);
        if (error) return json({ success: false, code: "KEYWORDS_SAVE_FAILED", message: error.message }, 500);
      }

      return json({
        success: true,
        groupId,
        targetDate,
        topicsCount: topicsParsed.length,
        keywordsCount: keywordsParsed.length,
        topics: topicsParsed,
        keywords: keywordsParsed,
      });
    } catch (error: unknown) {
      if (error instanceof OpenAiResponsesError) {
        return json({ success: false, code: error.code, message: error.message }, 502);
      }
      return json({ success: false, code: "SERVER_ERROR", message: error instanceof Error ? error.message : "Erro interno" }, 500);
    }
  };
}

const handler = createGenerateGroupTopicsKeywordsHandler();

if ((import.meta as any).main) {
  DenoRef.serve(handler);
}

export default handler;
