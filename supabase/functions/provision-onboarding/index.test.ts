import { createProvisionOnboardingHandler } from "./index.ts";

const DenoRef = (globalThis as any).Deno;

function assertEquals(actual: any, expected: any) {
  if (actual !== expected) {
    throw new Error(`assertEquals falhou: esperado=${String(expected)} atual=${String(actual)}`);
  }
}

type RpcCall = { fn: string; args: any };

const okFetch = async () => {
  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

function makeGroupsBuilder(group: any) {
  const state: any = { filters: {} as Record<string, any> };
  const builder: any = {
    select(_cols: string) {
      return builder;
    },
    eq(col: string, value: any) {
      state.filters[`eq:${col}`] = value;
      return builder;
    },
    maybeSingle() {
      if (state.filters["eq:id"] === group.id) {
        return Promise.resolve({ data: group, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    },
  };
  return builder;
}

function makeReq(body: any) {
  return new Request(`${process.env.VITE_APP_URL || "http://localhost:8080"}/functions/v1/provision-onboarding`, {
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
    participants: [],
  };
}

DenoRef.test("provision-onboarding faz fallback para RPC v1 quando v2 não existe", async () => {
  const calls: RpcCall[] = [];
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
  const handler = createProvisionOnboardingHandler({
    env: {
      get: (k: string) => {
        if (k === "SUPABASE_URL") return process.env.VITE_APP_URL || "http://localhost:8080";
        if (k === "SUPABASE_SERVICE_ROLE_KEY") return "service";
        if (k === "N8N_WEBHOOK_CREATE_ASSISTANT_URL") return "http://webhook";
        return undefined;
      },
    },
    fetch: okFetch,
    createClient: (() => {
      return {
        rpc: async (fn: string, args: any) => {
          calls.push({ fn, args });
          if (fn === "public_onboarding_provision_tx_v2") {
            return {
              data: null,
              error: {
                code: "PGRST202",
                message: "Could not find the function public.public_onboarding_provision_tx_v2",
              },
            };
          }
          return {
            data: [{ organization_id: "org-1", group_id: "group-1" }],
            error: null,
          };
        },
        from: (table: string) => {
          if (table === "groups") return makeGroupsBuilder(groupRow);
          throw new Error(`unexpected table: ${table}`);
        },
      } as any;
    }) as any,
  });

  const res = await handler(makeReq(makePayload()));
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.success, true);
  assertEquals(calls.length, 2);
  assertEquals(calls[0].fn, "public_onboarding_provision_tx_v2");
  assertEquals(calls[1].fn, "public_onboarding_provision_tx");
  assertEquals(Object.prototype.hasOwnProperty.call(calls[1].args, "p_lead_phone_e164"), true);
});

DenoRef.test("provision-onboarding usa RPC v2 quando disponível", async () => {
  const calls: RpcCall[] = [];
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
  const handler = createProvisionOnboardingHandler({
    env: {
      get: (k: string) => {
        if (k === "SUPABASE_URL") return process.env.VITE_APP_URL || "http://localhost:8080";
        if (k === "SUPABASE_SERVICE_ROLE_KEY") return "service";
        if (k === "N8N_WEBHOOK_CREATE_ASSISTANT_URL") return "http://webhook";
        return undefined;
      },
    },
    fetch: okFetch,
    createClient: (() => {
      return {
        rpc: async (fn: string, args: any) => {
          calls.push({ fn, args });
          return {
            data: [{ organization_id: "org-1", group_id: "group-1" }],
            error: null,
          };
        },
        from: (table: string) => {
          if (table === "groups") return makeGroupsBuilder(groupRow);
          throw new Error(`unexpected table: ${table}`);
        },
      } as any;
    }) as any,
  });

  const res = await handler(makeReq(makePayload()));
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.success, true);
  assertEquals(calls.length, 1);
  assertEquals(calls[0].fn, "public_onboarding_provision_tx_v2");
  assertEquals(Object.prototype.hasOwnProperty.call(calls[0].args, "p_participants"), true);
});

DenoRef.test("provision-onboarding retorna RPC_NOT_AVAILABLE quando v1 e v2 não existem", async () => {
  const handler = createProvisionOnboardingHandler({
    env: {
      get: (k: string) => {
        if (k === "SUPABASE_URL") return process.env.VITE_APP_URL || "http://localhost:8080";
        if (k === "SUPABASE_SERVICE_ROLE_KEY") return "service";
        return undefined;
      },
    },
    createClient: (() => {
      return {
        rpc: async (fn: string) => {
          return {
            data: null,
            error: {
              code: "PGRST202",
              message: `Could not find the function public.${fn}`,
            },
          };
        },
      } as any;
    }) as any,
  });

  const res = await handler(makeReq(makePayload()));
  assertEquals(res.status, 500);
  const body = await res.json();
  assertEquals(body.success, false);
  assertEquals(body.code, "ONBOARDING_FALLBACK_FAILED");
});

DenoRef.test("provision-onboarding usa fallback sem RPC quando v1 e v2 não existem", async () => {
  const calls: any[] = [];

  const makeBuilder = (table: string) => {
    const state: any = {
      table,
      insertPayload: null,
      updatePayload: null,
      deleteFilters: null,
      upsertPayload: null,
      selectCols: null,
      filters: {} as Record<string, any>,
    };

    const builder: any = {
      insert(values: any) {
        state.insertPayload = values;
        calls.push({ table, action: 'insert', values });
        return builder;
      },
      upsert(values: any, _opts?: any) {
        state.upsertPayload = values;
        calls.push({ table, action: 'upsert', values });
        return Promise.resolve({ data: null, error: null });
      },
      update(values: any) {
        state.updatePayload = values;
        calls.push({ table, action: 'update', values });
        return builder;
      },
      delete() {
        calls.push({ table, action: 'delete' });
        return builder;
      },
      select(cols: string) {
        state.selectCols = cols;
        calls.push({ table, action: 'select', cols });
        return builder;
      },
      eq(col: string, value: any) {
        state.filters[`eq:${col}`] = value;
        calls.push({ table, action: 'eq', col, value });
        return builder;
      },
      maybeSingle() {
        if (table === 'organizations' && state.insertPayload) {
          return Promise.resolve({ data: { id: 'org-1' }, error: null });
        }
        if (table === 'groups' && state.insertPayload) {
          return Promise.resolve({ data: { id: 'group-1' }, error: null });
        }
        if (table === 'groups' && state.filters['eq:id'] === 'group-1') {
          return Promise.resolve({
            data: {
              id: 'group-1',
              name: 'Grupo',
              description: null,
              organization_id: 'org-1',
              provider: 'whatsapp',
              whatsapp_provider_id: 'g-1',
              provider_phone: null,
              invite_link: 'https://chat.whatsapp.com/abc',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              assistant_id: null,
              has_assistant: false,
              metadata: null,
              raw_provider: null,
              status: null,
              sync_status: null,
              sync_error: null,
            },
            error: null,
          });
        }
        return Promise.resolve({ data: null, error: null });
      },
    };

    return builder;
  };

  const handler = createProvisionOnboardingHandler({
    env: {
      get: (k: string) => {
        if (k === 'SUPABASE_URL') return process.env.VITE_APP_URL || 'http://localhost:8080';
        if (k === 'SUPABASE_SERVICE_ROLE_KEY') return 'service';
        if (k === 'N8N_WEBHOOK_CREATE_ASSISTANT_URL') return 'http://webhook';
        return undefined;
      },
    },
    fetch: okFetch,
    createClient: (() => {
      return {
        rpc: async (fn: string) => {
          return {
            data: null,
            error: {
              code: 'PGRST202',
              message: `Could not find the function public.${fn}`,
            },
          };
        },
        from: (table: string) => makeBuilder(table),
      } as any;
    }) as any,
  });

  const res = await handler(makeReq(makePayload()));
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.success, true);
  assertEquals(body.organization_id, 'org-1');
  assertEquals(body.group_id, 'group-1');
});
