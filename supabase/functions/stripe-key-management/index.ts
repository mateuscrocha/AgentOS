import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function getEnvOrThrow(name: string): string {
  const value = Deno.env.get(name);
  if (!value || value.trim() === "") {
    throw new Error(`Configuração ausente: ${name}`);
  }
  return value;
}

function getStripeSecretKeyFromEnv(): string | null {
  const key = (Deno.env.get("STRIPE_SECRET_KEY") || "").trim();
  return key ? key : null;
}

function maskStripeSecretKey(secretKey: string): string {
  const trimmed = (secretKey || "").trim();
  if (!trimmed) return "Não configurado";
  const last4 = trimmed.slice(-4);
  const m = trimmed.match(/^(sk|rk)_(live|test)_/);
  const prefix = m?.[0] || "key_";
  return `${prefix}${"•".repeat(12)}${last4}`;
}

export default Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const json = (body: any, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Connection": "keep-alive",
      },
    });

  try {
    const url = getEnvOrThrow("SUPABASE_URL");
    const anon = getEnvOrThrow("SUPABASE_ANON_KEY");

    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return json({ success: false, message: "Unauthorized", code: "UNAUTHORIZED" }, 401);
    }

    const supabaseUser = createClient(url, anon, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: getUserErr } = await supabaseUser.auth.getUser();
    if (getUserErr || !userData?.user?.id) {
      return json({ success: false, message: "Unauthorized", code: "UNAUTHORIZED" }, 401);
    }

    const requesterId = userData.user.id;

    const { data: isAdmin, error: isAdminErr } = await supabaseUser.rpc("is_system_admin", {
      _user_id: requesterId,
    });
    if (isAdminErr) {
      return json({ success: false, message: isAdminErr.message, code: "SERVER_ERROR" }, 500);
    }
    if (!isAdmin) {
      return json({ success: false, message: "Forbidden", code: "FORBIDDEN" }, 403);
    }

    const payload = (await req.json().catch(() => null)) as
      | { action?: "get" | "update" | "audit" }
      | null;

    const action = payload?.action || "get";
    const envKey = getStripeSecretKeyFromEnv();

    if (action === "get") {
      const hasKey = !!envKey;
      return json({
        success: true,
        has_key: hasKey,
        masked_key: hasKey ? maskStripeSecretKey(envKey!) : "Não configurado",
        updated_at: null,
        managed_by: "env",
      });
    }

    if (action === "audit") {
      return json({
        success: true,
        items: [],
      });
    }

    if (action === "update") {
      return json({
        success: false,
        message: "Chave gerenciada por variável de ambiente (STRIPE_SECRET_KEY). Atualização por este painel está desativada.",
        code: "VALIDATION_ERROR",
      }, 400);
    }

    return json({ success: false, message: "Ação inválida", code: "VALIDATION_ERROR" }, 400);
  } catch (err: any) {
    return json({ success: false, message: err?.message || "Erro interno", code: "SERVER_ERROR" }, 500);
  }
});
