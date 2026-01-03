import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.24.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SETTING_ID = "stripe_secret_key";
const ENTITY_TYPE = "system_secret";
const ENTITY_ID = "5b0bdb2f-3f1f-4d3a-9f2d-3d1ef8a2b1e7";

type EncryptedPayload = {
  v: 1;
  alg: "A256GCM";
  iv: string;
  ct: string;
};

function b64Encode(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function b64Decode(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function deriveAesKey(secret: string): Promise<CryptoKey> {
  const raw = new TextEncoder().encode(secret);
  const hash = await crypto.subtle.digest("SHA-256", raw);
  return crypto.subtle.importKey("raw", hash, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

async function encryptString(plaintext: string, secret: string): Promise<EncryptedPayload> {
  const key = await deriveAesKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const pt = new TextEncoder().encode(plaintext);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, pt));
  return { v: 1, alg: "A256GCM", iv: b64Encode(iv), ct: b64Encode(ct) };
}

function parseStripeKeyParts(key: string): { prefix: string; last4: string } {
  const trimmed = (key || "").trim();
  const last4 = trimmed.slice(-4);
  const prefix = trimmed.startsWith("sk_live_") ? "sk_live_" : "sk_test_";
  return { prefix, last4 };
}

function isValidStripeSecretKeyFormat(key: string): boolean {
  const k = (key || "").trim();
  return /^sk_(live|test)_[0-9A-Za-z]+$/.test(k);
}

function maskStripeKey(prefix: string, last4: string): string {
  if (!prefix || !last4) return "Não configurado";
  return `${prefix}${"•".repeat(12)}${last4}`;
}

async function verifyPassword(params: {
  supabaseUrl: string;
  anonKey: string;
  email: string;
  password: string;
}): Promise<{ ok: boolean; message?: string }>{
  const res = await fetch(`${params.supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: params.anonKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email: params.email, password: params.password }),
  });

  if (res.ok) return { ok: true };
  const body = await res.json().catch(() => null) as any;
  const msg = (body?.error_description || body?.msg || body?.error || "Senha inválida") as string;
  return { ok: false, message: msg };
}

export default Deno.serve(async (req: Request) => {
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

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const encryptionSecret = Deno.env.get("STRIPE_KEY_ENCRYPTION_SECRET") || "";

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return json({ success: false, message: "Unauthorized", code: "UNAUTHORIZED" }, 401);
    }

    const supabaseUser = createClient(url, anon, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: getUserErr } = await supabaseUser.auth.getUser();
    if (getUserErr || !userData?.user?.id) {
      return json({ success: false, message: "Unauthorized", code: "UNAUTHORIZED" }, 401);
    }

    const requesterId = userData.user.id;
    const requesterEmail = userData.user.email || "";

    const { data: isAdmin, error: isAdminErr } = await supabaseUser.rpc("is_system_admin", {
      _user_id: requesterId,
    });
    if (isAdminErr) {
      return json({ success: false, message: isAdminErr.message, code: "SERVER_ERROR" }, 500);
    }
    if (!isAdmin) {
      return json({ success: false, message: "Forbidden", code: "FORBIDDEN" }, 403);
    }

    const payload = (await req.json().catch(() => null)) as
      | { action?: "get" | "update" | "audit"; newKey?: string; password?: string }
      | null;

    const action = payload?.action || "get";
    const supabaseAdmin = createClient(url, service);

    if (action === "get") {
      const { data: row, error } = await supabaseAdmin
        .from("system_secrets")
        .select("key_prefix,key_last4,updated_at")
        .eq("id", SETTING_ID)
        .maybeSingle();
      if (error) return json({ success: false, message: error.message, code: "SERVER_ERROR" }, 500);
      const hasKey = !!row?.key_prefix && !!row?.key_last4;
      return json({
        success: true,
        has_key: hasKey,
        masked_key: hasKey ? maskStripeKey(row.key_prefix, row.key_last4) : "Não configurado",
        updated_at: row?.updated_at || null,
      });
    }

    if (action === "audit") {
      const { data: events, error } = await supabaseAdmin
        .from("events")
        .select("id,created_at,user_id,metadata")
        .eq("entity_type", ENTITY_TYPE)
        .eq("entity_id", ENTITY_ID)
        .eq("event_type", "STRIPE_KEY_UPDATE")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) return json({ success: false, message: error.message, code: "SERVER_ERROR" }, 500);

      const userIds = Array.from(new Set((events || []).map((e: any) => e.user_id).filter(Boolean)));
      const { data: profiles } = userIds.length
        ? await supabaseAdmin.from("profiles").select("id,name").in("id", userIds)
        : { data: [] as any[] };
      const nameById = new Map<string, string>();
      for (const p of profiles || []) nameById.set(p.id, p.name || "");

      return json({
        success: true,
        items: (events || []).map((e: any) => ({
          id: e.id,
          created_at: e.created_at,
          user_id: e.user_id,
          user_name: e.user_id ? nameById.get(e.user_id) || null : null,
          status: e.metadata?.status || null,
          message: e.metadata?.message || null,
        })),
      });
    }

    if (action === "update") {
      const newKey = (payload?.newKey || "").trim();
      const password = (payload?.password || "").trim();

      if (!newKey || !password) {
        return json({ success: false, message: "Dados obrigatórios ausentes", code: "VALIDATION_ERROR" }, 400);
      }
      if (!isValidStripeSecretKeyFormat(newKey)) {
        return json({ success: false, message: "Formato de chave inválido", code: "VALIDATION_ERROR" }, 400);
      }
      if (!requesterEmail) {
        return json({ success: false, message: "E-mail do usuário não encontrado", code: "SERVER_ERROR" }, 500);
      }
      if (!encryptionSecret) {
        return json({ success: false, message: "Configuração ausente: STRIPE_KEY_ENCRYPTION_SECRET", code: "SERVER_ERROR" }, 500);
      }

      const pw = await verifyPassword({
        supabaseUrl: url,
        anonKey: anon,
        email: requesterEmail,
        password,
      });
      if (!pw.ok) {
        await supabaseAdmin.from("events").insert({
          event_type: "STRIPE_KEY_UPDATE",
          entity_type: ENTITY_TYPE,
          entity_id: ENTITY_ID,
          user_id: requesterId,
          metadata: { status: "failed", message: "Reautenticação falhou" },
        });
        return json({ success: false, message: "Senha inválida", code: "REAUTH_FAILED" }, 401);
      }

      let stripeAccountId: string | null = null;
      try {
        const stripe = new Stripe(newKey, { apiVersion: "2024-11-20" });
        const acct = await stripe.accounts.retrieve();
        stripeAccountId = acct?.id || null;
      } catch (err: any) {
        await supabaseAdmin.from("events").insert({
          event_type: "STRIPE_KEY_UPDATE",
          entity_type: ENTITY_TYPE,
          entity_id: ENTITY_ID,
          user_id: requesterId,
          metadata: { status: "failed", message: "Falha ao validar chave com a Stripe" },
        });
        return json({ success: false, message: "Falha ao validar chave com a Stripe", code: "STRIPE_CONNECTIVITY_FAILED" }, 400);
      }

      const enc = await encryptString(newKey, encryptionSecret);
      const { prefix, last4 } = parseStripeKeyParts(newKey);

      const { error: upsertErr } = await supabaseAdmin
        .from("system_secrets")
        .upsert(
          {
            id: SETTING_ID,
            encrypted_value: JSON.stringify(enc),
            key_prefix: prefix,
            key_last4: last4,
            updated_by: requesterId,
          },
          { onConflict: "id" },
        );
      if (upsertErr) {
        await supabaseAdmin.from("events").insert({
          event_type: "STRIPE_KEY_UPDATE",
          entity_type: ENTITY_TYPE,
          entity_id: ENTITY_ID,
          user_id: requesterId,
          metadata: { status: "failed", message: "Falha ao salvar chave" },
        });
        return json({ success: false, message: upsertErr.message, code: "SAVE_FAILED" }, 500);
      }

      await supabaseAdmin.from("events").insert({
        event_type: "STRIPE_KEY_UPDATE",
        entity_type: ENTITY_TYPE,
        entity_id: ENTITY_ID,
        user_id: requesterId,
        metadata: { status: "success", key_prefix: prefix, key_last4: last4, stripe_account_id: stripeAccountId },
      });

      return json({
        success: true,
        masked_key: maskStripeKey(prefix, last4),
        stripe_account_id: stripeAccountId,
      });
    }

    return json({ success: false, message: "Ação inválida", code: "VALIDATION_ERROR" }, 400);
  } catch (err: any) {
    return json({ success: false, message: err?.message || "Erro interno", code: "SERVER_ERROR" }, 500);
  }
});
