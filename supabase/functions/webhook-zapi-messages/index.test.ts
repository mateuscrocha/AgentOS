import { assertEquals } from "https://deno.land/std@0.224.0/testing/asserts.ts";

import { createWebhookZapiMessagesHandler } from "./index.ts";

const DenoRef = (globalThis as any).Deno;

function makeReq(body: any) {
  return new Request("http://localhost:8000/functions/v1/webhook-zapi-messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

function makeCreateClientStub(state: {
  groupId: string;
  providerPhone: string;
  groupName?: string;
  welcomeMessageEnabled?: boolean;
  memberEventInserts: any[];
  groupUpdates: any[];
  membersByLid?: Record<string, any>;
  membersByPhone?: Record<string, any>;
  messageInserts?: any[];
  messageCountByMemberId?: Record<string, number>;
  memberUpdates?: any[];
}) {
  return (_url: string, _key: string, _opts?: any) => {
    const from = (table: string) => {
      const filters: Record<string, any> = {};
      let updateValues: any = null;
      let selectOptions: any = null;

      const builder: any = {
        select(_columns?: string, options?: any) {
          selectOptions = options ?? null;
          return builder;
        },
        in(column: string, value: any) {
          filters[`in:${column}`] = value;
          return builder;
        },
        limit() {
          return builder;
        },
        maybeSingle: async () => {
          if (table === "groups") {
            const variants = Array.isArray(filters["in:provider_phone"]) ? filters["in:provider_phone"] : [];
            if (variants.includes(state.providerPhone)) {
              return { data: { id: state.groupId, name: state.groupName ?? "Grupo Teste", provider_phone: state.providerPhone }, error: null };
            }
          }
          if (table === "group_settings") {
            return { data: { welcome_message_enabled: !!state.welcomeMessageEnabled }, error: null };
          }
          if (table === "members") {
            const byLid = filters["eq:lid"];
            if (typeof byLid === "string" && state.membersByLid?.[byLid]) {
              return { data: state.membersByLid[byLid], error: null };
            }
            const byPhone = filters["eq:phone_e164"];
            if (typeof byPhone === "string" && state.membersByPhone?.[byPhone]) {
              return { data: state.membersByPhone[byPhone], error: null };
            }
          }

          return { data: null, error: null };
        },
        insert: async (values: any) => {
          if (table === "member_events") {
            state.memberEventInserts.push(...(Array.isArray(values) ? values : [values]));
          }
          if (table === "messages") {
            state.messageInserts?.push(...(Array.isArray(values) ? values : [values]));
          }
          return { data: values, error: null };
        },
        update(values: any) {
          updateValues = values;
          return builder;
        },
        eq(column: string, value: any) {
          if (table === "groups" && updateValues) {
            state.groupUpdates.push({ column, value, values: updateValues });
            return Promise.resolve({ data: null, error: null });
          }
          if (table === "members" && updateValues) {
            state.memberUpdates?.push({ column, value, values: updateValues });
            return Promise.resolve({ data: null, error: null });
          }
          filters[`eq:${column}`] = value;
          return builder;
        },
        then(onFulfilled: any, onRejected: any) {
          if (table === "messages" && selectOptions?.head) {
            const memberId = filters["eq:member_id"];
            const count = typeof memberId === "string" ? (state.messageCountByMemberId?.[memberId] ?? 0) : 0;
            return Promise.resolve({ data: null, error: null, count }).then(onFulfilled, onRejected);
          }
          return Promise.resolve({ data: [], error: null }).then(onFulfilled, onRejected);
        },
      };

      return builder;
    };

    return { from };
  };
}

DenoRef.test("webhook-zapi-messages persiste evento de entrada de membro", async () => {
  const memberEventInserts: any[] = [];
  const groupUpdates: any[] = [];

  const handler = createWebhookZapiMessagesHandler({
    env: {
      get: (key: string) => {
        if (key === "SUPABASE_URL") return "http://localhost:8000";
        if (key === "SUPABASE_SERVICE_ROLE_KEY") return "service";
        return undefined;
      },
    },
    createClientImpl: makeCreateClientStub({
      groupId: "11111111-1111-4111-8111-111111111111",
      providerPhone: "5511999990000-group",
      memberEventInserts,
      groupUpdates,
    }) as any,
  });

  const res = await handler(makeReq({
    provider_phone: "5511999990000-group",
    eventType: "GROUP_PARTICIPANT_ADD",
    timestamp: "2026-03-24T18:30:00.000Z",
    participants: [
      {
        participantPhone: "5511998887777",
        participantName: "Maria",
      },
    ],
  }));

  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.success, true);
  assertEquals(body.type, "member_event");
  assertEquals(body.eventType, "GROUP_PARTICIPANT_ADD");
  assertEquals(memberEventInserts.length, 1);
  assertEquals(memberEventInserts[0].group_id, "11111111-1111-4111-8111-111111111111");
  assertEquals(memberEventInserts[0].event_type, "GROUP_PARTICIPANT_ADD");
  assertEquals(memberEventInserts[0].member_lid, "5511998887777");
  assertEquals(memberEventInserts[0].meta.phone_e164, "+5511998887777");
  assertEquals(memberEventInserts[0].meta.name, "Maria");
  assertEquals(groupUpdates.length, 1);
});

DenoRef.test("webhook-zapi-messages normaliza saida de membro por alias textual", async () => {
  const memberEventInserts: any[] = [];

  const handler = createWebhookZapiMessagesHandler({
    env: {
      get: (key: string) => {
        if (key === "SUPABASE_URL") return "http://localhost:8000";
        if (key === "SUPABASE_SERVICE_ROLE_KEY") return "service";
        return undefined;
      },
    },
    createClientImpl: makeCreateClientStub({
      groupId: "11111111-1111-4111-8111-111111111111",
      providerPhone: "5511999990000-group",
      groupName: "Grupo Teste",
      memberEventInserts,
      groupUpdates: [],
    }) as any,
  });

  const res = await handler(makeReq({
    provider_phone: "5511999990000-group",
    type: "group-participant-left",
    participantPhone: "5511977776666",
    participantName: "Carlos",
    timestamp: "1711305000",
  }));

  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.eventType, "GROUP_PARTICIPANT_LEAVE");
  assertEquals(memberEventInserts.length, 1);
  assertEquals(memberEventInserts[0].event_type, "GROUP_PARTICIPANT_LEAVE");
  assertEquals(memberEventInserts[0].member_lid, "5511977776666");
  assertEquals(memberEventInserts[0].meta.phone_e164, "+5511977776666");
  assertEquals(typeof memberEventInserts[0].occurred_at, "string");
});

DenoRef.test("webhook-zapi-messages usa notificationParameters[0] como alvo em payload envelopado do listener", async () => {
  const memberEventInserts: any[] = [];

  const handler = createWebhookZapiMessagesHandler({
    env: {
      get: (key: string) => {
        if (key === "SUPABASE_URL") return "http://localhost:8000";
        if (key === "SUPABASE_SERVICE_ROLE_KEY") return "service";
        return undefined;
      },
    },
    createClientImpl: makeCreateClientStub({
      groupId: "11111111-1111-4111-8111-111111111111",
      providerPhone: "120363420759804263-group",
      memberEventInserts,
      groupUpdates: [],
    }) as any,
  });

  const res = await handler(makeReq({
    body: {
      type: "ReceivedCallback",
      isGroup: true,
      phone: "120363420759804263-group",
      notification: "GROUP_PARTICIPANT_ADD",
      participantPhone: "34669093503136",
      notificationParameters: ["221783940681929@lid"],
      momment: 1774381748000,
    },
  }));

  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.eventType, "GROUP_PARTICIPANT_ADD");
  assertEquals(memberEventInserts.length, 1);
  assertEquals(memberEventInserts[0].member_lid, "221783940681929@lid");
  assertEquals(memberEventInserts[0].meta.phone_e164, null);
  assertEquals(memberEventInserts[0].meta.actor_phone_e164, "+34669093503136");
});

DenoRef.test("webhook-zapi-messages envia boas-vindas quando automacao esta habilitada", async () => {
  const memberEventInserts: any[] = [];
  const messageInserts: any[] = [];
  const memberUpdates: any[] = [];
  const sentMessages: any[] = [];

  const handler = createWebhookZapiMessagesHandler({
    env: {
      get: (key: string) => {
        if (key === "SUPABASE_URL") return "http://localhost:8000";
        if (key === "SUPABASE_SERVICE_ROLE_KEY") return "service";
        if (key === "ZAPI_INSTANCE") return "instance-1";
        if (key === "ZAPI_TOKEN") return "token-1";
        if (key === "ZAPI_CLIENT_TOKEN") return "client-token-1";
        return undefined;
      },
    },
    createClientImpl: makeCreateClientStub({
      groupId: "11111111-1111-4111-8111-111111111111",
      providerPhone: "5511999990000-group",
      groupName: "Grupo Teste",
      welcomeMessageEnabled: true,
      memberEventInserts,
      groupUpdates: [],
      messageInserts,
      memberUpdates,
    }) as any,
    fetchImpl: (async (_input: string | URL, init?: RequestInit) => {
      sentMessages.push(JSON.parse(String(init?.body)));
      return new Response(JSON.stringify({ sent: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as any,
  });

  const res = await handler(makeReq({
    provider_phone: "5511999990000-group",
    eventType: "GROUP_PARTICIPANT_ADD",
    participantPhone: "5511998887777",
    participantName: "Alice",
  }));

  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.welcomeSentCount, 1);
  assertEquals(Array.isArray(body.welcomeResults), true);
  assertEquals(body.welcomeResults[0].sent, true);
  assertEquals(sentMessages.length, 1);
  assertEquals(messageInserts.length, 1);
  assertEquals(sentMessages[0].phone, "5511999990000-group");
  assertEquals(sentMessages[0].message.includes("Alice"), true);
  assertEquals(messageInserts[0].direction, "outbound");
  assertEquals(messageInserts[0].status, "SENT");
  assertEquals(messageInserts[0].metadata.source, "welcome_automation");
});

DenoRef.test("webhook-zapi-messages nao reenvia boas-vindas para membro ja saudado", async () => {
  const sentMessages: any[] = [];

  const handler = createWebhookZapiMessagesHandler({
    env: {
      get: (key: string) => {
        if (key === "SUPABASE_URL") return "http://localhost:8000";
        if (key === "SUPABASE_SERVICE_ROLE_KEY") return "service";
        if (key === "ZAPI_INSTANCE") return "instance-1";
        if (key === "ZAPI_TOKEN") return "token-1";
        if (key === "ZAPI_CLIENT_TOKEN") return "client-token-1";
        return undefined;
      },
    },
    createClientImpl: makeCreateClientStub({
      groupId: "11111111-1111-4111-8111-111111111111",
      providerPhone: "5511999990000-group",
      groupName: "Grupo Teste",
      welcomeMessageEnabled: true,
      memberEventInserts: [],
      groupUpdates: [],
      messageInserts: [],
      memberUpdates: [],
      membersByLid: {
        "alice@lid": {
          id: "member-1",
          metadata: {
            welcome_sent_at: "2026-03-24T21:00:00.000Z",
            welcome_sent_source: "member_event",
          },
        },
      },
    }) as any,
    fetchImpl: (async (_input: string | URL, init?: RequestInit) => {
      sentMessages.push(JSON.parse(String(init?.body)));
      return new Response(JSON.stringify({ sent: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as any,
  });

  const res = await handler(makeReq({
    provider_phone: "5511999990000-group",
    eventType: "GROUP_PARTICIPANT_ADD",
    participantLid: "alice@lid",
    participantName: "Alice",
  }));

  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.welcomeSentCount, 0);
  assertEquals(body.welcomeResults[0].skipped, true);
  assertEquals(body.welcomeResults[0].reason, "already_welcomed");
  assertEquals(sentMessages.length, 0);
});

DenoRef.test("webhook-zapi-messages envia boas-vindas no fallback da primeira mensagem", async () => {
  const messageInserts: any[] = [];
  const memberUpdates: any[] = [];
  const sentMessages: any[] = [];

  const handler = createWebhookZapiMessagesHandler({
    env: {
      get: (key: string) => {
        if (key === "SUPABASE_URL") return "http://localhost:8000";
        if (key === "SUPABASE_SERVICE_ROLE_KEY") return "service";
        if (key === "ZAPI_INSTANCE") return "instance-1";
        if (key === "ZAPI_TOKEN") return "token-1";
        if (key === "ZAPI_CLIENT_TOKEN") return "client-token-1";
        return undefined;
      },
    },
    createClientImpl: makeCreateClientStub({
      groupId: "11111111-1111-4111-8111-111111111111",
      providerPhone: "5511999990000-group",
      groupName: "Grupo Teste",
      welcomeMessageEnabled: true,
      memberEventInserts: [],
      groupUpdates: [],
      membersByPhone: {
        "+5511998887777": { id: "member-1", metadata: {} },
      },
      messageInserts,
      messageCountByMemberId: {
        "member-1": 1,
      },
      memberUpdates,
    }) as any,
    fetchImpl: (async (_input: string | URL, init?: RequestInit) => {
      sentMessages.push(JSON.parse(String(init?.body)));
      return new Response(JSON.stringify({ sent: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as any,
  });

  const res = await handler(makeReq({
    provider_phone: "5511999990000-group",
    messageId: "msg-1",
    messageType: "text",
    participantPhone: "5511998887777",
    senderName: "Alice",
    text: { message: "Oi, cheguei!" },
  }));

  assertEquals(res.status, 200);
  assertEquals(messageInserts.length, 2);
  assertEquals(sentMessages.length, 1);
  assertEquals(sentMessages[0].message.includes("Alice"), true);
  assertEquals(memberUpdates.length, 1);
  assertEquals(typeof memberUpdates[0].values.metadata.welcome_sent_at, "string");
  assertEquals(messageInserts[1].direction, "outbound");
  assertEquals(messageInserts[1].status, "SENT");
  assertEquals(messageInserts[1].metadata.event_type, "first_message_fallback");
});

DenoRef.test("webhook-zapi-messages ignora grupo desconhecido com 200", async () => {
  const handler = createWebhookZapiMessagesHandler({
    env: {
      get: (key: string) => {
        if (key === "SUPABASE_URL") return "http://localhost:8000";
        if (key === "SUPABASE_SERVICE_ROLE_KEY") return "service";
        return undefined;
      },
    },
    createClientImpl: makeCreateClientStub({
      groupId: "11111111-1111-4111-8111-111111111111",
      providerPhone: "5511999990000-group",
      memberEventInserts: [],
      groupUpdates: [],
    }) as any,
  });

  const res = await handler(makeReq({
    provider_phone: "grupo-inexistente-group",
    messageId: "msg-404",
    text: { message: "oi" },
  }));

  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.success, true);
  assertEquals(body.ignored, true);
  assertEquals(body.reason, "group_not_found");
});
