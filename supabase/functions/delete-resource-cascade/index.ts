import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Credentials": "true",
};

export default serve(async (req) => {
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
      return json({ success: false, message: "Unauthorized" }, 401);
    }

    const supabaseUser = createClient(url, anon, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: getUserErr } = await supabaseUser.auth.getUser();
    if (getUserErr || !userData?.user?.id) {
      return json({ success: false, message: "Unauthorized" }, 401);
    }

    const requesterId = userData.user.id;

    const { data: isAdmin, error: isAdminErr } = await supabaseUser.rpc("is_system_admin", {
      _user_id: requesterId,
    });
    if (isAdminErr) {
      return json({ success: false, message: isAdminErr.message }, 500);
    }
    if (!isAdmin) {
      return json({ success: false, message: "Forbidden" }, 403);
    }

    const payload = await req.json().catch(() => null) as {
      resourceType?: "organization" | "group";
      resourceId?: string;
    } | null;

    if (!payload || !payload.resourceType || !payload.resourceId) {
      return json({ success: false, message: "Dados obrigatórios ausentes" }, 400);
    }

    const supabaseAdmin = createClient(url, service);

    if (payload.resourceType === "group") {
      const { data: beforeCounts } = await supabaseAdmin
        .from("groups")
        .select("id, organization_id")
        .eq("id", payload.resourceId)
        .maybeSingle();

      if (!beforeCounts) {
        return json({ success: false, message: "Grupo não encontrado" }, 404);
      }

      const { data: deleted, error: delErr } = await supabaseAdmin
        .from("groups")
        .delete()
        .eq("id", payload.resourceId)
        .select("id");

      if (delErr) {
        return json({ success: false, message: delErr.message }, 400);
      }

      await supabaseAdmin
        .from("events")
        .insert({
          event_type: "cascade_delete",
          entity_type: "group",
          entity_id: payload.resourceId,
          user_id: requesterId,
          metadata: { organization_id: beforeCounts.organization_id },
        });

      return json({ success: true });
    }

    if (payload.resourceType === "organization") {
      const { data: org, error: orgErr } = await supabaseAdmin
        .from("organizations")
        .select("id")
        .eq("id", payload.resourceId)
        .maybeSingle();

      if (orgErr) {
        return json({ success: false, message: orgErr.message }, 400);
      }
      if (!org) {
        return json({ success: false, message: "Organização não encontrada" }, 404);
      }

      const { error: delErr } = await supabaseAdmin
        .from("organizations")
        .delete()
        .eq("id", payload.resourceId);

      if (delErr) {
        return json({ success: false, message: delErr.message }, 400);
      }

      await supabaseAdmin
        .from("events")
        .insert({
          event_type: "cascade_delete",
          entity_type: "organization",
          entity_id: payload.resourceId,
          user_id: requesterId,
          metadata: {},
        });

      return json({ success: true });
    }

    return json({ success: false, message: "resourceType inválido" }, 400);
  } catch (err: any) {
    return json({ success: false, message: err?.message || "Erro interno" }, 500);
  }
});
