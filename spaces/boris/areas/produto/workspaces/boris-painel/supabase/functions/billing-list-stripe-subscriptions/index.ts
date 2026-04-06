import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import Stripe from "https://esm.sh/stripe@14.24.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Payload = { stripe_customer_id?: string; limit?: number };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Connection": "keep-alive" },
  });
}

function clampLimit(v: unknown, def: number, min: number, max: number) {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return def;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

function getStripe() {
  const key = (Deno.env.get("STRIPE_SECRET_KEY") || "").trim();
  if (!key) throw new Error("Configuração ausente: STRIPE_SECRET_KEY");
  return new Stripe(key);
}

function mapStripeStatusToBilling(status: string) {
  switch (status) {
    case "trialing":
      return "trialing";
    case "active":
      return "active";
    case "past_due":
      return "past_due";
    case "unpaid":
      return "unpaid";
    case "canceled":
      return "canceled";
    case "incomplete":
      return "incomplete";
    case "incomplete_expired":
      return "incomplete_expired";
    case "paused":
      return "paused";
    default:
      return "inactive";
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return json({ success: false, message: "Unauthorized", code: "UNAUTHORIZED" }, 401);
    }

    const supabaseUser = createClient(url, anon, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: userData, error: userErr } = await supabaseUser.auth.getUser();
    if (userErr || !userData?.user?.id) {
      return json({ success: false, message: "Unauthorized", code: "UNAUTHORIZED" }, 401);
    }

    const { data: isAdmin, error: isAdminErr } = await supabaseUser.rpc("is_system_admin", {
      _user_id: userData.user.id,
    });
    if (isAdminErr) {
      return json({ success: false, message: "Falha ao validar permissões", code: "SERVER_ERROR" }, 500);
    }
    if (!isAdmin) return json({ success: false, message: "Forbidden", code: "FORBIDDEN" }, 403);

    const payload = (await req.json().catch(() => null)) as Payload | null;
    const stripeCustomerId = (payload?.stripe_customer_id || "").trim();
    const limit = clampLimit(payload?.limit, 20, 1, 100);
    if (!stripeCustomerId.startsWith("cus_")) {
      return json({ success: false, message: "stripe_customer_id inválido", code: "VALIDATION_ERROR" }, 400);
    }

    const stripe = getStripe();
    const res = await stripe.subscriptions.list({
      customer: stripeCustomerId,
      status: "all",
      limit,
    });

    const subscriptions = res.data.map((subscription) => {
      const firstPrice = subscription.items.data[0]?.price;
      return {
        id: subscription.id,
        status: subscription.status,
        billing_status: mapStripeStatusToBilling(subscription.status),
        stripe_price_id: typeof firstPrice?.id === "string" ? firstPrice.id : null,
        price_nickname: typeof firstPrice?.nickname === "string" ? firstPrice.nickname : null,
        unit_amount: typeof firstPrice?.unit_amount === "number" ? firstPrice.unit_amount : null,
        currency: typeof firstPrice?.currency === "string" ? firstPrice.currency : null,
        interval: typeof firstPrice?.recurring?.interval === "string" ? firstPrice.recurring.interval : null,
        current_period_end:
          typeof subscription.current_period_end === "number"
            ? new Date(subscription.current_period_end * 1000).toISOString()
            : null,
      };
    });

    subscriptions.sort((a, b) => {
      const aDate = a.current_period_end ? new Date(a.current_period_end).getTime() : 0;
      const bDate = b.current_period_end ? new Date(b.current_period_end).getTime() : 0;
      return bDate - aDate;
    });

    return json({ success: true, subscriptions });
  } catch (err: any) {
    return json(
      { success: false, message: err?.message || "Falha ao listar assinaturas da Stripe", code: "STRIPE_ERROR" },
      502,
    );
  }
});
