import { assertEquals, assert } from "https://deno.land/std@0.224.0/testing/asserts.ts";

import { createAdminDeleteUserHandler } from "./index.ts";

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
    this.action = "select";
    this.selectOptions = options;
    return this;
  }

  update(values: any) {
    this.action = "update";
    this.payload = values;
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

  neq(column: string, value: any) {
    this.filters[`neq:${column}`] = value;
    return this;
  }

  limit(_n: number) {
    return this;
  }

  order(_column: string, _opts?: any) {
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

    if (this.table === "user_roles" && this.action === "select") {
      const role = this.filters["eq:role"];
      const userId = this.filters["eq:user_id"];
      const orgId = this.filters["eq:organization_id"];
      const neqUser = this.filters["neq:user_id"];

      if (role === "SYSTEM_ADMIN" && userId) {
        return { data: this.state.targetIsSystemAdmin ? { id: "r1" } : null, error: null };
      }

      if (role === "SYSTEM_ADMIN" && this.selectOptions?.head && this.selectOptions?.count === "exact") {
        return { data: null, error: null, count: this.state.systemAdminsCount };
      }

      if (role === "ORG_ADMIN" && orgId && neqUser) {
        const replacement = this.state.replacementsByOrgId?.[orgId] ?? null;
        return { data: replacement, error: null };
      }
    }

    if (this.table === "profiles" && this.action === "select") {
      if (this.single) {
        return { data: { name: this.state.targetName ?? null }, error: null };
      }
      return { data: [{ name: this.state.targetName ?? null }], error: null };
    }

    if (this.table === "organizations" && this.action === "select") {
      const owner = this.filters["eq:owner_user_id"];
      if (owner) {
        const orgs = (this.state.ownedOrgIds ?? []).map((id: string) => ({ id }));
        return { data: orgs, error: null };
      }
    }

    if (this.table === "organizations" && this.action === "update") {
      return { data: [{ id: this.filters["eq:id"] }], error: null };
    }

    if (this.table === "group_members" && this.action === "update") {
      return { data: [], error: null };
    }

    if (this.table === "events" && this.action === "insert") {
      return { data: [{ id: "e1" }], error: null };
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
        rpc: async (_fn: string, _args: any) => ({ data: state.requesterIsSystemAdmin, error: null }),
        __opts: opts,
      };
    }

    return {
      from: (table: string) => new Builder(table, calls, state),
      auth: {
        admin: {
          getUserById: async (_id: string) => ({ data: { user: { email: state.targetEmail ?? null } }, error: null }),
          deleteUser: async (_id: string) => {
            if (state.deleteUserErrorMessage) return { error: { message: state.deleteUserErrorMessage } };
            return { error: null };
          },
        },
      },
    };
  };
}

function makeReq(userId: string, token = "t") {
  return new Request(testBaseUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ user_id: userId }),
  });
}

DenoRef.test("admin-delete-user limpa owner_user_id quando não há substituto", async () => {
  const calls: Call[] = [];
  const targetUserId = "67d69f28-dbd7-4878-931d-e8f3818cc622";
  const orgId = "c9c523fd-af5f-4f61-a240-f3256a77b94e";

  const state = {
    requesterId: "06cb58c0-7019-4f92-acb6-a8dc3b3b4a46",
    requesterIsSystemAdmin: true,
    targetIsSystemAdmin: false,
    systemAdminsCount: 2,
    targetName: "Anabela",
    targetEmail: "anabela@exemplo.com",
    ownedOrgIds: [orgId],
    replacementsByOrgId: {},
  };

  const handler = createAdminDeleteUserHandler({
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

  const res = await handler(makeReq(targetUserId));
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.success, true);
  assertEquals(body.deleted_user_id, targetUserId);

  const ownerUpdates = calls.filter((c) => c.table === "organizations" && c.action === "update");
  assertEquals(ownerUpdates.length, 1);
  assertEquals(ownerUpdates[0].payload?.owner_user_id, null);
  assertEquals(ownerUpdates[0].filters?.["eq:id"], orgId);
});

DenoRef.test("admin-delete-user transfere owner_user_id quando há substituto", async () => {
  const calls: Call[] = [];
  const targetUserId = "67d69f28-dbd7-4878-931d-e8f3818cc622";
  const orgId = "c9c523fd-af5f-4f61-a240-f3256a77b94e";
  const replacementId = "d1d6236f-fea1-42d1-b764-a02aa9306566";

  const state = {
    requesterId: "06cb58c0-7019-4f92-acb6-a8dc3b3b4a46",
    requesterIsSystemAdmin: true,
    targetIsSystemAdmin: false,
    systemAdminsCount: 2,
    targetName: "Anabela",
    targetEmail: "anabela@exemplo.com",
    ownedOrgIds: [orgId],
    replacementsByOrgId: {
      [orgId]: { user_id: replacementId, created_at: "2025-01-01T00:00:00Z" },
    },
  };

  const handler = createAdminDeleteUserHandler({
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

  const res = await handler(makeReq(targetUserId));
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.success, true);

  const ownerUpdates = calls.filter((c) => c.table === "organizations" && c.action === "update");
  assertEquals(ownerUpdates.length, 1);
  assertEquals(ownerUpdates[0].payload?.owner_user_id, replacementId);
});

DenoRef.test("admin-delete-user retorna 409 quando deleteUser falha por dependência", async () => {
  const calls: Call[] = [];
  const targetUserId = "67d69f28-dbd7-4878-931d-e8f3818cc622";

  const state = {
    requesterId: "06cb58c0-7019-4f92-acb6-a8dc3b3b4a46",
    requesterIsSystemAdmin: true,
    targetIsSystemAdmin: false,
    systemAdminsCount: 2,
    ownedOrgIds: [],
    deleteUserErrorMessage: "ERROR: update or delete on table \"profiles\" violates foreign key constraint",
  };

  const handler = createAdminDeleteUserHandler({
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

  const res = await handler(makeReq(targetUserId));
  assertEquals(res.status, 409);
  const body = await res.json();
  assertEquals(body.success, false);
  assertEquals(body.code, "DEPENDENCIES_EXIST");
});

DenoRef.test("admin-delete-user limpa group_members.granted_by_user_id antes de excluir", async () => {
  const calls: Call[] = [];
  const targetUserId = "67d69f28-dbd7-4878-931d-e8f3818cc622";

  const state = {
    requesterId: "06cb58c0-7019-4f92-acb6-a8dc3b3b4a46",
    requesterIsSystemAdmin: true,
    targetIsSystemAdmin: false,
    systemAdminsCount: 2,
    ownedOrgIds: [],
  };

  const handler = createAdminDeleteUserHandler({
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

  const res = await handler(makeReq(targetUserId));
  assertEquals(res.status, 200);

  const cleanup = calls.find((c) => c.table === "group_members" && c.action === "update");
  if (!cleanup) throw new Error("expected group_members cleanup update");
  assertEquals(cleanup.payload?.granted_by_user_id, null);
  assertEquals(cleanup.filters?.["eq:granted_by_user_id"], targetUserId);
});

DenoRef.test("admin-delete-user bloqueia exclusão do próprio usuário", async () => {
  const calls: Call[] = [];
  const requesterId = "06cb58c0-7019-4f92-acb6-a8dc3b3b4a46";

  const state = {
    requesterId,
    requesterIsSystemAdmin: true,
    targetIsSystemAdmin: false,
    systemAdminsCount: 2,
    ownedOrgIds: [],
  };

  const handler = createAdminDeleteUserHandler({
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

  const res = await handler(makeReq(requesterId));
  assertEquals(res.status, 400);
  const body = await res.json();
  assert(body.message);
  assertEquals(body.code, "CANNOT_DELETE_SELF");
});
