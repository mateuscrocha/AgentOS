import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useUserRoles } from "@/hooks/use-user-roles";
import AccessDenied from "./AccessDenied";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { AdminPageHeader } from "@/components/layout/AdminPageHeader";
import { LoadingState } from "@/components/ui/loading-state";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { ExecutiveSectionHeader } from "@/components/dashboard/ExecutiveSectionHeader";
import { ListSectionHeader } from "@/components/dashboard/ListSectionHeader";
import { ADMIN_MICROCOPY } from "@/components/dashboard/admin-microcopy";
import { BorisTable } from "@/components/ui/boris-table";
import { StatusTag } from "@/components/ui/status-tag";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Line, LineChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Activity, BarChart3, Building2, Users } from "lucide-react";
import { PeriodFilter } from "@/components/group-dashboard/PeriodFilter";
import { getDateRange, type DateRange, type PeriodType } from "@/components/group-dashboard/period-utils";
import { formatDateTickBR, formatDateTimeBR } from "@/lib/date";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

type OrgStatus = "active" | "warm" | "inactive";
type TabKey = "orgs" | "admins";

type OrderByOrgs = "last_activity_at" | "org_name" | "status" | "admins_active" | "active_days";
type OrderByAdmins = "last_activity_at" | "user_name" | "active_days";

const PAGE_SIZE = 20;

function getStatusLabel(status: string): string {
  if (status === "active") return "Ativa";
  if (status === "warm") return "Morna";
  if (status === "inactive") return "Inativa";
  return status || "—";
}

function getStatusVariant(status: string): "success" | "warning" | "neutral" {
  if (status === "active") return "success";
  if (status === "warm") return "warning";
  return "neutral";
}

function getPageLabel(page: string): string {
  if (page === "dashboard") return "Painel";
  if (page === "grupos") return "Grupos";
  if (page === "configuracoes") return "Configurações";
  if (page === "usuarios") return "Usuários";
  if (page === "relatorios") return "Relatórios";
  if (page === "onboarding") return "Onboarding";
  return page;
}

export default function SystemActivity() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { isSystemAdmin, isLoading: rolesLoading } = useUserRoles();

  const [tab, setTab] = useState<TabKey>("orgs");
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>("7d");
  const [customRange, setCustomRange] = useState<DateRange | undefined>();
  const [recentDays, setRecentDays] = useState(7);
  const [minActiveDays, setMinActiveDays] = useState(3);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const [orgStatus, setOrgStatus] = useState<"all" | OrgStatus>("all");
  const [orgsPage, setOrgsPage] = useState(1);
  const [adminsPage, setAdminsPage] = useState(1);

  const [orderByOrgs, setOrderByOrgs] = useState<OrderByOrgs>("last_activity_at");
  const [orderByAdmins, setOrderByAdmins] = useState<OrderByAdmins>("last_activity_at");
  const [orderDir, setOrderDir] = useState<"asc" | "desc">("desc");

  const currentRange = getDateRange(selectedPeriod, customRange);
  const startISO = currentRange.from.toISOString();
  const endISO = currentRange.to.toISOString();

  const overviewQuery = useQuery({
    queryKey: ["system-activity-overview", startISO, endISO, recentDays, minActiveDays],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("activity_overview", {
        _start: startISO,
        _end: endISO,
        _recent_days: recentDays,
        _min_active_days: minActiveDays,
      });
      if (error) throw error;
      return data?.[0] ?? null;
    },
    enabled: isAuthenticated && isSystemAdmin,
  });

  const dailyQuery = useQuery({
    queryKey: ["system-activity-daily", startISO, endISO],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("activity_daily_org_admins", {
        _start: startISO,
        _end: endISO,
      });
      if (error) throw error;
      return data ?? [];
    },
    enabled: isAuthenticated && isSystemAdmin,
  });

  const topPagesQuery = useQuery({
    queryKey: ["system-activity-top-pages", startISO, endISO],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("activity_top_pages", {
        _start: startISO,
        _end: endISO,
        _limit: 10,
      });
      if (error) throw error;
      return data ?? [];
    },
    enabled: isAuthenticated && isSystemAdmin,
  });

  const orgsQuery = useQuery({
    queryKey: [
      "system-activity-orgs",
      startISO,
      endISO,
      recentDays,
      minActiveDays,
      debouncedSearch,
      orgStatus,
      orderByOrgs,
      orderDir,
      orgsPage,
    ],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("activity_orgs", {
        _start: startISO,
        _end: endISO,
        _recent_days: recentDays,
        _min_active_days: minActiveDays,
        _search: debouncedSearch || null,
        _status: orgStatus === "all" ? null : orgStatus,
        _order_by: orderByOrgs,
        _order_dir: orderDir,
        _limit: PAGE_SIZE,
        _offset: (orgsPage - 1) * PAGE_SIZE,
      });
      if (error) throw error;
      const total = data?.[0]?.total_count ?? 0;
      return { items: data ?? [], total };
    },
    retry: false,
    enabled: isAuthenticated && isSystemAdmin,
  });

  const adminsQuery = useQuery({
    queryKey: ["system-activity-admins", startISO, endISO, debouncedSearch, orderByAdmins, orderDir, adminsPage],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("activity_org_admins", {
        _start: startISO,
        _end: endISO,
        _search: debouncedSearch || null,
        _order_by: orderByAdmins,
        _order_dir: orderDir,
        _limit: PAGE_SIZE,
        _offset: (adminsPage - 1) * PAGE_SIZE,
      });
      if (error) throw error;
      const total = data?.[0]?.total_count ?? 0;
      return { items: data ?? [], total };
    },
    retry: false,
    enabled: isAuthenticated && isSystemAdmin,
  });

  const dailyChartData = useMemo(() => {
    return (dailyQuery.data ?? []).map((d: any) => ({
      day: d.day,
      org_admins: d.org_admins ?? 0,
    }));
  }, [dailyQuery.data]);

  if (authLoading || rolesLoading) {
    return (
      <AdminLayout title="Atividade" subtitle="Carregando...">
        <LoadingState message="Verificando permissões..." />
      </AdminLayout>
    );
  }

  if (!isSystemAdmin) {
    return <AccessDenied />;
  }

  const overview = overviewQuery.data;
  const hasAnyError = !!overviewQuery.error || !!dailyQuery.error || !!topPagesQuery.error;

  const orgColumns = [
    {
      key: "org_name",
      header: "Organização",
      render: (o: any) => (
        <div className="min-w-0">
          <div className="font-semibold text-card-foreground truncate">{o.org_name}</div>
          <div className="text-xs text-muted-foreground tabular-nums truncate">{o.org_id}</div>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (o: any) => <StatusTag variant={getStatusVariant(o.status)}>{getStatusLabel(o.status)}</StatusTag>,
    },
    {
      key: "admins_active",
      header: "Admins",
      hideOn: "sm",
      render: (o: any) => <span className="tabular-nums font-semibold">{o.admins_active ?? 0}</span>,
    },
    {
      key: "active_days",
      header: "Dias ativos",
      hideOn: "sm",
      render: (o: any) => <span className="tabular-nums">{o.active_days ?? 0}</span>,
    },
    {
      key: "last_login_at",
      header: "Último login",
      hideOn: "md",
      render: (o: any) => (o.last_login_at ? <span className="text-xs text-muted-foreground">{formatDateTimeBR(o.last_login_at)}</span> : "—"),
    },
    {
      key: "last_activity_at",
      header: "Última atividade",
      hideOn: "md",
      render: (o: any) => (o.last_activity_at ? <span className="text-xs text-muted-foreground">{formatDateTimeBR(o.last_activity_at)}</span> : "—"),
    },
  ];

  const adminColumns = [
    {
      key: "user_name",
      header: "Gestor",
      render: (a: any) => (
        <div className="min-w-0">
          <div className="font-semibold text-card-foreground truncate">{a.user_name || "—"}</div>
          <div className="text-xs text-muted-foreground tabular-nums truncate">{a.user_id}</div>
        </div>
      ),
    },
    {
      key: "org_name",
      header: "Organização",
      hideOn: "sm",
      render: (a: any) => <span className="text-sm text-muted-foreground truncate">{a.org_name}</span>,
    },
    {
      key: "active_days",
      header: "Dias ativos",
      hideOn: "sm",
      render: (a: any) => <span className="tabular-nums">{a.active_days ?? 0}</span>,
    },
    {
      key: "top_pages",
      header: "Top páginas",
      hideOn: "md",
      render: (a: any) => {
        const pages = (a.top_pages ?? []) as string[];
        const label = pages.length ? pages.map(getPageLabel).join(" • ") : "—";
        return <span className="text-xs text-muted-foreground">{label}</span>;
      },
    },
    {
      key: "last_login_at",
      header: "Último login",
      hideOn: "md",
      render: (a: any) => (a.last_login_at ? <span className="text-xs text-muted-foreground">{formatDateTimeBR(a.last_login_at)}</span> : "—"),
    },
    {
      key: "last_activity_at",
      header: "Última atividade",
      hideOn: "md",
      render: (a: any) => (a.last_activity_at ? <span className="text-xs text-muted-foreground">{formatDateTimeBR(a.last_activity_at)}</span> : "—"),
    },
  ];

  const showClearFilters =
    selectedPeriod !== "7d" ||
    !!customRange ||
    !!search ||
    orgStatus !== "all" ||
    recentDays !== 7 ||
    minActiveDays !== 3 ||
    orderByOrgs !== "last_activity_at" ||
    orderByAdmins !== "last_activity_at" ||
    orderDir !== "desc";

  return (
    <AdminLayout title="Atividade" subtitle="Central de Comando › Atividade">
      <div className="space-y-8 animate-fade-in">
        <AdminPageHeader
          breadcrumbItems={[{ label: "Central de Comando", href: "/" }, { label: "Atividade" }]}
          title="Atividade"
          description="Uso por gestores de organização"
          filters={
            <div className="flex flex-wrap items-center gap-2">
              <PeriodFilter
                value={selectedPeriod}
                customRange={customRange}
                onChange={(p, r) => {
                  setSelectedPeriod(p);
                  setCustomRange(p === "custom" ? r : undefined);
                  setOrgsPage(1);
                  setAdminsPage(1);
                }}
              />
              <select
                value={recentDays}
                onChange={(e) => {
                  setRecentDays(parseInt(e.target.value, 10));
                  setOrgsPage(1);
                }}
                className="px-3 py-2 rounded-lg border border-border bg-card text-sm"
                aria-label="Janela recente"
              >
                <option value={7}>Recente: 7d</option>
                <option value={14}>Recente: 14d</option>
                <option value={30}>Recente: 30d</option>
              </select>
              <select
                value={minActiveDays}
                onChange={(e) => {
                  setMinActiveDays(parseInt(e.target.value, 10));
                  setOrgsPage(1);
                }}
                className="px-3 py-2 rounded-lg border border-border bg-card text-sm"
                aria-label="Mínimo de dias ativos"
              >
                <option value={1}>Ativa: ≥ 1 dia</option>
                <option value={2}>Ativa: ≥ 2 dias</option>
                <option value={3}>Ativa: ≥ 3 dias</option>
                <option value={5}>Ativa: ≥ 5 dias</option>
              </select>
              {tab === "orgs" ? (
                <select
                  value={orgStatus}
                  onChange={(e) => {
                    setOrgStatus(e.target.value as any);
                    setOrgsPage(1);
                  }}
                  className="px-3 py-2 rounded-lg border border-border bg-card text-sm"
                  aria-label="Status"
                >
                  <option value="all">Status: todos</option>
                  <option value="active">Status: ativa</option>
                  <option value="warm">Status: morna</option>
                  <option value="inactive">Status: inativa</option>
                </select>
              ) : null}
              <select
                value={tab === "orgs" ? orderByOrgs : orderByAdmins}
                onChange={(e) => {
                  if (tab === "orgs") {
                    setOrderByOrgs(e.target.value as OrderByOrgs);
                    setOrgsPage(1);
                  } else {
                    setOrderByAdmins(e.target.value as OrderByAdmins);
                    setAdminsPage(1);
                  }
                }}
                className="px-3 py-2 rounded-lg border border-border bg-card text-sm"
                aria-label="Ordenação"
              >
                {tab === "orgs" ? (
                  <>
                    <option value="last_activity_at">Ordenar: última atividade</option>
                    <option value="org_name">Ordenar: organização</option>
                    <option value="status">Ordenar: status</option>
                    <option value="admins_active">Ordenar: admins</option>
                    <option value="active_days">Ordenar: dias ativos</option>
                  </>
                ) : (
                  <>
                    <option value="last_activity_at">Ordenar: última atividade</option>
                    <option value="user_name">Ordenar: gestor</option>
                    <option value="active_days">Ordenar: dias ativos</option>
                  </>
                )}
              </select>
              <select
                value={orderDir}
                onChange={(e) => {
                  setOrderDir(e.target.value as any);
                  setOrgsPage(1);
                  setAdminsPage(1);
                }}
                className="px-3 py-2 rounded-lg border border-border bg-card text-sm"
                aria-label="Direção"
              >
                <option value="desc">Direção: desc</option>
                <option value="asc">Direção: asc</option>
              </select>
              <input
                type="text"
                placeholder="Buscar por org ou gestor"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setOrgsPage(1);
                  setAdminsPage(1);
                }}
                className="w-64 px-3 py-2 rounded-lg border border-border bg-card text-sm"
              />
            </div>
          }
          showClearFilters={showClearFilters}
          onClearFilters={() => {
            setSelectedPeriod("7d");
            setCustomRange(undefined);
            setRecentDays(7);
            setMinActiveDays(3);
            setSearch("");
            setOrgStatus("all");
            setOrderByOrgs("last_activity_at");
            setOrderByAdmins("last_activity_at");
            setOrderDir("desc");
            setOrgsPage(1);
            setAdminsPage(1);
          }}
          generalKpis={
            overview ? (
              <>
                <StatsCard
                  title="Organizações"
                  value={overview.orgs_total ?? "—"}
                  icon={Building2}
                  variant="kpi"
                  numericValue
                  help={{
                    whatIs: "Total de organizações avaliadas no painel de atividade para o período/filtros atuais.",
                    howToInterpret: "É a base de referência para comparar quantas estão ativas, mornas ou inativas.",
                    whatToObserve: "Compare com ‘Organizações com atividade’ para medir cobertura de uso.",
                  }}
                />
                <StatsCard
                  title="Organizações com atividade"
                  value={overview.orgs_with_activity ?? "—"}
                  icon={Activity}
                  variant="kpi"
                  numericValue
                  help={{
                    whatIs: "Organizações que tiveram sinais de atividade no período (eventos de uso, acessos ou interação).",
                    howToInterpret: "Mostra adoção real no intervalo analisado, não apenas organizações cadastradas.",
                    whatToObserve: "Acompanhe a proporção sobre o total e sua evolução ao alterar o período.",
                  }}
                />
                <StatsCard
                  title="Ativas"
                  value={overview.orgs_active ?? "—"}
                  icon={BarChart3}
                  variant="kpi"
                  numericValue
                  help={{
                    whatIs: "Organizações classificadas como ativas segundo as regras do painel (dias/recência de atividade).",
                    howToInterpret: "Representa a faixa mais saudável de engajamento operacional no período.",
                    whatToObserve: "Observe migração entre ‘Ativas’, ‘Mornas’ e ‘Inativas’ ao longo do tempo.",
                  }}
                />
                <StatsCard
                  title="Mornas"
                  value={overview.orgs_warm ?? "—"}
                  icon={BarChart3}
                  variant="kpi"
                  numericValue
                  help={{
                    whatIs: "Organizações com atividade intermediária (nem inativas, nem plenamente ativas).",
                    howToInterpret: "É uma faixa de atenção: existe uso, mas abaixo do patamar considerado saudável.",
                    whatToObserve: "Acompanhe se estão migrando para ‘Ativas’ ou escorregando para ‘Inativas’.",
                  }}
                />
                <StatsCard
                  title="Inativas"
                  value={overview.orgs_inactive ?? "—"}
                  icon={BarChart3}
                  variant="kpi"
                  numericValue
                  help={{
                    whatIs: "Organizações sem atividade suficiente no período, segundo a regra deste painel.",
                    howToInterpret: "Indica risco de desengajamento ou ausência de uso recente.",
                    whatToObserve: "Priorize concentração por carteira/segmento e tendência de crescimento.",
                  }}
                />
                <StatsCard
                  title="Admins ativos"
                  value={overview.org_admins_active ?? "—"}
                  icon={Users}
                  variant="kpi"
                  numericValue
                  help={{
                    whatIs: "Quantidade de administradores de organização com atividade no período.",
                    howToInterpret: "Mostra engajamento operacional de quem gerencia organizações.",
                    whatToObserve: "Compare com logins e visualizações para avaliar qualidade de uso administrativo.",
                  }}
                />
                <StatsCard
                  title="Logins"
                  value={overview.logins ?? "—"}
                  icon={Activity}
                  variant="kpi"
                  numericValue
                  help={{
                    whatIs: "Quantidade de logins registrados no período selecionado.",
                    howToInterpret: "Mede acessos à plataforma e ajuda a inferir frequência de uso.",
                    whatToObserve: "Leia junto de admins ativos e page views para evitar interpretação isolada.",
                  }}
                />
                <StatsCard
                  title="Visualizações de página"
                  value={overview.page_views ?? "—"}
                  icon={Activity}
                  variant="kpi"
                  numericValue
                  help={{
                    whatIs: "Total de páginas visualizadas na aplicação durante o período.",
                    howToInterpret: "Indica intensidade de navegação/uso. Pode crescer por maior adoção ou por mais sessões por usuário.",
                    whatToObserve: "Compare com logins para entender profundidade média de navegação.",
                  }}
                />
              </>
            ) : null
          }
        />

        {hasAnyError ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
            <div className="text-sm font-semibold text-card-foreground">Falha ao carregar parte dos dados</div>
            <div className="text-xs text-muted-foreground mt-1">Verifique sua sessão e tente novamente.</div>
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <section className="rounded-xl border border-border/70 bg-card p-5">
            <ExecutiveSectionHeader
              eyebrow="Série temporal"
              title="Admins ativos por dia"
              description="Evolução diária de gestores de organização com atividade no período selecionado."
              icon={Activity}
              className="mb-2"
            />
            <div className="mt-3">
              {dailyQuery.isLoading ? (
                <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground">Carregando…</div>
              ) : dailyChartData.length === 0 ? (
                <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground">Sem dados</div>
              ) : (
                <ChartContainer
                  config={{ org_admins: { label: "Admins ativos", color: "hsl(var(--primary))" } }}
                  className="h-[220px] w-full"
                >
                  <LineChart data={dailyChartData}>
                    <CartesianGrid stroke="hsl(var(--border))" strokeOpacity={0.25} vertical={false} />
                    <XAxis
                      dataKey="day"
                      tick={{ fontSize: 10 }}
                      tickFormatter={(v) => formatDateTickBR(v)}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      width={28}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line
                      type="monotone"
                      dataKey="org_admins"
                      stroke="var(--color-org_admins)"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ChartContainer>
              )}
            </div>
          </section>

          <section className="rounded-xl border border-border/70 bg-card p-5">
            <ExecutiveSectionHeader
              eyebrow="Navegação"
              title="Top páginas"
              description="Páginas mais visualizadas por admins no intervalo selecionado."
              icon={BarChart3}
              className="mb-2"
            />
            <div className="mt-3 space-y-2">
              {topPagesQuery.isLoading ? (
                <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground">Carregando…</div>
              ) : (topPagesQuery.data ?? []).length === 0 ? (
                <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground">Sem dados</div>
              ) : (
                <ul className="space-y-2" role="list">
                  {(topPagesQuery.data ?? []).map((p: any) => (
                    <li key={p.page} className="rounded-lg border border-border bg-secondary/20 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-card-foreground truncate">{getPageLabel(p.page)}</div>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="text-sm font-semibold tabular-nums">{(p.page_views ?? 0).toLocaleString("pt-BR")}</div>
                          <div className="text-xs text-muted-foreground">{(p.admins ?? 0).toLocaleString("pt-BR")} admins</div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)} className="space-y-3">
          <TabsList className="h-10 rounded-lg border border-border/70 bg-card p-1">
            <TabsTrigger value="orgs">Organizações</TabsTrigger>
            <TabsTrigger value="admins">Gestores</TabsTrigger>
          </TabsList>

          <TabsContent value="orgs" className="mt-0 space-y-0">
            <ListSectionHeader
              className="mb-3"
              title="Lista de organizações"
              count={typeof orgsQuery.data?.total === "number" ? orgsQuery.data.total.toLocaleString("pt-BR") : "—"}
              statusLabel={orgStatus === "all" ? ADMIN_MICROCOPY.listStatus.periodRecords : `${ADMIN_MICROCOPY.listStatus.filtered} • ${getStatusLabel(orgStatus)}`}
              isLoading={orgsQuery.isLoading}
            />
            <BorisTable
              columns={orgColumns as any}
              data={orgsQuery.data?.items ?? []}
              keyExtractor={(o: any) => o.org_id}
              page={orgsPage}
              pageSize={PAGE_SIZE}
              totalCount={orgsQuery.data?.total}
              onPageChange={setOrgsPage}
              loading={orgsQuery.isLoading}
              error={!!orgsQuery.error}
              emptyIcon={Building2}
              emptyMessage="Nenhuma organização com atividade neste período."
            />
          </TabsContent>

          <TabsContent value="admins" className="mt-0 space-y-0">
            <ListSectionHeader
              className="mb-3"
              title="Lista de gestores"
              count={typeof adminsQuery.data?.total === "number" ? adminsQuery.data.total.toLocaleString("pt-BR") : "—"}
              statusLabel={search ? ADMIN_MICROCOPY.listStatus.filtered : ADMIN_MICROCOPY.listStatus.periodRecords}
              isLoading={adminsQuery.isLoading}
            />
            <BorisTable
              columns={adminColumns as any}
              data={adminsQuery.data?.items ?? []}
              keyExtractor={(a: any) => `${a.user_id}:${a.org_id}`}
              page={adminsPage}
              pageSize={PAGE_SIZE}
              totalCount={adminsQuery.data?.total}
              onPageChange={setAdminsPage}
              loading={adminsQuery.isLoading}
              error={!!adminsQuery.error}
              emptyIcon={Users}
              emptyMessage="Nenhum gestor com atividade neste período."
            />
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
