import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const SUPABASE_JS_URL: string = "https://esm.sh/@supabase/supabase-js@2.45.4";

const DenoRef = (globalThis as any).Deno;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Credentials": "true",
};

type Env = {
  get: (key: string) => string | undefined;
};

type CreateClient = (...args: any[]) => any;

let createClientCached: CreateClient | null = null;
async function getCreateClient(): Promise<CreateClient> {
  if (createClientCached) return createClientCached;
  const mod = await import(SUPABASE_JS_URL as any);
  createClientCached = (mod as any).createClient as CreateClient;
  return createClientCached;
}

type Payload = {
  resourceType?: "organization" | "group";
  resourceId?: string;
} | null;

function isDependencyError(err: any): boolean {
  const code = (err?.code || "").toString();
  if (code === "23503") return true;
  const m = (err?.message || err || "").toString().toLowerCase();
  return m.includes("violates foreign key") || m.includes("foreign key") || m.includes("still referenced");
}

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const json = (body: any, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Connection": "keep-alive",
    },
  });

async function readPayload(req: Request): Promise<Payload> {
  return await req.json().catch(() => null) as Payload;
}

async function countByGroupId(supabaseAdmin: any, table: string, groupId: string): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("group_id", groupId);
  if (error) throw error;
  return Number(count || 0);
}

async function countByOrgId(supabaseAdmin: any, table: string, orgId: string): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId);
  if (error) throw error;
  return Number(count || 0);
}

async function countByGroupIds(supabaseAdmin: any, table: string, groupIds: string[]): Promise<number> {
  if (groupIds.length === 0) return 0;
  const { count, error } = await supabaseAdmin
    .from(table)
    .select("id", { count: "exact", head: true })
    .in("group_id", groupIds);
  if (error) throw error;
  return Number(count || 0);
}

async function deleteByGroupIds(supabaseAdmin: any, table: string, groupIds: string[]) {
  if (groupIds.length === 0) return;
  const chunkSize = 50;
  for (let i = 0; i < groupIds.length; i += chunkSize) {
    const chunk = groupIds.slice(i, i + chunkSize);
    const { error } = await supabaseAdmin
      .from(table)
      .delete()
      .in("group_id", chunk);
    if (error) throw error;
  }
}

export function createDeleteResourceCascadeHandler(
  deps: { createClient?: CreateClient; env?: Env } = {},
) {
  const env = deps.env ?? { get: (key: string) => DenoRef?.env?.get?.(key) };

  return async (req: Request) => {
    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (req.method !== "POST") {
      return json({ success: false, message: "Method not allowed", code: "METHOD_NOT_ALLOWED" }, 405);
    }

    const url = env.get("SUPABASE_URL");
    const anon = env.get("SUPABASE_ANON_KEY");
    const service = env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !anon || !service) {
      console.log(JSON.stringify({ stage: "env_missing", hasUrl: !!url, hasAnon: !!anon, hasService: !!service, status: 500 }));
      return json({ success: false, message: "Configuração ausente", code: "SERVER_ERROR" }, 500);
    }

    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return json({ success: false, message: "Unauthorized", code: "UNAUTHORIZED" }, 401);
    }

    const createClientImpl = deps.createClient ?? await getCreateClient();

    const supabaseUser = createClientImpl(url, anon, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: getUserErr } = await (supabaseUser as any).auth.getUser();
    if (getUserErr || !userData?.user?.id) {
      console.log(JSON.stringify({ stage: "auth_get_user", error: getUserErr?.message, status: 401 }));
      return json({ success: false, message: "Unauthorized", code: "UNAUTHORIZED" }, 401);
    }

    const requesterId = userData.user.id as string;

    const { data: isAdmin, error: isAdminErr } = await (supabaseUser as any).rpc("is_system_admin", {
      _user_id: requesterId,
    });
    if (isAdminErr) {
      console.log(JSON.stringify({ stage: "check_admin", requesterId, error: isAdminErr.message, status: 500 }));
      return json({ success: false, message: "Falha ao validar permissões", code: "SERVER_ERROR" }, 500);
    }
    if (!isAdmin) {
      console.log(JSON.stringify({ stage: "check_admin", requesterId, status: 403 }));
      return json({ success: false, message: "Forbidden", code: "FORBIDDEN" }, 403);
    }

    const payload = await readPayload(req);
    if (!payload?.resourceType || !payload?.resourceId) {
      console.log(JSON.stringify({ stage: "validation", requesterId, payload, status: 400 }));
      return json({ success: false, message: "Dados obrigatórios ausentes", code: "VALIDATION_ERROR" }, 400);
    }

    if (!(payload.resourceType === "group" || payload.resourceType === "organization")) {
      return json({ success: false, message: "resourceType inválido", code: "VALIDATION_ERROR" }, 400);
    }

    if (!isUuid(payload.resourceId)) {
      return json({ success: false, message: "resourceId inválido", code: "VALIDATION_ERROR" }, 400);
    }

    const supabaseAdmin = createClientImpl(url, service);

    if (payload.resourceType === "group") {
      console.log(JSON.stringify({ stage: "group_start", requesterId, groupId: payload.resourceId, status: 200 }));

      const { data: group, error: groupErr } = await (supabaseAdmin as any)
        .from("groups")
        .select("id, organization_id, name")
        .eq("id", payload.resourceId)
        .maybeSingle();

      if (groupErr) {
        console.log(JSON.stringify({ stage: "group_load", requesterId, groupId: payload.resourceId, error: groupErr.message, status: 400 }));
        return json({ success: false, message: groupErr.message, code: "READ_FAILED" }, 400);
      }
      if (!group) {
        return json({ success: false, message: "Grupo não encontrado", code: "NOT_FOUND" }, 404);
      }

      let counts: Record<string, number> = {};
      try {
        counts = {
          members: await countByGroupId(supabaseAdmin, "members", payload.resourceId),
          messages: await countByGroupId(supabaseAdmin, "messages", payload.resourceId),
          group_members: await countByGroupId(supabaseAdmin, "group_members", payload.resourceId),
          polls: await countByGroupId(supabaseAdmin, "polls", payload.resourceId),
          member_events: await countByGroupId(supabaseAdmin, "member_events", payload.resourceId),
          message_reactions: await countByGroupId(supabaseAdmin, "message_reactions", payload.resourceId),
          group_members_archive: await countByGroupId(supabaseAdmin, "group_members_archive", payload.resourceId),
          user_roles: (() => 0)(),
        };

        const { count: rolesCount, error: rolesErr } = await (supabaseAdmin as any)
          .from("user_roles")
          .select("id", { count: "exact", head: true })
          .eq("group_id", payload.resourceId);
        if (rolesErr) throw rolesErr;
        counts.user_roles = Number(rolesCount || 0);
      } catch (e: any) {
        console.log(JSON.stringify({ stage: "group_count", requesterId, groupId: payload.resourceId, error: e?.message, status: 500 }));
        return json({ success: false, message: "Falha ao checar dependências", code: "SERVER_ERROR" }, 500);
      }

      await (supabaseAdmin as any).from("events").insert({
        event_type: "GROUP_CASCADE_DELETE_ATTEMPT",
        entity_type: "group",
        entity_id: payload.resourceId,
        user_id: requesterId,
        metadata: {
          organization_id: group.organization_id,
          group_name: group.name,
          counts,
        },
      });

      try {
        try {
          const { error: delReactionsErr } = await (supabaseAdmin as any)
            .from("message_reactions")
            .delete()
            .eq("group_id", payload.resourceId);
          if (delReactionsErr) throw delReactionsErr;
        } catch (e: any) {
          console.log(JSON.stringify({ stage: "group_cleanup", requesterId, groupId: payload.resourceId, error: e?.message, status: 400 }));
          await (supabaseAdmin as any).from("events").insert({
            event_type: "GROUP_CASCADE_DELETE_FAILED",
            entity_type: "group",
            entity_id: payload.resourceId,
            user_id: requesterId,
            metadata: {
              organization_id: group.organization_id,
              group_name: group.name,
              counts,
              error: { message: e?.message || "Falha na limpeza" },
            },
          });
          return json({
            success: false,
            message: "Falha ao limpar dependências do grupo",
            code: "DEPENDENCY_CLEANUP_FAILED",
            details: { counts },
          }, 400);
        }

        const { data: deleted, error: delGroupErr } = await (supabaseAdmin as any)
          .from("groups")
          .delete()
          .eq("id", payload.resourceId)
          .select("id")
          .maybeSingle();

        if (delGroupErr) {
          const isDep = isDependencyError(delGroupErr);
          console.log(JSON.stringify({
            stage: "group_delete",
            requesterId,
            groupId: payload.resourceId,
            error: { message: delGroupErr.message, code: (delGroupErr as any).code, details: (delGroupErr as any).details, hint: (delGroupErr as any).hint },
            status: isDep ? 409 : 400,
          }));

          await (supabaseAdmin as any).from("events").insert({
            event_type: "GROUP_CASCADE_DELETE_FAILED",
            entity_type: "group",
            entity_id: payload.resourceId,
            user_id: requesterId,
            metadata: {
              organization_id: group.organization_id,
              group_name: group.name,
              counts,
              error: {
                message: delGroupErr.message,
                code: (delGroupErr as any).code,
                details: (delGroupErr as any).details,
                hint: (delGroupErr as any).hint,
              },
            },
          });

          return json({
            success: false,
            message: "Não foi possível excluir o grupo agora",
            code: isDep ? "DEPENDENCIES_EXIST" : "DELETE_FAILED",
            details: { counts },
          }, isDep ? 409 : 400);
        }

        await (supabaseAdmin as any).from("events").insert({
          event_type: "GROUP_CASCADE_DELETED",
          entity_type: "group",
          entity_id: payload.resourceId,
          user_id: requesterId,
          metadata: {
            organization_id: group.organization_id,
            group_name: group.name,
            counts,
            deleted_id: deleted?.id ?? payload.resourceId,
          },
        });

        console.log(JSON.stringify({ stage: "group_success", requesterId, groupId: payload.resourceId, counts, status: 200 }));
        return json({ success: true, resourceType: "group", resourceId: payload.resourceId, counts });
      } catch (e: any) {
        console.log(JSON.stringify({ stage: "group_catch", requesterId, groupId: payload.resourceId, error: e?.message, status: 500 }));
        await (supabaseAdmin as any).from("events").insert({
          event_type: "GROUP_CASCADE_DELETE_FAILED",
          entity_type: "group",
          entity_id: payload.resourceId,
          user_id: requesterId,
          metadata: {
            organization_id: group.organization_id,
            group_name: group.name,
            counts,
            error: { message: e?.message || "Erro interno" },
          },
        });
        return json({ success: false, message: "Erro interno", code: "SERVER_ERROR" }, 500);
      }
    }

    if (payload.resourceType === "organization") {
      console.log(JSON.stringify({ stage: "org_start", requesterId, organizationId: payload.resourceId, status: 200 }));

      const { data: org, error: orgErr } = await (supabaseAdmin as any)
        .from("organizations")
        .select("id, name")
        .eq("id", payload.resourceId)
        .maybeSingle();

      if (orgErr) {
        console.log(JSON.stringify({ stage: "org_load", requesterId, organizationId: payload.resourceId, error: orgErr.message, status: 400 }));
        return json({ success: false, message: orgErr.message, code: "READ_FAILED" }, 400);
      }
      if (!org) {
        return json({ success: false, message: "Organização não encontrada", code: "NOT_FOUND" }, 404);
      }

      let counts: Record<string, number> = {};
      try {
        const { data: orgGroups, error: orgGroupsErr } = await (supabaseAdmin as any)
          .from("groups")
          .select("id")
          .eq("organization_id", payload.resourceId);
        if (orgGroupsErr) throw orgGroupsErr;
        const groupIds = ((orgGroups ?? []) as any[]).map((g) => g.id).filter(Boolean) as string[];

        counts = {
          groups: groupIds.length,
          organization_contacts: await countByOrgId(supabaseAdmin, "organization_contacts", payload.resourceId),
          user_roles: (() => 0)(),
          member_events: await countByGroupIds(supabaseAdmin, "member_events", groupIds),
          message_reactions: await countByGroupIds(supabaseAdmin, "message_reactions", groupIds),
        };

        const { count: rolesCount, error: rolesErr } = await (supabaseAdmin as any)
          .from("user_roles")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", payload.resourceId);
        if (rolesErr) throw rolesErr;
        counts.user_roles = Number(rolesCount || 0);
      } catch (_e) {
        counts = {};
      }

      await (supabaseAdmin as any).from("events").insert({
        event_type: "ORG_CASCADE_DELETE_ATTEMPT",
        entity_type: "organization",
        entity_id: payload.resourceId,
        user_id: requesterId,
        metadata: { organization_name: org.name, counts },
      });

      try {
        const { data: orgGroups, error: orgGroupsErr } = await (supabaseAdmin as any)
          .from("groups")
          .select("id")
          .eq("organization_id", payload.resourceId);
        if (orgGroupsErr) throw orgGroupsErr;

        const groupIds = ((orgGroups ?? []) as any[]).map((g) => g.id).filter(Boolean) as string[];

        await deleteByGroupIds(supabaseAdmin, "member_events", groupIds);
        await deleteByGroupIds(supabaseAdmin, "message_reactions", groupIds);
      } catch (e: any) {
        console.log(JSON.stringify({ stage: "org_cleanup", requesterId, organizationId: payload.resourceId, error: e?.message, status: 400 }));
        await (supabaseAdmin as any).from("events").insert({
          event_type: "ORG_CASCADE_DELETE_FAILED",
          entity_type: "organization",
          entity_id: payload.resourceId,
          user_id: requesterId,
          metadata: { organization_name: org.name, counts, error: { message: e?.message || "Falha na limpeza" } },
        });
        return json({ success: false, message: "Falha ao limpar dependências da organização", code: "DEPENDENCY_CLEANUP_FAILED", details: { counts } }, 400);
      }

      const { error: delErr } = await (supabaseAdmin as any)
        .from("organizations")
        .delete()
        .eq("id", payload.resourceId);

      if (delErr) {
        const isDep = isDependencyError(delErr);
        console.log(JSON.stringify({ stage: "org_delete", requesterId, organizationId: payload.resourceId, error: delErr.message, status: 409 }));
        await (supabaseAdmin as any).from("events").insert({
          event_type: "ORG_CASCADE_DELETE_FAILED",
          entity_type: "organization",
          entity_id: payload.resourceId,
          user_id: requesterId,
          metadata: { organization_name: org.name, counts, error: { message: delErr.message, code: (delErr as any).code } },
        });
        return json({ success: false, message: "Não foi possível excluir a organização agora", code: isDep ? "DEPENDENCIES_EXIST" : "DELETE_FAILED", details: { counts } }, isDep ? 409 : 400);
      }

      await (supabaseAdmin as any).from("events").insert({
        event_type: "ORG_CASCADE_DELETED",
        entity_type: "organization",
        entity_id: payload.resourceId,
        user_id: requesterId,
        metadata: { organization_name: org.name, counts },
      });

      console.log(JSON.stringify({ stage: "org_success", requesterId, organizationId: payload.resourceId, counts, status: 200 }));
      return json({ success: true, resourceType: "organization", resourceId: payload.resourceId, counts });
    }

    return json({ success: false, message: "resourceType inválido", code: "VALIDATION_ERROR" }, 400);
  };
}

const handler = createDeleteResourceCascadeHandler();

if ((import.meta as any).main) {
  DenoRef.serve(handler);
}

export default handler;
