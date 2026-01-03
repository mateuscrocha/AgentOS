import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getStripe, mapStripeStatusToBilling } from "../_shared/stripeClient.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface LinkPayload { organizationId: string; stripeCustomerId: string }

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ message: "Autenticação requerida" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: { user } } = await supabaseUser.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ message: "Sessão inválida" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const payload: LinkPayload = await req.json();
    if (!payload?.organizationId || !payload?.stripeCustomerId) {
      return new Response(JSON.stringify({ message: "organizationId e stripeCustomerId são obrigatórios" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: roles } = await supabaseUser
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    const isSystemAdmin = !!roles?.find(r => r.role === "SYSTEM_ADMIN");
    if (!isSystemAdmin) {
      return new Response(JSON.stringify({ message: "Acesso negado: requer System Admin" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: org, error: orgErr } = await supabaseUser
      .from("organizations")
      .select("id, name, stripe_customer_id")
      .eq("id", payload.organizationId)
      .maybeSingle();
    if (orgErr || !org) {
      return new Response(JSON.stringify({ message: "Organização não encontrada" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (org.stripe_customer_id && org.stripe_customer_id !== payload.stripeCustomerId) {
      return new Response(JSON.stringify({ message: "Organização já vinculada a outro stripe_customer_id" }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const stripe = await getStripe();
    const customer = await stripe.customers.retrieve(payload.stripeCustomerId);
    if ((customer as any).deleted) {
      return new Response(JSON.stringify({ message: "Cliente Stripe está deletado" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const subs = await stripe.subscriptions.list({ customer: payload.stripeCustomerId, status: "active", limit: 1 });
    const activeSub = subs.data?.[0];
    if (!activeSub) {
      return new Response(JSON.stringify({ message: "Nenhuma assinatura ativa encontrada para o cliente" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const priceId = activeSub.items?.data?.[0]?.price?.id as string | undefined;
    const status = mapStripeStatusToBilling(activeSub.status);
    const currentPeriodEnd = activeSub.current_period_end ? new Date(activeSub.current_period_end * 1000).toISOString() : null;

    const { error: updErr } = await supabaseUser
      .from("organizations")
      .update({
        stripe_customer_id: payload.stripeCustomerId,
        stripe_subscription_id: activeSub.id,
        stripe_price_id: priceId ?? null,
        billing_status: status,
        current_period_end: currentPeriodEnd,
      })
      .eq("id", org.id);
    if (updErr) {
      return new Response(JSON.stringify({ message: "Falha ao atualizar organização" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ message: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
