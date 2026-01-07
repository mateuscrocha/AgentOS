import { assertEquals } from "https://deno.land/std@0.224.0/testing/asserts.ts";

import { createBillingListStripeCustomersHandler } from "./index.ts";

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

DenoRef.test("billing-list-stripe-customers bloqueia não admin", async () => {
  const state = {
    requesterId: "06cb58c0-7019-4f92-acb6-a8dc3b3b4a46",
    requesterIsSystemAdmin: false,
  };

  const handler = createBillingListStripeCustomersHandler({
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
        list: async () => ({ data: [], has_more: false }),
      },
    }),
  });

  const res = await handler(makeReq({ limit: 10 }));
  assertEquals(res.status, 403);
});

DenoRef.test("billing-list-stripe-customers retorna clientes e paginação", async () => {
  const state = {
    requesterId: "06cb58c0-7019-4f92-acb6-a8dc3b3b4a46",
    requesterIsSystemAdmin: true,
  };

  const handler = createBillingListStripeCustomersHandler({
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
        list: async (params: any) => {
          assertEquals(params.limit, 2);
          assertEquals(params.starting_after, "cus_1");
          return {
            has_more: true,
            data: [
              { id: "cus_2", name: "Acme", email: "billing@acme.com", phone: "+5511999999999", created: 1700000000 },
              { id: "cus_del", deleted: true },
              { id: "cus_3", name: null, email: null, phone: null, created: 1700000100 },
            ],
          };
        },
      },
    }),
  });

  const res = await handler(makeReq({ limit: 2, starting_after: "cus_1" }));
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.success, true);
  assertEquals(body.customers.length, 2);
  assertEquals(body.customers[0].id, "cus_2");
  assertEquals(body.customers[0].name, "Acme");
  assertEquals(body.customers[0].email, "billing@acme.com");
  assertEquals(body.customers[0].phone, "+5511999999999");
  assertEquals(body.customers[0].created, 1700000000);
  assertEquals(body.customers[1].id, "cus_3");
  assertEquals(body.has_more, true);
  assertEquals(body.next_starting_after, "cus_3");
});

DenoRef.test("billing-list-stripe-customers usa search quando query é informada", async () => {
  const state = {
    requesterId: "06cb58c0-7019-4f92-acb6-a8dc3b3b4a46",
    requesterIsSystemAdmin: true,
  };

  const handler = createBillingListStripeCustomersHandler({
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
        search: async (params: any) => {
          assertEquals(typeof params.query, "string");
          assertEquals(params.limit, 10);
          return {
            has_more: false,
            data: [{ id: "cus_abc", name: "Ana", email: "ana@exemplo.com", phone: null, created: 1700000001 }],
          };
        },
        list: async () => ({ data: [], has_more: false }),
      },
    }),
  });

  const res = await handler(makeReq({ limit: 10, query: "ana" }));
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.success, true);
  assertEquals(body.customers.length, 1);
  assertEquals(body.customers[0].id, "cus_abc");
  assertEquals(body.has_more, false);
  assertEquals(body.next_starting_after, null);
});

DenoRef.test("billing-list-stripe-customers usa retrieve quando query é cus_", async () => {
  const state = {
    requesterId: "06cb58c0-7019-4f92-acb6-a8dc3b3b4a46",
    requesterIsSystemAdmin: true,
  };

  const handler = createBillingListStripeCustomersHandler({
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
        retrieve: async (id: string) => ({ id, name: null, email: null, phone: null, created: 1700000002 }),
        list: async () => ({ data: [], has_more: false }),
      },
    }),
  });

  const res = await handler(makeReq({ query: "cus_x" }));
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.success, true);
  assertEquals(body.customers.length, 1);
  assertEquals(body.customers[0].id, "cus_x");
});
