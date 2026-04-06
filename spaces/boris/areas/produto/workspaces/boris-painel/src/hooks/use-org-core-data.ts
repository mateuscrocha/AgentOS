import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type OrgPrimaryContact = {
  contact_role: string | null;
  id: string;
  organization_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role_title: string | null;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
  user_id: string | null;
};

type OrgContactUser = {
  id: string;
  name: string | null;
  phone_e164: string | null;
  avatar_url: string | null;
  role: string;
};

type UseOrgCoreDataArgs = {
  orgId?: string;
  isAuthenticated: boolean;
  hasAccess: boolean;
};

const ORG_CORE_STALE_TIME_MS = 60_000;
const ORG_CORE_GC_TIME_MS = 5 * 60_000;

const ROLE_PRIORITY: Record<string, number> = {
  SYSTEM_ADMIN: 4,
  ORG_ADMIN: 3,
  GROUP_MANAGER: 2,
  USER: 1,
};

const ROLE_LABELS: Record<string, string> = {
  SYSTEM_ADMIN: "Admin do sistema",
  ORG_ADMIN: "Gestor da organização",
  GROUP_MANAGER: "Gestor de grupo",
  USER: "Usuário",
};

export function useOrgCoreData({ orgId, isAuthenticated, hasAccess }: UseOrgCoreDataArgs) {
  const {
    data: org,
    isLoading: orgLoading,
    error: orgError,
    refetch: refetchOrg,
  } = useQuery({
    queryKey: ["organization-detail", orgId],
    queryFn: async () => {
      const { data, error } = await supabase.from("organizations").select("*").eq("id", orgId).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!orgId && isAuthenticated && hasAccess,
    staleTime: ORG_CORE_STALE_TIME_MS,
    gcTime: ORG_CORE_GC_TIME_MS,
  });

  const { data: ownerProfile } = useQuery({
    queryKey: ["owner-profile", (org as any)?.owner_user_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("name")
        .eq("id", (org as any).owner_user_id)
        .maybeSingle();
      return data;
    },
    enabled: !!(org as any)?.owner_user_id && isAuthenticated && hasAccess,
    staleTime: ORG_CORE_STALE_TIME_MS,
    gcTime: ORG_CORE_GC_TIME_MS,
  });

  const {
    data: primaryContact,
    isLoading: contactLoading,
    error: contactError,
    refetch: refetchPrimaryContact,
  } = useQuery({
    queryKey: ["org-primary-contact", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organization_contacts")
        .select("*")
        .eq("organization_id", orgId)
        .eq("is_primary", true)
        .maybeSingle();
      if (error) throw error;
      return data as OrgPrimaryContact;
    },
    enabled: !!orgId && isAuthenticated && hasAccess,
    staleTime: ORG_CORE_STALE_TIME_MS,
    gcTime: ORG_CORE_GC_TIME_MS,
  });

  const { data: primaryContactUser } = useQuery({
    queryKey: ["org-primary-contact-user", primaryContact?.user_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, name, avatar_url, phone_e164")
        .eq("id", primaryContact!.user_id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!primaryContact?.user_id && isAuthenticated && hasAccess,
    staleTime: ORG_CORE_STALE_TIME_MS,
    gcTime: ORG_CORE_GC_TIME_MS,
  });

  const hasExplicitContact = Boolean(
    primaryContact?.name ||
      primaryContact?.email ||
      primaryContact?.phone ||
      primaryContact?.role_title ||
      (org as any)?.contact_name ||
      (org as any)?.contact_email ||
      (org as any)?.contact_phone,
  );

  const { data: fallbackContactUser } = useQuery({
    queryKey: ["org-fallback-contact-user", orgId, (org as any)?.owner_user_id, hasExplicitContact],
    queryFn: async () => {
      const [{ data: orgRoles, error: rolesError }, { data: orgRow, error: orgError }] = await Promise.all([
        supabase
          .from("user_roles")
          .select("user_id, role")
          .eq("organization_id", orgId),
        supabase
          .from("organizations")
          .select("owner_user_id")
          .eq("id", orgId)
          .maybeSingle(),
      ]);

      if (rolesError) throw rolesError;
      if (orgError) throw orgError;

      const roleByUser = new Map<string, string>();
      for (const row of orgRoles ?? []) {
        const current = roleByUser.get(row.user_id);
        const currentPriority = current ? (ROLE_PRIORITY[current] ?? 0) : 0;
        const nextPriority = ROLE_PRIORITY[row.role] ?? 0;
        if (!current || nextPriority > currentPriority) {
          roleByUser.set(row.user_id, row.role);
        }
      }

      if (orgRow?.owner_user_id && !roleByUser.has(orgRow.owner_user_id)) {
        roleByUser.set(orgRow.owner_user_id, "ORG_ADMIN");
      }

      const userIds = Array.from(roleByUser.keys());
      if (userIds.length === 0) return null as OrgContactUser | null;

      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, name, phone_e164, avatar_url")
        .in("id", userIds)
        .is("deleted_at", null);

      if (profilesError) throw profilesError;

      const ordered = (profiles ?? [])
        .map((profile) => ({
          id: profile.id,
          name: profile.name,
          phone_e164: profile.phone_e164,
          avatar_url: profile.avatar_url,
          role: roleByUser.get(profile.id) ?? "USER",
        }))
        .sort((a, b) => {
          const ap = ROLE_PRIORITY[a.role] ?? 0;
          const bp = ROLE_PRIORITY[b.role] ?? 0;
          if (ap !== bp) return bp - ap;
          const byName = (a.name ?? "").localeCompare(b.name ?? "", "pt-BR", { sensitivity: "base" });
          if (byName !== 0) return byName;
          return a.id.localeCompare(b.id);
        });

      return ordered[0] ?? null;
    },
    enabled: !!orgId && isAuthenticated && hasAccess && !hasExplicitContact,
    staleTime: ORG_CORE_STALE_TIME_MS,
    gcTime: ORG_CORE_GC_TIME_MS,
  });

  const isFallbackContact = !hasExplicitContact && !!fallbackContactUser;
  const contactName =
    primaryContact?.name ||
    (org as any)?.contact_name ||
    fallbackContactUser?.name ||
    (fallbackContactUser ? "Usuário da organização" : undefined);
  const contactEmail = primaryContact?.email || (org as any)?.contact_email || undefined;
  const contactPhone = primaryContact?.phone || (org as any)?.contact_phone || fallbackContactUser?.phone_e164 || undefined;
  const contactRole =
    primaryContact?.role_title ||
    (fallbackContactUser ? (ROLE_LABELS[fallbackContactUser.role] ?? "Usuário") : undefined);
  const contactUser = primaryContactUser || fallbackContactUser || null;

  return {
    org,
    orgLoading,
    orgError,
    refetchOrg,
    ownerProfile,
    primaryContact,
    primaryContactUser,
    contactUser,
    isFallbackContact,
    contactLoading,
    contactError,
    refetchPrimaryContact,
    contactName,
    contactEmail,
    contactPhone,
    contactRole,
  };
}
