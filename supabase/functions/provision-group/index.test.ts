import { createProvisionGroupHandler } from "./index.ts";

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
function assertEquals(actual: any, expected: any) {
  if (actual !== expected) {
    throw new Error(`assertEquals falhou: esperado=${String(expected)} atual=${String(actual)}`);
  }
}

function makeReq(body: any) {
  return new Request(new URL("/functions/v1/provision-group", testBaseUrl).toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer token",
      "x-correlation-id": "corr-1",
    },
    body: JSON.stringify(body),
  });
}

DenoRef.test("provision-group marca SUPERADMIN também como is_admin ...", async () => {
  const membersInserted: any[] = [];
  const groupUpdates: any[] = [];

  const payload = {
    organization_id: "org-1",
    group: {
      provider: "whatsapp",
      whatsapp_provider_id: "g-1",
      name: "Grupo",
      invite_link: "https://chat.whatsapp.com/abc",
    },
    participants: [
      {
        phone: "11999990000",
        name: "Dono",
        is_admin: false,
        is_super_admin: true,
        whatsapp_provider_id: "lid-1",
      },
    ],
  };

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
    ai_enabled: false,
    ai_prompt: null,
    ai_model: null,
    ai_runtime: null,
    metadata: null,
    raw_provider: null,
    status: null,
    sync_status: null,
    sync_error: null,
  };

  const createClientMock = ((url: string, key: string) => {
    if (key === "anon") {
      const supabaseUser: any = {
        auth: {
          getUser: async () => ({ data: { user: { id: "u-1" } }, error: null }),
        },
        from: (table: string) => {
          if (table === "organizations") {
            return {
              select: () => ({
                eq: () => ({
                  maybeSingle: async () => ({ data: { id: "org-1", name: "Org" }, error: null }),
                }),
              }),
            } as any;
          }

          if (table === "groups") {
            return {
              select: () => ({
                eq: () => ({
                  maybeSingle: async () => ({ data: null, error: null }),
                }),
              }),
              insert: () => ({
                select: () => ({
                  single: async () => ({ data: { id: "group-1" }, error: null }),
                }),
              }),
            } as any;
          }

          if (table === "members") {
            return {
              insert: async (values: any[]) => {
                if (Array.isArray(values) && values[0]) membersInserted.push(values[0]);
                return { error: null };
              },
            } as any;
          }

          throw new Error(`unexpected table: ${table}`);
        },
      };

      return supabaseUser;
    }

    const supabaseAdmin: any = {
      from: (table: string) => {
        if (table === "groups") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: groupRow, error: null }),
              }),
            }),
            update: (values: any) => ({
              eq: async (id: string) => {
                groupUpdates.push({ id, values });
                return { error: null };
              },
            }),
            delete: () => ({
              eq: async () => ({ error: null }),
            }),
          } as any;
        }

        if (table === "events") {
          return {
            insert: async () => ({ error: null }),
            delete: () => ({
              eq: () => ({
                eq: async () => ({ error: null }),
              }),
            }),
          } as any;
        }

        if (table === "group_ai_prompt_configs") {
          return {
            upsert: async () => ({ error: null }),
          } as any;
        }

        if (table === "members") {
          return {
            delete: () => ({
              eq: async () => ({ error: null }),
            }),
          } as any;
        }

        throw new Error(`unexpected table: ${table}`);
      },
    };

    return supabaseAdmin;
  }) as any;

  const handler = createProvisionGroupHandler({
    env: {
      get: (k: string) => {
        if (k === "SUPABASE_URL") return testBaseUrl;
        if (k === "SUPABASE_ANON_KEY") return "anon";
        if (k === "SUPABASE_SERVICE_ROLE_KEY") return "service";
        return undefined;
      },
    },
    crypto: { randomUUID: () => "uuid-1" } as any,
    createClient: createClientMock,
  });

  const res = await handler(makeReq(payload));
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.success, true);
  assertEquals(body.group_id, "group-1");
  assertEquals(Array.isArray(membersInserted), true);
  const inserted = membersInserted as any[];
  assertEquals(inserted.length, 1);
  assertEquals(inserted[0]?.phone_e164, "+5511999990000");
  assertEquals(inserted[0]?.is_admin, true);
  assertEquals(inserted[0]?.is_super_admin, true);
  assertEquals(groupUpdates.length, 1);
  assertEquals(groupUpdates[0]?.values?.ai_enabled, true);
  assertEquals(groupUpdates[0]?.values?.ai_model, "gpt-4o-mini");
  assertEquals(groupUpdates[0]?.values?.ai_runtime, "responses");
  assertEquals(
    groupUpdates[0]?.values?.ai_prompt,
    "Você é o Bóris, um assistente que acompanha este grupo de WhatsApp. Seu papel é ajudar a resumir conversas, identificar temas e tornar a informação clara, sem inventar nada."
  );
});

DenoRef.test("provision-group deduplica participantes por whatsapp_provider_id", async () => {
  const membersInserted: any[] = [];
  const groupUpdates: any[] = [];

  const payload = {
    organization_id: "org-1",
    group: {
      provider: "whatsapp",
      whatsapp_provider_id: "g-1",
      name: "Grupo",
      invite_link: "https://chat.whatsapp.com/abc",
    },
    participants: [
      {
        phone: "11999990000",
        name: "A",
        is_admin: true,
        is_super_admin: false,
        whatsapp_provider_id: "lid-1",
      },
      {
        phone: "11999990000",
        name: "A2",
        is_admin: true,
        is_super_admin: false,
        whatsapp_provider_id: "lid-1",
      },
    ],
  };

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
    metadata: null,
    raw_provider: null,
    status: null,
    sync_status: null,
    sync_error: null,
  };

  const createClientMock = ((_: string, key: string) => {
    if (key === "anon") {
      return {
        auth: {
          getUser: async () => ({ data: { user: { id: "u-1" } }, error: null }),
        },
        from: (table: string) => {
          if (table === "organizations") {
            return {
              select: () => ({
                eq: () => ({
                  maybeSingle: async () => ({ data: { id: "org-1", name: "Org" }, error: null }),
                }),
              }),
            } as any;
          }
          if (table === "groups") {
            return {
              select: () => ({
                eq: () => ({
                  maybeSingle: async () => ({ data: null, error: null }),
                }),
              }),
              insert: () => ({
                select: () => ({
                  single: async () => ({ data: { id: "group-1" }, error: null }),
                }),
              }),
            } as any;
          }
          if (table === "members") {
            return {
              insert: async (values: any[]) => {
                if (Array.isArray(values) && values[0]) membersInserted.push(values[0]);
                return { error: null };
              },
            } as any;
          }
          throw new Error(`unexpected table: ${table}`);
        },
      } as any;
    }

    return {
      from: (table: string) => {
        if (table === "groups") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: groupRow, error: null }),
              }),
            }),
            update: (values: any) => ({
              eq: async (id: string) => {
                groupUpdates.push({ id, values });
                return { error: null };
              },
            }),
            delete: () => ({
              eq: async () => ({ error: null }),
            }),
          } as any;
        }
        if (table === "events") {
          return {
            insert: async () => ({ error: null }),
            delete: () => ({
              eq: () => ({
                eq: async () => ({ error: null }),
              }),
            }),
          } as any;
        }
        if (table === "group_ai_prompt_configs") {
          return {
            upsert: async () => ({ error: null }),
          } as any;
        }
        if (table === "members") {
          return {
            delete: () => ({
              eq: async () => ({ error: null }),
            }),
          } as any;
        }
        throw new Error(`unexpected table: ${table}`);
      },
    } as any;
  }) as any;

  const handler = createProvisionGroupHandler({
    env: {
      get: (k: string) => {
        if (k === "SUPABASE_URL") return testBaseUrl;
        if (k === "SUPABASE_ANON_KEY") return "anon";
        if (k === "SUPABASE_SERVICE_ROLE_KEY") return "service";
        return undefined;
      },
    },
    crypto: { randomUUID: () => "uuid-1" } as any,
    createClient: createClientMock,
  });

  const res = await handler(makeReq(payload));
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.success, true);
  assertEquals(Array.isArray(membersInserted), true);
  const inserted = membersInserted as any[];
  assertEquals(inserted.length, 1);
  assertEquals(inserted[0]?.whatsapp_provider_id, "lid-1");
  assertEquals(groupUpdates.length, 1);
});

DenoRef.test("provision-group ignora duplicidade e continua inserindo outros membros", async () => {
  const membersInserted: any[] = [];
  const groupUpdates: any[] = [];
  let insertCalls = 0;

  const payload = {
    organization_id: "org-1",
    group: {
      provider: "whatsapp",
      whatsapp_provider_id: "g-1",
      name: "Grupo",
      invite_link: "https://chat.whatsapp.com/abc",
    },
    participants: [
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
    ],
  };

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
    metadata: null,
    raw_provider: null,
    status: null,
    sync_status: null,
    sync_error: null,
  };

  const createClientMock = ((_: string, key: string) => {
    if (key === "anon") {
      return {
        auth: {
          getUser: async () => ({ data: { user: { id: "u-1" } }, error: null }),
        },
        from: (table: string) => {
          if (table === "organizations") {
            return {
              select: () => ({
                eq: () => ({
                  maybeSingle: async () => ({ data: { id: "org-1", name: "Org" }, error: null }),
                }),
              }),
            } as any;
          }
          if (table === "groups") {
            return {
              select: () => ({
                eq: () => ({
                  maybeSingle: async () => ({ data: null, error: null }),
                }),
              }),
              insert: () => ({
                select: () => ({
                  single: async () => ({ data: { id: "group-1" }, error: null }),
                }),
              }),
            } as any;
          }
          if (table === "members") {
            return {
              insert: async (values: any[]) => {
                insertCalls += 1;
                if (insertCalls === 1) {
                  return { error: { code: "23505", message: "duplicate key value violates unique constraint" } };
                }
                if (Array.isArray(values) && values[0]) membersInserted.push(values[0]);
                return { error: null };
              },
            } as any;
          }
          throw new Error(`unexpected table: ${table}`);
        },
      } as any;
    }

    return {
      from: (table: string) => {
        if (table === "groups") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: groupRow, error: null }),
              }),
            }),
            update: (values: any) => ({
              eq: async (id: string) => {
                groupUpdates.push({ id, values });
                return { error: null };
              },
            }),
            delete: () => ({
              eq: async () => ({ error: null }),
            }),
          } as any;
        }
        if (table === "events") {
          return {
            insert: async () => ({ error: null }),
            delete: () => ({
              eq: () => ({
                eq: async () => ({ error: null }),
              }),
            }),
          } as any;
        }
        if (table === "group_ai_prompt_configs") {
          return {
            upsert: async () => ({ error: null }),
          } as any;
        }
        if (table === "members") {
          return {
            delete: () => ({
              eq: async () => ({ error: null }),
            }),
          } as any;
        }
        throw new Error(`unexpected table: ${table}`);
      },
    } as any;
  }) as any;

  const handler = createProvisionGroupHandler({
    env: {
      get: (k: string) => {
        if (k === "SUPABASE_URL") return testBaseUrl;
        if (k === "SUPABASE_ANON_KEY") return "anon";
        if (k === "SUPABASE_SERVICE_ROLE_KEY") return "service";
        return undefined;
      },
    },
    crypto: { randomUUID: () => "uuid-1" } as any,
    createClient: createClientMock,
  });

  const res = await handler(makeReq(payload));
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.success, true);
  assertEquals(membersInserted.length, 1);
  assertEquals(membersInserted[0]?.whatsapp_provider_id, "lid-2");
  assertEquals(groupUpdates.length, 1);
});

DenoRef.test("provision-group tolera schema sem colunas opcionais de modelo/runtime", async () => {
  const groupUpdates: any[] = [];

  const payload = {
    organization_id: "org-1",
    group: {
      provider: "whatsapp",
      whatsapp_provider_id: "g-1",
      name: "Grupo",
      invite_link: "https://chat.whatsapp.com/abc",
    },
    participants: [],
  };

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
    ai_enabled: false,
    ai_prompt: null,
    ai_model: null,
    ai_runtime: null,
    metadata: null,
    raw_provider: null,
    status: null,
    sync_status: null,
    sync_error: null,
  };

  let groupsUpdateCalls = 0;

  const createClientMock = ((_: string, key: string) => {
    if (key === "anon") {
      return {
        auth: {
          getUser: async () => ({ data: { user: { id: "u-1" } }, error: null }),
        },
        from: (table: string) => {
          if (table === "organizations") {
            return {
              select: () => ({
                eq: () => ({
                  maybeSingle: async () => ({ data: { id: "org-1", name: "Org" }, error: null }),
                }),
              }),
            } as any;
          }
          if (table === "groups") {
            return {
              select: () => ({
                eq: () => ({
                  maybeSingle: async () => ({ data: null, error: null }),
                }),
              }),
              insert: () => ({
                select: () => ({
                  single: async () => ({ data: { id: "group-1" }, error: null }),
                }),
              }),
            } as any;
          }
          throw new Error(`unexpected table: ${table}`);
        },
      } as any;
    }

    return {
      from: (table: string) => {
        if (table === "groups") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: groupRow, error: null }),
              }),
            }),
            update: (values: any) => ({
              eq: async (id: string) => {
                groupsUpdateCalls += 1;
                groupUpdates.push({ id, values });
                if ("ai_model" in values) {
                  return { error: { code: "PGRST204", message: "Could not find the 'ai_model' column" } };
                }
                if ("ai_runtime" in values) {
                  return { error: { code: "PGRST204", message: "Could not find the 'ai_runtime' column" } };
                }
                return { error: null };
              },
            }),
            delete: () => ({
              eq: async () => ({ error: null }),
            }),
          } as any;
        }
        if (table === "events") {
          return {
            insert: async () => ({ error: null }),
            delete: () => ({
              eq: () => ({
                eq: async () => ({ error: null }),
              }),
            }),
          } as any;
        }
        if (table === "group_ai_prompt_configs") {
          return {
            upsert: async () => ({ error: null }),
          } as any;
        }
        if (table === "members") {
          return {
            delete: () => ({
              eq: async () => ({ error: null }),
            }),
          } as any;
        }
        throw new Error(`unexpected table: ${table}`);
      },
    } as any;
  }) as any;

  const handler = createProvisionGroupHandler({
    env: {
      get: (k: string) => {
        if (k === "SUPABASE_URL") return testBaseUrl;
        if (k === "SUPABASE_ANON_KEY") return "anon";
        if (k === "SUPABASE_SERVICE_ROLE_KEY") return "service";
        return undefined;
      },
    },
    crypto: { randomUUID: () => "uuid-1" } as any,
    createClient: createClientMock,
  });

  const res = await handler(makeReq(payload));
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.success, true);
  assertEquals(groupsUpdateCalls, 2);
  assertEquals("ai_model" in groupUpdates[0]?.values, true);
  assertEquals("ai_runtime" in groupUpdates[0]?.values, true);
  assertEquals("ai_model" in groupUpdates[1]?.values, false);
  assertEquals("ai_runtime" in groupUpdates[1]?.values, false);
});
