import { AdminLayout } from "@/components/layout/AdminLayout";
import { BorisTable } from "@/components/ui/boris-table";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Users } from "lucide-react";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useUserRoles } from "@/hooks/use-user-roles";
import { UserInline } from "@/components/ui/UserInline";
import AccessDenied from "./AccessDenied";
import { formatDateSimpleBR } from "@/lib/date";

interface PersonAgg {
  personKey: string;
  provider: string;
  provider_user_id: string;
  name: string;
  photo_url: string | null;
  created_at: string;
  groups: string[];
  organizations: string[];
}

const PAGE_SIZE = 20;

export default function SystemPeople() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { isSystemAdmin, isLoading: rolesLoading } = useUserRoles();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["system-people", page, debouncedSearch],
    queryFn: async () => {
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from("members")
        .select(
          "id, group_id, provider, provider_member_id, name, display_name, profile_pic_url, created_at",
          { count: "exact" }
        )
        .is("deleted_at", null);

      if (debouncedSearch) {
        query = query.or(`name.ilike.%${debouncedSearch}%,display_name.ilike.%${debouncedSearch}%`);
      }

      const { data, error, count } = await query
        .order("created_at", { ascending: false })
        .range(from, to);
      if (error) throw error;

      const groupIds = Array.from(new Set((data ?? []).map((m: any) => m.group_id))).filter(Boolean);
      const orgByGroup: Record<string, string> = {};
      if (groupIds.length > 0) {
        const { data: groups } = await supabase
          .from("groups")
          .select("id, organization_id")
          .in("id", groupIds as string[]);
        (groups ?? []).forEach((g: any) => {
          orgByGroup[g.id] = g.organization_id;
        });
      }

      const map: Record<string, PersonAgg> = {};
      (data ?? []).forEach((m: any) => {
        const provider_user_id = m.provider_member_id || "";
        const key = `${m.provider}:${provider_user_id}`;
        const display = m.display_name || m.name;
        if (!map[key]) {
          map[key] = {
            personKey: key,
            provider: m.provider,
            provider_user_id,
            name: display,
            photo_url: m.profile_pic_url,
            created_at: m.created_at,
            groups: [],
            organizations: [],
          };
        }
        map[key].groups.push(m.group_id);
        const orgId = orgByGroup[m.group_id];
        if (orgId) map[key].organizations.push(orgId);
      });

      const items = Object.values(map).map((p) => ({
        ...p,
        groups: Array.from(new Set(p.groups)),
        organizations: Array.from(new Set(p.organizations)),
      }));

      return { items, count: count ?? items.length } as { items: PersonAgg[]; count: number };
    },
    enabled: isAuthenticated && isSystemAdmin,
  });

  if (authLoading || rolesLoading) {
    return (
      <AdminLayout title="Pessoas" subtitle="Carregando...">
        <LoadingState message="Verificando permissões..." />
      </AdminLayout>
    );
  }

  if (!isSystemAdmin) {
    return <AccessDenied />;
  }

  const columns = [
    {
      key: "name",
      header: "Pessoa",
      render: (p: PersonAgg) => (
        <UserInline name={p.name} avatarUrl={p.photo_url} />
      ),
    },
    {
      key: "provider",
      header: "Provedor",
      hideOn: "sm",
      render: (p: PersonAgg) => (
        <span className="px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground text-xs font-medium capitalize">
          {p.provider}
        </span>
      ),
    },
    {
      key: "groups",
      header: "Grupos",
      hideOn: "sm",
      render: (p: PersonAgg) => (
        <span className="text-sm text-muted-foreground">{p.groups.length}</span>
      ),
    },
    {
      key: "organizations",
      header: "Organizações",
      hideOn: "sm",
      render: (p: PersonAgg) => (
        <span className="text-sm text-muted-foreground">{p.organizations.length}</span>
      ),
    },
    {
      key: "created_at",
      header: "Criado em",
      hideOn: "md",
      render: (p: PersonAgg) => formatDateSimpleBR(p.created_at),
    },
  ];

  return (
    <AdminLayout title="Pessoas" subtitle="Central de Comando › Pessoas">
      <div className="space-y-6 animate-fade-in">
        <Breadcrumbs items={[{ label: "Central de Comando", href: "/" }, { label: "Pessoas" }]} />

        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Buscar por nome"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-64 px-3 py-2 rounded-lg border border-border bg-card text-sm"
          />
        </div>

        <BorisTable
          columns={columns as any}
          data={data?.items ?? []}
          keyExtractor={(p) => p.personKey}
          page={page}
          pageSize={PAGE_SIZE}
          totalCount={data?.count}
          onPageChange={setPage}
          loading={isLoading}
          error={!!error}
          emptyIcon={Users}
          emptyMessage="Não há pessoas registradas."
        />
      </div>
    </AdminLayout>
  );
}
