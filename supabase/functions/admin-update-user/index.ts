import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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
    const { data: isAdmin, error: isAdminErr } = await supabaseUser.rpc("is_system_admin", { _user_id: requesterId });
    if (isAdminErr) {
      return json({ success: false, message: isAdminErr.message, code: "SERVER_ERROR" }, 500);
    }
    if (!isAdmin) {
      return json({ success: false, message: "Forbidden", code: "FORBIDDEN" }, 403);
    }

    const payload = await req.json().catch(() => null) as {
      user_id?: string;
      password?: string;
    } | null;

    if (!payload || !payload.user_id || !payload.password) {
      return json({ success: false, message: "Dados obrigatórios ausentes", code: "VALIDATION_ERROR" }, 400);
    }
    if ((payload.password || "").length < 8) {
      return json({ success: false, message: "Senha deve ter pelo menos 8 caracteres", code: "VALIDATION_ERROR" }, 400);
    }

    const supabaseAdmin = createClient(url, service);
    const { data: updated, error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(payload.user_id, {
      password: payload.password,
    });

    if (updateErr) {
      const msg = updateErr.message || "Erro ao atualizar usuário";
      return json({ success: false, message: msg, code: "UPDATE_USER_FAILED" }, 400);
    }

    return json({ success: true, user_id: updated?.user?.id });
  } catch (err: any) {
    return json({ success: false, message: err?.message || "Erro interno", code: "SERVER_ERROR" }, 500);
  }
});

