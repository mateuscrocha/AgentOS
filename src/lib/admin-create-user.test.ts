import { describe, expect, it } from "vitest";

import { buildAdminCreateUserPayload } from "./admin-create-user";

describe("buildAdminCreateUserPayload", () => {
  it("monta payload de ORG_ADMIN com scope de organização", () => {
    const payload = buildAdminCreateUserPayload({
      name: "Ana",
      email: "ana@exemplo.com",
      whatsappPhone: "+5511999990000",
      sendInvite: false,
      password: "12345678",
      accessType: "ORG_ADMIN",
      organizationId: "org-1",
      groupIds: ["g-1"],
    });

    expect(payload.access_type).toBe("ORG_ADMIN");
    expect(payload.organization_id).toBe("org-1");
    expect(payload.group_ids).toBeUndefined();
    expect(payload.scope_type).toBe("organization");
    expect(payload.scope_id).toBe("org-1");
    expect(payload.assign_org_admin).toBe(true);
    expect(payload.password).toBe("12345678");
  });

  it("monta payload de GROUP_MANAGER com grupos únicos e sem senha quando convite", () => {
    const payload = buildAdminCreateUserPayload({
      name: "Bia",
      email: "bia@exemplo.com",
      whatsappPhone: "",
      sendInvite: true,
      password: "12345678",
      accessType: "GROUP_MANAGER",
      organizationId: "org-1",
      groupIds: ["g-1", "g-1", "  g-2  ", ""],
    });

    expect(payload.access_type).toBe("GROUP_MANAGER");
    expect(payload.organization_id).toBe("org-1");
    expect(payload.group_ids).toEqual(["g-1", "g-2"]);
    expect(payload.scope_type).toBe("group");
    expect(payload.scope_id).toBe("g-1");
    expect(payload.assign_org_admin).toBeUndefined();
    expect(payload.password).toBeUndefined();
  });
});
