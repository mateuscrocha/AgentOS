import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type UseOrgCountsArgs = {
  orgId?: string;
  isAuthenticated: boolean;
  hasAccess: boolean;
};

const ORG_COUNTS_STALE_TIME_MS = 30_000;
const ORG_COUNTS_GC_TIME_MS = 5 * 60_000;

export function useOrgCounts({ orgId, isAuthenticated, hasAccess }: UseOrgCountsArgs) {
  const { data: orgGroupIds } = useQuery({
    queryKey: ["org-group-ids", orgId],
    queryFn: async () => {
      const { data } = await supabase
        .from("groups")
        .select("id")
        .eq("organization_id", orgId!)
        .is("deleted_at", null)
        .neq("is_archived", true);
      return (data ?? []).map((g: { id: string }) => g.id);
    },
    enabled: !!orgId && isAuthenticated && hasAccess,
    staleTime: ORG_COUNTS_STALE_TIME_MS,
    gcTime: ORG_COUNTS_GC_TIME_MS,
  });

  const { data: totalMembersCount, isLoading: membersCountLoading } = useQuery({
    queryKey: ["org-total-members", orgId, orgGroupIds?.join(",")],
    queryFn: async () => {
      if (!orgGroupIds || orgGroupIds.length === 0) return 0;
      const { count } = await supabase
        .from("members")
        .select("*", { count: "exact", head: true })
        .in("group_id", orgGroupIds)
        .is("deleted_at", null);
      return count ?? 0;
    },
    enabled: !!orgId && isAuthenticated && hasAccess && Array.isArray(orgGroupIds),
    staleTime: ORG_COUNTS_STALE_TIME_MS,
    gcTime: ORG_COUNTS_GC_TIME_MS,
  });

  const { data: messagesLast7dCount, isLoading: messagesCountLoading } = useQuery({
    queryKey: ["org-messages-7d", orgId, orgGroupIds?.join(",")],
    queryFn: async () => {
      if (!orgGroupIds || orgGroupIds.length === 0) return 0;
      const fromISO = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const toISO = new Date().toISOString();
      const { count } = await supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .in("group_id", orgGroupIds)
        .is("deleted_at", null)
        .gte("created_at", fromISO)
        .lte("created_at", toISO);
      return count ?? 0;
    },
    enabled: !!orgId && isAuthenticated && hasAccess && Array.isArray(orgGroupIds),
    staleTime: ORG_COUNTS_STALE_TIME_MS,
    gcTime: ORG_COUNTS_GC_TIME_MS,
  });

  const { data: activeGroupsCount, isLoading: activeGroupsLoading } = useQuery({
    queryKey: ["org-active-groups-count", orgId],
    queryFn: async () => {
      const { count } = await supabase
        .from("groups")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", orgId!)
        .is("deleted_at", null)
        .neq("is_archived", true)
        .eq("is_active", true);
      return count ?? 0;
    },
    enabled: !!orgId && isAuthenticated && hasAccess,
    staleTime: ORG_COUNTS_STALE_TIME_MS,
    gcTime: ORG_COUNTS_GC_TIME_MS,
  });

  return {
    orgGroupIds,
    totalMembersCount,
    membersCountLoading,
    messagesLast7dCount,
    messagesCountLoading,
    activeGroupsCount,
    activeGroupsLoading,
  };
}
