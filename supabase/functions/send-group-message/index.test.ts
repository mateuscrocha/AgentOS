import { assertEquals } from "https://deno.land/std@0.224.0/testing/asserts.ts";

import { createSendGroupMessageHandler } from "./index.ts";

const DenoRef = (globalThis as any).Deno;

function makeReq(body: any, token = "Bearer t") {
  return new Request("http://localhost:8000/functions/v1/send-group-message", {
    method: "POST",
    headers: {
      Authorization: token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

function makeCreateClientStub(state: {
  requesterId: string;
  requesterIsSystemAdmin?: boolean;
  requesterCanEditGroup?: boolean;
  group?: any;
}) {
  return (_url: string, key: string, _opts?: any) => {
    if (key === "anon") {
      return {
        auth: {
          getUser: async () => ({ data: { user: { id: state.requesterId } }, error: null }),
        },
        rpc: async (fn: string) => {
          if (fn === "is_system_admin") return { data: !!state.requesterIsSystemAdmin, error: null };
          if (fn === "can_edit_group") return { data: !!state.requesterCanEditGroup, error: null };
          return { data: null, error: null };
        },
      };
    }

    return {
      from: (_table: string) => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: state.group ?? null, error: null }),
          }),
        }),
      }),
    };
  };
}

DenoRef.test("send-group-message envia para Z-API quando usuario pode editar o grupo", async () => {
  let fetchUrl = "";
  let fetchInit: RequestInit | undefined;

  const handler = createSendGroupMessageHandler({
    createClientImpl: makeCreateClientStub({
      requesterId: "user-1",
      requesterCanEditGroup: true,
      group: {
        id: "11111111-1111-4111-8111-111111111111",
        name: "Grupo Teste",
        provider_phone: "5511999990000-group",
      },
    }) as any,
    env: {
      get: (k: string) => {
        if (k === "SUPABASE_URL") return "http://localhost:8000";
        if (k === "SUPABASE_ANON_KEY") return "anon";
        if (k === "SUPABASE_SERVICE_ROLE_KEY") return "service";
        if (k === "ZAPI_INSTANCE") return "instance-1";
        if (k === "ZAPI_TOKEN") return "token-1";
        if (k === "ZAPI_CLIENT_TOKEN") return "client-token-1";
        return undefined;
      },
    },
    fetchImpl: (async (input: string | URL, init?: RequestInit) => {
      fetchUrl = String(input);
      fetchInit = init;
      return new Response(JSON.stringify({ sent: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as any,
  });

  const res = await handler(
    makeReq({
      groupId: "11111111-1111-4111-8111-111111111111",
      message: "Oi, grupo",
    })
  );

  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.success, true);
  assertEquals(body.messageSent, true);
  assertEquals(
    fetchUrl,
    "https://api.z-api.io/instances/instance-1/token/token-1/send-text"
  );
  assertEquals((fetchInit?.headers as Record<string, string>)["Client-Token"], "client-token-1");
  assertEquals(JSON.parse(String(fetchInit?.body)).phone, "5511999990000-group");
  assertEquals(JSON.parse(String(fetchInit?.body)).message, "Oi, grupo");
});

DenoRef.test("send-group-message bloqueia usuario sem permissao", async () => {
  const handler = createSendGroupMessageHandler({
    createClientImpl: makeCreateClientStub({
      requesterId: "user-1",
      requesterCanEditGroup: false,
      group: {
        id: "11111111-1111-4111-8111-111111111111",
        name: "Grupo Teste",
        provider_phone: "5511999990000-group",
      },
    }) as any,
    env: {
      get: (k: string) => {
        if (k === "SUPABASE_URL") return "http://localhost:8000";
        if (k === "SUPABASE_ANON_KEY") return "anon";
        if (k === "SUPABASE_SERVICE_ROLE_KEY") return "service";
        if (k === "ZAPI_INSTANCE") return "instance-1";
        if (k === "ZAPI_TOKEN") return "token-1";
        if (k === "ZAPI_CLIENT_TOKEN") return "client-token-1";
        return undefined;
      },
    },
  });

  const res = await handler(
    makeReq({
      groupId: "11111111-1111-4111-8111-111111111111",
      message: "Oi, grupo",
    })
  );

  assertEquals(res.status, 403);
  const body = await res.json();
  assertEquals(body.code, "FORBIDDEN");
  assertEquals(body.messageSent, false);
});

DenoRef.test("send-group-message retorna erro claro quando zapi falha", async () => {
  const handler = createSendGroupMessageHandler({
    createClientImpl: makeCreateClientStub({
      requesterId: "user-1",
      requesterCanEditGroup: true,
      group: {
        id: "11111111-1111-4111-8111-111111111111",
        name: "Grupo Teste",
        provider_phone: "5511999990000-group",
      },
    }) as any,
    env: {
      get: (k: string) => {
        if (k === "SUPABASE_URL") return "http://localhost:8000";
        if (k === "SUPABASE_ANON_KEY") return "anon";
        if (k === "SUPABASE_SERVICE_ROLE_KEY") return "service";
        if (k === "ZAPI_INSTANCE") return "instance-1";
        if (k === "ZAPI_TOKEN") return "token-1";
        if (k === "ZAPI_CLIENT_TOKEN") return "client-token-1";
        return undefined;
      },
    },
    fetchImpl: (async () => {
      return new Response(JSON.stringify({ message: "provider down" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }) as any,
  });

  const res = await handler(
    makeReq({
      groupId: "11111111-1111-4111-8111-111111111111",
      message: "Oi, grupo",
    })
  );

  assertEquals(res.status, 502);
  const body = await res.json();
  assertEquals(body.code, "ZAPI_SEND_FAILED");
  assertEquals(body.message, "provider down");
  assertEquals(body.messageSent, false);
});
