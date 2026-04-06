import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type OrganizationListItem = {
  id: string;
  name: string;
  status: string;
  relationship_type: string | null;
  billing_status: string | null;
  created_at: string;
  settings?: Record<string, any> | null;
  activity_24h?: number;
};

type StatusFilter = "all" | "active" | "inactive" | "suspended";
type OrderBy = "activity_24h" | "name" | "created_at";
type OrderDir = "asc" | "desc";

type UseSystemOrganizationsArgs = {
  isAuthenticated: boolean;
  page: number;
  pageSize: number;
  search: string;
  statusFilter: StatusFilter;
  orderBy: OrderBy;
  orderDir: OrderDir;
};

export const systemOrganizationsQueryKeys = {
  all: ["system-organizations"] as const,
  list: (params: {
    page: number;
    pageSize: number;
    search: string;
    statusFilter: StatusFilter;
    orderBy: OrderBy;
    orderDir: OrderDir;
  }) => [...systemOrganizationsQueryKeys.all, "list", params] as const,
  overview: () => [...systemOrganizationsQueryKeys.all, "overview"] as const,
  groupCounts: (orgIds: string[]) => [...systemOrganizationsQueryKeys.all, "group-counts", ...orgIds] as const,
};

let organizationsOverviewRpcAvailable: boolean | null = null;

async function fetchOverviewFallback() {
  const [orgsTotal, orgsActive, orgsInactive, orgsSuspended, groupsTotal] = await Promise.all([
    supabase.from("organizations").select("id", { count: "exact", head: true }),
    supabase.from("organizations").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("organizations").select("id", { count: "exact", head: true }).eq("status", "inactive"),
    supabase.from("organizations").select("id", { count: "exact", head: true }).eq("status", "suspended"),
    supabase.from("groups").select("id", { count: "exact", head: true }).is("deleted_at", null).neq("is_archived", true),
  ]);

  const err = orgsTotal.error || orgsActive.error || orgsInactive.error || orgsSuspended.error || groupsTotal.error;
  if (err) throw err;

  return {
    orgsTotal: orgsTotal.count ?? 0,
    orgsActive: orgsActive.count ?? 0,
    orgsInactive: orgsInactive.count ?? 0,
    orgsSuspended: orgsSuspended.count ?? 0,
    groupsTotal: groupsTotal.count ?? 0,
  };
}

async function fetchOverview() {
  const rpc = (supabase as any).rpc;
  if (typeof rpc !== "function") return fetchOverviewFallback();
  if (organizationsOverviewRpcAvailable === false) return fetchOverviewFallback();

  const { data, error } = await rpc.call(supabase, "get_system_organizations_overview_counts");
  if (error) {
    const code = String((error as { code?: string } | null)?.code ?? "");
    const message = String((error as { message?: string } | null)?.message ?? "");
    if (code === "42883" || /get_system_organizations_overview_counts/i.test(message)) {
      organizationsOverviewRpcAvailable = false;
    }
    // Fallback while migration is not applied yet.
    return fetchOverviewFallback();
  }

  organizationsOverviewRpcAvailable = true;

  const row = Array.isArray(data) ? data[0] : data;
  return {
    orgsTotal: Number(row?.orgs_total ?? 0),
    orgsActive: Number(row?.orgs_active ?? 0),
    orgsInactive: Number(row?.orgs_inactive ?? 0),
    orgsSuspended: Number(row?.orgs_suspended ?? 0),
    groupsTotal: Number(row?.groups_total ?? 0),
  };
}

export function useSystemOrganizations({
  isAuthenticated,
  page,
  pageSize,
  search,
  statusFilter,
  orderBy,
  orderDir,
}: UseSystemOrganizationsArgs) {
  const queryClient = useQueryClient();

  const orgsQuery = useQuery({
    queryKey: systemOrganizationsQueryKeys.list({ page, pageSize, search, statusFilter, orderBy, orderDir }),
    queryFn: async () => {
      let query = supabase
        .from("organizations")
        .select("id, name, status, relationship_type, billing_status, created_at, settings", { count: "exact" });

      if (search) query = query.ilike("name", `%${search}%`);
      if (statusFilter !== "all") query = query.eq("status", statusFilter);

      if (orderBy !== "activity_24h") {
        query = query.order(orderBy, { ascending: orderDir === "asc" });
      }

      const { data, error, count } = await (
        orderBy === "activity_24h"
          ? query
          : query.range((page - 1) * pageSize, page * pageSize - 1)
      );
      if (error) throw error;

      const items = (data ?? []) as OrganizationListItem[];

      if (orderBy !== "activity_24h" || items.length === 0) {
        return { items, count: count ?? 0 };
      }

      const orgIds = items.map((org) => org.id);
      const { data: groupsData, error: groupsError } = await supabase
        .from("groups")
        .select("id, organization_id")
        .in("organization_id", orgIds)
        .is("deleted_at", null)
        .neq("is_archived", true);
      if (groupsError) throw groupsError;

      const groupRows = (groupsData ?? []) as Array<{ id: string; organization_id: string | null }>;
      const groupIds = groupRows.map((group) => group.id).filter(Boolean);
      const activityByOrgId = new Map<string, number>();

      if (groupIds.length > 0) {
        const sinceIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { data: messagesData, error: messagesError } = await supabase
          .from("messages")
          .select("group_id")
          .in("group_id", groupIds)
          .is("deleted_at", null)
          .gte("created_at", sinceIso);
        if (messagesError) throw messagesError;

        const orgByGroupId = new Map<string, string>();
        groupRows.forEach((group) => {
          if (group.id && group.organization_id) {
            orgByGroupId.set(group.id, group.organization_id);
          }
        });

        (messagesData ?? []).forEach((row: any) => {
          const orgId = orgByGroupId.get(String(row?.group_id ?? ""));
          if (!orgId) return;
          activityByOrgId.set(orgId, (activityByOrgId.get(orgId) ?? 0) + 1);
        });
      }

      items.forEach((org) => {
        org.activity_24h = activityByOrgId.get(org.id) ?? 0;
      });

      const directionFactor = orderDir === "asc" ? 1 : -1;
      items.sort((a, b) => {
        const diff = (a.activity_24h ?? 0) - (b.activity_24h ?? 0);
        if (diff !== 0) return diff * directionFactor;
        return a.name.localeCompare(b.name, "pt-BR") * directionFactor;
      });

      const from = (page - 1) * pageSize;
      const to = from + pageSize;
      return { items: items.slice(from, to), count: items.length };
    },
    enabled: isAuthenticated,
  });

  const overviewQuery = useQuery({
    queryKey: systemOrganizationsQueryKeys.overview(),
    queryFn: fetchOverview,
    enabled: isAuthenticated,
  });

  const orgIds = useMemo(() => (orgsQuery.data?.items ?? []).map((o) => o.id), [orgsQuery.data]);

  const orgGroupCountsQuery = useQuery({
    queryKey: systemOrganizationsQueryKeys.groupCounts(orgIds),
    queryFn: async () => {
      if (orgIds.length === 0) return {} as Record<string, number>;
      const { data, error } = await supabase
        .from("groups")
        .select("organization_id, id")
        .in("organization_id", orgIds)
        .is("deleted_at", null)
        .neq("is_archived", true);
      if (error) throw error;
      const counts: Record<string, number> = {};
      (data ?? []).forEach((g: any) => {
        const key = g.organization_id as string;
        counts[key] = (counts[key] || 0) + 1;
      });
      return counts;
    },
    enabled: isAuthenticated && orgIds.length > 0,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "active" | "inactive" | "suspended" }) => {
      const { error } = await supabase.from("organizations").update({ status }).eq("id", id);
      if (error) throw error;
    },
  });

  const refreshAll = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: systemOrganizationsQueryKeys.all }),
      queryClient.invalidateQueries({ queryKey: ["org-group-counts"] }),
    ]);
  };

  return {
    orgsQuery,
    overviewQuery,
    orgGroupCountsQuery,
    updateStatusMutation,
    refreshAll,
  };
}
