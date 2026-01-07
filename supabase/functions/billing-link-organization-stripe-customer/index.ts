import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { getStripe as getStripeRaw } from "../_shared/stripeClient.ts";

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

type StripeCustomer = {
  id: string;
  name?: string | null;
  email?: string | null;
  deleted?: boolean;
};

type StripeLike = {
  customers: {
    retrieve: (customerId: string) => Promise<StripeCustomer>;
  };
};

type Payload = {
  organization_id?: string;
  stripe_customer_id?: string;
};

function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v || "");
}

function isStripeCustomerId(v: string): boolean {
  const s = (v || "").trim();
  return s.startsWith("cus_") && s.length >= 8;
}

function getStripeStatusCode(err: any): number | null {
  const s = (err?.statusCode ?? err?.status ?? err?.code) as any;
  const n = typeof s === "number" ? s : Number(s);
  return Number.isFinite(n) ? n : null;
}

export function createBillingLinkOrganizationStripeCustomerHandler(
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
          event_type: "ORGANIZATION_STRIPE_LINK_FORBIDDEN",
          entity_type: "organization",
          entity_id: organizationId,
          user_id: requesterId,
          metadata: { stripe_customer_id: stripeCustomerId || null },
        });
      }
      return json({ success: false, message: "Forbidden", code: "FORBIDDEN" }, 403);
    }

    if (!isUuid(organizationId)) {
      await (supabaseAdmin as any).from("events").insert({
        event_type: "ORGANIZATION_STRIPE_LINK_VALIDATION_ERROR",
        entity_type: "organization",
        entity_id: organizationId || "00000000-0000-0000-0000-000000000000",
        user_id: requesterId,
        metadata: { reason: "organization_id inválido", stripe_customer_id: stripeCustomerId || null },
      });
      return json({ success: false, message: "organization_id inválido", code: "VALIDATION_ERROR" }, 400);
    }

    if (!isStripeCustomerId(stripeCustomerId)) {
      await (supabaseAdmin as any).from("events").insert({
        event_type: "ORGANIZATION_STRIPE_LINK_VALIDATION_ERROR",
        entity_type: "organization",
        entity_id: organizationId,
        user_id: requesterId,
        metadata: { reason: "stripe_customer_id inválido", stripe_customer_id: stripeCustomerId || null },
      });
      return json(
        {
          success: false,
          message: "stripe_customer_id inválido (deve começar com cus_)",
          code: "VALIDATION_ERROR",
        },
        400,
      );
    }

    const { data: org, error: orgErr } = await (supabaseAdmin as any)
      .from("organizations")
      .select("id,name,stripe_customer_id")
      .eq("id", organizationId)
      .maybeSingle();
    if (orgErr || !org?.id) {
      await (supabaseAdmin as any).from("events").insert({
        event_type: "ORGANIZATION_STRIPE_LINK_VALIDATION_ERROR",
        entity_type: "organization",
        entity_id: organizationId,
        user_id: requesterId,
        metadata: { reason: "Organização não encontrada", stripe_customer_id: stripeCustomerId },
      });
      return json({ success: false, message: "Organização não encontrada", code: "NOT_FOUND" }, 404);
    }

    const previousStripeCustomerId = (org.stripe_customer_id as string | null) || null;
    if (previousStripeCustomerId && previousStripeCustomerId !== stripeCustomerId) {
      await (supabaseAdmin as any).from("events").insert({
        event_type: "ORGANIZATION_STRIPE_LINK_VALIDATION_ERROR",
        entity_type: "organization",
        entity_id: organizationId,
        user_id: requesterId,
        metadata: {
          reason: "Organização já vinculada a outro cliente",
          stripe_customer_id: stripeCustomerId,
          previous_stripe_customer_id: previousStripeCustomerId,
        },
      });
      return json(
        {
          success: false,
          message: "Organização já vinculada a outro cliente Stripe",
          code: "ALREADY_LINKED",
        },
        409,
      );
    }

    let customer: StripeCustomer;
    try {
      const stripe = await getStripeImpl();
      customer = await stripe.customers.retrieve(stripeCustomerId);
      if ((customer as any)?.deleted) {
        await (supabaseAdmin as any).from("events").insert({
          event_type: "ORGANIZATION_STRIPE_LINK_STRIPE_ERROR",
          entity_type: "organization",
          entity_id: organizationId,
          user_id: requesterId,
          metadata: { reason: "Cliente Stripe deletado", stripe_customer_id: stripeCustomerId },
        });
        return json({ success: false, message: "Cliente Stripe está deletado", code: "STRIPE_CUSTOMER_DELETED" }, 400);
      }
    } catch (err: any) {
      const status = getStripeStatusCode(err);
      const notFound = status === 404;

      await (supabaseAdmin as any).from("events").insert({
        event_type: "ORGANIZATION_STRIPE_LINK_STRIPE_ERROR",
        entity_type: "organization",
        entity_id: organizationId,
        user_id: requesterId,
        metadata: {
          stripe_customer_id: stripeCustomerId,
          stripe_status: status,
          error: { message: (err?.message || "Stripe error").toString().slice(0, 200) },
        },
      });

      return json(
        {
          success: false,
          message: notFound ? "Cliente Stripe não encontrado" : "Falha ao validar cliente na Stripe",
          code: notFound ? "STRIPE_CUSTOMER_NOT_FOUND" : "STRIPE_ERROR",
        },
        notFound ? 404 : 502,
      );
    }

    const { error: updErr } = await (supabaseAdmin as any)
      .from("organizations")
      .update({ stripe_customer_id: stripeCustomerId })
      .eq("id", organizationId);
    if (updErr) {
      await (supabaseAdmin as any).from("events").insert({
        event_type: "ORGANIZATION_STRIPE_LINK_FAILED",
        entity_type: "organization",
        entity_id: organizationId,
        user_id: requesterId,
        metadata: {
          stripe_customer_id: stripeCustomerId,
          error: { message: (updErr?.message || "Falha ao atualizar").toString().slice(0, 200) },
        },
      });
      return json({ success: false, message: "Falha ao salvar vínculo", code: "UPDATE_FAILED" }, 400);
    }

    await (supabaseAdmin as any).from("events").insert({
      event_type: "ORGANIZATION_STRIPE_LINKED",
      entity_type: "organization",
      entity_id: organizationId,
      user_id: requesterId,
      metadata: {
        stripe_customer_id: stripeCustomerId,
        previous_stripe_customer_id: previousStripeCustomerId,
        stripe_customer_name: customer?.name ?? null,
        stripe_customer_email: customer?.email ?? null,
      },
    });

    return json({
      success: true,
      organization_id: organizationId,
      stripe_customer_id: stripeCustomerId,
      customer: {
        name: customer?.name ?? null,
        email: customer?.email ?? null,
      },
    });
  };
}

const handler = createBillingLinkOrganizationStripeCustomerHandler();

if ((import.meta as any).main) {
  DenoRef.serve(handler);
}

export default handler;
