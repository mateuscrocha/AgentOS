import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normalizePhoneE164(input: string | null): string | null {
  const raw = (input || "").trim();
  if (!raw) return null;
  const cleaned = raw.replace(/[\s\-()]/g, "");
  if (cleaned.startsWith("+")) {
    const digits = cleaned.replace(/[^+\d]/g, "");
    return digits || null;
  }
  const digits = cleaned.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("55") && digits.length >= 10) return `+${digits}`;
  if (digits.length === 10 || digits.length === 11) return `+55${digits}`;
  return `+${digits}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const groupId: string = body?.group_id;
    const items: Array<{
      createdAtISO: string;
      senderRaw: string;
      senderPhone: string | null;
      senderName: string | null;
      text: string;
      textHash: string;
      importKey: string;
    }> = Array.isArray(body?.items) ? body.items : [];

    if (!groupId || items.length === 0) {
      return new Response(
        JSON.stringify({ success: false, message: "Parâmetros inválidos" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let inserted = 0;
    let duplicates = 0;
    let errors = 0;

    for (const it of items) {
      let memberId: string | null = null;
      const phone = normalizePhoneE164(it.senderPhone);
      if (phone) {
        const { data: existingByPhone } = await supabase
          .from("members")
          .select("id")
          .eq("group_id", groupId)
          .eq("phone_e164", phone)
          .maybeSingle();
        if (existingByPhone?.id) {
          memberId = existingByPhone.id;
        } else {
          const { data: created } = await supabase
            .from("members")
            .insert({
              group_id: groupId,
              name: phone,
              display_name: phone,
              phone_e164: phone,
              whatsapp_provider_id: phone.replace(/\D/g, "") || null,
              provider: "whatsapp",
              first_seen_at: it.createdAtISO,
              joined_at: it.createdAtISO,
              status: "active",
              metadata: { origin: "manual_import" },
            })
            .select("id")
            .single();
          memberId = created?.id || null;
        }
      } else {
        const name = (it.senderName || it.senderRaw || "").trim();
        if (!name) {
          errors++;
          continue;
        }
        const { data: existingByName } = await supabase
          .from("members")
          .select("id, name, display_name")
          .eq("group_id", groupId)
          .or(`name.ilike.${name},display_name.ilike.${name}`)
          .maybeSingle();
        if (existingByName?.id) {
          memberId = existingByName.id;
        } else {
          const { data: created } = await supabase
            .from("members")
            .insert({
              group_id: groupId,
              name,
              display_name: name,
              phone_e164: null,
              provider: "whatsapp",
              first_seen_at: it.createdAtISO,
              joined_at: it.createdAtISO,
              status: "active",
              metadata: { origin: "manual_import" },
            })
            .select("id")
            .single();
          memberId = created?.id || null;
        }
      }

      if (!memberId) {
        errors++;
        continue;
      }

      const createdAtISO = it.createdAtISO;
      const textHash = it.textHash;
      const { data: existing } = await supabase
        .from("messages")
        .select("id")
        .eq("group_id", groupId)
        .eq("member_id", memberId)
        .eq("created_at", createdAtISO)
        .contains("metadata", { text_hash: textHash })
        .maybeSingle();
      if (existing?.id) {
        duplicates++;
        continue;
      }

      const { error: insErr } = await supabase
        .from("messages")
        .insert({
          group_id: groupId,
          member_id: memberId,
          message_type: "text",
          provider: "manual_import",
          whatsapp_provider_id: it.importKey,
          sender_phone: phone,
          sender_name: phone ? null : (it.senderName || it.senderRaw),
          content: it.text,
          text: it.text,
          created_at: createdAtISO,
          metadata: { source: "manual_import", text_hash: textHash },
        });
      if (insErr) {
        errors++;
      } else {
        inserted++;
      }
    }

    return new Response(
      JSON.stringify({ success: true, inserted, duplicates, errors }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ success: false, message: (e as Error)?.message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
