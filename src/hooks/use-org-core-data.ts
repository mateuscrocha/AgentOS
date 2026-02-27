import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type OrgPrimaryContact = {
  id: string;
  organization_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role_title: string | null;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
};

type UseOrgCoreDataArgs = {
  orgId?: string;
  isAuthenticated: boolean;
  hasAccess: boolean;
};

const ORG_CORE_STALE_TIME_MS = 60_000;
const ORG_CORE_GC_TIME_MS = 5 * 60_000;

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

  const contactName = primaryContact?.name || (org as any)?.contact_name || undefined;
  const contactEmail = primaryContact?.email || (org as any)?.contact_email || undefined;
  const contactPhone = primaryContact?.phone || (org as any)?.contact_phone || undefined;
  const contactRole = primaryContact?.role_title || undefined;

  return {
    org,
    orgLoading,
    orgError,
    refetchOrg,
    ownerProfile,
    primaryContact,
    contactLoading,
    contactError,
    refetchPrimaryContact,
    contactName,
    contactEmail,
    contactPhone,
    contactRole,
  };
}
