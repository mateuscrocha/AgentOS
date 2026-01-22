import { createProvisionOnboardingHandler } from "./index.ts";

const DenoRef = (globalThis as any).Deno;

function getTestBaseUrl() {
  const raw = (
    process.env.TEST_BASE_URL ||
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    process.env.VITE_APP_URL ||
    ""
  ).trim();

  return (raw || "http://127.0.0.1:8080").trim().replace(/\/+$/, "");
}

const testBaseUrl = getTestBaseUrl();
const testWebhookUrl = (process.env.TEST_WEBHOOK_URL || "http://127.0.0.1:9999/webhook").trim();

function assertEquals(actual: any, expected: any) {
  if (actual !== expected) {
    throw new Error(`assertEquals falhou: esperado=${String(expected)} atual=${String(actual)}`);
  }
}

function createMockSupabase(args?: { membersFirstInsertDuplicate?: boolean }) {
  const calls: any[] = [];
  const membersInserted: any[] = [];
  let membersCount = 0;
  let membersInsertCalls = 0;

  const groupRow = {
    id: "group-1",
    name: "Grupo",
    description: null,
    organization_id: "org-1",
    provider: "whatsapp",
    whatsapp_provider_id: "g-1",
    provider_phone: null,
    invite_link: "https://chat.whatsapp.com/abc",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    assistant_id: null,
    has_assistant: false,
    metadata: null,
    raw_provider: null,
    status: null,
    sync_status: null,
    sync_error: null,
  };

  const makeBuilder = (table: string) => {
    const state: any = {
      table,
      insertPayload: null,
      updatePayload: null,
      deleteCalled: false,
      upsertPayload: null,
      selectCols: null,
      selectOptions: null,
      filters: {} as Record<string, any>,
    };

    const builder: any = {
      insert(values: any) {
        state.insertPayload = values;
        calls.push({ table, action: "insert", values });

        if (table === "members") {
          membersInsertCalls += 1;
          if (args?.membersFirstInsertDuplicate && membersInsertCalls === 1) {
            return Promise.resolve({ error: { code: "23505", message: "duplicate key value violates unique constraint" } });
          }

          const row = Array.isArray(values) ? values[0] : values;
          if (row) {
            membersInserted.push(row);
            membersCount = membersInserted.length;
          }
          return Promise.resolve({ error: null });
        }

        return builder;
      },
      upsert(values: any) {
        state.upsertPayload = values;
        calls.push({ table, action: "upsert", values });
        return Promise.resolve({ data: null, error: null });
      },
      update(values: any) {
        state.updatePayload = values;
        calls.push({ table, action: "update", values });
        return builder;
      },
      delete() {
        state.deleteCalled = true;
        calls.push({ table, action: "delete" });
        return builder;
      },
      select(cols: string, options?: any) {
        state.selectCols = cols;
        state.selectOptions = options || null;
        calls.push({ table, action: "select", cols, options: options || null });
        return builder;
      },
      eq(col: string, value: any) {
        state.filters[`eq:${col}`] = value;
        calls.push({ table, action: "eq", col, value });
        return builder;
      },
      is(col: string, value: any) {
        state.filters[`is:${col}`] = value;
        calls.push({ table, action: "is", col, value });
        return builder;
      },
      maybeSingle() {
        calls.push({ table, action: "maybeSingle" });

        if (table === "organizations" && state.insertPayload) {
          return Promise.resolve({ data: { id: "org-1" }, error: null });
        }

        if (table === "groups") {
          if (state.insertPayload) {
            return Promise.resolve({ data: { id: "group-1" }, error: null });
          }

          if (state.filters["eq:id"] === "group-1") {
            return Promise.resolve({ data: groupRow, error: null });
          }

          if (state.filters["eq:whatsapp_provider_id"] === "g-1") {
            return Promise.resolve({ data: null, error: null });
          }
        }

        return Promise.resolve({ data: null, error: null });
      },
      single() {
        calls.push({ table, action: "single" });

        if (table === "groups" && state.insertPayload) {
          return Promise.resolve({ data: { id: "group-1" }, error: null });
        }

        return Promise.resolve({ data: null, error: null });
      },
      then(onFulfilled: any, onRejected: any) {
        if (table === "members" && state.selectOptions && state.selectOptions.count === "exact" && state.selectOptions.head === true) {
          return Promise.resolve({ count: membersCount, error: null }).then(onFulfilled, onRejected);
        }

        if (table === "organizations" && state.insertPayload && state.selectCols) {
          return Promise.resolve({ data: { id: "org-1" }, error: null }).then(onFulfilled, onRejected);
        }

        if (table === "groups" && state.insertPayload && state.selectCols) {
          return Promise.resolve({ data: { id: "group-1" }, error: null }).then(onFulfilled, onRejected);
        }

        return Promise.resolve({ data: null, error: null }).then(onFulfilled, onRejected);
      },
    };

    return builder;
  };

  return {
    supabase: {
      from: (table: string) => makeBuilder(table),
    } as any,
    calls,
    membersInserted,
    groupRow,
  };
}

function makeReq(body: any) {
  return new Request(new URL("/functions/v1/provision-onboarding", testBaseUrl).toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makePayload() {
  return {
    lead: {
      name: "Ana",
      email: "ana@exemplo.com",
      whatsapp_phone: "+5511999990000",
      user_id: "u-1",
    },
    organization: { name: "Org" },
    group: {
      provider: "whatsapp",
      whatsapp_provider_id: "g-1",
      name: "Grupo",
      invite_link: "https://chat.whatsapp.com/abc",
    },
    participants: [] as any[],
  };
}

DenoRef.test("provision-onboarding retorna erro quando participants está vazio", async () => {
  const { supabase } = createMockSupabase();

  const handler = createProvisionOnboardingHandler({
    env: {
      get: (k: string) => {
        if (k === "SUPABASE_URL") return testBaseUrl;
        if (k === "SUPABASE_SERVICE_ROLE_KEY") return "service";
        if (k === "N8N_WEBHOOK_CREATE_ASSISTANT_URL") return testWebhookUrl;
        return undefined;
      },
    },
    createClient: (() => supabase) as any,
  });

  const res = await handler(makeReq(makePayload()));
  assertEquals(res.status, 400);
  const body = await res.json();
  assertEquals(body.success, false);
  assertEquals(body.code, "WEBHOOK_CONTRACT_INVALID");
});

DenoRef.test("provision-onboarding cria org+grupo, insere members e marca SUPERADMIN como admin", async () => {
  const { supabase, membersInserted } = createMockSupabase();
  const fetchCalls: Array<{ url: string; init: any }> = [];

  const handler = createProvisionOnboardingHandler({
    env: {
      get: (k: string) => {
        if (k === "SUPABASE_URL") return testBaseUrl;
        if (k === "SUPABASE_SERVICE_ROLE_KEY") return "service";
        if (k === "N8N_WEBHOOK_CREATE_ASSISTANT_URL") return testWebhookUrl;
        return undefined;
      },
    },
    fetch: (async (input: any, init: any) => {
      fetchCalls.push({ url: String(input), init });
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as any,
    createClient: (() => supabase) as any,
  });

  const payload = makePayload();
  payload.participants = [
    {
      phone: "11999990000",
      name: "Dono",
      is_admin: false,
      is_super_admin: true,
      whatsapp_provider_id: "lid-1",
    },
    {
      phone: "+5511888887777",
      name: "Admin",
      is_admin: true,
      is_super_admin: false,
      whatsapp_provider_id: "lid-2",
    },
  ];

  const res = await handler(makeReq(payload));
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.success, true);
  assertEquals(body.organization_id, "org-1");
  assertEquals(body.group_id, "group-1");

  assertEquals(membersInserted.length, 2);
  assertEquals(membersInserted[0]?.phone_e164, "+5511999990000");
  assertEquals(membersInserted[0]?.is_admin, true);
  assertEquals(membersInserted[0]?.is_super_admin, true);

  assertEquals(fetchCalls.length, 1);
  assertEquals(fetchCalls[0].url, testWebhookUrl);
  const webhookBody = JSON.parse(fetchCalls[0].init?.body || "{}");
  assertEquals(webhookBody.id, "group-1");
  assertEquals(webhookBody.organization_id, "org-1");
});

DenoRef.test("provision-onboarding ignora duplicidade ao inserir Members", async () => {
  const { supabase, membersInserted } = createMockSupabase({ membersFirstInsertDuplicate: true });

  const handler = createProvisionOnboardingHandler({
    env: {
      get: (k: string) => {
        if (k === "SUPABASE_URL") return testBaseUrl;
        if (k === "SUPABASE_SERVICE_ROLE_KEY") return "service";
        if (k === "N8N_WEBHOOK_CREATE_ASSISTANT_URL") return testWebhookUrl;
        return undefined;
      },
    },
    fetch: (async () => {
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as any,
    createClient: (() => supabase) as any,
  });

  const payload = makePayload();
  payload.participants = [
    {
      phone: "11999990000",
      name: "A",
      is_admin: true,
      is_super_admin: false,
      whatsapp_provider_id: "lid-1",
    },
    {
      phone: "11988887777",
      name: "B",
      is_admin: true,
      is_super_admin: false,
      whatsapp_provider_id: "lid-2",
    },
  ];

  const res = await handler(makeReq(payload));
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.success, true);
  assertEquals(membersInserted.length, 1);
  assertEquals(membersInserted[0]?.whatsapp_provider_id, "lid-2");
});
