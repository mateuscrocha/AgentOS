import Stripe from "https://esm.sh/stripe@14.24.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export function getEnvOrThrow(name: string): string {
  const value = Deno.env.get(name);
  if (!value || value.trim() === "") {
    throw new Error(`Configuração ausente: ${name}`);
  }
  return value;
}

const SETTING_ID = "stripe_secret_key";

type EncryptedPayload = {
  v: 1;
  alg: "A256GCM";
  iv: string;
  ct: string;
};

function b64Decode(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function deriveAesKey(secret: string): Promise<CryptoKey> {
  const raw = new TextEncoder().encode(secret);
  const hash = await crypto.subtle.digest("SHA-256", raw);
  return crypto.subtle.importKey("raw", hash, { name: "AES-GCM" }, false, ["decrypt"]);
}

async function decryptString(payloadText: string, secret: string): Promise<string> {
  const p = JSON.parse(payloadText) as EncryptedPayload;
  if (!p || p.v !== 1 || p.alg !== "A256GCM" || !p.iv || !p.ct) {
    throw new Error("Payload criptografado inválido");
  }
  const key = await deriveAesKey(secret);
  const iv = b64Decode(p.iv);
  const ct = b64Decode(p.ct);
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv.buffer as ArrayBuffer },
    key,
    ct.buffer as ArrayBuffer,
  );
  return new TextDecoder().decode(pt);
}

let cachedStripe: Stripe | null = null;
let cachedStripeKey: string | null = null;
let cachedStripeExpiresAt = 0;

async function loadStripeSecretKeyFromDb(): Promise<string | null> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const encryptionSecret = Deno.env.get("STRIPE_KEY_ENCRYPTION_SECRET") || "";
  if (!supabaseUrl || !serviceKey) return null;

  const supabaseAdmin = createClient(supabaseUrl, serviceKey);
  const { data: row, error } = await supabaseAdmin
    .from("system_secrets")
    .select("encrypted_value")
    .eq("id", SETTING_ID)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!row?.encrypted_value) return null;
  if (!encryptionSecret) {
    throw new Error("Configuração ausente: STRIPE_KEY_ENCRYPTION_SECRET");
  }
  return await decryptString(row.encrypted_value, encryptionSecret);
}

export async function getStripe(): Promise<Stripe> {
  const now = Date.now();
  if (cachedStripe && cachedStripeKey && now < cachedStripeExpiresAt) return cachedStripe;

  const dbKey = await loadStripeSecretKeyFromDb().catch((err) => {
    throw err;
  });
  const key = dbKey || Deno.env.get("STRIPE_SECRET_KEY") || "";
  if (!key) {
    throw new Error("Configuração ausente: STRIPE_SECRET_KEY");
  }

  if (!cachedStripe || cachedStripeKey !== key) {
    cachedStripe = new Stripe(key, { apiVersion: "2024-11-20" });
    cachedStripeKey = key;
  }
  cachedStripeExpiresAt = now + 60_000;
  return cachedStripe;
}

export const STRIPE_PUBLISHABLE_KEY = getEnvOrThrow("STRIPE_PUBLISHABLE_KEY");
export const STRIPE_WEBHOOK_SECRET = getEnvOrThrow("STRIPE_WEBHOOK_SECRET");
export const STRIPE_PRICE_ID_DEFAULT = getEnvOrThrow("STRIPE_PRICE_ID_DEFAULT");
export const STRIPE_CHECKOUT_SUCCESS_URL = getEnvOrThrow("STRIPE_CHECKOUT_SUCCESS_URL");
export const STRIPE_CHECKOUT_CANCEL_URL = getEnvOrThrow("STRIPE_CHECKOUT_CANCEL_URL");
export const STRIPE_CUSTOMER_PORTAL_RETURN_URL = getEnvOrThrow("STRIPE_CUSTOMER_PORTAL_RETURN_URL");

export function mapStripeStatusToBilling(status: string): "inactive" | "trialing" | "active" | "past_due" | "canceled" {
  switch (status) {
    case "trialing":
      return "trialing";
    case "active":
      return "active";
    case "past_due":
      return "past_due";
    case "canceled":
    case "unpaid":
      return "canceled";
    default:
      return "inactive";
  }
}
