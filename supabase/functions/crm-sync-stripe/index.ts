import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const DenoRef = (globalThis as any).Deno;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type StripeSubscription = {
  id: string;
  customer: string | { id: string };
  status: string;
  current_period_end: number | null;
  items?: {
    data?: Array<{
      price?: {
        id?: string;
        nickname?: string | null;
        recurring?: { interval?: string | null; interval_count?: number | null } | null;
      } | null;
    }>;
  };
  latest_invoice?: string | StripeInvoice | null;
};

type StripeInvoice = {
  id: string;
  created: number | null;
  status: string | null;
  amount_paid: number | null;
  amount_due: number | null;
  total: number | null;
  paid: boolean | null;
};

type CRMAccountRow = {
  id: string;
  organization_id: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  organizations?: {
    id: string;
    billing_plan: string | null;
    billing_status: string | null;
    current_period_end: string | null;
    stripe_customer_id: string | null;
    stripe_subscription_id: string | null;
  } | {
    id: string;
    billing_plan: string | null;
    billing_status: string | null;
    current_period_end: string | null;
    stripe_customer_id: string | null;
    stripe_subscription_id: string | null;
  }[] | null;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Connection": "keep-alive",
    },
  });
}

function toIso(value?: number | null) {
  return typeof value === "number" ? new Date(value * 1000).toISOString() : null;
}

function getStripeId(value: string | { id: string } | null | undefined) {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

function buildBillingPlan(subscription: StripeSubscription) {
  const price = subscription.items?.data?.[0]?.price;
  if (price?.nickname) return price.nickname;
  const interval = price?.recurring?.interval;
  const intervalCount = price?.recurring?.interval_count;
  if (!interval) return null;
  if (intervalCount && intervalCount > 1) return `${intervalCount} ${interval}`;
  return interval;
}

function isDelinquent(subscriptionStatus: string | null, invoiceStatus: string | null, invoicePaid: boolean | null) {
  if (subscriptionStatus && ["past_due", "unpaid", "incomplete_expired", "canceled"].includes(subscriptionStatus)) {
    return true;
  }
  if (invoiceStatus && ["open", "uncollectible", "void"].includes(invoiceStatus) && invoicePaid === false) {
    return true;
  }
  return false;
}

async function stripeFetch<T>(path: string, stripeSecretKey: string, fetchImpl: typeof fetch) {
  const response = await fetchImpl(`https://api.stripe.com${path}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${stripeSecretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.error?.message || "Falha ao consultar Stripe";
    throw new Error(message);
  }

  return payload as T;
}

export function createCrmSyncStripeHandler(args?: {
  createClientImpl?: typeof createClient;
  env?: { get: (key: string) => string | undefined };
  fetchImpl?: typeof fetch;
}) {
  const createClientImpl = args?.createClientImpl ?? createClient;
  const env = args?.env ?? DenoRef.env;
  const fetchImpl = args?.fetchImpl ?? fetch;

  return async (req: Request) => {
    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      const url = env.get("SUPABASE_URL")!;
      const anon = env.get("SUPABASE_ANON_KEY")!;
      const service = env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const stripeSecretKey = env.get("STRIPE_SECRET_KEY");

      if (!stripeSecretKey) {
        return json({ success: false, message: "STRIPE_SECRET_KEY não configurada.", code: "STRIPE_NOT_CONFIGURED" }, 500);
      }

      const authHeader = req.headers.get("Authorization") || "";
      if (!authHeader.startsWith("Bearer ")) {
        return json({ success: false, message: "Unauthorized", code: "UNAUTHORIZED" }, 401);
      }

      const supabaseUser = createClientImpl(url, anon, {
        global: { headers: { Authorization: authHeader } },
      });

      const { data: userData, error: getUserErr } = await supabaseUser.auth.getUser();
      if (getUserErr || !userData?.user?.id) {
        return json({ success: false, message: "Unauthorized", code: "UNAUTHORIZED" }, 401);
      }

      const { data: isAdmin, error: isAdminErr } = await supabaseUser.rpc("is_system_admin", { _user_id: userData.user.id });
      if (isAdminErr) {
        return json({ success: false, message: isAdminErr.message, code: "SERVER_ERROR" }, 500);
      }
      if (!isAdmin) {
        return json({ success: false, message: "Forbidden", code: "FORBIDDEN" }, 403);
      }

      const payload = await req.json().catch(() => null) as { crm_account_id?: string } | null;
      const crmAccountId = (payload?.crm_account_id || "").trim();
      if (!crmAccountId) {
        return json({ success: false, message: "crm_account_id é obrigatório.", code: "VALIDATION_ERROR" }, 400);
      }

      const supabaseAdmin = createClientImpl(url, service);
      const { data: account, error: accountErr } = await supabaseAdmin
        .from("crm_accounts")
        .select(`
          id,
          organization_id,
          stripe_customer_id,
          stripe_subscription_id,
          organizations (
            id,
            billing_plan,
            billing_status,
            current_period_end,
            stripe_customer_id,
            stripe_subscription_id
          )
        `)
        .eq("id", crmAccountId)
        .maybeSingle();

      if (accountErr) {
        return json({ success: false, message: accountErr.message, code: "SERVER_ERROR" }, 500);
      }
      if (!account) {
        return json({ success: false, message: "Conta CRM não encontrada.", code: "NOT_FOUND" }, 404);
      }

      const crmAccount = account as unknown as CRMAccountRow;
      const linkedOrganization = Array.isArray(crmAccount.organizations)
        ? (crmAccount.organizations[0] ?? null)
        : (crmAccount.organizations ?? null);
      const stripeCustomerId = crmAccount.stripe_customer_id || linkedOrganization?.stripe_customer_id || null;
      let stripeSubscriptionId = crmAccount.stripe_subscription_id || linkedOrganization?.stripe_subscription_id || null;

      if (!stripeSubscriptionId && !stripeCustomerId) {
        return json({ success: false, message: "A conta CRM não possui vínculo Stripe nem organização vinculada com IDs Stripe.", code: "STRIPE_IDS_MISSING" }, 400);
      }

      if (!stripeSubscriptionId && stripeCustomerId) {
        const subscriptions = await stripeFetch<{ data?: StripeSubscription[] }>(
          `/v1/subscriptions?customer=${encodeURIComponent(stripeCustomerId)}&status=all&limit=1`,
          stripeSecretKey,
          fetchImpl,
        );
        stripeSubscriptionId = subscriptions.data?.[0]?.id ?? null;
      }

      if (!stripeSubscriptionId) {
        return json({ success: false, message: "Nenhuma assinatura encontrada para este cliente Stripe.", code: "SUBSCRIPTION_NOT_FOUND" }, 404);
      }

      const subscription = await stripeFetch<StripeSubscription>(
        `/v1/subscriptions/${encodeURIComponent(stripeSubscriptionId)}?expand[]=latest_invoice`,
        stripeSecretKey,
        fetchImpl,
      );

      const latestInvoiceRaw = subscription.latest_invoice;
      let latestInvoice: StripeInvoice | null = null;
      if (latestInvoiceRaw && typeof latestInvoiceRaw === "object") {
        latestInvoice = latestInvoiceRaw;
      } else if (typeof latestInvoiceRaw === "string") {
        latestInvoice = await stripeFetch<StripeInvoice>(
          `/v1/invoices/${encodeURIComponent(latestInvoiceRaw)}`,
          stripeSecretKey,
          fetchImpl,
        );
      }

      const resolvedCustomerId = stripeCustomerId || getStripeId(subscription.customer);
      const resolvedBillingPlan = buildBillingPlan(subscription);
      const resolvedStatus = subscription.status || null;
      const resolvedCurrentPeriodEnd = toIso(subscription.current_period_end);
      const resolvedAmountCents = latestInvoice?.amount_paid ?? latestInvoice?.total ?? latestInvoice?.amount_due ?? null;
      const resolvedLastInvoiceAt = toIso(latestInvoice?.created);
      const resolvedDelinquent = isDelinquent(resolvedStatus, latestInvoice?.status ?? null, latestInvoice?.paid ?? null);

      const { error: updateCrmErr } = await supabaseAdmin
        .from("crm_accounts")
        .update({
          stripe_customer_id: resolvedCustomerId,
          stripe_subscription_id: subscription.id,
          stripe_subscription_status: resolvedStatus,
          stripe_last_invoice_at: resolvedLastInvoiceAt,
          stripe_last_invoice_amount_cents: resolvedAmountCents,
          stripe_next_billing_at: resolvedCurrentPeriodEnd,
          stripe_is_delinquent: resolvedDelinquent,
          financial_context_updated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", crmAccountId);

      if (updateCrmErr) {
        return json({ success: false, message: updateCrmErr.message, code: "SERVER_ERROR" }, 500);
      }

      if (crmAccount.organization_id) {
        const { error: updateOrgErr } = await supabaseAdmin
          .from("organizations")
          .update({
            stripe_customer_id: resolvedCustomerId,
            stripe_subscription_id: subscription.id,
            billing_status: resolvedStatus,
            billing_plan: resolvedBillingPlan,
            current_period_end: resolvedCurrentPeriodEnd,
            updated_at: new Date().toISOString(),
          })
          .eq("id", crmAccount.organization_id);

        if (updateOrgErr) {
          return json({ success: false, message: updateOrgErr.message, code: "SERVER_ERROR" }, 500);
        }
      }

      return json({
        success: true,
        crm_account_id: crmAccountId,
        stripe_customer_id: resolvedCustomerId,
        stripe_subscription_id: subscription.id,
        status: resolvedStatus,
        current_period_end: resolvedCurrentPeriodEnd,
        amount_cents: resolvedAmountCents,
        last_invoice_at: resolvedLastInvoiceAt,
        is_delinquent: resolvedDelinquent,
      });
    } catch (err: any) {
      return json({ success: false, message: err?.message || "Erro interno", code: "SERVER_ERROR" }, 500);
    }
  };
}

const handler = createCrmSyncStripeHandler();

if ((import.meta as any).main) {
  DenoRef.serve(handler);
}

export default handler;
