import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const DenoRef = (globalThis as any).Deno;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value || "");
}

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Connection": "keep-alive",
    },
  });
}

function readEnv(env: { get: (key: string) => string | undefined }, key: string): string {
  return String(env.get(key) || "").trim();
}

export function createSendGroupMessageHandler(args?: {
  createClientImpl?: typeof createClient;
  env?: { get: (key: string) => string | undefined };
  fetchImpl?: typeof fetch;
}) {
  const createClientImpl = args?.createClientImpl ?? createClient;
  const env = args?.env ?? DenoRef.env;
  const fetchImpl = args?.fetchImpl ?? fetch;

  return async (req: Request) => {
    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      if (req.method !== "POST") {
        return json({ success: false, messageSent: false, message: "Method Not Allowed", code: "METHOD_NOT_ALLOWED" }, 405);
      }

      const supabaseUrl = readEnv(env, "SUPABASE_URL");
      const supabaseAnonKey = readEnv(env, "SUPABASE_ANON_KEY");
      const supabaseServiceKey = readEnv(env, "SUPABASE_SERVICE_ROLE_KEY");
      const zapiInstance = readEnv(env, "ZAPI_INSTANCE");
      const zapiToken = readEnv(env, "ZAPI_TOKEN");
      const zapiClientToken = readEnv(env, "ZAPI_CLIENT_TOKEN");
      const zapiBaseUrl = readEnv(env, "ZAPI_BASE_URL") || "https://api.z-api.io";

      const authHeader = req.headers.get("Authorization") || "";
      if (!authHeader.startsWith("Bearer ")) {
        return json({ success: false, messageSent: false, message: "Unauthorized", code: "UNAUTHORIZED" }, 401);
      }

      if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
        return json({ success: false, messageSent: false, message: "Supabase não configurado", code: "SUPABASE_NOT_CONFIGURED" }, 500);
      }

      if (!zapiInstance || !zapiToken || !zapiClientToken) {
        return json({ success: false, messageSent: false, message: "Z-API não configurada", code: "ZAPI_NOT_CONFIGURED" }, 500);
      }

      const body = await req.json().catch(() => null) as {
        groupId?: string;
        message?: string;
      } | null;

      const groupId = String(body?.groupId || "").trim();
      const message = String(body?.message || "").trim();

      if (!isUuid(groupId) || !message) {
        return json({ success: false, messageSent: false, message: "Parâmetros inválidos", code: "VALIDATION_ERROR" }, 400);
      }

      const supabaseUser = createClientImpl(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });

      const { data: userData, error: getUserErr } = await supabaseUser.auth.getUser();
      if (getUserErr || !userData?.user?.id) {
        return json({ success: false, messageSent: false, message: "Unauthorized", code: "UNAUTHORIZED" }, 401);
      }

      const requesterId = String(userData.user.id);
      const { data: isAdmin, error: isAdminErr } = await (supabaseUser as any).rpc("is_system_admin", {
        _user_id: requesterId,
      });
      if (isAdminErr) {
        return json({ success: false, messageSent: false, message: isAdminErr.message, code: "SERVER_ERROR" }, 500);
      }

      let canEditGroup = !!isAdmin;
      if (!canEditGroup) {
        const { data: canEdit, error: canEditErr } = await (supabaseUser as any).rpc("can_edit_group", {
          _user_id: requesterId,
          _group_id: groupId,
        });
        if (canEditErr) {
          return json({ success: false, messageSent: false, message: canEditErr.message, code: "SERVER_ERROR" }, 500);
        }
        canEditGroup = !!canEdit;
      }

      if (!canEditGroup) {
        return json({ success: false, messageSent: false, message: "Forbidden", code: "FORBIDDEN" }, 403);
      }

      const supabaseAdmin = createClientImpl(supabaseUrl, supabaseServiceKey);
      const { data: group, error: groupErr } = await supabaseAdmin
        .from("groups")
        .select("id, name, provider_phone")
        .eq("id", groupId)
        .maybeSingle();

      if (groupErr) {
        return json({ success: false, messageSent: false, message: groupErr.message, code: "SERVER_ERROR" }, 500);
      }

      if (!group?.id) {
        return json({ success: false, messageSent: false, message: "Grupo não encontrado", code: "GROUP_NOT_FOUND" }, 404);
      }

      const providerPhone = String(group.provider_phone || "").trim();
      if (!providerPhone) {
        return json({ success: false, messageSent: false, message: "Grupo sem provider_phone configurado", code: "GROUP_PROVIDER_PHONE_MISSING" }, 400);
      }

      const zapiResponse = await fetchImpl(
        `${zapiBaseUrl.replace(/\/+$/, "")}/instances/${encodeURIComponent(zapiInstance)}/token/${encodeURIComponent(zapiToken)}/send-text`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Client-Token": zapiClientToken,
          },
          body: JSON.stringify({
            phone: providerPhone,
            message,
          }),
        }
      );

      const rawResponse = await zapiResponse.text().catch(() => "");
      let parsedResponse: any = null;
      try {
        parsedResponse = rawResponse ? JSON.parse(rawResponse) : null;
      } catch {
        parsedResponse = null;
      }

      if (!zapiResponse.ok) {
        const zapiMessage =
          typeof parsedResponse?.message === "string" && parsedResponse.message.trim()
            ? parsedResponse.message.trim()
            : rawResponse.trim();

        return json(
          {
            success: false,
            messageSent: false,
            message: zapiMessage || `Falha ao enviar mensagem via Z-API (HTTP ${zapiResponse.status})`,
            code: "ZAPI_SEND_FAILED",
          },
          502
        );
      }

      return json({
        success: true,
        messageSent: true,
        provider: "zapi",
        groupId: group.id,
        groupName: group.name || null,
        providerResponse: parsedResponse,
      });
    } catch (err: any) {
      return json(
        {
          success: false,
          messageSent: false,
          message: err?.message || "Erro interno",
          code: "SERVER_ERROR",
        },
        500
      );
    }
  };
}

const handler = createSendGroupMessageHandler();

if ((import.meta as any).main) {
  DenoRef.serve(handler);
}

export default handler;
