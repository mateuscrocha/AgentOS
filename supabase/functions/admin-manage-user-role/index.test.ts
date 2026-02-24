import { assertEquals } from "https://deno.land/std@0.224.0/testing/asserts.ts";

import { createAdminManageUserRoleHandler } from "./index.ts";

const DenoRef = (globalThis as any).Deno;

type Call = {
  table: string;
  action: string;
  payload?: any;
  filters?: Record<string, any>;
};

class Builder {
  private table: string;
  private calls: Call[];
  private state: any;
  private action = "select";
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

  maybeSingle() {
    this.single = true;
    return this.execute();
  }

  then(resolve: any, reject: any) {
    return this.execute().then(resolve, reject);
  }

  private async execute(): Promise<any> {
    this.calls.push({ table: this.table, action: this.action, payload: this.payload, filters: this.filters });

    if (this.table === "user_roles" && this.action === "select") {
      if (this.filters["eq:id"]) {
        const row = this.state.roleById?.[this.filters["eq:id"]] ?? null;
        return { data: this.single ? row : (row ? [row] : []), error: null };
      }
      if (this.filters["eq:role"] === "SYSTEM_ADMIN" && this.selectOptions?.head && this.selectOptions?.count === "exact") {
        return { data: null, error: null, count: this.state.systemAdminCount ?? 0 };
      }
      return { data: this.single ? null : [], error: null };
    }

    if (this.table === "groups" && this.action === "select") {
      const row = this.state.groupById?.[this.filters["eq:id"]] ?? null;
      return { data: this.single ? row : (row ? [row] : []), error: null };
    }

    if (this.table === "user_roles" && this.action === "insert") {
      if (this.state.insertDuplicate) {
        return { data: null, error: { code: "23505", message: "duplicate key value violates unique constraint" } };
      }
      return { data: [{ id: "new-role" }], error: null };
    }

    if (this.table === "user_roles" && this.action === "delete") {
      return { data: [], error: null };
    }

    if (this.table === "events" && this.action === "insert") {
      return { data: [{ id: "evt-1" }], error: null };
    }

    return { data: null, error: null };
  }
}

function makeCreateClientStub(state: any, calls: Call[]) {
  let n = 0;
  return (_url: string, _key: string, _opts?: any) => {
    n += 1;
    if (n === 1) {
      return {
        auth: {
          getUser: async () => ({ data: { user: { id: state.requesterId ?? "req-1" } }, error: null }),
        },
        rpc: async (fn: string) => {
          if (fn === "is_system_admin") return { data: state.requesterIsSystemAdmin ?? true, error: null };
          return { data: null, error: null };
        },
      };
    }

    return {
      from: (table: string) => new Builder(table, calls, state),
    };
  };
}

function makeReq(body: any) {
  return new Request("http://localhost:8000/functions/v1/admin-manage-user-role", {
    method: "POST",
    headers: {
      Authorization: "Bearer t",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

function testEnv() {
  return {
    get: (k: string) => {
      if (k === "SUPABASE_URL") return "http://localhost:8000";
      if (k === "SUPABASE_ANON_KEY") return "anon";
      if (k === "SUPABASE_SERVICE_ROLE_KEY") return "service";
      return undefined;
    },
  };
}

DenoRef.test("admin-manage-user-role bloqueia remoção do último SYSTEM_ADMIN", async () => {
  const calls: Call[] = [];
  const roleId = "11111111-1111-4111-8111-111111111111";
  const handler = createAdminManageUserRoleHandler({
    createClientImpl: makeCreateClientStub({
      requesterIsSystemAdmin: true,
      roleById: {
        [roleId]: {
          id: roleId,
          user_id: "22222222-2222-4222-8222-222222222222",
          role: "SYSTEM_ADMIN",
          organization_id: null,
          group_id: null,
        },
      },
      systemAdminCount: 1,
    }, calls) as any,
    env: testEnv(),
  });

  const res = await handler(makeReq({ action: "remove", role_id: roleId }));
  const body = await res.json();

  assertEquals(res.status, 409);
  assertEquals(body.success, false);
  assertEquals(body.code, "LAST_SYSTEM_ADMIN");

  const deleteCalls = calls.filter((c) => c.table === "user_roles" && c.action === "delete");
  assertEquals(deleteCalls.length, 0);
  const eventCalls = calls.filter((c) => c.table === "events" && c.action === "insert");
  assertEquals(eventCalls.length, 0);
});

DenoRef.test("admin-manage-user-role retorna conflito quando papel já existe", async () => {
  const calls: Call[] = [];
  const userId = "33333333-3333-4333-8333-333333333333";
  const orgId = "44444444-4444-4444-8444-444444444444";

  const handler = createAdminManageUserRoleHandler({
    createClientImpl: makeCreateClientStub({
      requesterIsSystemAdmin: true,
      insertDuplicate: true,
    }, calls) as any,
    env: testEnv(),
  });

  const res = await handler(makeReq({
    action: "add",
    user_id: userId,
    role: "ORG_ADMIN",
    organization_id: orgId,
    group_id: null,
  }));
  const body = await res.json();

  assertEquals(res.status, 409);
  assertEquals(body.success, false);
  assertEquals(body.code, "ROLE_ALREADY_EXISTS");
});

DenoRef.test("admin-manage-user-role adiciona GROUP_MANAGER preenchendo organization_id do grupo", async () => {
  const calls: Call[] = [];
  const userId = "55555555-5555-4555-8555-555555555555";
  const groupId = "66666666-6666-4666-8666-666666666666";
  const orgId = "77777777-7777-4777-8777-777777777777";

  const handler = createAdminManageUserRoleHandler({
    createClientImpl: makeCreateClientStub({
      requesterIsSystemAdmin: true,
      groupById: {
        [groupId]: { id: groupId, organization_id: orgId },
      },
    }, calls) as any,
    env: testEnv(),
  });

  const res = await handler(makeReq({
    action: "add",
    user_id: userId,
    role: "GROUP_MANAGER",
    group_id: groupId,
  }));
  const body = await res.json();

  assertEquals(res.status, 200);
  assertEquals(body.success, true);
  assertEquals(body.organization_id, orgId);
  assertEquals(body.group_id, groupId);

  const insertCall = calls.find((c) => c.table === "user_roles" && c.action === "insert");
  assertEquals(insertCall?.payload?.organization_id, orgId);
  assertEquals(insertCall?.payload?.group_id, groupId);

  const eventCall = calls.find((c) => c.table === "events" && c.action === "insert");
  assertEquals(eventCall?.payload?.event_type, "USER_ROLE_ADDED");
  assertEquals(eventCall?.payload?.entity_id, userId);
  assertEquals(eventCall?.payload?.metadata?.role, "GROUP_MANAGER");
  assertEquals(eventCall?.payload?.metadata?.organization_id, orgId);
  assertEquals(eventCall?.payload?.metadata?.group_id, groupId);
});

DenoRef.test("admin-manage-user-role registra auditoria ao remover papel", async () => {
  const calls: Call[] = [];
  const roleId = "88888888-8888-4888-8888-888888888888";
  const userId = "99999999-9999-4999-8999-999999999999";

  const handler = createAdminManageUserRoleHandler({
    createClientImpl: makeCreateClientStub({
      requesterIsSystemAdmin: true,
      roleById: {
        [roleId]: {
          id: roleId,
          user_id: userId,
          role: "USER",
          organization_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          group_id: null,
        },
      },
      systemAdminCount: 2,
    }, calls) as any,
    env: testEnv(),
  });

  const res = await handler(makeReq({ action: "remove", role_id: roleId }));
  const body = await res.json();

  assertEquals(res.status, 200);
  assertEquals(body.success, true);

  const eventCall = calls.find((c) => c.table === "events" && c.action === "insert");
  assertEquals(eventCall?.payload?.event_type, "USER_ROLE_REMOVED");
  assertEquals(eventCall?.payload?.entity_id, userId);
  assertEquals(eventCall?.payload?.metadata?.role_id, roleId);
  assertEquals(eventCall?.payload?.metadata?.role, "USER");
});
