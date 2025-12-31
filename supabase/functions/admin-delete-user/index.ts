import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const DenoRef = (globalThis as any).Deno;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v || "");
}

function isDependencyError(err: any): boolean {
  const code = (err?.code || "").toString();
  if (code === "23503") return true;
  const m = (err?.message || err || "").toString().toLowerCase();
  return m.includes("violates foreign key") || m.includes("foreign key") || m.includes("still referenced");
}

type EnvGetter = { get: (key: string) => string | undefined };
type CreateClientLike = typeof createClient;

export function createAdminDeleteUserHandler(deps: { createClient?: CreateClientLike; env?: EnvGetter } = {}) {
  const createClientImpl = deps.createClient ?? createClient;
  const env = deps.env ?? { get: (key: string) => DenoRef?.env?.get?.(key) };

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
        console.log(JSON.stringify({ stage: "auth_get_user", error: getUserErr?.message, status: 401 }));
        return json({ success: false, message: "Unauthorized", code: "UNAUTHORIZED" }, 401);
      }

      const requesterId = userData.user.id;

      const { data: isAdmin, error: isAdminErr } = await supabaseUser.rpc("is_system_admin", {
        _user_id: requesterId,
      });
      if (isAdminErr) {
        console.log(JSON.stringify({ stage: "check_admin", error: isAdminErr.message, status: 500 }));
        return json({ success: false, message: isAdminErr.message, code: "SERVER_ERROR" }, 500);
      }
      if (!isAdmin) {
        console.log(JSON.stringify({ stage: "check_admin", requesterId, status: 403 }));
        return json({ success: false, message: "Forbidden", code: "FORBIDDEN" }, 403);
      }

      const payload = (await req.json().catch(() => null)) as { user_id?: string } | null;
      const targetUserId = (payload?.user_id || "").trim();
      if (!isUuid(targetUserId)) {
        console.log(JSON.stringify({ stage: "validation", targetUserIdPresent: !!targetUserId, status: 400 }));
        return json({ success: false, message: "user_id inválido", code: "VALIDATION_ERROR" }, 400);
      }

      if (targetUserId === requesterId) {
        return json({ success: false, message: "Você não pode excluir seu próprio usuário", code: "CANNOT_DELETE_SELF" }, 400);
      }

      const supabaseAdmin = createClientImpl(url, service);

      const { data: targetIsSystemAdminRole } = await supabaseAdmin
        .from("user_roles")
        .select("id")
        .eq("user_id", targetUserId)
        .eq("role", "SYSTEM_ADMIN")
        .limit(1)
        .maybeSingle();

      if (targetIsSystemAdminRole?.id) {
        const { count: systemAdminsCount, error: cntErr } = await supabaseAdmin
          .from("user_roles")
          .select("user_id", { count: "exact", head: true })
          .eq("role", "SYSTEM_ADMIN");

        if (cntErr) {
          console.log(JSON.stringify({ stage: "count_system_admins", error: cntErr.message, status: 500 }));
          return json({ success: false, message: "Falha ao validar administradores", code: "SERVER_ERROR" }, 500);
        }

        if ((systemAdminsCount || 0) <= 1) {
          return json({
            success: false,
            message: "Não é possível excluir o último administrador do sistema",
            code: "LAST_SYSTEM_ADMIN",
          }, 409);
        }
      }

      let deletedEmail: string | null = null;
      try {
        const { data: u } = await (supabaseAdmin as any).auth.admin.getUserById(targetUserId);
        deletedEmail = u?.user?.email || null;
      } catch (_e) {
        deletedEmail = null;
      }

      const { data: profileRow } = await supabaseAdmin
        .from("profiles")
        .select("name")
        .eq("id", targetUserId)
        .maybeSingle();
      const deletedName = (profileRow as any)?.name || null;

      const ownershipChanges: Array<{ organization_id: string; new_owner_user_id: string | null }> = [];
      const { data: ownedOrgs, error: ownedOrgsErr } = await supabaseAdmin
        .from("organizations")
        .select("id")
        .eq("owner_user_id", targetUserId);

      if (ownedOrgsErr) {
        console.log(JSON.stringify({
          stage: "list_owned_orgs",
          error: { message: ownedOrgsErr.message, code: (ownedOrgsErr as any).code, details: (ownedOrgsErr as any).details },
          status: 500,
        }));
        return json({ success: false, message: "Falha ao validar organizações do usuário", code: "SERVER_ERROR" }, 500);
      }

      for (const org of (ownedOrgs || []) as Array<{ id: string }>) {
        const orgId = org.id;
        const { data: replacement } = await supabaseAdmin
          .from("user_roles")
          .select("user_id, created_at")
          .eq("role", "ORG_ADMIN")
          .eq("organization_id", orgId)
          .neq("user_id", targetUserId)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();

        const newOwnerId = (replacement as any)?.user_id || null;
        const { error: updOwnerErr } = await supabaseAdmin
          .from("organizations")
          .update({ owner_user_id: newOwnerId })
          .eq("id", orgId);

        if (updOwnerErr) {
          console.log(JSON.stringify({
            stage: "update_org_owner",
            orgId,
            error: { message: updOwnerErr.message, code: (updOwnerErr as any).code, details: (updOwnerErr as any).details },
            status: 400,
          }));
          return json({ success: false, message: "Falha ao atualizar owner da organização", code: "DEPENDENCY_CLEANUP_FAILED" }, 400);
        }

        ownershipChanges.push({ organization_id: orgId, new_owner_user_id: newOwnerId });
      }

      const { error: clearGrantedByErr } = await supabaseAdmin
        .from("group_members")
        .update({ granted_by_user_id: null })
        .eq("granted_by_user_id", targetUserId);
      if (clearGrantedByErr) {
        console.log(JSON.stringify({
          stage: "clear_granted_by",
          error: { message: clearGrantedByErr.message, code: (clearGrantedByErr as any).code, details: (clearGrantedByErr as any).details },
          status: 400,
        }));
        return json({ success: false, message: "Falha ao limpar dependências do usuário", code: "DEPENDENCY_CLEANUP_FAILED" }, 400);
      }

      const { error: deleteAuthErr } = await (supabaseAdmin as any).auth.admin.deleteUser(targetUserId);
      if (deleteAuthErr) {
        const msg = deleteAuthErr.message || "Falha ao excluir usuário";
        const isDep = isDependencyError(deleteAuthErr);
        console.log(JSON.stringify({
          stage: "delete_auth_user",
          error: { message: msg, code: (deleteAuthErr as any).code, details: (deleteAuthErr as any).details, hint: (deleteAuthErr as any).hint },
          status: isDep ? 409 : 400,
        }));
        return json({
          success: false,
          message: msg,
          code: isDep ? "DEPENDENCIES_EXIST" : "DELETE_USER_FAILED",
        }, isDep ? 409 : 400);
      }

      await supabaseAdmin.from("events").insert({
        event_type: "USER_DELETED",
        entity_type: "user",
        entity_id: targetUserId,
        user_id: requesterId,
        metadata: {
          deleted_user_id: targetUserId,
          deleted_user_email: deletedEmail,
          deleted_user_name: deletedName,
          ownership_changes: ownershipChanges,
        },
      });

      console.log(JSON.stringify({ stage: "success", requesterId, deleted_user_id: targetUserId, status: 200 }));
      return json({
        success: true,
        deleted_user_id: targetUserId,
        ownership_changes: ownershipChanges,
      });
    } catch (err: any) {
      console.log(JSON.stringify({ stage: "catch", error: err?.message, status: 500 }));
      return new Response(JSON.stringify({ success: false, message: err?.message || "Erro interno", code: "SERVER_ERROR" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  };
}

const handler = createAdminDeleteUserHandler();

if ((import.meta as any).main) {
  DenoRef.serve(handler);
}

export default handler;
