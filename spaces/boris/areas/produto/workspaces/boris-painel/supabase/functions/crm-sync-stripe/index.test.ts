import { assertEquals } from "https://deno.land/std@0.224.0/testing/asserts.ts";

import { createCrmSyncStripeHandler } from "./index.ts";

const DenoRef = (globalThis as any).Deno;

function makeReq(body: any) {
  return new Request("http://localhost:8000/functions/v1/crm-sync-stripe", {
    method: "POST",
    headers: {
      Authorization: "Bearer t",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

function makeCreateClientStub(state: {
  requesterId: string;
  requesterIsSystemAdmin: boolean;
  account: any;
  updates: Array<{ table: string; values: any }>;
}) {
  return (_url: string, key: string, _opts?: any) => {
    if (key === "anon") {
      return {
        auth: {
          getUser: async () => ({ data: { user: { id: state.requesterId } }, error: null }),
        },
        rpc: async (fn: string) => {
          if (fn === "is_system_admin") return { data: state.requesterIsSystemAdmin, error: null };
          return { data: null, error: null };
        },
      };
    }

    return {
      from: (table: string) => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: state.account, error: null }),
          }),
        }),
        update: (values: any) => ({
          eq: async () => {
            state.updates.push({ table, values });
            return { data: null, error: null };
          },
        }),
      }),
    };
  };
}

DenoRef.test("crm-sync-stripe atualiza crm_account e organization vinculada", async () => {
  const updates: Array<{ table: string; values: any }> = [];
  const handler = createCrmSyncStripeHandler({
    createClientImpl: makeCreateClientStub({
      requesterId: "u-req",
      requesterIsSystemAdmin: true,
      updates,
      account: {
        id: "crm-1",
        organization_id: "org-1",
        stripe_customer_id: "cus_123",
        stripe_subscription_id: "sub_123",
        organizations: {
          id: "org-1",
          billing_plan: null,
          billing_status: null,
          current_period_end: null,
          stripe_customer_id: "cus_123",
          stripe_subscription_id: "sub_123",
        },
      },
    }) as any,
    env: {
      get: (k: string) => {
        if (k === "SUPABASE_URL") return "http://localhost:8000";
        if (k === "SUPABASE_ANON_KEY") return "anon";
        if (k === "SUPABASE_SERVICE_ROLE_KEY") return "service";
        if (k === "STRIPE_SECRET_KEY") return "sk_test";
        return undefined;
      },
    },
    fetchImpl: (async (input: string | URL) => {
      const url = String(input);
      if (url.includes("/v1/subscriptions/sub_123")) {
        return new Response(JSON.stringify({
          id: "sub_123",
          customer: "cus_123",
          status: "active",
          current_period_end: 1896048000,
          items: { data: [{ price: { nickname: "Growth", unit_amount: 129900, recurring: { interval: "month", interval_count: 1 } } }] },
          latest_invoice: {
            id: "in_123",
            created: 1893456000,
            status: "paid",
            amount_paid: 129900,
            amount_due: 129900,
            total: 129900,
            paid: true,
          },
        }), { status: 200 });
      }
      if (url.includes("/v1/invoices?subscription=sub_123&status=paid&limit=1")) {
        return new Response(JSON.stringify({
          data: [{
            id: "in_paid_123",
            created: 1893456000,
            status: "paid",
            amount_paid: 129900,
            total: 129900,
            paid: true,
            status_transitions: {
              paid_at: 1893456000,
            },
          }],
        }), { status: 200 });
      }
      return new Response(JSON.stringify({ error: { message: "not found" } }), { status: 404 });
    }) as any,
  });

  const res = await handler(makeReq({ crm_account_id: "crm-1" }));

  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.success, true);
  assertEquals(updates.length, 2);
  assertEquals(updates[0].table, "crm_accounts");
  assertEquals(updates[1].table, "organizations");
  assertEquals(updates[0].values.status, "customer");
  assertEquals(updates[0].values.stage, "customer");
  assertEquals(updates[0].values.stripe_subscription_status, "active");
  assertEquals(updates[0].values.stripe_next_billing_at, "2030-01-31T00:00:00.000Z");
  assertEquals(updates[0].values.stripe_is_delinquent, false);
  assertEquals(updates[0].values.stripe_monthly_amount_cents, 129900);
  assertEquals(updates[1].values.billing_status, "active");
  assertEquals(updates[1].values.billing_plan, "Growth");
  assertEquals(updates[1].values.current_period_end, "2030-01-31T00:00:00.000Z");
});

DenoRef.test("crm-sync-stripe retorna erro claro quando ids Stripe não existem", async () => {
  const handler = createCrmSyncStripeHandler({
    createClientImpl: makeCreateClientStub({
      requesterId: "u-req",
      requesterIsSystemAdmin: true,
      updates: [],
      account: {
        id: "crm-1",
        organization_id: null,
        stripe_customer_id: null,
        stripe_subscription_id: null,
        organizations: null,
      },
    }) as any,
    env: {
      get: (k: string) => {
        if (k === "SUPABASE_URL") return "http://localhost:8000";
        if (k === "SUPABASE_ANON_KEY") return "anon";
        if (k === "SUPABASE_SERVICE_ROLE_KEY") return "service";
        if (k === "STRIPE_SECRET_KEY") return "sk_test";
        return undefined;
      },
    },
  });

  const res = await handler(makeReq({ crm_account_id: "crm-1" }));

  assertEquals(res.status, 400);
  const body = await res.json();
  assertEquals(body.code, "STRIPE_IDS_MISSING");
});
