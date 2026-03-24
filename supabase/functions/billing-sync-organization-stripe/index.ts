import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Payload = {
  organization_id?: string;
};

type OrganizationRow = {
  id: string;
  name: string;
  slug: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  relationship_type: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Connection": "keep-alive" },
  });
}

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v || "");
}

function buildStripeBody(org: OrganizationRow) {
  const params = new URLSearchParams();
  params.set("name", org.name);
  if (org.contact_email) params.set("email", org.contact_email);
  if (org.contact_phone) params.set("phone", org.contact_phone);
  params.set("metadata[organization_id]", org.id);
  params.set("metadata[organization_name]", org.name);
  if (org.slug) params.set("metadata[organization_slug]", org.slug);
  if (org.relationship_type) params.set("metadata[relationship_type]", org.relationship_type);
  params.set("metadata[source]", "boris_panel");
  return params;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const stripeSecretKey = (Deno.env.get("STRIPE_SECRET_KEY") || "").trim();

    if (!stripeSecretKey) {
      return json({ success: false, message: "Configuração ausente: STRIPE_SECRET_KEY", code: "STRIPE_NOT_CONFIGURED" }, 500);
    }

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

    const { data: isAdmin, error: isAdminErr } = await supabaseUser.rpc("is_system_admin", { _user_id: userData.user.id });
    if (isAdminErr) {
      return json({ success: false, message: "Falha ao validar permissões", code: "SERVER_ERROR" }, 500);
    }
    if (!isAdmin) {
      return json({ success: false, message: "Forbidden", code: "FORBIDDEN" }, 403);
    }

    const payload = (await req.json().catch(() => null)) as Payload | null;
    const organizationId = (payload?.organization_id || "").trim();
    if (!isUuid(organizationId)) {
      return json({ success: false, message: "organization_id inválido", code: "VALIDATION_ERROR" }, 400);
    }

    const supabaseAdmin = createClient(url, service, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: organization, error: orgErr } = await supabaseAdmin
      .from("organizations")
      .select("id, name, slug, contact_email, contact_phone, relationship_type, stripe_customer_id, stripe_subscription_id")
      .eq("id", organizationId)
      .maybeSingle();

    if (orgErr) {
      return json({ success: false, message: orgErr.message, code: "SERVER_ERROR" }, 500);
    }
    if (!organization) {
      return json({ success: false, message: "Organização não encontrada", code: "NOT_FOUND" }, 404);
    }

    const org = organization as OrganizationRow;
    if (!org.stripe_customer_id) {
      return json({ success: false, message: "A organização ainda não possui stripe_customer_id", code: "STRIPE_IDS_MISSING" }, 400);
    }

    const customerResponse = await fetch(`https://api.stripe.com/v1/customers/${encodeURIComponent(org.stripe_customer_id)}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeSecretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: buildStripeBody(org).toString(),
    });
    const customerPayload = await customerResponse.json().catch(() => ({}));
    if (!customerResponse.ok) {
      return json({
        success: false,
        message: customerPayload?.error?.message || "Falha ao atualizar customer na Stripe",
        code: "STRIPE_CUSTOMER_UPDATE_FAILED",
      }, 502);
    }

    if (org.stripe_subscription_id) {
      const subscriptionParams = new URLSearchParams();
      subscriptionParams.set("metadata[organization_id]", org.id);
      subscriptionParams.set("metadata[organization_name]", org.name);
      if (org.relationship_type) subscriptionParams.set("metadata[relationship_type]", org.relationship_type);
      subscriptionParams.set("metadata[source]", "boris_panel");

      const subscriptionResponse = await fetch(`https://api.stripe.com/v1/subscriptions/${encodeURIComponent(org.stripe_subscription_id)}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${stripeSecretKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: subscriptionParams.toString(),
      });
      const subscriptionPayload = await subscriptionResponse.json().catch(() => ({}));
      if (!subscriptionResponse.ok) {
        return json({
          success: false,
          message: subscriptionPayload?.error?.message || "Falha ao atualizar assinatura na Stripe",
          code: "STRIPE_SUBSCRIPTION_UPDATE_FAILED",
        }, 502);
      }
    }

    return json({
      success: true,
      organization_id: org.id,
      stripe_customer_id: org.stripe_customer_id,
      stripe_subscription_id: org.stripe_subscription_id,
    });
  } catch (err: any) {
    return json({ success: false, message: err?.message || "Falha ao sincronizar contexto da organização com a Stripe", code: "STRIPE_ERROR" }, 502);
  }
});
