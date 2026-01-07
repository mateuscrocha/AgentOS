import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getStripe, getStripeWebhookSecret, mapStripeStatusToBilling } from "../_shared/stripeClient.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const sig = req.headers.get("Stripe-Signature");
  if (!sig) {
    return new Response(JSON.stringify({ message: "Stripe-Signature ausente" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    const rawBody = await req.text();
    const stripe = await getStripe();
    const webhookSecret = getStripeWebhookSecret();
    const event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    async function updateOrgByCustomerOrSubscription(
      ids: { customerId?: string | null; subscriptionId?: string | null },
      fields: Record<string, any>,
    ) {
      const customerId = (ids.customerId || "").trim();
      const subscriptionId = (ids.subscriptionId || "").trim();
      if (!customerId && !subscriptionId) return;

      const ors: string[] = [];
      if (subscriptionId) ors.push(`stripe_subscription_id.eq.${subscriptionId}`);
      if (customerId) ors.push(`stripe_customer_id.eq.${customerId}`);
      const orExpr = ors.join(",");

      const { data: org, error: orgErr } = await supabaseAdmin
        .from("organizations")
        .select("id")
        .or(orExpr)
        .maybeSingle();
      if (orgErr || !org) return;
      await supabaseAdmin.from("organizations").update(fields).eq("id", org.id);
    }

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as any;
        const customerId = session.customer as string;
        const subscriptionId = typeof session.subscription === "string" ? session.subscription : (session.subscription?.id as string | undefined);
        if (customerId && subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          const priceId = subscription.items?.data?.[0]?.price?.id as string | undefined;
          const status = mapStripeStatusToBilling(subscription.status);
          const currentPeriodEnd = subscription.current_period_end ? new Date(subscription.current_period_end * 1000).toISOString() : null;
          await updateOrgByCustomerOrSubscription({ customerId, subscriptionId }, {
            stripe_subscription_id: subscription.id,
            stripe_price_id: priceId ?? null,
            billing_status: status,
            current_period_end: currentPeriodEnd,
          });
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscriptionObj = event.data.object as any;
        const subscriptionId = subscriptionObj.id as string;
        const customerId = subscriptionObj.customer as string;
        const priceId = subscriptionObj.items?.data?.[0]?.price?.id as string | undefined;
        const status = mapStripeStatusToBilling(subscriptionObj.status);
        const currentPeriodEnd = subscriptionObj.current_period_end ? new Date(subscriptionObj.current_period_end * 1000).toISOString() : null;
        await updateOrgByCustomerOrSubscription({ customerId, subscriptionId }, {
          stripe_subscription_id: subscriptionId,
          stripe_price_id: priceId ?? null,
          billing_status: status,
          current_period_end: currentPeriodEnd,
        });
        break;
      }
      case "customer.subscription.deleted": {
        const subscriptionObj = event.data.object as any;
        const subscriptionId = subscriptionObj.id as string;
        const customerId = subscriptionObj.customer as string;
        const priceId = subscriptionObj.items?.data?.[0]?.price?.id as string | undefined;
        const currentPeriodEnd = subscriptionObj.current_period_end ? new Date(subscriptionObj.current_period_end * 1000).toISOString() : null;
        await updateOrgByCustomerOrSubscription({ customerId, subscriptionId }, {
          stripe_subscription_id: subscriptionId || null,
          stripe_price_id: priceId ?? null,
          billing_status: "canceled",
          current_period_end: currentPeriodEnd,
        });
        break;
      }
      case "invoice.payment_succeeded":
      case "invoice.payment_failed": {
        const invoice = event.data.object as any;
        const customerId = (invoice.customer as string | undefined) || null;
        const subscriptionId = typeof invoice.subscription === "string" ? (invoice.subscription as string) : (invoice.subscription?.id as string | undefined);

        if (subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          const priceId = subscription.items?.data?.[0]?.price?.id as string | undefined;
          const status = mapStripeStatusToBilling(subscription.status);
          const currentPeriodEnd = subscription.current_period_end ? new Date(subscription.current_period_end * 1000).toISOString() : null;
          await updateOrgByCustomerOrSubscription({ customerId, subscriptionId }, {
            stripe_subscription_id: subscriptionId,
            stripe_price_id: priceId ?? null,
            billing_status: status,
            current_period_end: currentPeriodEnd,
          });
          break;
        }

        await updateOrgByCustomerOrSubscription(
          { customerId, subscriptionId: null },
          { billing_status: event.type === "invoice.payment_failed" ? "past_due" : "active" },
        );
        break;
      }
      default:
        break;
    }

    return new Response(JSON.stringify({ received: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ message: msg }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
