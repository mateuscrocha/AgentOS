import { assertEquals } from "https://deno.land/std@0.224.0/testing/asserts.ts";

import { createGenerateGroupSummaryHandler } from "./index.ts";
import {
  DEFAULT_GROUP_AI_PROMPTS,
  GROUP_AI_PROMPT_KEYS,
  type GroupAiPromptKey,
} from "../_shared/group-ai-prompts.ts";

const DenoRef = (globalThis as any).Deno;

function makeReq(body: any, apiKey = "cron-key") {
  return new Request("http://localhost:8000/functions/v1/generate-group-summary", {
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
  last24Messages: any[];
  recentMessages: any[];
  previousSummaries: any[];
  prevDayMessages?: any[];
  beforePrevDayMessages?: any[];
  summaryUpserts: any[];
  promptUpserts: any[];
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
        gte(column: string, value: any) {
          filters[`gte:${column}`] = value;
          return builder;
        },
        lte(column: string, value: any) {
          filters[`lte:${column}`] = value;
          return builder;
        },
        lt(column: string, value: any) {
          filters[`lt:${column}`] = value;
          return builder;
        },
        in(column: string, value: any) {
          filters[`in:${column}`] = value;
          return builder;
        },
        order() {
          return builder;
        },
        limit() {
          return builder;
        },
        maybeSingle() {
          if (table === "groups") {
            return Promise.resolve({ data: state.group, error: null });
          }
          if (table === "group_daily_summaries" && upsertValues) {
            return Promise.resolve({ data: { id: "summary-1", created_at: new Date().toISOString(), ...upsertValues }, error: null });
          }
          return Promise.resolve({ data: null, error: null });
        },
        upsert(values: any) {
          upsertValues = values;
          if (table === "group_daily_summaries") state.summaryUpserts.push(values);
          if (table === "group_ai_prompt_configs") state.promptUpserts.push(values);
          return builder;
        },
        then(onFulfilled: any, onRejected: any) {
          let result: any = { data: [], error: null };

          if (table === "v_messages_with_members") {
            const gte = filters["gte:message_created_at"];
            const lte = filters["lte:message_created_at"];
            const lt = filters["lt:message_created_at"];

            if (gte && lte) {
              result = { data: state.last24Messages, error: null };
            } else if (gte && lt) {
              const startIso = String(gte);
              const isBeforePrevious = startIso.includes("2026-03-21") || startIso.includes("2026-03-22");
              result = { data: isBeforePrevious ? (state.beforePrevDayMessages ?? []) : (state.prevDayMessages ?? []), error: null };
            } else {
              result = { data: state.recentMessages, error: null };
            }
          }

          if (table === "group_daily_summaries") {
            result = { data: state.previousSummaries, error: null };
          }

          if (table === "group_ai_prompt_configs") {
            const keys = (Array.isArray(filters["in:prompt_key"]) ? filters["in:prompt_key"] : []) as GroupAiPromptKey[];
            const rows = keys.map((key) => ({
              group_id: state.group.id,
              prompt_key: key,
              prompt_text: DEFAULT_GROUP_AI_PROMPTS[key].prompt_text,
              model: DEFAULT_GROUP_AI_PROMPTS[key].model,
              runtime: DEFAULT_GROUP_AI_PROMPTS[key].runtime,
              is_enabled: true,
            }));
            result = { data: rows, error: null };
          }

          return Promise.resolve(result).then(onFulfilled, onRejected);
        },
      };

      return builder;
    };

    return { from };
  };
}

DenoRef.test("generate-group-summary gera SHORT, salva no banco e envia ao grupo", async () => {
  const summaryUpserts: any[] = [];
  const promptUpserts: any[] = [];
  let openAiPrompt = "";
  let sentMessage = "";

  const handler = createGenerateGroupSummaryHandler({
    env: {
      get: (key: string) => {
        if (key === "SUPABASE_URL") return "http://localhost:8000";
        if (key === "SUPABASE_SERVICE_ROLE_KEY") return "service";
        if (key === "GROUP_AI_CRON_API_KEY") return "cron-key";
        if (key === "OPENAI_API_KEY") return "sk-test";
        if (key === "ZAPI_INSTANCE") return "instance-1";
        if (key === "ZAPI_TOKEN") return "token-1";
        if (key === "ZAPI_CLIENT_TOKEN") return "client-token-1";
        return undefined;
      },
    },
    now: () => new Date("2026-03-24T18:00:00.000Z"),
    createClientImpl: makeCreateClientStub({
      group: {
        id: "11111111-1111-4111-8111-111111111111",
        name: "Grupo Teste",
        description: "Comunidade de produto",
        provider_phone: "5511999990000-group",
      },
      last24Messages: [
        { message_created_at: "2026-03-24T14:00:00.000Z", text: "Falamos de onboarding", display_name: "Ana" },
        { message_created_at: "2026-03-24T13:00:00.000Z", text: "Também teve tema de automação", display_name: "Bruno" },
      ],
      recentMessages: [
        { message_created_at: "2026-03-24T14:00:00.000Z", text: "Falamos de onboarding", display_name: "Ana" },
      ],
      previousSummaries: [],
      summaryUpserts,
      promptUpserts,
    }) as any,
    fetchImpl: (async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/v1/responses")) {
        openAiPrompt = JSON.parse(String(init?.body)).input;
        return new Response(JSON.stringify({ output_text: "## *Resumo curto* da conversa" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      sentMessage = JSON.parse(String(init?.body)).message;
      return new Response(JSON.stringify({ sent: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as any,
  });

  const res = await handler(makeReq({ groupId: "11111111-1111-4111-8111-111111111111" }));
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.summaryType, "SHORT");
  assertEquals(summaryUpserts.length, 1);
  assertEquals(summaryUpserts[0].metadata.summary_type, "SHORT");
  assertEquals(promptUpserts.length > 0, true);
  assertEquals(openAiPrompt.includes("Grupo Teste"), true);
  assertEquals(openAiPrompt.includes("Falamos de onboarding"), true);
  assertEquals(sentMessage, "*Resumo curto* da conversa");
});

DenoRef.test("generate-group-summary usa MARGED quando os dois últimos resumos são SHORT", async () => {
  const summaryUpserts: any[] = [];

  const handler = createGenerateGroupSummaryHandler({
    env: {
      get: (key: string) => {
        if (key === "SUPABASE_URL") return "http://localhost:8000";
        if (key === "SUPABASE_SERVICE_ROLE_KEY") return "service";
        if (key === "GROUP_AI_CRON_API_KEY") return "cron-key";
        if (key === "OPENAI_API_KEY") return "sk-test";
        return undefined;
      },
    },
    now: () => new Date("2026-03-24T18:00:00.000Z"),
    createClientImpl: makeCreateClientStub({
      group: {
        id: "11111111-1111-4111-8111-111111111111",
        name: "Grupo Teste",
        description: "Comunidade de produto",
        provider_phone: "5511999990000-group",
      },
      last24Messages: [
        { message_created_at: "2026-03-24T14:00:00.000Z", text: "Pouca conversa hoje", display_name: "Ana" },
      ],
      recentMessages: [
        { message_created_at: "2026-03-24T14:00:00.000Z", text: "Pouca conversa hoje", display_name: "Ana" },
        { message_created_at: "2026-03-23T14:00:00.000Z", text: "Tema antigo", display_name: "Bruno" },
      ],
      prevDayMessages: [],
      beforePrevDayMessages: [],
      previousSummaries: [
        { summary_date: "2026-03-23", summary_text: "Resumo 1", metadata: { summary_type: "SHORT" } },
        { summary_date: "2026-03-22", summary_text: "Resumo 2", metadata: { summary_type: "SHORT" } },
      ],
      summaryUpserts,
      promptUpserts: [],
    }) as any,
    fetchImpl: (async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/v1/responses")) {
        const prompt = JSON.parse(String(init?.body)).input;
        assertEquals(prompt.includes("Resumo 1"), true);
        assertEquals(prompt.includes("Resumo 2"), true);
        return new Response(JSON.stringify({ output_text: "Resumo marged final" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ sent: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as any,
  });

  const res = await handler(makeReq({ groupId: "11111111-1111-4111-8111-111111111111", sendToGroup: false }));
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.summaryType, "MARGED");
  assertEquals(summaryUpserts[0].metadata.summary_type, "MARGED");
  assertEquals(summaryUpserts[0].metadata.prompt_key, GROUP_AI_PROMPT_KEYS.summaryMarged);
});
