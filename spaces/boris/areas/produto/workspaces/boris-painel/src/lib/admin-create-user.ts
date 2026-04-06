export type AdminCreateUserAccessType = "ORG_ADMIN" | "GROUP_MANAGER";

function uniqStrings(values: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const v of values) {
    const s = (v || "").trim();
    if (!s) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

export type AdminCreateUserPayload = {
  name: string;
  email: string;
  whatsapp_phone: string;
  password?: string;
  access_type: AdminCreateUserAccessType;
  organization_id: string;
  group_ids?: string[];
  scope_type?: "organization" | "group";
  scope_id?: string;
  assign_org_admin?: boolean;
};

export function buildAdminCreateUserPayload(input: {
  name: string;
  email: string;
  whatsappPhone: string;
  sendInvite: boolean;
  password?: string;
  accessType: AdminCreateUserAccessType;
  organizationId: string;
  groupIds: string[];
}): AdminCreateUserPayload {
  const groupIds = input.accessType === "GROUP_MANAGER" ? uniqStrings(input.groupIds) : [];
  const scopeType = input.accessType === "GROUP_MANAGER" ? "group" : "organization";
  const scopeId = input.accessType === "GROUP_MANAGER" ? (groupIds[0] || "") : input.organizationId;
  return {
    name: input.name,
    email: input.email,
    whatsapp_phone: input.whatsappPhone,
    password: input.sendInvite ? undefined : input.password,
    access_type: input.accessType,
    organization_id: input.organizationId,
    group_ids: groupIds.length ? groupIds : undefined,
    scope_type: scopeId ? scopeType : undefined,
    scope_id: scopeId ? scopeId : undefined,
    assign_org_admin: input.accessType === "ORG_ADMIN" ? true : undefined,
  };
}
