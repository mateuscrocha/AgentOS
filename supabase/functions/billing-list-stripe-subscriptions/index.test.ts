import { assertEquals } from "https://deno.land/std@0.224.0/testing/asserts.ts";

import { createBillingListStripeSubscriptionsHandler } from "./index.ts";

const DenoRef = (globalThis as any).Deno;

function makeCreateClientStub(state: any) {
  return (_url: string, _key: string, _opts?: any) => {
    return {
      auth: {
        getUser: async () => ({ data: { user: { id: state.requesterId } }, error: null }),
      },
      rpc: async (_fn: string, _args: any) => ({ data: state.requesterIsSystemAdmin, error: null }),
    };
  };
}

function makeReq(payload: any, token = "t") {
  return new Request("http://localhost", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

DenoRef.test("billing-list-stripe-subscriptions bloqueia não admin", async () => {
  const state = {
    requesterId: "06cb58c0-7019-4f92-acb6-a8dc3b3b4a46",
    requesterIsSystemAdmin: false,
  };

  const handler = createBillingListStripeSubscriptionsHandler({
    createClient: makeCreateClientStub(state) as any,
    env: {
      get: (k: string) => {
        if (k === "SUPABASE_URL") return "http://localhost";
        if (k === "SUPABASE_ANON_KEY") return "anon";
        return undefined;
      },
    },
    getStripe: async () => ({
      subscriptions: {
        list: async () => ({ data: [], has_more: false }),
      },
    }),
  });

  const res = await handler(makeReq({ stripe_customer_id: "cus_1" }));
  assertEquals(res.status, 403);
});

DenoRef.test("billing-list-stripe-subscriptions valida stripe_customer_id", async () => {
  const state = {
    requesterId: "06cb58c0-7019-4f92-acb6-a8dc3b3b4a46",
    requesterIsSystemAdmin: true,
  };

  const handler = createBillingListStripeSubscriptionsHandler({
    createClient: makeCreateClientStub(state) as any,
    env: {
      get: (k: string) => {
        if (k === "SUPABASE_URL") return "http://localhost";
        if (k === "SUPABASE_ANON_KEY") return "anon";
        return undefined;
      },
    },
    getStripe: async () => ({
      subscriptions: {
        list: async () => ({ data: [], has_more: false }),
      },
    }),
  });

  const res = await handler(makeReq({ stripe_customer_id: "bad" }));
  assertEquals(res.status, 400);
  const body = await res.json();
  assertEquals(body.code, "VALIDATION_ERROR");
});

DenoRef.test("billing-list-stripe-subscriptions retorna assinaturas", async () => {
  const state = {
    requesterId: "06cb58c0-7019-4f92-acb6-a8dc3b3b4a46",
    requesterIsSystemAdmin: true,
  };

  const handler = createBillingListStripeSubscriptionsHandler({
    createClient: makeCreateClientStub(state) as any,
    env: {
      get: (k: string) => {
        if (k === "SUPABASE_URL") return "http://localhost";
        if (k === "SUPABASE_ANON_KEY") return "anon";
        return undefined;
      },
    },
    getStripe: async () => ({
      subscriptions: {
        list: async (params: any) => {
          assertEquals(params.customer, "cus_1");
          assertEquals(params.limit, 2);
          return {
            has_more: false,
            data: [
              {
                id: "sub_1",
                status: "active",
                customer: "cus_1",
                current_period_end: 1700000000,
                items: { data: [{ price: { id: "price_1", nickname: "Pro", unit_amount: 1000, currency: "brl", recurring: { interval: "month" } } }] },
              },
            ],
          };
        },
      },
    }),
  });

  const res = await handler(makeReq({ stripe_customer_id: "cus_1", limit: 2 }));
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.success, true);
  assertEquals(body.subscriptions.length, 1);
  assertEquals(body.subscriptions[0].id, "sub_1");
  assertEquals(body.subscriptions[0].stripe_price_id, "price_1");
});

