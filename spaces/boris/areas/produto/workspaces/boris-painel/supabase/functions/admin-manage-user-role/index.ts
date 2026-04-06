import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const DenoRef = (globalThis as any).Deno;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type AppRole = "SYSTEM_ADMIN" | "ORG_ADMIN" | "GROUP_MANAGER" | "USER";

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value || "");
}

function isAppRole(value: string): value is AppRole {
  return ["SYSTEM_ADMIN", "ORG_ADMIN", "GROUP_MANAGER", "USER"].includes(value);
}

type EnvGetter = { get: (key: string) => string | undefined };
type CreateClientLike = typeof createClient;

export function createAdminManageUserRoleHandler(args?: {
  createClientImpl?: CreateClientLike;
  env?: EnvGetter;
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

    if (req.method !== "POST") {
      return json({ success: false, message: "Method Not Allowed", code: "METHOD_NOT_ALLOWED" }, 405);
    }

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

      const body = (await req.json().catch(() => null)) as
        | {
            action?: "add" | "remove";
            role_id?: string;
            user_id?: string;
            role?: AppRole;
            organization_id?: string | null;
            group_id?: string | null;
          }
        | null;

      if (!body?.action || (body.action !== "add" && body.action !== "remove")) {
        return json({ success: false, message: "Ação inválida", code: "VALIDATION_ERROR" }, 400);
      }

      const supabaseAdmin = createClientImpl(url, service);

      if (body.action === "remove") {
        const roleId = (body.role_id || "").trim();
        if (!isUuid(roleId)) {
          return json({ success: false, message: "role_id inválido", code: "VALIDATION_ERROR" }, 400);
        }

        const { data: roleRow, error: roleFetchErr } = await supabaseAdmin
          .from("user_roles")
          .select("id,user_id,role,organization_id,group_id")
          .eq("id", roleId)
          .maybeSingle();

        if (roleFetchErr) {
          return json({ success: false, message: roleFetchErr.message, code: "SERVER_ERROR" }, 500);
        }
        if (!roleRow?.id) {
          return json({ success: false, message: "Papel não encontrado", code: "ROLE_NOT_FOUND" }, 404);
        }

        if (roleRow.role === "SYSTEM_ADMIN") {
          const { count, error: countErr } = await supabaseAdmin
            .from("user_roles")
            .select("id", { count: "exact", head: true })
            .eq("role", "SYSTEM_ADMIN");

          if (countErr) {
            return json({ success: false, message: "Falha ao validar administradores", code: "SERVER_ERROR" }, 500);
          }
          if ((count || 0) <= 1) {
            return json({
              success: false,
              message: "Não é possível remover o último administrador do sistema",
              code: "LAST_SYSTEM_ADMIN",
            }, 409);
          }
        }

        const { error: deleteErr } = await supabaseAdmin
          .from("user_roles")
          .delete()
          .eq("id", roleId);

        if (deleteErr) {
          return json({ success: false, message: deleteErr.message, code: "DELETE_ROLE_FAILED" }, 400);
        }

        await supabaseAdmin.from("events").insert({
          event_type: "USER_ROLE_REMOVED",
          entity_type: "user",
          entity_id: roleRow.user_id,
          user_id: requesterId,
          metadata: {
            target_user_id: roleRow.user_id,
            role_id: roleRow.id,
            role: roleRow.role,
            organization_id: roleRow.organization_id,
            group_id: roleRow.group_id,
            requested_by: requesterId,
          },
        });

        return json({ success: true, action: "remove", role_id: roleId, user_id: roleRow.user_id });
      }

      const userId = (body.user_id || "").trim();
      const role = body.role;
      const organizationIdRaw = (body.organization_id || "").trim();
      const groupIdRaw = (body.group_id || "").trim();
      let organizationId: string | null = organizationIdRaw || null;
      let groupId: string | null = groupIdRaw || null;

      if (!isUuid(userId) || !role || !isAppRole(role)) {
        return json({ success: false, message: "Dados inválidos", code: "VALIDATION_ERROR" }, 400);
      }

      if (role === "SYSTEM_ADMIN") {
        organizationId = null;
        groupId = null;
      } else if (role === "ORG_ADMIN" || role === "USER") {
        if (!organizationId || !isUuid(organizationId)) {
          return json({ success: false, message: "organization_id obrigatório", code: "VALIDATION_ERROR" }, 400);
        }
        groupId = null;
      } else if (role === "GROUP_MANAGER") {
        if (!groupId || !isUuid(groupId)) {
          return json({ success: false, message: "group_id obrigatório", code: "VALIDATION_ERROR" }, 400);
        }
        const { data: groupRow, error: groupErr } = await supabaseAdmin
          .from("groups")
          .select("id, organization_id")
          .eq("id", groupId)
          .maybeSingle();
        if (groupErr) {
          return json({ success: false, message: groupErr.message, code: "SERVER_ERROR" }, 500);
        }
        if (!groupRow?.id) {
          return json({ success: false, message: "Grupo não encontrado", code: "GROUP_NOT_FOUND" }, 404);
        }
        if (organizationId && organizationId !== groupRow.organization_id) {
          return json({ success: false, message: "Grupo não pertence à organização informada", code: "VALIDATION_ERROR" }, 400);
        }
        organizationId = groupRow.organization_id;
      }

      const { error: insertErr } = await supabaseAdmin.from("user_roles").insert({
        user_id: userId,
        role,
        organization_id: organizationId,
        group_id: groupId,
      });

      if (insertErr) {
        const code = String((insertErr as any)?.code || "");
        if (code === "23505") {
          return json({ success: false, message: "Papel já atribuído", code: "ROLE_ALREADY_EXISTS" }, 409);
        }
        if (code === "23503") {
          return json({ success: false, message: "Usuário/escopo inválido", code: "VALIDATION_ERROR" }, 400);
        }
        return json({ success: false, message: insertErr.message, code: "ADD_ROLE_FAILED" }, 400);
      }

      await supabaseAdmin.from("events").insert({
        event_type: "USER_ROLE_ADDED",
        entity_type: "user",
        entity_id: userId,
        user_id: requesterId,
        metadata: {
          target_user_id: userId,
          role,
          organization_id: organizationId,
          group_id: groupId,
          requested_by: requesterId,
        },
      });

      return json({
        success: true,
        action: "add",
        user_id: userId,
        role,
        organization_id: organizationId,
        group_id: groupId,
      });
    } catch (err: any) {
      return json({ success: false, message: err?.message || "Erro interno", code: "SERVER_ERROR" }, 500);
    }
  };
}

const handler = createAdminManageUserRoleHandler();

if ((import.meta as any).main) {
  DenoRef.serve(handler);
}

export default handler;
