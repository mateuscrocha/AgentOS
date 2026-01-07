import { assertEquals } from "https://deno.land/std@0.224.0/testing/asserts.ts";

import { createBillingGetStripeCustomerHandler } from "./index.ts";

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

DenoRef.test("billing-get-stripe-customer bloqueia não admin", async () => {
  const state = {
    requesterId: "06cb58c0-7019-4f92-acb6-a8dc3b3b4a46",
    requesterIsSystemAdmin: false,
  };

  const handler = createBillingGetStripeCustomerHandler({
    createClient: makeCreateClientStub(state) as any,
    env: {
      get: (k: string) => {
        if (k === "SUPABASE_URL") return "http://localhost";
        if (k === "SUPABASE_ANON_KEY") return "anon";
        return undefined;
      },
    },
    getStripe: async () => ({
      customers: {
        retrieve: async () => ({ id: "cus_x" }),
      },
    }),
  });

  const res = await handler(makeReq({ stripe_customer_id: "cus_123" }));
  assertEquals(res.status, 403);
});

DenoRef.test("billing-get-stripe-customer valida stripe_customer_id", async () => {
  const state = {
    requesterId: "06cb58c0-7019-4f92-acb6-a8dc3b3b4a46",
    requesterIsSystemAdmin: true,
  };

  const handler = createBillingGetStripeCustomerHandler({
    createClient: makeCreateClientStub(state) as any,
    env: {
      get: (k: string) => {
        if (k === "SUPABASE_URL") return "http://localhost";
        if (k === "SUPABASE_ANON_KEY") return "anon";
        return undefined;
      },
    },
    getStripe: async () => ({
      customers: {
        retrieve: async () => ({ id: "cus_x" }),
      },
    }),
  });

  const res = await handler(makeReq({ stripe_customer_id: "bad" }));
  assertEquals(res.status, 400);
  const body = await res.json();
  assertEquals(body.code, "VALIDATION_ERROR");
});

DenoRef.test("billing-get-stripe-customer retorna detalhes básicos", async () => {
  const state = {
    requesterId: "06cb58c0-7019-4f92-acb6-a8dc3b3b4a46",
    requesterIsSystemAdmin: true,
  };

  const handler = createBillingGetStripeCustomerHandler({
    createClient: makeCreateClientStub(state) as any,
    env: {
      get: (k: string) => {
        if (k === "SUPABASE_URL") return "http://localhost";
        if (k === "SUPABASE_ANON_KEY") return "anon";
        return undefined;
      },
    },
    getStripe: async () => ({
      customers: {
        retrieve: async (id: string) => ({
          id,
          name: "Acme",
          email: "billing@acme.com",
          phone: "+5511999999999",
          created: 1700000000,
          delinquent: false,
          balance: 0,
          currency: "brl",
        }),
      },
    }),
  });

  const res = await handler(makeReq({ stripe_customer_id: "cus_123" }));
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.success, true);
  assertEquals(body.customer.id, "cus_123");
  assertEquals(body.customer.name, "Acme");
  assertEquals(body.customer.email, "billing@acme.com");
  assertEquals(body.customer.phone, "+5511999999999");
  assertEquals(body.customer.created, 1700000000);
  assertEquals(body.customer.delinquent, false);
  assertEquals(body.customer.balance, 0);
  assertEquals(body.customer.currency, "brl");
});

DenoRef.test("billing-get-stripe-customer retorna 404 quando não encontra", async () => {
  const state = {
    requesterId: "06cb58c0-7019-4f92-acb6-a8dc3b3b4a46",
    requesterIsSystemAdmin: true,
  };

  const handler = createBillingGetStripeCustomerHandler({
    createClient: makeCreateClientStub(state) as any,
    env: {
      get: (k: string) => {
        if (k === "SUPABASE_URL") return "http://localhost";
        if (k === "SUPABASE_ANON_KEY") return "anon";
        return undefined;
      },
    },
    getStripe: async () => ({
      customers: {
        retrieve: async () => {
          const e: any = new Error("Not Found");
          e.statusCode = 404;
          throw e;
        },
      },
    }),
  });

  const res = await handler(makeReq({ stripe_customer_id: "cus_404" }));
  assertEquals(res.status, 404);
  const body = await res.json();
  assertEquals(body.code, "STRIPE_CUSTOMER_NOT_FOUND");
});
