import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { stripe, STRIPE_PRICE_ID_DEFAULT, STRIPE_CHECKOUT_SUCCESS_URL, STRIPE_CHECKOUT_CANCEL_URL } from "../_shared/stripeClient.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CheckoutPayload { organizationId: string }

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

    const payload: CheckoutPayload = await req.json();
    if (!payload?.organizationId) {
      return new Response(JSON.stringify({ message: "organizationId é obrigatório" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: roles } = await supabaseUser
      .from("user_roles")
      .select("role, organization_id")
      .eq("user_id", user.id);

    const isSystemAdmin = !!roles?.find(r => r.role === "SYSTEM_ADMIN");
    const isOrgAdmin = !!roles?.find(r => r.role === "ORG_ADMIN" && r.organization_id === payload.organizationId);
    if (!isSystemAdmin && !isOrgAdmin) {
      return new Response(JSON.stringify({ message: "Acesso negado: requer admin da organização" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: org, error: orgErr } = await supabaseUser
      .from("organizations")
      .select("id, name, stripe_customer_id")
      .eq("id", payload.organizationId)
      .maybeSingle();
    if (orgErr || !org) {
      return new Response(JSON.stringify({ message: "Organização não encontrada" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let customerId = org.stripe_customer_id as string | null;
    if (!customerId) {
      const customer = await stripe.customers.create({
        name: org.name,
        metadata: { organization_id: org.id },
      });
      customerId = customer.id;
      const { error: updErr } = await supabaseUser
        .from("organizations")
        .update({ stripe_customer_id: customerId })
        .eq("id", org.id);
      if (updErr) {
        return new Response(JSON.stringify({ message: "Falha ao salvar stripe_customer_id" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: STRIPE_PRICE_ID_DEFAULT, quantity: 1 }],
      success_url: STRIPE_CHECKOUT_SUCCESS_URL,
      cancel_url: STRIPE_CHECKOUT_CANCEL_URL,
    });

    return new Response(JSON.stringify({ url: session.url }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ message: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

