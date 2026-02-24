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

function normalizePhoneE164(phone: string): string {
  const raw = (phone || "").trim();
  if (!raw) return "";
  if (raw.startsWith("+")) return raw.replace(/\s+/g, "");
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("55") && digits.length >= 10) return "+" + digits;
  return "+55" + digits;
}

export function createAdminCreateUserHandler(args?: {
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
      return json({ success: false, message: "Unauthorized" }, 401);
    }

    const supabaseUser = createClientImpl(url, anon, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: getUserErr } = await supabaseUser.auth.getUser();
    if (getUserErr || !userData?.user?.id) {
      console.log(JSON.stringify({ stage: 'auth_get_user', error: getUserErr?.message, status: 401 }));
      return json({ success: false, message: "Unauthorized", code: 'UNAUTHORIZED' }, 401);
    }

    const requesterId = userData.user.id;

    const { data: isAdmin, error: isAdminErr } = await supabaseUser.rpc("is_system_admin", {
      _user_id: requesterId,
    });
    if (isAdminErr) {
      console.log(JSON.stringify({ stage: 'check_admin', error: isAdminErr.message, status: 500 }));
      return json({ success: false, message: isAdminErr.message, code: 'SERVER_ERROR' }, 500);
    }
    if (!isAdmin) {
      console.log(JSON.stringify({ stage: 'check_admin', requesterId, status: 403 }));
      return json({ success: false, message: "Forbidden", code: 'FORBIDDEN' }, 403);
    }

    const payload = await req.json().catch(() => null) as {
      name?: string;
      email?: string;
      whatsapp_phone?: string;
      password?: string;
      scope_type?: 'organization' | 'group';
      scope_id?: string;
      assign_org_admin?: boolean;
    } | null;

    if (!payload || !payload.name || !payload.email || !payload.password) {
      console.log(JSON.stringify({ stage: 'validation', payload: { name: !!payload?.name, email: !!payload?.email, scope_type: payload?.scope_type, scope_id: payload?.scope_id }, status: 400 }));
      return json({ success: false, message: "Dados obrigatórios ausentes", code: 'VALIDATION_ERROR' }, 400);
    }
    const passwordValidationError = validatePasswordStrength(payload.password || "");
    if (passwordValidationError) {
      const passwordLen = (payload.password || "").length;
      const code = passwordLen > MAX_PASSWORD_LENGTH ? "PASSWORD_TOO_LONG" : "WEAK_PASSWORD";
      console.log(JSON.stringify({ stage: 'validation_password_policy', len: passwordLen, code, status: 400 }));
      return json({ success: false, message: passwordValidationError, code }, 400);
    }
    if (!payload.scope_type || !payload.scope_id) {
      console.log(JSON.stringify({ stage: 'validation_scope', payload: { scope_type: payload.scope_type, scope_id: payload.scope_id }, status: 400 }));
      return json({ success: false, message: "Escopo inicial obrigatório", code: 'VALIDATION_ERROR' }, 400);
    }
    if (!(payload.scope_type === 'organization' || payload.scope_type === 'group')) {
      console.log(JSON.stringify({ stage: 'validation_scope_type', payload: { scope_type: payload.scope_type }, status: 400 }));
      return json({ success: false, message: "Escopo inválido", code: 'VALIDATION_ERROR' }, 400);
    }

    const supabaseAdmin = createClientImpl(url, service);

    const rollbackCreatedUser = async (userId: string) => {
      try {
        await supabaseAdmin.auth.admin.deleteUser(userId);
      } catch (_e) {
        void 0;
      }
    };

    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: payload.email,
      password: payload.password,
      user_metadata: { name: payload.name },
      email_confirm: true,
    });

    if (createErr) {
      const msg = createErr.message || "Erro ao criar usuário";
      const m = (msg || '').toLowerCase();
      const isEmailExists = /already.*registered/.test(m) || m.includes('email exists');
      const status = isEmailExists ? 409 : 400;
      console.log(JSON.stringify({ stage: 'admin_create_user', error: msg, status }));
      return json({ success: false, message: msg, code: isEmailExists ? 'EMAIL_EXISTS' : 'CREATE_USER_FAILED' }, status);
    }

    const newUserId = created?.user?.id;
    if (!newUserId) {
      console.log(JSON.stringify({ stage: 'admin_create_user', error: 'user_id_missing', status: 500 }));
      return json({ success: false, message: "Usuário não retornado", code: 'SERVER_ERROR' }, 500);
    }

    const phone = normalizePhoneE164(payload.whatsapp_phone || "");

    const { error: profileUpdateErr } = await supabaseAdmin
      .from("profiles")
      .update({ name: payload.name, phone_e164: phone, status: "active" })
      .eq("id", newUserId);
    if (profileUpdateErr) {
      await rollbackCreatedUser(newUserId);
      console.log(JSON.stringify({ stage: 'update_profile_after_create', error: profileUpdateErr.message, status: 400 }));
      return json({ success: false, message: "Erro ao atualizar perfil do usuário", code: 'UPDATE_PROFILE_FAILED' }, 400);
    }

    const { error: scopeErr } = await supabaseAdmin
      .from("user_access_scope")
      .insert({
        user_id: newUserId,
        scope_type: payload.scope_type,
        scope_id: payload.scope_id,
      });

    if (scopeErr) {
      await rollbackCreatedUser(newUserId);
      const msg = scopeErr.message || "Erro ao criar escopo inicial";
      console.log(JSON.stringify({ stage: 'insert_user_access_scope', error: msg, status: 400 }));
      return json({ success: false, message: msg, code: 'INSERT_SCOPE_FAILED' }, 400);
    }
    if (payload.assign_org_admin && payload.scope_type === 'organization') {
      const { error: roleErr } = await supabaseAdmin
        .from("user_roles")
        .insert({
          user_id: newUserId,
          role: 'ORG_ADMIN',
          organization_id: payload.scope_id,
        });
      if (roleErr) {
        await rollbackCreatedUser(newUserId);
        console.log(JSON.stringify({ stage: 'assign_org_admin', error: roleErr.message, status: 400 }));
        return json({ success: false, message: 'Falha ao atribuir privilégios de admin organizacional', code: 'ASSIGN_ORG_ADMIN_FAILED' }, 400);
      }
      const { data: canEditOrg, error: canEditErr } = await supabaseAdmin.rpc("can_edit_org", { _user_id: newUserId, _org_id: payload.scope_id });
      const { data: hasOrgAccess, error: hasAccessErr } = await supabaseAdmin.rpc("has_org_access", { _user_id: newUserId, _org_id: payload.scope_id });
      if (canEditErr || hasAccessErr || !canEditOrg || !hasOrgAccess) {
        await rollbackCreatedUser(newUserId);
        console.log(JSON.stringify({ stage: 'verify_org_admin', canEditErr: canEditErr?.message, hasAccessErr: hasAccessErr?.message, canEditOrg, hasOrgAccess, status: 500 }));
        return json({ success: false, message: 'Verificação de privilégios falhou', code: 'VERIFY_ORG_ADMIN_FAILED' }, 500);
      }
      await supabaseAdmin.from("events").insert({
        event_type: 'ORG_ADMIN_ASSIGNED',
        entity_type: 'organization',
        entity_id: payload.scope_id,
        user_id: newUserId,
        metadata: { requested_by: requesterId },
      });
    }

    console.log(JSON.stringify({ stage: 'success', requesterId, user_id: newUserId, scope_type: payload.scope_type, assign_org_admin: !!payload.assign_org_admin, status: 200 }));
    return json({ success: true, user_id: newUserId, scope: { scope_type: payload.scope_type, scope_id: payload.scope_id }, assigned_org_admin: !!payload.assign_org_admin });
  } catch (err: any) {
    console.log(JSON.stringify({ stage: 'catch', error: err?.message, status: 500 }));
    return json({ success: false, message: err?.message || "Erro interno", code: 'SERVER_ERROR' }, 500);
  }
  };
}

const handler = createAdminCreateUserHandler();

if ((import.meta as any).main) {
  DenoRef.serve(handler);
}

export default handler;
