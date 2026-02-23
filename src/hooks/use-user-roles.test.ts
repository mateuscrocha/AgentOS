import { describe, expect, it } from "vitest";
import { hasGroupAccessForRoles, type UserRoleAccessInput } from "@/hooks/use-user-roles";

describe("hasGroupAccessForRoles", () => {
  it("nega acesso quando o usuário tem role em outro grupo sem org compatível", () => {
    const roles: UserRoleAccessInput[] = [
      {
        role: "GROUP_MANAGER",
        group_id: "group-a",
        organization_id: "org-a",
      },
    ];

    expect(hasGroupAccessForRoles(roles, "group-b")).toBe(false);
  });

  it("permite acesso quando o group_id corresponde", () => {
    const roles: UserRoleAccessInput[] = [
      {
        role: "GROUP_MANAGER",
        group_id: "group-a",
        organization_id: "org-a",
      },
    ];

    expect(hasGroupAccessForRoles(roles, "group-a")).toBe(true);
  });

  it("permite acesso por organização quando o orgId do grupo é informado", () => {
    const roles: UserRoleAccessInput[] = [
      {
        role: "ORG_ADMIN",
        group_id: null,
        organization_id: "org-a",
      },
    ];

    expect(hasGroupAccessForRoles(roles, "group-b", "org-a")).toBe(true);
    expect(hasGroupAccessForRoles(roles, "group-b", "org-b")).toBe(false);
  });

  it("permite acesso para system admin", () => {
    expect(hasGroupAccessForRoles([], "group-x", undefined, true)).toBe(true);
  });
});
