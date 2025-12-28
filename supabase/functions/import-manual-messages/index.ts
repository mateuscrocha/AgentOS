import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Item = {
  createdAtISO: string;
  senderPhone: string;
  text: string;
  textHash: string;
  importKey: string;
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(url, anon, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const serviceClient = createClient(url, service, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const body = await req.json();
    const groupId: string = body?.group_id;
    const items: Item[] = Array.isArray(body?.items) ? body.items : [];

    if (!groupId) {
      return new Response(JSON.stringify({ success: false, message: "group_id obrigatório" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    }
    if (!items || items.length === 0) {
      return new Response(JSON.stringify({ success: false, message: "Nenhuma mensagem" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    }

    const { data: user } = await userClient.auth.getUser();
    const userId = user?.user?.id || null;
    if (!userId) {
      return new Response(JSON.stringify({ success: false, message: "Não autenticado" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });
    }

    const { data: canEdit } = await serviceClient.rpc("can_edit_group", { _group_id: groupId, _user_id: userId });
    if (!canEdit) {
      return new Response(JSON.stringify({ success: false, message: "Sem permissão" }), { status: 403, headers: { ...cors, "Content-Type": "application/json" } });
    }

    let inserted = 0;
    let duplicates = 0;

    for (const it of items) {
      const exists = await serviceClient
        .from("messages")
        .select("id")
        .eq("provider", "manual_import")
        .eq("provider_message_id", it.importKey)
        .maybeSingle();
      if (exists.data?.id) {
        duplicates++;
        continue;
      }
      const ins = await serviceClient.from("messages").insert({
        group_id: groupId,
        message_type: "text",
        provider: "manual_import",
        provider_message_id: it.importKey,
        sender_phone: it.senderPhone,
        text: it.text,
        created_at: it.createdAtISO,
        metadata: { source: "manual_import", text_hash: it.textHash },
      });
      if (!ins.error) inserted++;
    }

    return new Response(JSON.stringify({ success: true, inserted, duplicates }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro";
    return new Response(JSON.stringify({ success: false, message }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});

