import { assertEquals } from "https://deno.land/std@0.224.0/testing/asserts.ts";

import { createBillingLinkOrganizationStripeCustomerHandler } from "./index.ts";

const DenoRef = (globalThis as any).Deno;

type Call = { table: string; action: string; payload?: any; filters?: Record<string, any> };

class Builder {
  private table: string;
  private calls: Call[];
  private state: any;
  private action: string = "select";
  private payload: any;
  private filters: Record<string, any> = {};
  private single = false;

  constructor(table: string, calls: Call[], state: any) {
    this.table = table;
    this.calls = calls;
    this.state = state;
  }

  select(_columns: string, _options?: any) {
    this.action = "select";
    return this;
  }

  update(values: any) {
    this.action = "update";
    this.payload = values;
    return this;
  }

  insert(values: any) {
    this.action = "insert";
    this.payload = values;
    return this;
  }

  eq(column: string, value: any) {
    this.filters[`eq:${column}`] = value;
    return this;
  }

  maybeSingle() {
    this.single = true;
    return this.execute();
  }

  then(resolve: any, reject: any) {
    return this.execute().then(resolve, reject);
  }

  private record(call: Call) {
    this.calls.push(call);
  }

  private async execute(): Promise<any> {
    this.record({ table: this.table, action: this.action, payload: this.payload, filters: this.filters });

    if (this.table === "organizations" && this.action === "select") {
      if (this.single) {
        return { data: this.state.org ?? null, error: null };
      }
      return { data: this.state.org ? [this.state.org] : [], error: null };
    }

    if (this.table === "organizations" && this.action === "update") {
      if (this.state.updateErrorMessage) {
        return { data: null, error: { message: this.state.updateErrorMessage } };
      }
      return { data: [{ id: this.filters["eq:id"] }], error: null };
    }

    if (this.table === "events" && this.action === "insert") {
      return { data: [{ id: "e1" }], error: null };
    }

    return { data: null, error: null };
  }
}

function makeCreateClientStub(state: any, calls: Call[]) {
  let n = 0;
  return (_url: string, _key: string, _opts?: any) => {
    n += 1;
    if (n === 1) {
      return {
        auth: {
          getUser: async () => ({ data: { user: { id: state.requesterId } }, error: null }),
        },
        rpc: async (_fn: string, _args: any) => ({ data: state.requesterIsSystemAdmin, error: null }),
      };
    }

    return {
      from: (table: string) => new Builder(table, calls, state),
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

DenoRef.test("billing-link-organization-stripe-customer bloqueia não admin", async () => {
  const calls: Call[] = [];
  const state = {
    requesterId: "06cb58c0-7019-4f92-acb6-a8dc3b3b4a46",
    requesterIsSystemAdmin: false,
    org: { id: "c9c523fd-af5f-4f61-a240-f3256a77b94e", name: "Org", stripe_customer_id: null },
  };

  const handler = createBillingLinkOrganizationStripeCustomerHandler({
    createClient: makeCreateClientStub(state, calls) as any,
    env: {
      get: (k: string) => {
        if (k === "SUPABASE_URL") return "http://localhost";
        if (k === "SUPABASE_ANON_KEY") return "anon";
        if (k === "SUPABASE_SERVICE_ROLE_KEY") return "service";
        return undefined;
      },
    },
    getStripe: async () => ({
      customers: {
        retrieve: async (_id: string) => ({ id: "cus_x" }),
      },
    }),
  });

  const res = await handler(
    makeReq({
      organization_id: "c9c523fd-af5f-4f61-a240-f3256a77b94e",
      stripe_customer_id: "cus_12345678",
    }),
  );
  assertEquals(res.status, 403);

  const updates = calls.filter((c) => c.table === "organizations" && c.action === "update");
  assertEquals(updates.length, 0);
});

DenoRef.test("billing-link-organization-stripe-customer valida formato inválido", async () => {
  const calls: Call[] = [];
  const state = {
    requesterId: "06cb58c0-7019-4f92-acb6-a8dc3b3b4a46",
    requesterIsSystemAdmin: true,
    org: { id: "c9c523fd-af5f-4f61-a240-f3256a77b94e", name: "Org", stripe_customer_id: null },
  };

  const handler = createBillingLinkOrganizationStripeCustomerHandler({
    createClient: makeCreateClientStub(state, calls) as any,
    env: {
      get: (k: string) => {
        if (k === "SUPABASE_URL") return "http://localhost";
        if (k === "SUPABASE_ANON_KEY") return "anon";
        if (k === "SUPABASE_SERVICE_ROLE_KEY") return "service";
        return undefined;
      },
    },
    getStripe: async () => ({
      customers: {
        retrieve: async (_id: string) => ({ id: "cus_x" }),
      },
    }),
  });

  const res = await handler(
    makeReq({
      organization_id: "c9c523fd-af5f-4f61-a240-f3256a77b94e",
      stripe_customer_id: "bad_id",
    }),
  );
  assertEquals(res.status, 400);
  const body = await res.json();
  assertEquals(body.code, "VALIDATION_ERROR");

  const updates = calls.filter((c) => c.table === "organizations" && c.action === "update");
  assertEquals(updates.length, 0);
});

DenoRef.test("billing-link-organization-stripe-customer retorna erro quando customer não existe", async () => {
  const calls: Call[] = [];
  const state = {
    requesterId: "06cb58c0-7019-4f92-acb6-a8dc3b3b4a46",
    requesterIsSystemAdmin: true,
    org: { id: "c9c523fd-af5f-4f61-a240-f3256a77b94e", name: "Org", stripe_customer_id: null },
  };

  const handler = createBillingLinkOrganizationStripeCustomerHandler({
    createClient: makeCreateClientStub(state, calls) as any,
    env: {
      get: (k: string) => {
        if (k === "SUPABASE_URL") return "http://localhost";
        if (k === "SUPABASE_ANON_KEY") return "anon";
        if (k === "SUPABASE_SERVICE_ROLE_KEY") return "service";
        return undefined;
      },
    },
    getStripe: async () => ({
      customers: {
        retrieve: async (_id: string) => {
          const e: any = new Error("Not Found");
          e.statusCode = 404;
          throw e;
        },
      },
    }),
  });

  const res = await handler(
    makeReq({
      organization_id: "c9c523fd-af5f-4f61-a240-f3256a77b94e",
      stripe_customer_id: "cus_12345678",
    }),
  );
  assertEquals(res.status, 404);
  const body = await res.json();
  assertEquals(body.code, "STRIPE_CUSTOMER_NOT_FOUND");

  const updates = calls.filter((c) => c.table === "organizations" && c.action === "update");
  assertEquals(updates.length, 0);
});

DenoRef.test("billing-link-organization-stripe-customer vincula com sucesso e atualiza organização", async () => {
  const calls: Call[] = [];
  const state = {
    requesterId: "06cb58c0-7019-4f92-acb6-a8dc3b3b4a46",
    requesterIsSystemAdmin: true,
    org: { id: "c9c523fd-af5f-4f61-a240-f3256a77b94e", name: "Org", stripe_customer_id: null },
  };

  const handler = createBillingLinkOrganizationStripeCustomerHandler({
    createClient: makeCreateClientStub(state, calls) as any,
    env: {
      get: (k: string) => {
        if (k === "SUPABASE_URL") return "http://localhost";
        if (k === "SUPABASE_ANON_KEY") return "anon";
        if (k === "SUPABASE_SERVICE_ROLE_KEY") return "service";
        return undefined;
      },
    },
    getStripe: async () => ({
      customers: {
        retrieve: async (id: string) => ({ id, name: "Acme", email: "billing@acme.com" }),
      },
    }),
  });

  const res = await handler(
    makeReq({
      organization_id: "c9c523fd-af5f-4f61-a240-f3256a77b94e",
      stripe_customer_id: "cus_12345678",
    }),
  );
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.success, true);
  assertEquals(body.organization_id, "c9c523fd-af5f-4f61-a240-f3256a77b94e");
  assertEquals(body.stripe_customer_id, "cus_12345678");
  assertEquals(body.customer?.name, "Acme");
  assertEquals(body.customer?.email, "billing@acme.com");

  const updates = calls.filter((c) => c.table === "organizations" && c.action === "update");
  assertEquals(updates.length, 1);
  assertEquals(updates[0].payload?.stripe_customer_id, "cus_12345678");

  const linkedEvent = calls.find((c) => c.table === "events" && c.action === "insert" && c.payload?.event_type === "ORGANIZATION_STRIPE_LINKED");
  assertEquals(!!linkedEvent, true);
});

