import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { getStripe as getStripeRaw, mapStripeStatusToBilling } from "../_shared/stripeClient.ts";

export const config = {
  verify_jwt: false,
};

const DenoRef = (globalThis as any).Deno;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type EnvGetter = { get: (key: string) => string | undefined };
type CreateClientLike = typeof createClient;

type Payload = {
  stripe_customer_id?: string;
  limit?: number;
};

type StripeSubscription = {
  id: string;
  status: string;
  customer: string;
  current_period_end?: number | null;
  items?: { data?: Array<{ price?: { id?: string; nickname?: string | null; unit_amount?: number | null; currency?: string | null; recurring?: { interval?: string | null } | null } | null } | null> } | null;
};

type StripeListResponse<T> = {
  data: T[];
  has_more: boolean;
};

type StripeLike = {
  subscriptions: {
    list: (params: { customer: string; limit: number }) => Promise<StripeListResponse<StripeSubscription>>;
  };
};

function clampLimit(v: any, def: number, min: number, max: number): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return def;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

export function createBillingListStripeSubscriptionsHandler(
  deps: {
    createClient?: CreateClientLike;
    env?: EnvGetter;
    getStripe?: () => Promise<StripeLike>;
  } = {},
) {
  const createClientImpl = deps.createClient ?? createClient;
  const env = deps.env ?? { get: (key: string) => DenoRef?.env?.get?.(key) };
  const getStripeDefault = getStripeRaw as unknown as () => Promise<StripeLike>;
  const getStripeImpl = deps.getStripe ?? getStripeDefault;

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

    const url = env.get("SUPABASE_URL")!;
    const anon = env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return json({ success: false, message: "Unauthorized", code: "UNAUTHORIZED" }, 401);
    }

    const supabaseUser = createClientImpl(url, anon, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: userData, error: userErr } = await supabaseUser.auth.getUser();
    if (userErr || !userData?.user?.id) {
      return json({ success: false, message: "Unauthorized", code: "UNAUTHORIZED" }, 401);
    }

    const requesterId = userData.user.id as string;

    const { data: isAdmin, error: isAdminErr } = await supabaseUser.rpc("is_system_admin", {
      _user_id: requesterId,
    });
    if (isAdminErr) {
      return json({ success: false, message: "Falha ao validar permissões", code: "SERVER_ERROR" }, 500);
    }
    if (!isAdmin) {
      return json({ success: false, message: "Forbidden", code: "FORBIDDEN" }, 403);
    }

    const payload = (await req.json().catch(() => null)) as Payload | null;
    const stripeCustomerId = (payload?.stripe_customer_id || "").trim();
    const limit = clampLimit(payload?.limit, 20, 1, 100);

    if (!stripeCustomerId || !stripeCustomerId.startsWith("cus_")) {
      return json({ success: false, message: "stripe_customer_id inválido", code: "VALIDATION_ERROR" }, 400);
    }

    try {
      const stripe = await getStripeImpl();
      const res = await stripe.subscriptions.list({ customer: stripeCustomerId, limit });

      const subscriptions = (res.data || []).map((s) => {
        const firstPrice = s.items?.data?.[0]?.price;
        return {
          id: s.id,
          status: s.status,
          billing_status: mapStripeStatusToBilling(s.status),
          stripe_price_id: typeof firstPrice?.id === "string" ? firstPrice.id : null,
          price_nickname: typeof firstPrice?.nickname === "string" ? firstPrice.nickname : null,
          unit_amount: typeof firstPrice?.unit_amount === "number" ? firstPrice.unit_amount : null,
          currency: typeof firstPrice?.currency === "string" ? firstPrice.currency : null,
          interval: typeof firstPrice?.recurring?.interval === "string" ? firstPrice.recurring.interval : null,
          current_period_end: typeof s.current_period_end === "number" ? new Date(s.current_period_end * 1000).toISOString() : null,
        };
      });

      return json({ success: true, subscriptions });
    } catch (err: any) {
      const message = typeof err?.message === "string" && err.message.trim() !== ""
        ? err.message
        : "Falha ao listar assinaturas da Stripe";
      return json({ success: false, message, code: "STRIPE_ERROR" }, 502);
    }
  };
}

const handler = createBillingListStripeSubscriptionsHandler();

if ((import.meta as any).main) {
  DenoRef.serve(handler);
}

export default handler;

