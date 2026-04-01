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
  membersByProviderId?: Record<string, any>;
  membersById?: Record<string, any>;
  messageInserts?: any[];
  messageReactionsInserts?: any[];
  messageCountByMemberId?: Record<string, number>;
  memberUpdates?: any[];
  pollByWhatsappProviderId?: Record<string, any>;
  pollVotesByPersonId?: Record<string, any[]>;
  pollVoteLookupsByMessageId?: Record<string, any>;
  pollVoteDeletes?: any[];
  targetMessagesByWhatsappProviderId?: Record<string, any>;
  messageReactionUpdates?: any[];
}) {
  return (_url: string, _key: string, _opts?: any) => {
    const from = (table: string) => {
      const filters: Record<string, any> = {};
      let updateValues: any = null;
      let selectOptions: any = null;
      let deleteRequested = false;
      let insertedValues: any = null;

      const materializeInsertedValues = () => {
        if (Array.isArray(insertedValues)) return insertedValues;
        if (!insertedValues || typeof insertedValues !== "object") return insertedValues;
        if (table === "members") {
          return { id: insertedValues.id ?? "generated-member-id", ...insertedValues };
        }
        if (table === "polls") {
          return { id: insertedValues.id ?? "generated-poll-id", ...insertedValues };
        }
        return insertedValues;
      };

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
            const byProviderId = filters["eq:whatsapp_provider_id"];
            if (typeof byProviderId === "string" && state.membersByProviderId?.[byProviderId]) {
              return { data: state.membersByProviderId[byProviderId], error: null };
            }
            const byId = filters["eq:id"];
            if (typeof byId === "string" && state.membersById?.[byId]) {
              return { data: state.membersById[byId], error: null };
            }
          }
          if (table === "polls") {
            const byMessageId = filters["eq:whatsapp_provider_id"];
            if (typeof byMessageId === "string" && state.pollByWhatsappProviderId?.[byMessageId]) {
              return { data: state.pollByWhatsappProviderId[byMessageId], error: null };
            }
          }
          if (table === "poll_votes") {
            const byMessageId = filters["eq:provider_vote_message_id"];
            if (typeof byMessageId === "string" && state.pollVoteLookupsByMessageId?.[byMessageId]) {
              return { data: state.pollVoteLookupsByMessageId[byMessageId], error: null };
            }
          }
          if (table === "messages") {
            const byMessageId = filters["eq:whatsapp_provider_id"];
            if (typeof byMessageId === "string" && state.targetMessagesByWhatsappProviderId?.[byMessageId]) {
              return { data: state.targetMessagesByWhatsappProviderId[byMessageId], error: null };
            }
          }
          if (table === "message_reactions" && updateValues) {
            state.messageReactionUpdates?.push({ filters: { ...filters }, values: updateValues });
            return { data: null, error: null };
          }
          if (table === "message_reactions") {
            return { data: null, error: null };
          }

          return { data: null, error: null };
        },
        single: async () => {
          return { data: materializeInsertedValues(), error: null };
        },
        insert(values: any) {
          insertedValues = values;
          if (table === "member_events") {
            state.memberEventInserts.push(...(Array.isArray(values) ? values : [values]));
          }
          if (table === "messages") {
            state.messageInserts?.push(...(Array.isArray(values) ? values : [values]));
          }
          if (table === "message_reactions") {
            state.messageReactionsInserts?.push(...(Array.isArray(values) ? values : [values]));
          }
          return builder;
        },
        update(values: any) {
          updateValues = values;
          return builder;
        },
        delete() {
          deleteRequested = true;
          return builder;
        },
        is(_column: string, _value: any) {
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
          if (deleteRequested && table === "poll_votes" && column === "person_id") {
            state.pollVoteDeletes?.push({ filters: { ...filters } });
            return Promise.resolve({ data: null, error: null });
          }
          return builder;
        },
        then(onFulfilled: any, onRejected: any) {
          if (table === "messages" && selectOptions?.head) {
            const memberId = filters["eq:member_id"];
            const count = typeof memberId === "string" ? (state.messageCountByMemberId?.[memberId] ?? 0) : 0;
            return Promise.resolve({ data: null, error: null, count }).then(onFulfilled, onRejected);
          }
          if (table === "poll_votes") {
            const personId = filters["eq:person_id"];
            const data = typeof personId === "string" ? (state.pollVotesByPersonId?.[personId] ?? []) : [];
            return Promise.resolve({ data, error: null }).then(onFulfilled, onRejected);
          }
          if (insertedValues !== null) {
            return Promise.resolve({ data: materializeInsertedValues(), error: null }).then(onFulfilled, onRejected);
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
      membersById: {
        "member-1": {
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
  assertEquals(memberUpdates.length, 2);
  const welcomeMetadataUpdate = memberUpdates.find((entry) => typeof entry?.values?.metadata?.welcome_sent_at === "string");
  assertEquals(typeof welcomeMetadataUpdate?.values?.metadata?.welcome_sent_at, "string");
  assertEquals(messageInserts[1].direction, "outbound");
  assertEquals(messageInserts[1].status, "SENT");
  assertEquals(messageInserts[1].metadata.event_type, "first_message_fallback");
});

DenoRef.test("webhook-zapi-messages atualiza atributos do membro existente ao receber mensagem", async () => {
  const memberUpdates: any[] = [];

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
      membersByLid: {
        "alice@lid": { id: "member-1", metadata: {} },
      },
      memberUpdates,
      messageInserts: [],
    }) as any,
  });

  const res = await handler(makeReq({
    provider_phone: "5511999990000-group",
    messageId: "msg-update-member-1",
    messageType: "text",
    participantLid: "alice@lid",
    participantName: "Alice Nova",
    profilePicUrl: "https://example.com/alice.jpg",
    isAdmin: true,
    isSuperAdmin: false,
    text: { message: "Oi" },
  }));

  assertEquals(res.status, 200);
  assertEquals(memberUpdates.length, 1);
  assertEquals(memberUpdates[0].column, "id");
  assertEquals(memberUpdates[0].value, "member-1");
  assertEquals(memberUpdates[0].values.name, "Alice Nova");
  assertEquals(memberUpdates[0].values.display_name, "Alice Nova");
  assertEquals(memberUpdates[0].values.profile_pic_url, "https://example.com/alice.jpg");
  assertEquals(memberUpdates[0].values.is_admin, true);
  assertEquals(memberUpdates[0].values.is_super_admin, false);
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

DenoRef.test("webhook-zapi-messages notifica Mateus quando payload nao e de grupo", async () => {
  const sentMessages: any[] = [];

  const handler = createWebhookZapiMessagesHandler({
    env: {
      get: (key: string) => {
        if (key === "SUPABASE_URL") return "http://localhost:8000";
        if (key === "SUPABASE_SERVICE_ROLE_KEY") return "service";
        if (key === "ZAPI_INSTANCE") return "instance-1";
        if (key === "ZAPI_TOKEN") return "token-1";
        if (key === "ZAPI_CLIENT_TOKEN") return "client-token-1";
        if (key === "MATEUS_PHONE") return "5511991112222";
        return undefined;
      },
    },
    createClientImpl: makeCreateClientStub({
      groupId: "11111111-1111-4111-8111-111111111111",
      providerPhone: "5511999990000-group",
      memberEventInserts: [],
      groupUpdates: [],
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
    phone: "5511993334444",
    type: "ReceivedCallback",
    isGroup: false,
    messageId: "msg-private-1",
    text: { message: "Oi no privado" },
  }));

  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.success, true);
  assertEquals(body.notifiedMateus, true);
  assertEquals(body.reason, "non_group_payload");
  assertEquals(sentMessages.length, 1);
  assertEquals(sentMessages[0].phone, "5511991112222");
  assertEquals(String(sentMessages[0].message).includes("Webhook recebido fora de grupo"), true);
});

DenoRef.test("webhook-zapi-messages persiste reacao vinculando mensagem e membro", async () => {
  const messageReactionsInserts: any[] = [];
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
      memberEventInserts: [],
      groupUpdates,
      membersByPhone: {
        "+5511998887777": { id: "member-1", metadata: {} },
      },
      targetMessagesByWhatsappProviderId: {
        "msg-target-1": { id: "message-1" },
      },
      messageReactionsInserts,
    }) as any,
  });

  const res = await handler(makeReq({
    provider_phone: "5511999990000-group",
    type: "REACTION",
    messageId: "reaction-event-1",
    participantPhone: "5511998887777",
    reaction: {
      emoji: "🔥",
      referencedMessage: {
        messageId: "msg-target-1",
      },
    },
    timestamp: "2026-03-29T10:00:00.000Z",
  }));

  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.success, true);
  assertEquals(body.type, "reaction");
  assertEquals(messageReactionsInserts.length, 1);
  assertEquals(messageReactionsInserts[0].message_id, "message-1");
  assertEquals(messageReactionsInserts[0].member_id, "member-1");
  assertEquals(messageReactionsInserts[0].emoji, "🔥");
  assertEquals(groupUpdates.length, 1);
});

DenoRef.test("webhook-zapi-messages associa member_id em convite ao inserir member_event", async () => {
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
      memberEventInserts,
      groupUpdates: [],
      membersByPhone: {
        "+5511991234567": { id: "member-invite-1", metadata: {} },
      },
    }) as any,
  });

  const res = await handler(makeReq({
    provider_phone: "5511999990000-group",
    eventType: "GROUP_PARTICIPANT_INVITE",
    participantPhone: "5511991234567",
    participantName: "Paula",
  }));

  assertEquals(res.status, 200);
  assertEquals(memberEventInserts.length, 1);
  assertEquals(memberEventInserts[0].member_id, "member-invite-1");
  assertEquals(memberEventInserts[0].event_type, "GROUP_PARTICIPANT_INVITE");
});

DenoRef.test("webhook-zapi-messages substitui voto anterior da mesma pessoa", async () => {
  const pollVoteDeletes: any[] = [];
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
      memberEventInserts: [],
      groupUpdates,
      pollByWhatsappProviderId: {
        "poll-msg-1": { id: "poll-1", max_votes_per_member: 1 },
      },
      membersByPhone: {
        "+5511998887777": { id: "member-1", metadata: {} },
      },
      pollVotesByPersonId: {
        "member-1": [{ id: "vote-old-1", voted_options: ["Opção A"], vote_sequence: 1 }],
      },
      pollVoteDeletes,
    }) as any,
  });

  const res = await handler(makeReq({
    provider_phone: "5511999990000-group",
    messageId: "vote-msg-2",
    pollVote: {
      pollMessageId: "poll-msg-1",
      options: [{ name: "Opção B" }],
    },
    participantPhone: "5511998887777",
    timestamp: "2026-03-29T12:30:00.000Z",
  }));

  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.success, true);
  assertEquals(body.type, "poll_vote");
  assertEquals(pollVoteDeletes.length, 1);
  assertEquals(pollVoteDeletes[0].filters["eq:poll_id"], "poll-1");
  assertEquals(pollVoteDeletes[0].filters["eq:person_id"], "member-1");
  assertEquals(groupUpdates.length, 1);
});
