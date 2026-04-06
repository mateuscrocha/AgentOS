import { AdminLayout } from "@/components/layout/AdminLayout";
import { BorisTable } from "@/components/ui/boris-table";
import { LoadingState } from "@/components/ui/loading-state";
import { AdminPageHeader } from "@/components/layout/AdminPageHeader";
import { ListSectionHeader } from "@/components/dashboard/ListSectionHeader";
import { ADMIN_MICROCOPY } from "@/components/dashboard/admin-microcopy";
import { CalendarRange, Building2, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useUserRoles } from "@/hooks/use-user-roles";
import { UserInline } from "@/components/ui/UserInline";
import AccessDenied from "./AccessDenied";
import { formatDateSimpleBR } from "@/lib/date";
import { PeriodFilter } from "@/components/group-dashboard/PeriodFilter";
import { getDateRange, PeriodType, DateRange } from "@/components/group-dashboard/period-utils";
import { Input } from "@/components/ui/input";

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
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>('7d');
  const [customRange, setCustomRange] = useState<DateRange | undefined>();
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const currentRange = getDateRange(selectedPeriod, customRange);
  const currentStartISO = currentRange.from.toISOString();
  const currentEndISO = currentRange.to.toISOString();
  const periodLabel = `${formatDateSimpleBR(currentRange.from)} — ${formatDateSimpleBR(currentRange.to)}`;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["system-people", page, debouncedSearch, selectedPeriod, customRange?.from?.toISOString(), customRange?.to?.toISOString()],
    queryFn: async () => {
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from("members")
        .select(
          "id, group_id, provider, whatsapp_provider_id, name, display_name, profile_pic_url, created_at",
          { count: "exact" }
        )
        .is("deleted_at", null);

      if (debouncedSearch) {
        query = query.or(`name.ilike.%${debouncedSearch}%,display_name.ilike.%${debouncedSearch}%`);
      }

      query = query
        .gte("created_at", currentStartISO)
        .lte("created_at", currentEndISO);

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
        const provider_user_id = m.whatsapp_provider_id || "";
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

  const visiblePeople = data?.items.length ?? 0;
  const visibleGroups = new Set((data?.items ?? []).flatMap((person) => person.groups)).size;
  const visibleOrganizations = new Set((data?.items ?? []).flatMap((person) => person.organizations)).size;

  const columns = [
    {
      key: "name",
      header: "Pessoa",
      sortable: true,
      render: (p: PersonAgg) => (
        <UserInline name={p.name} avatarUrl={p.photo_url} />
      ),
    },
    {
      key: "provider",
      header: "Provedor",
      hideOn: "sm",
      sortable: true,
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
      sortable: true,
      sortValue: (p: PersonAgg) => p.groups.length,
      render: (p: PersonAgg) => (
        <span className="text-sm text-muted-foreground">{p.groups.length}</span>
      ),
    },
    {
      key: "organizations",
      header: "Organizações",
      hideOn: "sm",
      sortable: true,
      sortValue: (p: PersonAgg) => p.organizations.length,
      render: (p: PersonAgg) => (
        <span className="text-sm text-muted-foreground">{p.organizations.length}</span>
      ),
    },
    {
      key: "created_at",
      header: "Criado em",
      hideOn: "md",
      sortable: true,
      render: (p: PersonAgg) => formatDateSimpleBR(p.created_at),
    },
  ];

  return (
    <AdminLayout title="Pessoas" subtitle="Central de Comando › Pessoas">
      <div className="mx-auto max-w-[1480px] space-y-8 animate-fade-in">
        <AdminPageHeader
          breadcrumbItems={[{ label: "Central de Comando", href: "/" }, { label: "Pessoas" }]}
          title="Pessoas"
          description="Leitura consolidada da base de pessoas, grupos e organizações no recorte selecionado."
        />

        <section className="grid gap-4 lg:grid-cols-4">
          <div className="rounded-[28px] border border-amber-200/70 bg-white px-5 py-5 shadow-subtle">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-700">
              <Users className="h-4 w-4" />
              Pessoas visíveis
            </div>
            <div className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-slate-950">{visiblePeople.toLocaleString("pt-BR")}</div>
            <p className="mt-2 text-sm text-slate-600">Quantidade exibida na página atual após aplicar os filtros.</p>
          </div>
          <div className="rounded-[28px] border border-slate-200 bg-white px-5 py-5 shadow-subtle">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              <Building2 className="h-4 w-4" />
              Organizações
            </div>
            <div className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-slate-950">{visibleOrganizations.toLocaleString("pt-BR")}</div>
            <p className="mt-2 text-sm text-slate-600">Organizações representadas entre as pessoas listadas.</p>
          </div>
          <div className="rounded-[28px] border border-slate-200 bg-white px-5 py-5 shadow-subtle">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              <Users className="h-4 w-4" />
              Grupos
            </div>
            <div className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-slate-950">{visibleGroups.toLocaleString("pt-BR")}</div>
            <p className="mt-2 text-sm text-slate-600">Grupos que aparecem no recorte atual da listagem.</p>
          </div>
          <div className="rounded-[28px] border border-slate-200 bg-white px-5 py-5 shadow-subtle">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              <CalendarRange className="h-4 w-4" />
              Período
            </div>
            <div className="mt-3 text-base font-semibold tracking-[-0.02em] text-slate-950">{periodLabel}</div>
            <p className="mt-2 text-sm text-slate-600">Janela usada para consolidar a leitura desta tela.</p>
          </div>
        </section>

        <section className="rounded-[30px] border border-slate-200 bg-white p-4 shadow-subtle sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-700">Filtros</p>
              <h2 className="text-lg font-semibold tracking-[-0.02em] text-slate-950">Refine a leitura da base</h2>
              <p className="text-sm text-slate-600">Ajuste período e busca para analisar a composição de pessoas com mais precisão.</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <PeriodFilter
                value={selectedPeriod}
                customRange={customRange}
                onChange={(p, r) => { setSelectedPeriod(p); setCustomRange(p === 'custom' ? r : undefined); setPage(1); }}
              />
              <Input
                type="text"
                placeholder="Buscar por nome"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="w-full min-w-[240px] bg-slate-50 lg:w-72"
              />
            </div>
          </div>
        </section>

        <ListSectionHeader
          title="Lista de pessoas"
          count={visiblePeople.toLocaleString("pt-BR")}
          statusLabel={search ? ADMIN_MICROCOPY.listStatus.filtered : ADMIN_MICROCOPY.listStatus.periodRecords}
          isLoading={isLoading}
        />

        <div className="rounded-[30px] border border-slate-200 bg-white p-3 shadow-subtle sm:p-4">
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
      </div>
    </AdminLayout>
  );
}
