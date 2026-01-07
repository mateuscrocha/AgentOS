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
  organization_id?: string;
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
};

type StripeSubscription = {
  id: string;
  status: string;
  customer: string;
  current_period_end?: number | null;
  items?: { data?: Array<{ price?: { id?: string } | null } | null> } | null;
};

type StripeLike = {
  subscriptions: {
    retrieve: (subscriptionId: string) => Promise<StripeSubscription>;
  };
};

function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v || "");
}

function isStripeCustomerId(v: string): boolean {
  const s = (v || "").trim();
  return s.startsWith("cus_") && s.length >= 8;
}

function isStripeSubscriptionId(v: string): boolean {
  const s = (v || "").trim();
  return s.startsWith("sub_") && s.length >= 8;
}

function getStripeStatusCode(err: any): number | null {
  const s = (err?.statusCode ?? err?.status ?? err?.code) as any;
  const n = typeof s === "number" ? s : Number(s);
  return Number.isFinite(n) ? n : null;
}

export function createBillingLinkOrganizationStripeSubscriptionHandler(
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
    const service = env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

    const payload = (await req.json().catch(() => null)) as Payload | null;
    const organizationId = (payload?.organization_id || "").trim();
    const stripeCustomerId = (payload?.stripe_customer_id || "").trim();
    const stripeSubscriptionId = (payload?.stripe_subscription_id || "").trim();

    const { data: isAdmin, error: isAdminErr } = await supabaseUser.rpc("is_system_admin", {
      _user_id: requesterId,
    });
    if (isAdminErr) {
      return json({ success: false, message: "Falha ao validar permissões", code: "SERVER_ERROR" }, 500);
    }

    const supabaseAdmin = createClientImpl(url, service, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    if (!isAdmin) {
      if (organizationId) {
        await (supabaseAdmin as any).from("events").insert({
          event_type: "ORGANIZATION_STRIPE_SUBSCRIPTION_LINK_FORBIDDEN",
          entity_type: "organization",
          entity_id: organizationId,
          user_id: requesterId,
          metadata: { stripe_customer_id: stripeCustomerId || null, stripe_subscription_id: stripeSubscriptionId || null },
        });
      }
      return json({ success: false, message: "Forbidden", code: "FORBIDDEN" }, 403);
    }

    if (!isUuid(organizationId)) {
      return json({ success: false, message: "organization_id inválido", code: "VALIDATION_ERROR" }, 400);
    }
    if (!isStripeCustomerId(stripeCustomerId)) {
      return json({ success: false, message: "stripe_customer_id inválido", code: "VALIDATION_ERROR" }, 400);
    }
    if (!isStripeSubscriptionId(stripeSubscriptionId)) {
      return json({ success: false, message: "stripe_subscription_id inválido", code: "VALIDATION_ERROR" }, 400);
    }

    const { data: org, error: orgErr } = await (supabaseAdmin as any)
      .from("organizations")
      .select("id,name,stripe_customer_id,stripe_subscription_id")
      .eq("id", organizationId)
      .maybeSingle();
    if (orgErr || !org?.id) {
      return json({ success: false, message: "Organização não encontrada", code: "NOT_FOUND" }, 404);
    }

    const previousCustomerId = (org.stripe_customer_id as string | null) || null;
    const previousSubscriptionId = (org.stripe_subscription_id as string | null) || null;
    if (previousCustomerId && previousCustomerId !== stripeCustomerId) {
      return json({ success: false, message: "Organização já vinculada a outro cliente Stripe", code: "ALREADY_LINKED" }, 409);
    }
    if (previousSubscriptionId && previousSubscriptionId !== stripeSubscriptionId) {
      return json({ success: false, message: "Organização já vinculada a outra assinatura Stripe", code: "ALREADY_LINKED" }, 409);
    }

    let subscription: StripeSubscription;
    try {
      const stripe = await getStripeImpl();
      subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
      if ((subscription as any)?.deleted) {
        return json({ success: false, message: "Assinatura Stripe está deletada", code: "STRIPE_SUBSCRIPTION_DELETED" }, 400);
      }
      if ((subscription.customer as any) !== stripeCustomerId) {
        return json({
          success: false,
          message: "Assinatura não pertence ao cliente informado",
          code: "STRIPE_SUBSCRIPTION_CUSTOMER_MISMATCH",
        }, 400);
      }
    } catch (err: any) {
      const status = getStripeStatusCode(err);
      const notFound = status === 404;
      await (supabaseAdmin as any).from("events").insert({
        event_type: "ORGANIZATION_STRIPE_SUBSCRIPTION_LINK_STRIPE_ERROR",
        entity_type: "organization",
        entity_id: organizationId,
        user_id: requesterId,
        metadata: {
          stripe_customer_id: stripeCustomerId,
          stripe_subscription_id: stripeSubscriptionId,
          stripe_status: status,
          error: { message: (err?.message || "Stripe error").toString().slice(0, 200) },
        },
      });
      return json({
        success: false,
        message: notFound ? "Assinatura Stripe não encontrada" : "Falha ao validar assinatura na Stripe",
        code: notFound ? "STRIPE_SUBSCRIPTION_NOT_FOUND" : "STRIPE_ERROR",
      }, notFound ? 404 : 502);
    }

    const priceId = (subscription.items?.data?.[0]?.price as any)?.id as string | undefined;
    const billingStatus = mapStripeStatusToBilling(subscription.status);
    const currentPeriodEnd = typeof subscription.current_period_end === "number"
      ? new Date(subscription.current_period_end * 1000).toISOString()
      : null;

    const { error: updErr } = await (supabaseAdmin as any)
      .from("organizations")
      .update({
        stripe_customer_id: stripeCustomerId,
        stripe_subscription_id: stripeSubscriptionId,
        stripe_price_id: priceId ?? null,
        billing_status: billingStatus,
        current_period_end: currentPeriodEnd,
      })
      .eq("id", organizationId);
    if (updErr) {
      const code = (updErr as any)?.code as string | undefined;
      const msg = (updErr as any)?.message as string | undefined;
      await (supabaseAdmin as any).from("events").insert({
        event_type: "ORGANIZATION_STRIPE_SUBSCRIPTION_LINK_FAILED",
        entity_type: "organization",
        entity_id: organizationId,
        user_id: requesterId,
        metadata: {
          stripe_customer_id: stripeCustomerId,
          stripe_subscription_id: stripeSubscriptionId,
          error: { code, message: (msg || "Falha ao atualizar").toString().slice(0, 200) },
        },
      });
      if (code === "23505") {
        return json({ success: false, message: "Cliente/assinatura já vinculada em outra organização", code: "CONFLICT" }, 409);
      }
      return json({ success: false, message: "Falha ao salvar vínculo", code: "UPDATE_FAILED" }, 400);
    }

    await (supabaseAdmin as any).from("events").insert({
      event_type: "ORGANIZATION_STRIPE_SUBSCRIPTION_LINKED",
      entity_type: "organization",
      entity_id: organizationId,
      user_id: requesterId,
      metadata: {
        stripe_customer_id: stripeCustomerId,
        stripe_subscription_id: stripeSubscriptionId,
        previous_stripe_customer_id: previousCustomerId,
        previous_stripe_subscription_id: previousSubscriptionId,
        stripe_price_id: priceId ?? null,
        billing_status: billingStatus,
        current_period_end: currentPeriodEnd,
      },
    });

    return json({
      success: true,
      organization_id: organizationId,
      stripe_customer_id: stripeCustomerId,
      stripe_subscription_id: stripeSubscriptionId,
      stripe_price_id: priceId ?? null,
      billing_status: billingStatus,
      current_period_end: currentPeriodEnd,
    });
  };
}

const handler = createBillingLinkOrganizationStripeSubscriptionHandler();

if ((import.meta as any).main) {
  DenoRef.serve(handler);
}

export default handler;

