import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Payload = {
  limit?: number;
};

type StripeListResponse<T> = {
  object: "list";
  data: T[];
  has_more: boolean;
};

type StripeCustomer = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  metadata?: Record<string, string | undefined>;
};

type StripePrice = {
  id: string;
  nickname: string | null;
  unit_amount: number | null;
  recurring?: {
    interval?: string | null;
  } | null;
};

type StripeSubscription = {
  id: string;
  status: string | null;
  created: number | null;
  canceled_at: number | null;
  current_period_end: number | null;
  items?: {
    data?: Array<{
      price?: StripePrice | null;
    }>;
  } | null;
};

type OrganizationRow = {
  id: string;
  name: string;
  status: string;
  relationship_type: string;
  contact_email: string | null;
  contact_phone: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Connection": "keep-alive" },
  });
}

function isUuid(value: string | null | undefined) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value || "");
}

function normalizeNullable(value: string | null | undefined) {
  const trimmed = (value || "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeName(value: string | null | undefined) {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(ltda|ltda\.|me|eireli|sa|s\.a\.|empresa|empresas|cursos|online|de|do|da|dos|das)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseRelationshipType(value?: string | null) {
  const normalized = (value || "").trim();
  if (["paying_customer", "partner", "courtesy", "internal", "trial", "demo"].includes(normalized)) {
    return normalized;
  }
  return "paying_customer";
}

function getSubscriptionPriority(status: string | null | undefined) {
  switch (status) {
    case "active":
      return 0;
    case "trialing":
      return 1;
    case "past_due":
      return 2;
    case "unpaid":
      return 3;
    case "paused":
      return 4;
    case "incomplete":
      return 5;
    case "canceled":
      return 6;
    case "incomplete_expired":
      return 7;
    default:
      return 8;
  }
}

function pickRelevantSubscription(subscriptions: StripeSubscription[]) {
  return [...subscriptions].sort((left, right) => {
    const byPriority = getSubscriptionPriority(left.status) - getSubscriptionPriority(right.status);
    if (byPriority !== 0) return byPriority;

    const leftMoment = left.current_period_end || left.canceled_at || left.created || 0;
    const rightMoment = right.current_period_end || right.canceled_at || right.created || 0;
    return rightMoment - leftMoment;
  })[0] ?? null;
}

function inferOrganizationStatus(billingStatus: string | null) {
  if (["active", "trialing", "past_due", "unpaid", "paused", "incomplete"].includes(billingStatus || "")) {
    return "active";
  }
  return "inactive";
}

function inferBillingPlan(subscription: StripeSubscription | null) {
  const price = subscription?.items?.data?.[0]?.price ?? null;
  if (!price) return null;
  if (price.nickname) return price.nickname;
  if (price.unit_amount != null && price.recurring?.interval) {
    return `${price.id} · ${price.unit_amount / 100}/${price.recurring.interval}`;
  }
  return price.id;
}

async function stripeRequest<T>(path: string, stripeSecretKey: string, params?: URLSearchParams) {
  const url = `https://api.stripe.com/v1/${path}${params ? `?${params.toString()}` : ""}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${stripeSecretKey}`,
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error?.message || `Falha ao consultar Stripe em ${path}`);
  }
  return payload as T;
}

async function findOrganizationBySimilarName(
  supabaseAdmin: ReturnType<typeof createClient>,
  customerName: string,
) {
  const normalizedCustomerName = normalizeName(customerName);
  if (!normalizedCustomerName) return null;

  const baseTerms = normalizedCustomerName.split(" ").filter((term) => term.length >= 3);
  const searchFragment = baseTerms.slice(0, 3).join(" ");
  if (!searchFragment) return null;

  const { data, error } = await supabaseAdmin
    .from("organizations")
    .select("id, name, status, relationship_type, contact_email, contact_phone, stripe_customer_id, stripe_subscription_id")
    .ilike("name", `%${searchFragment}%`)
    .limit(20);

  if (error) {
    throw error;
  }

  const candidates = (data as OrganizationRow[] | null) ?? [];
  return candidates.find((candidate) => {
    if (candidate.stripe_customer_id) return false;
    const normalizedCandidateName = normalizeName(candidate.name);
    if (!normalizedCandidateName) return false;
    return (
      normalizedCandidateName === normalizedCustomerName ||
      normalizedCandidateName.startsWith(normalizedCustomerName) ||
      normalizedCustomerName.startsWith(normalizedCandidateName)
    );
  }) ?? null;
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
    const limit = Math.max(1, Math.min(200, Number(payload?.limit) || 100));

    const supabaseAdmin = createClient(url, service, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const customers = await stripeRequest<StripeListResponse<StripeCustomer>>(
      "customers",
      stripeSecretKey,
      new URLSearchParams({
        limit: String(limit),
      }),
    );

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const customer of customers.data ?? []) {
      const customerName = normalizeNullable(customer.name) || normalizeNullable(customer.email) || `Cliente Stripe ${customer.id.slice(-8)}`;
      const customerEmail = normalizeNullable(customer.email);
      const customerPhone = normalizeNullable(customer.phone);
      const metadata = customer.metadata || {};
      const metadataOrganizationId = normalizeNullable(metadata.organization_id);
      const relationshipType = parseRelationshipType(metadata.relationship_type);

      let existingOrganization: OrganizationRow | null = null;

      const byStripeCustomer = await supabaseAdmin
        .from("organizations")
        .select("id, name, status, relationship_type, contact_email, contact_phone, stripe_customer_id, stripe_subscription_id")
        .eq("stripe_customer_id", customer.id)
        .maybeSingle();
      if (byStripeCustomer.error) {
        return json({ success: false, message: byStripeCustomer.error.message, code: "SERVER_ERROR" }, 500);
      }
      existingOrganization = (byStripeCustomer.data as OrganizationRow | null) ?? null;

      if (!existingOrganization && isUuid(metadataOrganizationId)) {
        const byMetadataId = await supabaseAdmin
          .from("organizations")
          .select("id, name, status, relationship_type, contact_email, contact_phone, stripe_customer_id, stripe_subscription_id")
          .eq("id", metadataOrganizationId!)
          .maybeSingle();
        if (byMetadataId.error) {
          return json({ success: false, message: byMetadataId.error.message, code: "SERVER_ERROR" }, 500);
        }
        existingOrganization = (byMetadataId.data as OrganizationRow | null) ?? null;
      }

      if (!existingOrganization && customerEmail) {
        const byEmail = await supabaseAdmin
          .from("organizations")
          .select("id, name, status, relationship_type, contact_email, contact_phone, stripe_customer_id, stripe_subscription_id")
          .ilike("contact_email", customerEmail)
          .limit(1)
          .maybeSingle();
        if (byEmail.error && byEmail.error.code !== "PGRST116") {
          return json({ success: false, message: byEmail.error.message, code: "SERVER_ERROR" }, 500);
        }
        existingOrganization = (byEmail.data as OrganizationRow | null) ?? null;
      }

      if (!existingOrganization) {
        const byName = await supabaseAdmin
          .from("organizations")
          .select("id, name, status, relationship_type, contact_email, contact_phone, stripe_customer_id, stripe_subscription_id")
          .eq("name", customerName)
          .limit(1)
          .maybeSingle();
        if (byName.error && byName.error.code !== "PGRST116") {
          return json({ success: false, message: byName.error.message, code: "SERVER_ERROR" }, 500);
        }
        existingOrganization = (byName.data as OrganizationRow | null) ?? null;
      }

      if (!existingOrganization) {
        existingOrganization = await findOrganizationBySimilarName(supabaseAdmin, customerName);
      }

      const subscriptions = await stripeRequest<StripeListResponse<StripeSubscription>>(
        "subscriptions",
        stripeSecretKey,
        new URLSearchParams({
          customer: customer.id,
          status: "all",
          limit: "20",
          "expand[]": "data.items.data.price",
        }),
      );

      const relevantSubscription = pickRelevantSubscription(subscriptions.data ?? []);
      const billingStatus = normalizeNullable(relevantSubscription?.status || null) || "inactive";
      const currentPeriodEnd = relevantSubscription?.current_period_end
        ? new Date(relevantSubscription.current_period_end * 1000).toISOString()
        : null;
      const billingPlan = inferBillingPlan(relevantSubscription);
      const organizationStatus = inferOrganizationStatus(billingStatus);

      const patch = {
        name: existingOrganization?.name || customerName,
        contact_email: existingOrganization?.contact_email || customerEmail,
        contact_phone: existingOrganization?.contact_phone || customerPhone,
        stripe_customer_id: customer.id,
        stripe_subscription_id: relevantSubscription?.id ?? null,
        stripe_price_id: relevantSubscription?.items?.data?.[0]?.price?.id ?? null,
        billing_status: billingStatus,
        billing_plan: billingPlan,
        current_period_end: currentPeriodEnd,
        relationship_type: existingOrganization?.relationship_type || relationshipType,
        status: organizationStatus,
      };

      if (!existingOrganization) {
        const insertResult = await supabaseAdmin
          .from("organizations")
          .insert(patch)
          .select("id")
          .single();
        if (insertResult.error) {
          skipped += 1;
          continue;
        }
        created += 1;
        continue;
      }

      const updateResult = await supabaseAdmin
        .from("organizations")
        .update(patch)
        .eq("id", existingOrganization.id);
      if (updateResult.error) {
        skipped += 1;
        continue;
      }
      updated += 1;
    }

    return json({
      success: true,
      counts: {
        customers_seen: customers.data?.length ?? 0,
        created,
        updated,
        skipped,
      },
    });
  } catch (err: any) {
    return json({
      success: false,
      message: err?.message || "Falha ao sincronizar clientes Stripe para organizações",
      code: "STRIPE_SYNC_FAILED",
    }, 502);
  }
});
