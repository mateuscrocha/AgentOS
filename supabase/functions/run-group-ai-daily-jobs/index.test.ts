import { assertEquals } from "https://deno.land/std@0.224.0/testing/asserts.ts";

import { createRunGroupAiDailyJobsHandler } from "./index.ts";

const DenoRef = (globalThis as any).Deno;

function makeReq(apiKey = "cron-key") {
  return new Request("http://localhost:8000/functions/v1/run-group-ai-daily-jobs", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
    },
  });
}

function makeCreateClientStub(state: {
  groups: any[];
  openAiCalls: Array<any>;
  zapiCalls: Array<any>;
}) {
  return (_url: string, _key: string, _opts?: any) => {
    const from = (table: string) => {
      const filters: Record<string, any> = {};
      let upsertValues: any = null;

      const builder: any = {
        select() {
          return builder;
        },
        eq(column: string, value: any) {
          filters[`eq:${column}`] = value;
          return builder;
        },
        gte() {
          return builder;
        },
        lte() {
          return builder;
        },
        lt() {
          return builder;
        },
        in() {
          return builder;
        },
        order() {
          return builder;
        },
        limit() {
          return builder;
        },
        maybeSingle() {
          if (table === "groups" && filters["eq:id"]) {
            const found = state.groups.find((group) => group.id === filters["eq:id"]) ?? null;
            return Promise.resolve({ data: found, error: null });
          }
          if (table === "group_daily_summaries" && upsertValues) {
            return Promise.resolve({ data: { id: "summary-1", created_at: new Date().toISOString(), ...upsertValues }, error: null });
          }
          return Promise.resolve({ data: null, error: null });
        },
        delete() {
          return builder;
        },
        insert(_values: any) {
          return Promise.resolve({ error: null });
        },
        upsert(values: any) {
          upsertValues = values;
          return builder;
        },
        then(onFulfilled: any, onRejected: any) {
          let result: any = { data: [], error: null };

          if (table === "groups" && filters["eq:is_active"] === true) {
            result = { data: state.groups, error: null };
          }

          if (table === "v_messages_with_members") {
            result = {
              data: [
                { message_created_at: "2026-03-24T14:00:00.000Z", text: "Falamos de onboarding", display_name: "Ana" },
              ],
              error: null,
            };
          }

      if (table === "group_daily_summaries") {
        result = { data: [], error: null };
      }

      if (table === "group_daily_topics") {
        result = { data: [], error: null };
      }

      if (table === "group_daily_keywords") {
        result = { data: [], error: null };
      }

      if (table === "group_ai_prompt_configs") {
        result = { data: [], error: null };
      }

          return Promise.resolve(result).then(onFulfilled, onRejected);
        },
      };

      return builder;
    };

    return { from };
  };
}

DenoRef.test("run-group-ai-daily-jobs gera resumo e topicos para todo grupo no minuto exato e so envia quando configurado", async () => {
  const openAiCalls: any[] = [];
  const zapiCalls: any[] = [];

  const fetch = async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("/v1/responses")) {
      openAiCalls.push(JSON.parse(String(init?.body)));
      if (openAiCalls.length === 1) {
        return new Response(JSON.stringify({ output_text: "Resumo diário" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (openAiCalls.length === 2) {
        return new Response(JSON.stringify({
          output_text: JSON.stringify([
            { topic: "Dor: Objeção de preço", description: "Alguns participantes relataram dificuldade de defender preço e ajustaram argumentos comerciais." },
          ]),
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({
        output_text: JSON.stringify(["preço", "follow-up"]),
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    zapiCalls.push(JSON.parse(String(init?.body)));
    return new Response(JSON.stringify({ sent: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  const runtimeHandler = createRunGroupAiDailyJobsHandler({
    env: {
      get: (key: string) => {
        if (key === "GROUP_AI_CRON_API_KEY") return "cron-key";
        if (key === "GROUP_AI_SEND_ENABLED") return "true";
        if (key === "SUPABASE_URL") return "http://localhost:8000";
        if (key === "SUPABASE_SERVICE_ROLE_KEY") return "service";
        if (key === "OPENAI_API_KEY") return "sk-test";
        if (key === "ZAPI_INSTANCE") return "instance-1";
        if (key === "ZAPI_TOKEN") return "token-1";
        if (key === "ZAPI_CLIENT_TOKEN") return "client-token-1";
        return undefined;
      },
    },
    now: () => new Date("2026-03-24T16:30:00.000Z"),
    createClientImpl: makeCreateClientStub({
      groups: [
        {
          id: "11111111-1111-4111-8111-111111111111",
          name: "Grupo com envio",
          description: "Desc",
          provider_phone: "5511999990000-group",
          group_settings: {
            daily_summary_enabled: true,
            daily_summary_time: "13:30:00",
            daily_topics_enabled: false,
          },
        },
        {
          id: "33333333-3333-4333-8333-333333333333",
          name: "Grupo sem envio",
          description: "Desc",
          provider_phone: "5511777770000-group",
          group_settings: {
            daily_summary_enabled: false,
            daily_summary_time: "13:30:00",
            daily_topics_enabled: false,
          },
        },
        {
          id: "22222222-2222-4222-8222-222222222222",
          name: "Grupo outro horário",
          description: "Desc",
          provider_phone: "5511888880000-group",
          group_settings: {
            daily_summary_enabled: true,
            daily_summary_time: "13:00:00",
            daily_topics_enabled: true,
          },
        },
        {
          id: "44444444-4444-4444-8444-444444444444",
          name: "Grupo pausado",
          description: "Desc",
          provider_phone: "5511666660000-group",
          status: "inactive",
          group_settings: {
            daily_summary_enabled: true,
            daily_summary_time: "13:30:00",
            daily_topics_enabled: true,
          },
        },
      ],
      openAiCalls,
      zapiCalls,
    }) as any,
    fetchImpl: fetch as any,
  });

  const res = await runtimeHandler(makeReq());
  const body = await res.json();
  assertEquals(res.status, 200);
  assertEquals(body.matchedGroups, 2);
  assertEquals(body.currentTime, "13:30");
  assertEquals(openAiCalls.length, 6);
  assertEquals(zapiCalls.length, 1);
  assertEquals(body.results[0].topicsKeywords.ok, true);
  assertEquals(body.results[0].summary.payload.sentToGroup, true);
  assertEquals(body.results[1].topicsKeywords.ok, true);
  assertEquals(body.results[1].summary.payload.sentToGroup, false);
});
