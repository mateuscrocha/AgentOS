import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

function normalizePhoneE164(phone: string): string {
  const raw = (phone || "").trim();
  if (!raw) return "";
  if (raw.startsWith("+")) return raw.replace(/\s+/g, "");
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("55") && digits.length >= 10) return "+" + digits;
  return "+55" + digits;
}

export default Deno.serve(async (req: Request) => {
  const json = (body: any, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: {
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
      name?: string;
      email?: string;
      whatsapp_phone?: string;
      password?: string;
    } | null;

    if (!payload || !payload.name || !payload.email || !payload.password) {
      return json({ success: false, message: "Dados obrigatórios ausentes" }, 400);
    }

    const supabaseAdmin = createClient(url, service);

    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: payload.email,
      password: payload.password,
      user_metadata: { name: payload.name },
      email_confirm: false,
    });

    if (createErr) {
      const msg = createErr.message || "Erro ao criar usuário";
      const status = msg.includes("already registered") ? 409 : 400;
      return json({ success: false, message: msg }, status);
    }

    const newUserId = created?.user?.id;
    if (!newUserId) {
      return json({ success: false, message: "Usuário não retornado" }, 500);
    }

    const phone = normalizePhoneE164(payload.whatsapp_phone || "");

    await supabaseAdmin
      .from("profiles")
      .update({ name: payload.name, phone_e164: phone, status: "active" })
      .eq("id", newUserId);

    return json({ success: true, user_id: newUserId });
  } catch (err: any) {
    return json({ success: false, message: err?.message || "Erro interno" }, 500);
  }
});

