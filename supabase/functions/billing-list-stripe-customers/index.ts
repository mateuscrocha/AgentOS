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
  limit?: number;
  starting_after?: string;
  query?: string;
};

type StripeCustomer = {
  id: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  created?: number;
  deleted?: boolean;
};

type StripeListResponse = {
  data: StripeCustomer[];
  has_more: boolean;
};

type StripeLike = {
  customers: {
    list: (params: { limit: number; starting_after?: string }) => Promise<StripeListResponse>;
    retrieve?: (customerId: string) => Promise<StripeCustomer>;
    search?: (params: { query: string; limit: number }) => Promise<StripeListResponse>;
  };
};

function escapeStripeSearchValue(value: string): string {
  return (value || "").replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function buildStripeCustomerSearchQuery(input: string): string {
  const q = (input || "").trim();
  const v = escapeStripeSearchValue(q);
  if (!v) return "";
  if (v.includes("@")) return `email:'${v}'`;
  return `name~'${v}' OR email~'${v}'`;
}

function clampLimit(v: any, def: number, min: number, max: number): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return def;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

export function createBillingListStripeCustomersHandler(
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
    const limit = clampLimit(payload?.limit, 50, 1, 100);
    const startingAfter = (payload?.starting_after || "").trim();
    const query = (payload?.query || "").trim();

    try {
      const stripe = await getStripeImpl();
      let res: StripeListResponse;
      if (query) {
        if (query.startsWith("cus_") && typeof stripe.customers.retrieve === "function") {
          const c = await stripe.customers.retrieve(query);
          res = { data: [c], has_more: false };
        } else if (typeof stripe.customers.search === "function") {
          const searchQuery = buildStripeCustomerSearchQuery(query);
          if (!searchQuery) {
            res = { data: [], has_more: false };
          } else {
            res = await stripe.customers.search({ query: searchQuery, limit: Math.min(limit, 25) });
          }
        } else {
          res = await stripe.customers.list({ limit: Math.min(limit, 100) });
        }
      } else {
        res = await stripe.customers.list({
          limit,
          ...(startingAfter ? { starting_after: startingAfter } : {}),
        });
      }

      const customers = (res.data || [])
        .filter((c) => c && !(c as any).deleted)
        .map((c) => ({
          id: c.id,
          name: c.name ?? null,
          email: c.email ?? null,
          phone: c.phone ?? null,
          created: typeof c.created === "number" ? c.created : null,
        }));

      const nextStartingAfter = !query && res.has_more && customers.length ? customers[customers.length - 1].id : null;

      return json({
        success: true,
        customers,
        has_more: !query && !!res.has_more,
        next_starting_after: nextStartingAfter,
      });
    } catch (err: any) {
      const message = typeof err?.message === "string" && err.message.trim() !== ""
        ? err.message
        : "Falha ao listar clientes da Stripe";
      return json({ success: false, message, code: "STRIPE_ERROR" }, 502);
    }
  };
}

const handler = createBillingListStripeCustomersHandler();

if ((import.meta as any).main) {
  DenoRef.serve(handler);
}

export default handler;
