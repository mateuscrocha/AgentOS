import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const DenoRef = (globalThis as any).Deno;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function createAdminGetUserEmailHandler(args?: {
  createClientImpl?: typeof createClient;
  env?: { get: (key: string) => string | undefined };
}) {
  const createClientImpl = args?.createClientImpl ?? createClient;
  const env = args?.env ?? DenoRef.env;

  return async (req: Request) => {
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
      const url = env.get("SUPABASE_URL")!;
      const anon = env.get("SUPABASE_ANON_KEY")!;
      const service = env.get("SUPABASE_SERVICE_ROLE_KEY")!;

      const authHeader = req.headers.get("Authorization") || "";
      if (!authHeader.startsWith("Bearer ")) {
        return json({ success: false, message: "Unauthorized", code: "UNAUTHORIZED" }, 401);
      }

      const supabaseUser = createClientImpl(url, anon, {
        global: { headers: { Authorization: authHeader } },
      });

      const { data: userData, error: getUserErr } = await supabaseUser.auth.getUser();
      if (getUserErr || !userData?.user?.id) {
        return json({ success: false, message: "Unauthorized", code: "UNAUTHORIZED" }, 401);
      }

      const requesterId = userData.user.id as string;
      const { data: isAdmin, error: isAdminErr } = await (supabaseUser as any).rpc("is_system_admin", { _user_id: requesterId });
      if (isAdminErr) {
        return json({ success: false, message: isAdminErr.message, code: "SERVER_ERROR" }, 500);
      }
      if (!isAdmin) {
        return json({ success: false, message: "Forbidden", code: "FORBIDDEN" }, 403);
      }

      const body = await req.json().catch(() => null) as { user_id?: string } | null;
      const userId = (body?.user_id || "").trim();
      if (!isUuid(userId)) {
        return json({ success: false, message: "user_id inválido", code: "VALIDATION_ERROR" }, 400);
      }

      const supabaseAdmin = createClientImpl(url, service);
      const { data: authUser, error: getByIdErr } = await (supabaseAdmin as any).auth.admin.getUserById(userId);
      if (getByIdErr) {
        const msg = getByIdErr.message || "Erro ao buscar usuário";
        return json({ success: false, message: msg, code: "SERVER_ERROR" }, 500);
      }
      if (!authUser?.user?.id) {
        return json({ success: false, message: "Usuário não encontrado", code: "USER_NOT_FOUND" }, 404);
      }

      const email = authUser.user.email || null;
      return json({ success: true, email });
    } catch (err: any) {
      return json({ success: false, message: err?.message || "Erro interno", code: "SERVER_ERROR" }, 500);
    }
  };
}

const handler = createAdminGetUserEmailHandler();

if ((import.meta as any).main) {
  DenoRef.serve(handler);
}

export default handler;
