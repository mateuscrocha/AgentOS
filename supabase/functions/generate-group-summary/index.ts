import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import {
  DEFAULT_GROUP_AI_PROMPTS,
  GROUP_AI_PROMPT_KEYS,
  loadGroupAiPrompts,
  type GroupAiPromptKey,
} from "../_shared/group-ai-prompts.ts";
import { createOpenAiTextResponse, OpenAiResponsesError } from "../_shared/openai-responses.ts";
import { recordOpenAiBillingAlert } from "../_shared/openai-system-alert.ts";
import { sendZapiText, ZapiSendError } from "../_shared/zapi-send-text.ts";
import { verifyCronApiKey } from "../_shared/cron-auth.ts";

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
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value || "");
}

function readEnv(env: { get: (key: string) => string | undefined }, key: string): string {
  return String(env.get(key) || "").trim();
}

function isTruthyEnv(value: string | null | undefined) {
  return ["1", "true", "yes", "on"].includes(String(value || "").trim().toLowerCase());
}

function isGroupPaused(group: { is_active?: boolean | null; status?: string | null }) {
  if (group.is_active === false) return true;
  return String(group.status || "").trim().toLowerCase() === "inactive";
}

function toSaoPauloShifted(date: Date) {
  return new Date(date.getTime() - SAO_PAULO_OFFSET_MS);
}

function getSaoPauloDateKey(date: Date) {
  return toSaoPauloShifted(date).toISOString().slice(0, 10);
}

function getSaoPauloNowIso(date: Date) {
  const shifted = toSaoPauloShifted(date);
  return new Date(shifted.getTime() + SAO_PAULO_OFFSET_MS).toISOString();
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

function truncate(text: string, limit: number) {
  return text.length > limit ? text.slice(0, limit) : text;
}

function renderSummaryPrompt(template: string, context: Record<string, string>) {
  let output = template;
  for (const [key, value] of Object.entries(context)) {
    output = output.split(key).join(value);
  }
  return output;
}

function extractSummaryType(summary: any): string | null {
  const metadata = summary?.metadata;
  if (metadata && typeof metadata === "object" && typeof metadata.summary_type === "string") {
    return metadata.summary_type;
  }
  return null;
}

async function resolveAuth(args: {
  req: Request;
  env: { get: (key: string) => string | undefined };
  createClientImpl: typeof createClient;
  groupId: string;
}) {
  const { req, env, createClientImpl, groupId } = args;
  const providedApiKey = String(req.headers.get("x-api-key") || "").trim();
  if (await verifyCronApiKey({ env, providedApiKey, createClientImpl })) {
    return { mode: "api_key" as const, requesterId: null };
  }

  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    return { mode: "unauthorized" as const, requesterId: null };
  }

  const supabaseUrl = readEnv(env, "SUPABASE_URL");
  const supabaseAnonKey = readEnv(env, "SUPABASE_ANON_KEY");
  if (!supabaseUrl || !supabaseAnonKey) {
    return { mode: "config_error" as const, requesterId: null };
  }

  const supabaseUser = createClientImpl(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userError } = await supabaseUser.auth.getUser();
  if (userError || !userData?.user?.id) {
    return { mode: "unauthorized" as const, requesterId: null };
  }

  const requesterId = String(userData.user.id);
  const { data: isAdmin } = await (supabaseUser as any).rpc("is_system_admin", { _user_id: requesterId });
  if (isAdmin) {
    return { mode: "user" as const, requesterId };
  }

  const { data: canEdit } = await (supabaseUser as any).rpc("can_edit_group", {
    _user_id: requesterId,
    _group_id: groupId,
  });

  if (!canEdit) {
    return { mode: "forbidden" as const, requesterId };
  }

  return { mode: "user" as const, requesterId };
}

type Deps = {
  createClientImpl?: typeof createClient;
  env?: { get: (key: string) => string | undefined };
  fetchImpl?: typeof fetch;
  now?: () => Date;
};

export function createGenerateGroupSummaryHandler(deps: Deps = {}) {
  const createClientImpl = deps.createClientImpl ?? createClient;
  const env = deps.env ?? DenoRef.env;
  const fetchImpl = deps.fetchImpl ?? fetch;
  const now = deps.now ?? (() => new Date());

  return async (req: Request) => {
    let supabase: ReturnType<typeof createClient> | null = null;
    let groupContext: { id: string; name?: string | null } | null = null;
    let authRequesterId: string | null = null;
    let requestedSummaryDate: string | null = null;

    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      if (req.method !== "POST") {
        return json({ success: false, code: "METHOD_NOT_ALLOWED", message: "Method Not Allowed" }, 405);
      }

      const body = await req.json().catch(() => null) as {
        groupId?: string;
        summaryDate?: string;
        sendToGroup?: boolean;
      } | null;

      const groupId = String(body?.groupId || "").trim();
      const sendToGroup = body?.sendToGroup !== false;
      const summaryDate = String(body?.summaryDate || "").trim() || getSaoPauloDateKey(now());
      requestedSummaryDate = summaryDate;

      if (!isUuid(groupId)) {
        return json({ success: false, code: "VALIDATION_ERROR", message: "groupId inválido" }, 400);
      }

      const auth = await resolveAuth({ req, env, createClientImpl, groupId });
      if (auth.mode === "config_error") {
        return json({ success: false, code: "SUPABASE_NOT_CONFIGURED", message: "Supabase não configurado" }, 500);
      }
      if (auth.mode === "unauthorized") {
        return json({ success: false, code: "UNAUTHORIZED", message: "Unauthorized" }, 401);
      }
      if (auth.mode === "forbidden") {
        return json({ success: false, code: "FORBIDDEN", message: "Forbidden" }, 403);
      }
      authRequesterId = auth.requesterId;

      const supabaseUrl = readEnv(env, "SUPABASE_URL");
      const serviceRoleKey = readEnv(env, "SUPABASE_SERVICE_ROLE_KEY");
      const openAiApiKey = readEnv(env, "OPENAI_API_KEY");
      if (!supabaseUrl || !serviceRoleKey) {
        return json({ success: false, code: "SUPABASE_NOT_CONFIGURED", message: "Supabase não configurado" }, 500);
      }
      if (!openAiApiKey) {
        return json({ success: false, code: "OPENAI_NOT_CONFIGURED", message: "OpenAI não configurada" }, 500);
      }

      supabase = createClientImpl(supabaseUrl, serviceRoleKey);

      const { data: group, error: groupError } = await supabase
        .from("groups")
        .select("id, name, description, provider_phone, is_active, status")
        .eq("id", groupId)
        .maybeSingle();

      if (groupError) {
        return json({ success: false, code: "GROUP_LOOKUP_FAILED", message: groupError.message }, 500);
      }
      if (!group?.id) {
        return json({ success: false, code: "GROUP_NOT_FOUND", message: "Grupo não encontrado" }, 404);
      }
      const groupRow = group as {
        id: string;
        name?: string | null;
        description?: string | null;
        provider_phone?: string | null;
        is_active?: boolean | null;
        status?: string | null;
      };
      groupContext = { id: String(groupRow.id), name: groupRow.name ?? null };
      if (isGroupPaused(groupRow)) {
        return json({
          success: true,
          skipped: true,
          code: "GROUP_PAUSED",
          message: "Grupo pausado. Resumo não gerado.",
          groupId,
          summaryDate,
          sentToGroup: false,
        });
      }

      const currentNow = now();
      const currentDateKey = getSaoPauloDateKey(currentNow);
      const endDate = summaryDate === currentDateKey ? currentNow : saoPauloDateTimeToUtc(summaryDate, "23:59:59");
      const start24 = new Date(endDate.getTime() - 24 * 60 * 60 * 1000);
      const start48 = new Date(endDate.getTime() - 48 * 60 * 60 * 1000);
      const start72 = new Date(endDate.getTime() - 72 * 60 * 60 * 1000);

      const [last24Result, recentResult, previousSummariesResult, prevDayResult, beforePrevDayResult] = await Promise.all([
        (supabase as any)
          .from("v_messages_with_members")
          .select("group_id, message_created_at, message_ts, text, content, media_caption, display_name, member_name, sender_name, phone_e164")
          .eq("group_id", groupId)
          .gte("message_created_at", start24.toISOString())
          .lte("message_created_at", endDate.toISOString())
          .order("message_created_at", { ascending: false }),
        (supabase as any)
          .from("v_messages_with_members")
          .select("group_id, message_created_at, message_ts, text, content, media_caption, display_name, member_name, sender_name, phone_e164")
          .eq("group_id", groupId)
          .order("message_created_at", { ascending: false })
          .limit(300),
        (supabase as any)
          .from("group_daily_summaries")
          .select("summary_date, summary_text, metadata, created_at")
          .eq("group_id", groupId)
          .lt("summary_date", summaryDate)
          .order("summary_date", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(3),
        (supabase as any)
          .from("v_messages_with_members")
          .select("group_id, message_created_at, message_ts, text, content, media_caption, display_name, member_name, sender_name, phone_e164")
          .eq("group_id", groupId)
          .gte("message_created_at", start48.toISOString())
          .lt("message_created_at", start24.toISOString())
          .order("message_created_at", { ascending: false }),
        (supabase as any)
          .from("v_messages_with_members")
          .select("group_id, message_created_at, message_ts, text, content, media_caption, display_name, member_name, sender_name, phone_e164")
          .eq("group_id", groupId)
          .gte("message_created_at", start72.toISOString())
          .lt("message_created_at", start48.toISOString())
          .order("message_created_at", { ascending: false }),
      ]);

      if (last24Result.error) return json({ success: false, code: "MESSAGES_LOOKUP_FAILED", message: last24Result.error.message }, 500);
      if (recentResult.error) return json({ success: false, code: "MESSAGES_LOOKUP_FAILED", message: recentResult.error.message }, 500);
      if (previousSummariesResult.error) return json({ success: false, code: "SUMMARY_LOOKUP_FAILED", message: previousSummariesResult.error.message }, 500);
      if (prevDayResult.error) return json({ success: false, code: "MESSAGES_LOOKUP_FAILED", message: prevDayResult.error.message }, 500);
      if (beforePrevDayResult.error) return json({ success: false, code: "MESSAGES_LOOKUP_FAILED", message: beforePrevDayResult.error.message }, 500);

      const last24Messages = sortMessagesNewestFirst((last24Result.data ?? []).map(normalizeMessage));
      const recentMessages = sortMessagesNewestFirst((recentResult.data ?? []).map(normalizeMessage));
      const prevDayMessages = sortMessagesNewestFirst((prevDayResult.data ?? []).map(normalizeMessage));
      const beforePrevDayMessages = sortMessagesNewestFirst((beforePrevDayResult.data ?? []).map(normalizeMessage));
      const previousSummaries = (previousSummariesResult.data ?? []) as any[];

      const twoShortInRow =
        previousSummaries.slice(0, 2).length === 2 &&
        previousSummaries.slice(0, 2).every((item) => extractSummaryType(item) === "SHORT");

      let summaryType: "SHORT" | "FULL" | "MARGED" = "FULL";
      let promptKey: GroupAiPromptKey = GROUP_AI_PROMPT_KEYS.summaryFull;
      if (last24Messages.length < 15) {
        if (twoShortInRow) {
          summaryType = "MARGED";
          promptKey = GROUP_AI_PROMPT_KEYS.summaryMarged;
        } else {
          summaryType = "SHORT";
          promptKey = GROUP_AI_PROMPT_KEYS.summaryShort;
        }
      }

      const promptMap = await loadGroupAiPrompts({
        supabase,
        groupId,
        keys: [promptKey],
      });
      const promptConfig = promptMap.get(promptKey) ?? {
        prompt_text: DEFAULT_GROUP_AI_PROMPTS[promptKey].prompt_text,
        model: DEFAULT_GROUP_AI_PROMPTS[promptKey].model,
        runtime: DEFAULT_GROUP_AI_PROMPTS[promptKey].runtime,
      };

      const promptText = renderSummaryPrompt(String(promptConfig.prompt_text || ""), {
        "{{ $items('Workflow Variables')[0].json.group_name }}": String(groupRow.name || ""),
        "{{ $('Workflow Variables').item.json.group_name }}": String(groupRow.name || ""),
        "{{ $items('Workflow Variables')[0].json.group_description }}": String(groupRow.description || ""),
        "{{ $('Workflow Variables').item.json.group_description }}": String(groupRow.description || ""),
        "{{ $items('Workflow Variables')[0].json.group_ai_id }}": "",
        "{{ $('When Executed by Another Workflow').item.json.group_ai_id }}": "",
        "{{ $now.toISO() }}": getSaoPauloNowIso(currentNow),
        "{{ $json.data.toJsonString() }}":
          JSON.stringify(summaryType === "MARGED" ? recentMessages : last24Messages),
        "{{ $('Aggregate Last 24 hours Messages').item.json.data.toJsonString().substring(0,250000) }}":
          truncate(JSON.stringify(last24Messages), 250000),
        "{{ $('Aggregate').item.json.summary.toJsonString() }}":
          JSON.stringify(previousSummaries.slice(0, 3).map((item) => item.summary_text || "")),
      });

      const aiResponse = await createOpenAiTextResponse({
        apiKey: openAiApiKey,
        model: String(promptConfig.model || "gpt-4o-mini"),
        input: promptText,
        fetchImpl,
      });

      const summaryText = formatWhatsappSummary(aiResponse.outputText);

      const summaryMetadata = {
        summary_type: summaryType,
        prompt_key: promptKey,
        model: String(promptConfig.model || "gpt-4o-mini"),
        runtime: String(promptConfig.runtime || "responses"),
        last_24h_count: last24Messages.length,
        recent_messages_count: recentMessages.length,
        previous_summaries_count: previousSummaries.length,
        previous_day_count: prevDayMessages.length,
        before_previous_day_count: beforePrevDayMessages.length,
      };

      const { data: savedSummary, error: upsertError } = await (supabase as any)
        .from("group_daily_summaries")
        .upsert(
          {
            group_id: groupId,
            summary_date: summaryDate,
            summary_text: summaryText,
            metadata: summaryMetadata,
          },
          { onConflict: "group_id,summary_date" }
        )
        .select("id, group_id, summary_date, summary_text, metadata, created_at")
        .maybeSingle();

      if (upsertError) {
        return json({ success: false, code: "SUMMARY_SAVE_FAILED", message: upsertError.message }, 500);
      }

      const deliveryEnabled = isTruthyEnv(readEnv(env, "GROUP_AI_SEND_ENABLED"));
      const shouldSendToGroup = sendToGroup && deliveryEnabled;

      let providerResponse: any = null;
      if (shouldSendToGroup) {
        const providerPhone = String(groupRow.provider_phone || "").trim();
        if (!providerPhone) {
          return json(
            {
              success: false,
              code: "GROUP_PROVIDER_PHONE_MISSING",
              message: "Grupo sem provider_phone configurado",
              summary: savedSummary,
            },
            400
          );
        }

        providerResponse = await sendZapiText({
          env,
          phone: providerPhone,
          message: summaryText,
          fetchImpl,
        });
      }

      return json({
        success: true,
        groupId,
        summaryDate,
        summaryType,
        promptKey,
        summary: savedSummary,
        sendRequested: sendToGroup,
        deliveryEnabled,
        sentToGroup: shouldSendToGroup,
        providerResponse,
      });
    } catch (error: unknown) {
      if (error instanceof OpenAiResponsesError || error instanceof ZapiSendError) {
        if (error instanceof OpenAiResponsesError && supabase) {
          await recordOpenAiBillingAlert({
            supabase: supabase as any,
            error,
            operation: "generate-group-summary",
            groupId: groupContext?.id ?? null,
            groupName: groupContext?.name ?? null,
            targetDate: requestedSummaryDate,
            userId: authRequesterId,
          });
        }

        return json(
          {
            success: false,
            code: error.code,
            message: error.message,
          },
          error instanceof OpenAiResponsesError ? 502 : 502
        );
      }

      return json(
        {
          success: false,
          code: "SERVER_ERROR",
          message: error instanceof Error ? error.message : "Erro interno",
        },
        500
      );
    }
  };
}

const handler = createGenerateGroupSummaryHandler();

if ((import.meta as any).main) {
  DenoRef.serve(handler);
}

export default handler;
