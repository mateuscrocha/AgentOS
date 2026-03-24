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
};

type StatusFilter = "all" | "active" | "inactive" | "suspended";
type OrderBy = "name" | "created_at";
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

  const { data, error } = await rpc.call(supabase, "get_system_organizations_overview_counts");
  if (error) {
    // Fallback while migration is not applied yet.
    return fetchOverviewFallback();
  }

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
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = supabase
        .from("organizations")
        .select("id, name, status, relationship_type, billing_status, created_at, settings", { count: "exact" });

      if (search) query = query.ilike("name", `%${search}%`);
      if (statusFilter !== "all") query = query.eq("status", statusFilter);

      query = query.order(orderBy, { ascending: orderDir === "asc" });

      const { data, error, count } = await query.range(from, to);
      if (error) throw error;
      return { items: (data ?? []) as OrganizationListItem[], count: count ?? 0 };
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
