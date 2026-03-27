import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { createGenerateGroupSummaryHandler } from "../generate-group-summary/index.ts";
import { createGenerateGroupTopicsKeywordsHandler } from "../generate-group-topics-keywords/index.ts";

const DenoRef = (globalThis as any).Deno;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function readEnv(env: { get: (key: string) => string | undefined }, key: string): string {
  return String(env.get(key) || "").trim();
}

function saoPauloHour(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    hour12: false,
  }).format(date);
}

function saoPauloDateKey(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  const day = parts.find((part) => part.type === "day")?.value ?? "";

  return `${year}-${month}-${day}`;
}

function extractHour(value: string | null | undefined) {
  const raw = String(value || "").trim();
  const match = raw.match(/^(\d{2}):/);
  return match ? match[1] : "";
}

function isGroupPaused(group: { is_active?: boolean | null; status?: string | null }) {
  if (group.is_active === false) return true;
  return String(group.status || "").trim().toLowerCase() === "inactive";
}

type Deps = {
  createClientImpl?: typeof createClient;
  env?: { get: (key: string) => string | undefined };
  now?: () => Date;
  fetchImpl?: typeof fetch;
};

export function createRunGroupAiDailyJobsHandler(deps: Deps = {}) {
  const createClientImpl = deps.createClientImpl ?? createClient;
  const env = deps.env ?? DenoRef.env;
  const now = deps.now ?? (() => new Date());
  const fetchImpl = deps.fetchImpl ?? fetch;

  const summaryHandler = createGenerateGroupSummaryHandler({
    createClientImpl,
    env,
    now,
    fetchImpl,
  });
  const topicsKeywordsHandler = createGenerateGroupTopicsKeywordsHandler({
    createClientImpl,
    env,
    now,
    fetchImpl,
  });

  return async (req: Request) => {
    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      if (req.method !== "POST") {
        return json({ success: false, code: "METHOD_NOT_ALLOWED", message: "Method Not Allowed" }, 405);
      }

      const inboundApiKey = readEnv(env, "GROUP_AI_CRON_API_KEY");
      const providedApiKey = String(req.headers.get("x-api-key") || "").trim();
      if (!inboundApiKey || providedApiKey !== inboundApiKey) {
        return json({ success: false, code: "UNAUTHORIZED", message: "Unauthorized" }, 401);
      }

      const supabaseUrl = readEnv(env, "SUPABASE_URL");
      const serviceRoleKey = readEnv(env, "SUPABASE_SERVICE_ROLE_KEY");
      if (!supabaseUrl || !serviceRoleKey) {
        return json({ success: false, code: "SUPABASE_NOT_CONFIGURED", message: "Supabase não configurado" }, 500);
      }

      const currentNow = now();
      const currentHour = saoPauloHour(currentNow);
      const summaryDate = saoPauloDateKey(currentNow);
      const supabase = createClientImpl(supabaseUrl, serviceRoleKey);

      const { data, error } = await (supabase as any)
        .from("groups")
        .select("id, name, is_active, status, group_settings!inner(daily_summary_enabled,daily_summary_time,daily_topics_enabled)")
        .eq("is_active", true);

      if (error) {
        return json({ success: false, code: "GROUPS_LOOKUP_FAILED", message: error.message }, 500);
      }

      const groups = Array.isArray(data) ? data : [];
      const dueGroups = groups.filter((group) => {
        const settings = Array.isArray(group.group_settings) ? group.group_settings[0] : group.group_settings;
        return !isGroupPaused(group) && extractHour(settings?.daily_summary_time) === currentHour;
      });

      const results: Array<Record<string, unknown>> = [];

      for (const group of dueGroups) {
        const settings = Array.isArray(group.group_settings) ? group.group_settings[0] : group.group_settings;
        const internalReq = new Request("http://internal/functions/v1/generate-group-summary", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": inboundApiKey,
          },
          body: JSON.stringify({
            groupId: group.id,
            summaryDate,
            sendToGroup: Boolean(settings?.daily_summary_enabled),
          }),
        });

        const response = await summaryHandler(internalReq);
        const payload = await response.json().catch(() => null);

        results.push({
          groupId: group.id,
          groupName: group.name ?? null,
          summary: {
            ok: response.ok,
            status: response.status,
            payload,
          },
        });

        const topicsReq = new Request("http://internal/functions/v1/generate-group-topics-keywords", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": inboundApiKey,
          },
          body: JSON.stringify({
            groupId: group.id,
            targetDate: summaryDate,
          }),
        });

        const topicsRes = await topicsKeywordsHandler(topicsReq);
        const topicsPayload = await topicsRes.json().catch(() => null);
        results[results.length - 1].topicsKeywords = {
          ok: topicsRes.ok,
          status: topicsRes.status,
          payload: topicsPayload,
        };
      }

      return json({
        success: true,
        currentHour,
        summaryDate,
        matchedGroups: dueGroups.length,
        processedGroups: results.length,
        results,
      });
    } catch (error: unknown) {
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

const handler = createRunGroupAiDailyJobsHandler();

if ((import.meta as any).main) {
  DenoRef.serve(handler);
}

export default handler;
