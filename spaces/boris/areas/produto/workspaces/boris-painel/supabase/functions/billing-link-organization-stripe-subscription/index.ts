import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import Stripe from "https://esm.sh/stripe@14.24.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Payload = { organization_id?: string; stripe_customer_id?: string; stripe_subscription_id?: string };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Connection": "keep-alive" },
  });
}

function getStripe() {
  const key = (Deno.env.get("STRIPE_SECRET_KEY") || "").trim();
  if (!key) throw new Error("Configuração ausente: STRIPE_SECRET_KEY");
  return new Stripe(key);
}

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v || "");
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

function buildBillingPlan(price: Stripe.Price | null | undefined) {
  if (!price) return null;
  if (typeof price.nickname === "string" && price.nickname.trim()) return price.nickname.trim();
  const interval = price.recurring?.interval;
  const intervalCount = price.recurring?.interval_count;
  if (!interval) return null;
  return intervalCount && intervalCount > 1 ? `${intervalCount} ${interval}` : interval;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
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
    const organizationId = (payload?.organization_id || "").trim();
    const stripeCustomerId = (payload?.stripe_customer_id || "").trim();
    const stripeSubscriptionId = (payload?.stripe_subscription_id || "").trim();

    if (!isUuid(organizationId)) {
      return json({ success: false, message: "organization_id inválido", code: "VALIDATION_ERROR" }, 400);
    }
    if (!stripeCustomerId.startsWith("cus_")) {
      return json({ success: false, message: "stripe_customer_id inválido", code: "VALIDATION_ERROR" }, 400);
    }
    if (!stripeSubscriptionId.startsWith("sub_")) {
      return json({ success: false, message: "stripe_subscription_id inválido", code: "VALIDATION_ERROR" }, 400);
    }

    const stripe = getStripe();
    const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
    if ((subscription.customer as string) !== stripeCustomerId) {
      return json(
        {
          success: false,
          message: "Assinatura não pertence ao cliente informado",
          code: "STRIPE_SUBSCRIPTION_CUSTOMER_MISMATCH",
        },
        400,
      );
    }

    const firstPrice = subscription.items.data[0]?.price ?? null;
    const billingStatus = mapStripeStatusToBilling(subscription.status);
    const billingPlan = buildBillingPlan(firstPrice);
    const currentPeriodEnd =
      typeof subscription.current_period_end === "number"
        ? new Date(subscription.current_period_end * 1000).toISOString()
        : null;

    const supabaseAdmin = createClient(url, service, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { error } = await supabaseAdmin
      .from("organizations")
      .update({
        stripe_customer_id: stripeCustomerId,
        stripe_subscription_id: stripeSubscriptionId,
        stripe_price_id: typeof firstPrice?.id === "string" ? firstPrice.id : null,
        billing_status: billingStatus,
        billing_plan: billingPlan,
        current_period_end: currentPeriodEnd,
      })
      .eq("id", organizationId);

    if (error) {
      return json({ success: false, message: error.message || "Falha ao salvar vínculo", code: "UPDATE_FAILED" }, 400);
    }

    return json({
      success: true,
      organization_id: organizationId,
      stripe_customer_id: stripeCustomerId,
      stripe_subscription_id: stripeSubscriptionId,
      stripe_price_id: typeof firstPrice?.id === "string" ? firstPrice.id : null,
      billing_status: billingStatus,
      billing_plan: billingPlan,
      current_period_end: currentPeriodEnd,
    });
  } catch (err: any) {
    if (err?.statusCode === 404) {
      return json({ success: false, message: "Assinatura Stripe não encontrada", code: "STRIPE_SUBSCRIPTION_NOT_FOUND" }, 404);
    }
    return json(
      { success: false, message: err?.message || "Falha ao validar assinatura na Stripe", code: "STRIPE_ERROR" },
      502,
    );
  }
});
