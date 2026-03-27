import { assertEquals } from "https://deno.land/std@0.224.0/testing/asserts.ts";

import { createGenerateGroupTopicsKeywordsHandler } from "./index.ts";

const DenoRef = (globalThis as any).Deno;

function makeReq(body: any, apiKey = "cron-key") {
  return new Request("http://localhost:8000/functions/v1/generate-group-topics-keywords", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify(body),
  });
}

function makeCreateClientStub(state: {
  group: any;
  messages: any[];
  insertedTopics: any[];
  insertedKeywords: any[];
}) {
  return (_url: string, _key: string, _opts?: any) => {
    const from = (table: string) => {
      const filters: Record<string, any> = {};

      const builder: any = {
        select() { return builder; },
        eq(column: string, value: any) { filters[`eq:${column}`] = value; return builder; },
        gte() { return builder; },
        lte() { return builder; },
        in() { return builder; },
        order() { return builder; },
        maybeSingle() {
          if (table === "groups") return Promise.resolve({ data: state.group, error: null });
          return Promise.resolve({ data: null, error: null });
        },
        delete() { return builder; },
        insert(values: any) {
          if (table === "group_daily_topics") state.insertedTopics.push(...(Array.isArray(values) ? values : [values]));
          if (table === "group_daily_keywords") state.insertedKeywords.push(...(Array.isArray(values) ? values : [values]));
          return Promise.resolve({ error: null });
        },
        upsert() { return Promise.resolve({ error: null }); },
        then(onFulfilled: any, onRejected: any) {
          let result: any = { data: [], error: null };
          if (table === "v_messages_with_members") result = { data: state.messages, error: null };
          if (table === "group_ai_prompt_configs") result = { data: [], error: null };
          return Promise.resolve(result).then(onFulfilled, onRejected);
        },
      };

      return builder;
    };

    return { from };
  };
}

DenoRef.test("generate-group-topics-keywords gera e salva tópicos e keywords do dia", async () => {
  const insertedTopics: any[] = [];
  const insertedKeywords: any[] = [];
  const prompts: string[] = [];

  const handler = createGenerateGroupTopicsKeywordsHandler({
    env: {
      get: (key: string) => {
        if (key === "GROUP_AI_CRON_API_KEY") return "cron-key";
        if (key === "SUPABASE_URL") return "http://localhost:8000";
        if (key === "SUPABASE_SERVICE_ROLE_KEY") return "service";
        if (key === "OPENAI_API_KEY") return "sk-test";
        return undefined;
      },
    },
    now: () => new Date("2026-03-24T18:00:00.000Z"),
    createClientImpl: makeCreateClientStub({
      group: {
        id: "11111111-1111-4111-8111-111111111111",
        name: "Grupo Teste",
        description: "Grupo sobre vendas e marketing",
      },
      messages: [
        { message_created_at: "2026-03-24T14:00:00.000Z", text: "Falamos sobre objeção de preço", display_name: "Ana" },
        { message_created_at: "2026-03-24T15:00:00.000Z", text: "Também teve desejo de automatizar follow-up", display_name: "Bruno" },
      ],
      insertedTopics,
      insertedKeywords,
    }) as any,
    fetchImpl: (async (_input: string | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      prompts.push(body.input);
      if (prompts.length === 1) {
        return new Response(JSON.stringify({
          output_text: JSON.stringify([
            { topic: "Dor: Objeção de preço", description: "Alguns participantes relataram dificuldade em defender preço e perceberam urgência em ajustar argumento comercial com exemplos mais claros e próximos da realidade do grupo." },
            { topic: "Desejo: Automatizar follow-up", description: "Comentaram que desejam automatizar follow-up para acelerar conversões, reduzir esquecimentos e manter constância nas abordagens ao longo da semana." },
          ]),
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }

      return new Response(JSON.stringify({
        output_text: JSON.stringify(["objeção de preço", "follow-up", "automação"]),
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }) as any,
  });

  const res = await handler(makeReq({ groupId: "11111111-1111-4111-8111-111111111111" }));
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.topicsCount, 2);
  assertEquals(body.keywordsCount, 3);
  assertEquals(insertedTopics.length, 2);
  assertEquals(insertedKeywords.length, 3);
  assertEquals(prompts[0].includes("Grupo sobre vendas e marketing"), true);
  assertEquals(prompts[1].includes("objeção de preço"), true);
});

DenoRef.test("generate-group-topics-keywords ignora grupo pausado", async () => {
  const insertedTopics: any[] = [];
  const insertedKeywords: any[] = [];
  let fetchCalls = 0;

  const handler = createGenerateGroupTopicsKeywordsHandler({
    env: {
      get: (key: string) => {
        if (key === "GROUP_AI_CRON_API_KEY") return "cron-key";
        if (key === "SUPABASE_URL") return "http://localhost:8000";
        if (key === "SUPABASE_SERVICE_ROLE_KEY") return "service";
        if (key === "OPENAI_API_KEY") return "sk-test";
        return undefined;
      },
    },
    now: () => new Date("2026-03-24T18:00:00.000Z"),
    createClientImpl: makeCreateClientStub({
      group: {
        id: "11111111-1111-4111-8111-111111111111",
        name: "Grupo Pausado",
        description: "Grupo sobre vendas e marketing",
        is_active: false,
        status: "inactive",
      },
      messages: [],
      insertedTopics,
      insertedKeywords,
    }) as any,
    fetchImpl: (async () => {
      fetchCalls += 1;
      throw new Error("nao deveria chamar openai");
    }) as any,
  });

  const res = await handler(makeReq({ groupId: "11111111-1111-4111-8111-111111111111" }));
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.skipped, true);
  assertEquals(body.code, "GROUP_PAUSED");
  assertEquals(fetchCalls, 0);
  assertEquals(insertedTopics.length, 0);
  assertEquals(insertedKeywords.length, 0);
});
