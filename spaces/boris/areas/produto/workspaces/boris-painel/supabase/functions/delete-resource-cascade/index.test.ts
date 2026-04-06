import { createDeleteResourceCascadeHandler } from "./index.ts";

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

type Call = { table: string; action: string; payload?: any; filters?: Record<string, any> };

class Builder {
  private table: string;
  private calls: Call[];
  private state: any;
  private action: string = "select";
  private payload: any;
  private filters: Record<string, any> = {};
  private selectOptions: any;
  private single = false;

  constructor(table: string, calls: Call[], state: any) {
    this.table = table;
    this.calls = calls;
    this.state = state;
  }

  select(_columns: string, options?: any) {
    if (this.action === "delete") {
      this.selectOptions = options;
      return this;
    }

    this.action = "select";
    this.selectOptions = options;
    return this;
  }

  insert(values: any) {
    this.action = "insert";
    this.payload = values;
    return this;
  }

  delete() {
    this.action = "delete";
    return this;
  }

  eq(column: string, value: any) {
    this.filters[`eq:${column}`] = value;
    return this;
  }

  in(column: string, values: any[]) {
    this.filters[`in:${column}`] = values;
    return this;
  }

  maybeSingle() {
    this.single = true;
    return this.execute();
  }

  then(resolve: any, reject: any) {
    return this.execute().then(resolve, reject);
  }

  private record(call: Call) {
    this.calls.push(call);
  }

  private async execute(): Promise<any> {
    this.record({ table: this.table, action: this.action, payload: this.payload, filters: this.filters });

    if (this.table === "events" && this.action === "insert") {
      return { data: [{ id: "e1" }], error: null };
    }

    if (this.action === "select" && this.selectOptions?.head && this.selectOptions?.count === "exact") {
      if (this.table === "organization_contacts") {
        return { data: null, error: null, count: this.state.orgCounts?.organization_contacts ?? 0 };
      }

      if (this.table === "user_roles") {
        const groupId = this.filters["eq:group_id"];
        const orgId = this.filters["eq:organization_id"];
        if (groupId) return { data: null, error: null, count: this.state.groupCounts?.user_roles ?? 0 };
        if (orgId) return { data: null, error: null, count: this.state.orgCounts?.user_roles ?? 0 };
      }

      const groupId = this.filters["eq:group_id"];
      const groupIds = this.filters["in:group_id"];

      if (groupId) {
        return { data: null, error: null, count: this.state.groupCounts?.[this.table] ?? 0 };
      }

      if (Array.isArray(groupIds)) {
        return { data: null, error: null, count: this.state.orgCounts?.[this.table] ?? 0 };
      }
    }

    if (this.table === "groups" && this.action === "select") {
      const groupId = this.filters["eq:id"];
      const orgId = this.filters["eq:organization_id"];

      if (groupId) {
        return { data: this.state.group ?? null, error: null };
      }

      if (orgId) {
        return { data: this.state.orgGroups ?? [], error: null };
      }
    }

    if (this.table === "organizations" && this.action === "select") {
      const orgId = this.filters["eq:id"];
      if (orgId) {
        if (this.single) return { data: this.state.org ?? null, error: null };
        return { data: this.state.org ? [this.state.org] : [], error: null };
      }
    }

    if (this.table === "member_events" && this.action === "delete") {
      if (this.state.failMemberEventsDelete) {
        return { data: null, error: { message: "fail member_events", code: "500" } };
      }
      return { data: [], error: null };
    }

    if (this.table === "message_reactions" && this.action === "delete") {
      if (this.state.failMessageReactionsDelete) {
        return { data: null, error: { message: "fail message_reactions", code: "500" } };
      }
      return { data: [], error: null };
    }

    if (this.table === "organization_contacts" && this.action === "delete") {
      if (this.state.failOrganizationContactsDelete) {
        return { data: null, error: { message: "fail organization_contacts", code: "500" } };
      }
      return { data: [], error: null };
    }

    if (this.table === "user_roles" && this.action === "delete") {
      if (this.state.failUserRolesDelete) {
        return { data: null, error: { message: "fail user_roles", code: "500" } };
      }
      return { data: [], error: null };
    }

    if (this.table === "groups" && this.action === "delete") {
      if (this.state.groupDeleteError) {
        return { data: null, error: { message: "fk", code: this.state.groupDeleteErrorCode ?? "23503" } };
      }
      return { data: { id: this.filters["eq:id"] ?? this.state.group?.id ?? null }, error: null };
    }

    if (this.table === "organizations" && this.action === "delete") {
      if (this.state.orgDeleteError) {
        return { data: null, error: { message: "fk", code: this.state.orgDeleteErrorCode ?? "23503" } };
      }
      return { data: [], error: null };
    }

    return { data: null, error: null };
  }
}

function makeCreateClientStub(state: any, calls: Call[]) {
  let n = 0;
  return (_url: string, _key: string, opts?: any) => {
    n += 1;
    if (n === 1) {
      return {
        auth: {
          getUser: async () => ({ data: { user: { id: state.requesterId } }, error: null }),
        },
        rpc: async (fn: string, args: any) => {
          calls.push({ table: "rpc", action: fn, payload: args });
          if (fn === "is_system_admin") {
            return { data: state.requesterIsSystemAdmin, error: null };
          }
          if (fn === "admin_group_delete_cascade") {
            return { data: state.cascadeData ?? { success: true }, error: state.cascadeError ?? null };
          }
          return { data: null, error: null };
        },
        __opts: opts,
      };
    }

    return {
      from: (table: string) => new Builder(table, calls, state),
    };
  };
}

function makeReq(body: any) {
  return new Request(testBaseUrl, {
    method: "POST",
    headers: {
      Authorization: "Bearer t",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

DenoRef.test("delete-resource-cascade bloqueia quando não é SYSTEM_ADMIN", async () => {
  const calls: Call[] = [];

  const state = {
    requesterId: "06cb58c0-7019-4f92-acb6-a8dc3b3b4a46",
    requesterIsSystemAdmin: false,
  };

  const handler = createDeleteResourceCascadeHandler({
    createClient: makeCreateClientStub(state, calls) as any,
    env: {
      get: (k: string) => {
        if (k === "SUPABASE_URL") return testBaseUrl;
        if (k === "SUPABASE_ANON_KEY") return "anon";
        if (k === "SUPABASE_SERVICE_ROLE_KEY") return "service";
        return undefined;
      },
    },
  });

  const res = await handler(makeReq({ resourceType: "group", resourceId: "bd0f288d-310b-47d4-bca5-e10da4beb2ab" }));
  assertEquals(res.status, 403);
});

DenoRef.test("delete-resource-cascade exclui grupo removendo reações antes", async () => {
  const calls: Call[] = [];
  const groupId = "bd0f288d-310b-47d4-bca5-e10da4beb2ab";

  const state = {
    requesterId: "06cb58c0-7019-4f92-acb6-a8dc3b3b4a46",
    requesterIsSystemAdmin: true,
    group: { id: groupId, organization_id: "c9c523fd-af5f-4f61-a240-f3256a77b94e", name: "Grupo" },
    cascadeData: { success: true },
  };

  const handler = createDeleteResourceCascadeHandler({
    createClient: makeCreateClientStub(state, calls) as any,
    env: {
      get: (k: string) => {
        if (k === "SUPABASE_URL") return testBaseUrl;
        if (k === "SUPABASE_ANON_KEY") return "anon";
        if (k === "SUPABASE_SERVICE_ROLE_KEY") return "service";
        return undefined;
      },
    },
  });

  const res = await handler(makeReq({ resourceType: "group", resourceId: groupId }));
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.success, true);

  const orgAttempt = calls.find((c) => c.table === "events" && c.action === "insert" && c.payload?.event_type === "ORG_GROUP_CASCADE_DELETE_ATTEMPT");
  const orgDeleted = calls.find((c) => c.table === "events" && c.action === "insert" && c.payload?.event_type === "ORG_GROUP_CASCADE_DELETED");
  assertEquals(!!orgAttempt, true);
  assertEquals(!!orgDeleted, true);

  const cascadeIndex = calls.findIndex((c) => c.table === "rpc" && c.action === "admin_group_delete_cascade");
  assertEquals(cascadeIndex >= 0, true);
});

DenoRef.test("delete-resource-cascade retorna DEPENDENCIES_EXIST quando FK bloqueia exclusão de grupo", async () => {
  const calls: Call[] = [];
  const groupId = "bd0f288d-310b-47d4-bca5-e10da4beb2ab";

  const state = {
    requesterId: "06cb58c0-7019-4f92-acb6-a8dc3b3b4a46",
    requesterIsSystemAdmin: true,
    group: { id: groupId, organization_id: "c9c523fd-af5f-4f61-a240-f3256a77b94e", name: "Grupo" },
    cascadeError: { message: "fk", code: "23503" },
  };

  const handler = createDeleteResourceCascadeHandler({
    createClient: makeCreateClientStub(state, calls) as any,
    env: {
      get: (k: string) => {
        if (k === "SUPABASE_URL") return testBaseUrl;
        if (k === "SUPABASE_ANON_KEY") return "anon";
        if (k === "SUPABASE_SERVICE_ROLE_KEY") return "service";
        return undefined;
      },
    },
  });

  const res = await handler(makeReq({ resourceType: "group", resourceId: groupId }));
  assertEquals(res.status, 409);
  const body = await res.json();
  assertEquals(body.success, false);
  assertEquals(body.code, "DEPENDENCIES_EXIST");
});

DenoRef.test("delete-resource-cascade exclui organização limpando member_events e reações", async () => {
  const calls: Call[] = [];
  const orgId = "c9c523fd-af5f-4f61-a240-f3256a77b94e";

  const state = {
    requesterId: "06cb58c0-7019-4f92-acb6-a8dc3b3b4a46",
    requesterIsSystemAdmin: true,
    org: { id: orgId, name: "Org" },
    orgGroups: [{ id: "g1" }, { id: "g2" }],
    orgCounts: {
      organization_contacts: 1,
      user_roles: 2,
      member_events: 3,
      message_reactions: 4,
    },
  };

  const handler = createDeleteResourceCascadeHandler({
    createClient: makeCreateClientStub(state, calls) as any,
    env: {
      get: (k: string) => {
        if (k === "SUPABASE_URL") return testBaseUrl;
        if (k === "SUPABASE_ANON_KEY") return "anon";
        if (k === "SUPABASE_SERVICE_ROLE_KEY") return "service";
        return undefined;
      },
    },
  });

  const res = await handler(makeReq({ resourceType: "organization", resourceId: orgId }));
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.success, true);

  const memberEventsDeleteIndex = calls.findIndex((c) => c.table === "member_events" && c.action === "delete");
  const orgContactsDeleteIndex = calls.findIndex((c) => c.table === "organization_contacts" && c.action === "delete");
  const userRolesDeleteIndex = calls.findIndex((c) => c.table === "user_roles" && c.action === "delete");
  const orgDeleteIndex = calls.findIndex((c) => c.table === "organizations" && c.action === "delete");
  assertEquals(memberEventsDeleteIndex >= 0, true);
  assertEquals(orgContactsDeleteIndex >= 0, true);
  assertEquals(userRolesDeleteIndex >= 0, true);
  assertEquals(orgDeleteIndex >= 0, true);
  assertEquals(memberEventsDeleteIndex < orgDeleteIndex, true);
  assertEquals(orgContactsDeleteIndex < orgDeleteIndex, true);
  assertEquals(userRolesDeleteIndex < orgDeleteIndex, true);
});

DenoRef.test("delete-resource-cascade retorna DEPENDENCY_CLEANUP_FAILED quando falha limpeza de organização", async () => {
  const calls: Call[] = [];
  const orgId = "c9c523fd-af5f-4f61-a240-f3256a77b94e";

  const state = {
    requesterId: "06cb58c0-7019-4f92-acb6-a8dc3b3b4a46",
    requesterIsSystemAdmin: true,
    org: { id: orgId, name: "Org" },
    orgGroups: [{ id: "g1" }, { id: "g2" }],
    orgCounts: {
      organization_contacts: 0,
      user_roles: 0,
      member_events: 3,
      message_reactions: 4,
    },
    failMessageReactionsDelete: true,
  };

  const handler = createDeleteResourceCascadeHandler({
    createClient: makeCreateClientStub(state, calls) as any,
    env: {
      get: (k: string) => {
        if (k === "SUPABASE_URL") return testBaseUrl;
        if (k === "SUPABASE_ANON_KEY") return "anon";
        if (k === "SUPABASE_SERVICE_ROLE_KEY") return "service";
        return undefined;
      },
    },
  });

  const res = await handler(makeReq({ resourceType: "organization", resourceId: orgId }));
  assertEquals(res.status, 400);
  const body = await res.json();
  assertEquals(body.success, false);
  assertEquals(body.code, "DEPENDENCY_CLEANUP_FAILED");
});

DenoRef.test("delete-resource-cascade retorna SERVER_ERROR quando ocorre exceção inesperada", async () => {
  const handler = createDeleteResourceCascadeHandler({
    createClient: (() => {
      throw new Error("boom");
    }) as any,
    env: {
      get: (k: string) => {
        if (k === "SUPABASE_URL") return testBaseUrl;
        if (k === "SUPABASE_ANON_KEY") return "anon";
        if (k === "SUPABASE_SERVICE_ROLE_KEY") return "service";
        return undefined;
      },
    },
  });

  const res = await handler(makeReq({ resourceType: "group", resourceId: "bd0f288d-310b-47d4-bca5-e10da4beb2ab" }));
  assertEquals(res.status, 500);
  const body = await res.json();
  assertEquals(body.success, false);
  assertEquals(body.code, "SERVER_ERROR");
});
