import { assertEquals, assert } from "https://deno.land/std@0.224.0/testing/asserts.ts";

import { createAdminUpdateUserHandler } from "./index.ts";

const DenoRef = (globalThis as any).Deno;

function makeReq(body: any) {
  return new Request("http://localhost:8000/functions/v1/admin-update-user", {
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
          updateUserById: async (userId: string) => ({ data: { user: { id: userId } }, error: null }),
        },
      },
    };
  };
}

DenoRef.test("admin-update-user retorna erro claro quando senha é muito longa", async () => {
  const handler = createAdminUpdateUserHandler({
    createClientImpl: makeCreateClientStub({ requesterId: "u-req", requesterIsSystemAdmin: true }) as any,
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
      user_id: "u-target",
      password: "a".repeat(10_000),
    })
  );

  assertEquals(res.status, 400);
  const body = await res.json();
  assertEquals(body.success, false);
  assertEquals(body.code, "PASSWORD_TOO_LONG");
  assert(String(body.message || "").includes("no máximo"));
});

DenoRef.test("admin-update-user aceita senha no limite sem quebrar", async () => {
  const handler = createAdminUpdateUserHandler({
    createClientImpl: makeCreateClientStub({ requesterId: "u-req", requesterIsSystemAdmin: true }) as any,
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
      user_id: "u-target",
      password: "a".repeat(72),
    })
  );

  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.success, true);
  assertEquals(body.user_id, "u-target");
});

