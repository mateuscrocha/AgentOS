import { assertEquals, assert } from "https://deno.land/std@0.224.0/testing/asserts.ts";

import { createAdminCreateUserHandler } from "./index.ts";

const DenoRef = (globalThis as any).Deno;
const STRONG_PASSWORD_72 = "Aa1!".repeat(18);

function makeReq(body: any) {
  return new Request("http://localhost:8000/functions/v1/admin-create-user", {
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
  createdUserId: string;
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
      auth: {
        admin: {
          createUser: async () => ({ data: { user: { id: state.createdUserId } }, error: null }),
          deleteUser: async () => ({ data: null, error: null }),
        },
      },
      from: (_table: string) => ({
        update: (_values: any) => ({
          eq: async () => ({ data: null, error: null }),
        }),
        insert: async (_values: any) => ({ data: null, error: null }),
        eq: async () => ({ data: null, error: null }),
      }),
      rpc: async () => ({ data: true, error: null }),
    };
  };
}

DenoRef.test("admin-create-user retorna erro claro quando senha é muito longa", async () => {
  const handler = createAdminCreateUserHandler({
    createClientImpl: makeCreateClientStub({
      requesterId: "u-req",
      requesterIsSystemAdmin: true,
      createdUserId: "u-new",
    }) as any,
    env: {
      get: (k: string) => {
        if (k === "SUPABASE_URL") return "http://localhost:8000";
        if (k === "SUPABASE_ANON_KEY") return "anon";
        if (k === "SUPABASE_SERVICE_ROLE_KEY") return "service";
        return undefined;
      },
    },
  });

  const res = await handler(
    makeReq({
      name: "Teste",
      email: "teste@exemplo.com",
      password: "a".repeat(10_000),
    })
  );

  assertEquals(res.status, 400);
  const body = await res.json();
  assertEquals(body.success, false);
  assertEquals(body.code, "PASSWORD_TOO_LONG");
  assert(String(body.message || "").includes("no máximo"));
});

DenoRef.test("admin-create-user rejeita senha fraca", async () => {
  const handler = createAdminCreateUserHandler({
    createClientImpl: makeCreateClientStub({
      requesterId: "u-req",
      requesterIsSystemAdmin: true,
      createdUserId: "u-new",
    }) as any,
    env: {
      get: (k: string) => {
        if (k === "SUPABASE_URL") return "http://localhost:8000";
        if (k === "SUPABASE_ANON_KEY") return "anon";
        if (k === "SUPABASE_SERVICE_ROLE_KEY") return "service";
        return undefined;
      },
    },
  });

  const res = await handler(
    makeReq({
      name: "Teste",
      email: "teste@exemplo.com",
      password: "abcdef1234",
      scope_type: "organization",
      scope_id: "org-1",
    })
  );

  assertEquals(res.status, 400);
  const body = await res.json();
  assertEquals(body.success, false);
  assertEquals(body.code, "WEAK_PASSWORD");
});

DenoRef.test("admin-create-user aceita senha no limite sem quebrar", async () => {
  const handler = createAdminCreateUserHandler({
    createClientImpl: makeCreateClientStub({
      requesterId: "u-req",
      requesterIsSystemAdmin: true,
      createdUserId: "u-new",
    }) as any,
    env: {
      get: (k: string) => {
        if (k === "SUPABASE_URL") return "http://localhost:8000";
        if (k === "SUPABASE_ANON_KEY") return "anon";
        if (k === "SUPABASE_SERVICE_ROLE_KEY") return "service";
        return undefined;
      },
    },
  });

  const res = await handler(
    makeReq({
      name: "Teste",
      email: "teste@exemplo.com",
      password: STRONG_PASSWORD_72,
      scope_type: "organization",
      scope_id: "org-1",
      assign_org_admin: false,
    })
  );

  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.success, true);
  assertEquals(body.user_id, "u-new");
});
