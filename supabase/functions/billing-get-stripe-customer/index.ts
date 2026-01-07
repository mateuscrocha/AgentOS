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

type Payload = {
  stripe_customer_id?: string;
};

type StripeCustomer = {
  id: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  created?: number;
  delinquent?: boolean | null;
  balance?: number | null;
  currency?: string | null;
  deleted?: boolean;
};

type StripeLike = {
  customers: {
    retrieve: (customerId: string) => Promise<StripeCustomer>;
  };
};

export function createBillingGetStripeCustomerHandler(
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

    const { data: isAdmin, error: isAdminErr } = await supabaseUser.rpc("is_system_admin", {
      _user_id: requesterId,
    });
    if (isAdminErr) {
      return json({ success: false, message: "Falha ao validar permissões", code: "SERVER_ERROR" }, 500);
    }
    if (!isAdmin) {
      return json({ success: false, message: "Forbidden", code: "FORBIDDEN" }, 403);
    }

    const payload = (await req.json().catch(() => null)) as Payload | null;
    const stripeCustomerId = (payload?.stripe_customer_id || "").trim();

    if (!stripeCustomerId || !stripeCustomerId.startsWith("cus_")) {
      return json({ success: false, message: "stripe_customer_id inválido", code: "VALIDATION_ERROR" }, 400);
    }

    try {
      const stripe = await getStripeImpl();
      const customer = await stripe.customers.retrieve(stripeCustomerId);

      if ((customer as any)?.deleted) {
        return json({ success: false, message: "Cliente Stripe está deletado", code: "STRIPE_CUSTOMER_DELETED" }, 400);
      }

      return json({
        success: true,
        customer: {
          id: customer.id,
          name: customer.name ?? null,
          email: customer.email ?? null,
          phone: customer.phone ?? null,
          created: typeof customer.created === "number" ? customer.created : null,
          delinquent: typeof customer.delinquent === "boolean" ? customer.delinquent : null,
          balance: typeof customer.balance === "number" ? customer.balance : null,
          currency: typeof customer.currency === "string" ? customer.currency : null,
        },
      });
    } catch (err: any) {
      if (err?.statusCode === 404) {
        return json({ success: false, message: "Cliente Stripe não encontrado", code: "STRIPE_CUSTOMER_NOT_FOUND" }, 404);
      }
      const message = typeof err?.message === "string" && err.message.trim() !== ""
        ? err.message
        : "Falha ao buscar cliente na Stripe";
      return json({ success: false, message, code: "STRIPE_ERROR" }, 502);
    }
  };
}

const handler = createBillingGetStripeCustomerHandler();

if ((import.meta as any).main) {
  DenoRef.serve(handler);
}

export default handler;
