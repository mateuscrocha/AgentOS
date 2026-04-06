import { describe, expect, it } from "vitest";
import { getPostLoginRedirectPath } from "@/lib/auth-routing";

describe("getPostLoginRedirectPath", () => {
  it("não redireciona system admin", () => {
    expect(getPostLoginRedirectPath({ isSystemAdmin: true, groupIds: ["g1"], orgIds: ["o1"] })).toBeNull();
  });

  it("prioriza organização para org admin quando houver organização acessível", () => {
    expect(
      getPostLoginRedirectPath({ isSystemAdmin: false, isOrgAdmin: true, groupIds: ["g1", "g2"], orgIds: ["o1"] }),
    ).toBe("/organization/o1/dashboard");
  });

  it("prioriza grupo quando houver acesso a grupos", () => {
    expect(getPostLoginRedirectPath({ isSystemAdmin: false, groupIds: ["g1", "g2"], orgIds: ["o1"] })).toBe("/groups/g1");
  });

  it("usa organização quando não houver grupo", () => {
    expect(getPostLoginRedirectPath({ isSystemAdmin: false, groupIds: [], orgIds: ["o1"] })).toBe("/organization/o1");
  });

  it("envia para no-access quando não houver escopo", () => {
    expect(getPostLoginRedirectPath({ isSystemAdmin: false, groupIds: [], orgIds: [] })).toBe("/no-access");
  });
});
