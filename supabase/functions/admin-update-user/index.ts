import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const DenoRef = (globalThis as any).Deno;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_PASSWORD_LENGTH = 72;
const MIN_PASSWORD_LENGTH = 10;

function validatePasswordStrength(password: string): string | null {
  const value = (password || "").trim();
  if (!value) return "Senha obrigatória";
  if (value.length < MIN_PASSWORD_LENGTH) {
    return `Senha deve ter no mínimo ${MIN_PASSWORD_LENGTH} caracteres.`;
  }
  if (value.length > MAX_PASSWORD_LENGTH) {
    return `Senha muito longa. Use no máximo ${MAX_PASSWORD_LENGTH} caracteres.`;
  }
  if (!/[A-Z]/.test(value)) return "Senha deve incluir letra maiúscula.";
  if (!/[a-z]/.test(value)) return "Senha deve incluir letra minúscula.";
  if (!/\d/.test(value)) return "Senha deve incluir número.";
  if (!/[^A-Za-z0-9]/.test(value)) return "Senha deve incluir símbolo.";
  return null;
}

export function createAdminUpdateUserHandler(args?: {
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
    const passwordValidationError = validatePasswordStrength(payload.password || "");
    if (passwordValidationError) {
      const passwordLen = (payload.password || "").length;
      const code = passwordLen > MAX_PASSWORD_LENGTH ? "PASSWORD_TOO_LONG" : "WEAK_PASSWORD";
      return json({ success: false, message: passwordValidationError, code }, 400);
    }

    const supabaseAdmin = createClientImpl(url, service);
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
  };
}

const handler = createAdminUpdateUserHandler();

if ((import.meta as any).main) {
  DenoRef.serve(handler);
}

export default handler;
