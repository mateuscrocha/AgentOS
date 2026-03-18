import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  Building2,
  MousePointerClick,
  UserX,
  Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useUserRoles } from "@/hooks/use-user-roles";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { AdminPageHeader } from "@/components/layout/AdminPageHeader";
import { ListSectionHeader } from "@/components/dashboard/ListSectionHeader";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { ADMIN_MICROCOPY } from "@/components/dashboard/admin-microcopy";
import { PeriodFilter } from "@/components/group-dashboard/PeriodFilter";
import { BorisTable, RowActions } from "@/components/ui/boris-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { LoadingState } from "@/components/ui/loading-state";
import { StatusTag } from "@/components/ui/status-tag";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FilterChips } from "@/components/ui/filter-chips";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getDateRange, type DateRange, type PeriodType } from "@/components/group-dashboard/period-utils";
import { formatDateTimeBR } from "@/lib/date";
import AccessDenied from "./AccessDenied";

type UserActivityStatus = "all" | "active" | "inactive" | "never_logged_in";
type UserPrimaryRole = "all" | "SYSTEM_ADMIN" | "ORG_ADMIN" | "GROUP_MANAGER" | "USER";
type TabKey = "orgs" | "users";

type OrgOrderBy = "last_login_at" | "last_activity_at" | "org_name" | "logins" | "page_views";
type UserOrderBy = "last_seen_at" | "last_login_at" | "user_name" | "page_views";

type KpiRow = {
  organizations_total: number;
  organizations_with_activity: number;
  admins_active: number;
  logins: number;
  page_views: number;
  never_logged_in_users: number;
  admins_active_today: number;
  admins_active_7d: number;
  users_inactive_30d: number;
  orgs_at_risk: number;
};

type OrgIntelligenceRow = {
  org_id: string;
  org_name: string;
  status: string;
  status_reason: string;
  last_login_at: string | null;
  last_activity_at: string | null;
  admins_active: number;
  active_days: number;
  logins: number;
  page_views: number;
  actions_count: number;
  usage_score: number;
  days_since_login: number | null;
  days_since_activity: number | null;
  total_count: number;
};

type UserActivityRow = {
  activity_status: "active" | "inactive" | "never_logged_in";
  first_login_at: string | null;
  last_login_at: string | null;
  last_seen_at: string | null;
  organization_id: string | null;
  organization_name: string | null;
  page_views: number;
  primary_role: "SYSTEM_ADMIN" | "ORG_ADMIN" | "GROUP_MANAGER" | "USER";
  top_pages: string[];
  total_count: number;
  user_id: string;
  user_name: string;
};

type TopPageRow = {
  page: string;
  page_views: number;
  admins: number;
};

const PAGE_SIZE = 20;

function rpc<T>(name: string, params: Record<string, unknown>) {
  return (supabase as any).rpc(name, params) as Promise<{ data: T; error: any }>;
}

function toCount(value: unknown) {
  return Number(value ?? 0);
}

function getPageLabel(page: string | null) {
  if (page === "dashboard") return "Dashboard geral";
  if (page === "organizacoes") return "Organizações";
  if (page === "grupos") return "Grupos";
  if (page === "mensagens") return "Mensagens";
  if (page === "suporte") return "Suporte";
  if (page === "eventos") return "Eventos";
  if (page === "enquetes") return "Enquetes";
  if (page === "configuracoes") return "Configurações";
  if (page === "usuarios") return "Usuários";
  if (page === "relatorios" || page === "resumos") return "Resumos";
  if (page === "alertas") return "Alertas";
  if (page === "insights") return "Insights";
  if (page === "onboarding") return "Onboarding";
  return page || "Acesso";
}

function getRoleLabel(role: string) {
  if (role === "SYSTEM_ADMIN") return "System Admin";
  if (role === "ORG_ADMIN") return "Gestor de Organização";
  if (role === "GROUP_MANAGER") return "Gestor de Grupo";
  if (role === "USER") return "Usuário";
  return role || "—";
}

function getUserActivityStatusLabel(status: UserActivityStatus | string) {
  if (status === "active") return "Ativo";
  if (status === "inactive") return "Inativo";
  if (status === "never_logged_in") return "Nunca logou";
  return "Todos";
}

function getUserActivityStatusVariant(status: string): "success" | "warning" | "neutral" {
  if (status === "active") return "success";
  if (status === "never_logged_in") return "warning";
  return "neutral";
}

function getPeriodLabel(period: PeriodType, customRange?: DateRange) {
  if (period === "7d") return "Ultimos 7 dias";
  if (period === "30d") return "Ultimos 30 dias";
  if (period === "90d") return "Ultimos 90 dias";
  if (period === "custom" && customRange) {
    return `${customRange.from.toLocaleDateString("pt-BR")} - ${customRange.to.toLocaleDateString("pt-BR")}`;
  }
  return "Periodo";
}

export default function SystemActivity() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { isSystemAdmin, isLoading: rolesLoading } = useUserRoles();

  const [tab, setTab] = useState<TabKey>("orgs");
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>("30d");
  const [customRange, setCustomRange] = useState<DateRange | undefined>();
  const [selectedUser, setSelectedUser] = useState<UserActivityRow | null>(null);
  const [selectedOrg, setSelectedOrg] = useState<OrgIntelligenceRow | null>(null);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const [userStatus, setUserStatus] = useState<UserActivityStatus>("all");
  const [userRole, setUserRole] = useState<UserPrimaryRole>("all");

  const [orgsPage, setOrgsPage] = useState(1);
  const [usersPage, setUsersPage] = useState(1);

  const [orderByOrgs, setOrderByOrgs] = useState<OrgOrderBy>("last_activity_at");
  const [orderByUsers, setOrderByUsers] = useState<UserOrderBy>("last_seen_at");
  const [orderDir, setOrderDir] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  const currentRange = useMemo(() => getDateRange(selectedPeriod, customRange), [selectedPeriod, customRange]);
  const startISO = currentRange.from.toISOString();
  const endISO = currentRange.to.toISOString();
  const todayStart = useMemo(() => {
    const d = new Date(currentRange.to);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }, [currentRange.to]);

  const kpiQuery = useQuery({
    queryKey: ["system-activity-kpis-v2", startISO, endISO, todayStart],
    queryFn: async () => {
      const { data, error } = await rpc<KpiRow[]>("system_activity_kpis", {
        _start: startISO,
        _end: endISO,
        _today_start: todayStart,
      });
      if (error) throw error;
      return data?.[0] ?? null;
    },
    enabled: isAuthenticated && isSystemAdmin,
  });

  const orgsQuery = useQuery({
    queryKey: [
      "system-activity-orgs-intelligence",
      startISO,
      endISO,
      debouncedSearch,
      orderByOrgs,
      orderDir,
      orgsPage,
    ],
    queryFn: async () => {
      const { data, error } = await rpc<OrgIntelligenceRow[]>("system_activity_orgs_intelligence", {
        _start: startISO,
        _end: endISO,
        _search: debouncedSearch || null,
        _status: null,
        _days_since_login_min: null,
        _days_since_login_max: null,
        _days_since_activity_min: null,
        _days_since_activity_max: null,
        _score_min: null,
        _score_max: null,
        _order_by: orderByOrgs,
        _order_dir: orderDir,
        _limit: PAGE_SIZE,
        _offset: (orgsPage - 1) * PAGE_SIZE,
      });
      if (error) throw error;
      const total = data?.[0]?.total_count ?? 0;
      return { items: data ?? [], total };
    },
    enabled: isAuthenticated && isSystemAdmin,
  });

  const usersQuery = useQuery({
    queryKey: [
      "system-user-activity-list-v2",
      startISO,
      endISO,
      debouncedSearch,
      userStatus,
      userRole,
      orderByUsers,
      orderDir,
      usersPage,
    ],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("system_user_activity_list", {
        _start: startISO,
        _end: endISO,
        _recent_days: 7,
        _search: debouncedSearch || null,
        _status: userStatus === "all" ? null : userStatus,
        _role: userRole === "all" ? null : userRole,
        _order_by: orderByUsers,
        _order_dir: orderDir,
        _limit: PAGE_SIZE,
        _offset: (usersPage - 1) * PAGE_SIZE,
      });
      if (error) throw error;
      const total = data?.[0]?.total_count ?? 0;
      return { items: (data ?? []) as UserActivityRow[], total };
    },
    enabled: isAuthenticated && isSystemAdmin,
  });

  const topPagesQuery = useQuery({
    queryKey: ["system-activity-top-pages-v2", startISO, endISO],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("activity_top_pages", {
        _start: startISO,
        _end: endISO,
        _limit: 50,
      });
      if (error) throw error;
      return (data ?? []) as TopPageRow[];
    },
    enabled: isAuthenticated && isSystemAdmin,
  });

  const userTimelineQuery = useQuery({
    queryKey: ["system-user-activity-timeline-v2", selectedUser?.user_id, startISO, endISO],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("system_user_activity_timeline", {
        _user_id: selectedUser!.user_id,
        _start: startISO,
        _end: endISO,
        _limit: 20,
      });
      if (error) throw error;
      return (data ?? []) as Array<{
        created_at: string;
        event_type: string;
        page: string | null;
        route: string | null;
        role: string;
        org_id: string | null;
        org_name: string | null;
        session_id: string | null;
      }>;
    },
    enabled: isAuthenticated && isSystemAdmin && !!selectedUser?.user_id,
  });

  const hasAnyError = [
    kpiQuery.error,
    orgsQuery.error,
    usersQuery.error,
    topPagesQuery.error,
  ].some(Boolean);

  const kpis = kpiQuery.data;

  const primaryCards = useMemo(() => {
    if (!kpis) return [];
    return [
      {
        title: "Organizações com acesso",
        value: toCount(kpis.organizations_with_activity),
        icon: Building2,
        description: "Organizações que tiveram login ou navegação no período",
      },
      {
        title: "Logins registrados",
        value: toCount(kpis.logins),
        icon: Activity,
        description: "Total de entradas no sistema",
      },
      {
        title: "Páginas visitadas",
        value: toCount(kpis.page_views),
        icon: MousePointerClick,
        description: "Total de navegação registrada",
      },
      {
        title: "Sem primeiro login",
        value: toCount(kpis.never_logged_in_users),
        icon: UserX,
        description: "Usuários criados que ainda não entraram",
      },
    ];
  }, [kpis]);

  const pageHighlights = useMemo(() => {
    const pages = topPagesQuery.data ?? [];
    return {
      mostUsed: pages.slice(0, 5),
      leastUsed: [...pages].reverse().slice(0, 5),
    };
  }, [topPagesQuery.data]);

  const activeFilterChips = useMemo(() => {
    const items: Array<{ key: string; label: string; onRemove?: () => void }> = [];
    if (selectedPeriod !== "30d" || customRange) {
      items.push({
        key: "period",
        label: getPeriodLabel(selectedPeriod, customRange),
        onRemove: () => {
          setSelectedPeriod("30d");
          setCustomRange(undefined);
        },
      });
    }
    if (search) items.push({ key: "search", label: `Busca: ${search}`, onRemove: () => setSearch("") });
    if (userStatus !== "all") items.push({ key: "userStatus", label: `Usuarios: ${getUserActivityStatusLabel(userStatus)}`, onRemove: () => setUserStatus("all") });
    if (userRole !== "all") items.push({ key: "userRole", label: `Papel: ${getRoleLabel(userRole)}`, onRemove: () => setUserRole("all") });
    return items;
  }, [customRange, search, selectedPeriod, userRole, userStatus]);

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

  const focusNeverLoggedUsers = () => {
    setTab("users");
    setUserStatus("never_logged_in");
    setUsersPage(1);
  };

  const orgColumns = [
    {
      key: "org_name",
      header: "Organização",
      sortable: true,
      render: (org: OrgIntelligenceRow) => (
        <div className="min-w-0">
          <div className="font-semibold text-card-foreground truncate">{org.org_name}</div>
          <div className="text-xs text-muted-foreground truncate">{org.org_id}</div>
        </div>
      ),
    },
    {
      key: "admins_active",
      header: "Usuários ativos",
      hideOn: "sm",
      render: (org: OrgIntelligenceRow) => <span className="tabular-nums font-semibold">{org.admins_active}</span>,
    },
    {
      key: "logins",
      header: "Logins",
      sortable: true,
      render: (org: OrgIntelligenceRow) => <span className="tabular-nums font-semibold">{org.logins.toLocaleString("pt-BR")}</span>,
    },
    {
      key: "page_views",
      header: "Páginas",
      sortable: true,
      render: (org: OrgIntelligenceRow) => <span className="tabular-nums">{org.page_views.toLocaleString("pt-BR")}</span>,
    },
    {
      key: "last_login_at",
      header: "Último login",
      hideOn: "md",
      sortable: true,
      render: (org: OrgIntelligenceRow) => (org.last_login_at ? <span className="text-xs text-muted-foreground">{formatDateTimeBR(org.last_login_at)}</span> : "—"),
    },
    {
      key: "last_activity_at",
      header: "Última atividade",
      hideOn: "md",
      sortable: true,
      render: (org: OrgIntelligenceRow) => (org.last_activity_at ? <span className="text-xs text-muted-foreground">{formatDateTimeBR(org.last_activity_at)}</span> : "—"),
    },
    {
      key: "actions",
      header: "Ações",
      render: (org: OrgIntelligenceRow) => (
        <RowActions>
          <DropdownMenuItem onSelect={() => setSelectedOrg(org)}>Ver resumo</DropdownMenuItem>
        </RowActions>
      ),
    },
  ];

  const userColumns = [
    {
      key: "user_name",
      header: "Usuário",
      sortable: true,
      render: (userRow: UserActivityRow) => (
        <div className="min-w-0">
          <div className="font-semibold text-card-foreground truncate">{userRow.user_name}</div>
          <div className="text-xs text-muted-foreground truncate">{userRow.user_id}</div>
        </div>
      ),
    },
    {
      key: "primary_role",
      header: "Papel",
      hideOn: "sm",
      render: (userRow: UserActivityRow) => <span className="text-sm text-muted-foreground">{getRoleLabel(userRow.primary_role)}</span>,
    },
    {
      key: "organization_name",
      header: "Organização",
      hideOn: "sm",
      render: (userRow: UserActivityRow) => <span className="text-sm text-muted-foreground">{userRow.organization_name || "—"}</span>,
    },
    {
      key: "activity_status",
      header: "Status",
      render: (userRow: UserActivityRow) => (
        <StatusTag variant={getUserActivityStatusVariant(userRow.activity_status)}>{getUserActivityStatusLabel(userRow.activity_status)}</StatusTag>
      ),
    },
    {
      key: "top_pages",
      header: "Páginas usadas",
      hideOn: "md",
      render: (userRow: UserActivityRow) => (
        <span className="text-xs text-muted-foreground">
          {userRow.top_pages.length > 0 ? userRow.top_pages.map((page) => getPageLabel(page)).join(" • ") : "Sem navegação"}
        </span>
      ),
    },
    {
      key: "page_views",
      header: "Page views",
      hideOn: "md",
      sortable: true,
      render: (userRow: UserActivityRow) => <span className="tabular-nums">{userRow.page_views.toLocaleString("pt-BR")}</span>,
    },
    {
      key: "last_login_at",
      header: "Último login",
      hideOn: "md",
      sortable: true,
      render: (userRow: UserActivityRow) => (userRow.last_login_at ? <span className="text-xs text-muted-foreground">{formatDateTimeBR(userRow.last_login_at)}</span> : "—"),
    },
    {
      key: "last_seen_at",
      header: "Última atividade",
      hideOn: "md",
      sortable: true,
      render: (userRow: UserActivityRow) => (userRow.last_seen_at ? <span className="text-xs text-muted-foreground">{formatDateTimeBR(userRow.last_seen_at)}</span> : "—"),
    },
  ];

  const showClearFilters =
    selectedPeriod !== "30d" ||
    !!customRange ||
    !!search ||
    userStatus !== "all" ||
    userRole !== "all" ||
    orderByOrgs !== "last_activity_at" ||
    orderByUsers !== "last_seen_at" ||
    orderDir !== "desc";

  return (
    <AdminLayout title="Atividade" subtitle="Central de Comando › Atividade">
      <div className="mx-auto max-w-[1480px] space-y-8 animate-fade-in">
        <AdminPageHeader
          breadcrumbItems={[{ label: "Central de Comando", href: "/" }, { label: "Atividade" }]}
          title="Comportamento de usuários"
          description="Leitura direta de quem entrou no sistema, quais organizações e usuários usaram o produto e quais páginas concentram mais e menos uso."
          filters={
            <div className="flex flex-wrap items-center gap-2">
              <PeriodFilter
                value={selectedPeriod}
                customRange={customRange}
                onChange={(period, range) => {
                  setSelectedPeriod(period);
                  setCustomRange(period === "custom" ? range : undefined);
                  setOrgsPage(1);
                  setUsersPage(1);
                }}
              />
              <Input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por organização, gestor ou usuário"
                className="w-72"
              />
            </div>
          }
          showClearFilters={showClearFilters}
          onClearFilters={() => {
            setSelectedPeriod("30d");
            setCustomRange(undefined);
            setSearch("");
            setUserStatus("all");
            setUserRole("all");
            setOrderByOrgs("last_activity_at");
            setOrderByUsers("last_seen_at");
            setOrderDir("desc");
            setOrgsPage(1);
            setUsersPage(1);
          }}
          generalKpis={
            primaryCards.length ? (
              <>
                {primaryCards.map((card) => {
                  return (
                    <StatsCard
                      key={card.title}
                      title={card.title}
                      value={card.value.toLocaleString("pt-BR")}
                      description={card.description}
                      icon={card.icon}
                      variant="kpi"
                      numericValue
                      help={{
                        whatIs: card.description,
                        howToInterpret: "Ajuda a entender adoção, frequência e risco do uso do produto.",
                        whatToObserve: "Use junto com as tabelas de organizações, usuários e ranking de páginas.",
                      }}
                      valueClassName="font-mono"
                      titleClassName="max-w-[13ch]"
                      onClick={card.title === "Sem primeiro login" ? focusNeverLoggedUsers : undefined}
                    />
                  );
                })}
              </>
            ) : null
          }
        />

        <FilterChips items={activeFilterChips} onClearAll={showClearFilters ? () => {
          setSelectedPeriod("30d");
          setCustomRange(undefined);
          setSearch("");
          setUserStatus("all");
          setUserRole("all");
          setOrderByOrgs("last_activity_at");
          setOrderByUsers("last_seen_at");
          setOrderDir("desc");
          setOrgsPage(1);
          setUsersPage(1);
        } : undefined} className="-mt-2" />

        {hasAnyError ? (
          <div className="rounded-[var(--radius-lg)] border border-destructive/30 bg-destructive/5 p-4 shadow-subtle">
          <div className="text-sm font-semibold text-card-foreground">Falha ao carregar parte dos dados</div>
          <div className="text-xs text-muted-foreground mt-1">Verifique sua sessão e tente novamente.</div>
        </div>
      ) : null}

        <section className="rounded-[var(--radius-xl)] border border-border/70 bg-card/95 p-5 shadow-subtle">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Resumo do uso</div>
              <h3 className="mt-2 text-xl font-semibold tracking-[-0.02em] text-card-foreground">Quem entrou e onde navegou</h3>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
                A leitura abaixo prioriza presença real no sistema: organizações com acesso, usuários que entraram e as páginas que concentram mais e menos uso.
              </p>
            </div>
            <Button variant="outline" onClick={focusNeverLoggedUsers}>
              Ver quem ainda não entrou
            </Button>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <div className="rounded-[var(--radius-xl)] border border-border/70 bg-card/95 p-5 shadow-subtle">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Páginas</div>
                <div className="text-lg font-semibold text-card-foreground">Mais usadas</div>
              </div>
              <MousePointerClick className="h-4 w-4 text-primary" />
            </div>
            <div className="space-y-3">
              {pageHighlights.mostUsed.map((page, index) => (
                <div key={`${page.page}:${index}`} className="rounded-[var(--radius-md)] border border-border/70 bg-secondary/20 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-card-foreground">{getPageLabel(page.page)}</div>
                      <div className="text-xs text-muted-foreground">{page.admins.toLocaleString("pt-BR")} usuários navegaram por aqui</div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-semibold text-card-foreground">{page.page_views.toLocaleString("pt-BR")}</div>
                      <div className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">views</div>
                    </div>
                  </div>
                </div>
              ))}
              {!topPagesQuery.isLoading && !pageHighlights.mostUsed.length ? (
                <div className="rounded-[var(--radius-md)] border border-border/70 bg-secondary/20 p-4 text-sm text-muted-foreground">
                  Nenhuma navegação registrada no período selecionado.
                </div>
              ) : null}
            </div>
          </div>

          <div className="rounded-[var(--radius-xl)] border border-border/70 bg-card/95 p-5 shadow-subtle">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Páginas</div>
                <div className="text-lg font-semibold text-card-foreground">Menos usadas</div>
              </div>
              <Activity className="h-4 w-4 text-primary" />
            </div>
            <div className="space-y-3">
              {pageHighlights.leastUsed.map((page, index) => (
                <div key={`${page.page}:least:${index}`} className="rounded-[var(--radius-md)] border border-border/70 bg-secondary/20 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-card-foreground">{getPageLabel(page.page)}</div>
                      <div className="text-xs text-muted-foreground">{page.admins.toLocaleString("pt-BR")} usuários navegaram por aqui</div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-semibold text-card-foreground">{page.page_views.toLocaleString("pt-BR")}</div>
                      <div className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">views</div>
                    </div>
                  </div>
                </div>
              ))}
              {!topPagesQuery.isLoading && !pageHighlights.leastUsed.length ? (
                <div className="rounded-[var(--radius-md)] border border-border/70 bg-secondary/20 p-4 text-sm text-muted-foreground">
                  Nenhuma navegação registrada no período selecionado.
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <Tabs value={tab} onValueChange={(value) => setTab(value as TabKey)} className="space-y-3">
          <TabsList className="h-10 rounded-[var(--radius-lg)] border border-border/70 bg-card/95 p-1 shadow-subtle">
            <TabsTrigger value="orgs">Organizações</TabsTrigger>
            <TabsTrigger value="users">Usuários</TabsTrigger>
          </TabsList>

          <TabsContent value="orgs" className="mt-0 space-y-0">
            <div className="mb-3 flex flex-wrap items-center gap-2 rounded-[var(--radius-lg)] border border-border/70 bg-card/95 p-3 shadow-subtle">
              <Select
                value={orderByOrgs}
                onValueChange={(value) => setOrderByOrgs(value as OrgOrderBy)}
              >
                <SelectTrigger className="w-[220px]" aria-label="Ordenação das organizações">
                  <SelectValue placeholder="Ordenar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="last_activity_at">Ordenar: última atividade</SelectItem>
                  <SelectItem value="last_login_at">Ordenar: último login</SelectItem>
                  <SelectItem value="org_name">Ordenar: organização</SelectItem>
                  <SelectItem value="logins">Ordenar: logins</SelectItem>
                  <SelectItem value="page_views">Ordenar: páginas</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={orderDir}
                onValueChange={(value) => setOrderDir(value as "asc" | "desc")}
              >
                <SelectTrigger className="w-[150px]" aria-label="Direção da ordenação">
                  <SelectValue placeholder="Direção" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="desc">Direção: desc</SelectItem>
                  <SelectItem value="asc">Direção: asc</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <ListSectionHeader
              className="mb-3"
              title="Organizações que acessaram o sistema"
              count={typeof orgsQuery.data?.total === "number" ? orgsQuery.data.total.toLocaleString("pt-BR") : "—"}
              statusLabel={search ? ADMIN_MICROCOPY.listStatus.filtered : ADMIN_MICROCOPY.listStatus.periodRecords}
              isLoading={orgsQuery.isLoading}
            />
            <BorisTable
              columns={orgColumns}
              data={orgsQuery.data?.items ?? []}
              keyExtractor={(org) => org.org_id}
              page={orgsPage}
              pageSize={PAGE_SIZE}
              totalCount={orgsQuery.data?.total}
              onPageChange={setOrgsPage}
              loading={orgsQuery.isLoading}
              error={!!orgsQuery.error}
              sortMode="manual"
              sortState={{ key: orderByOrgs, direction: orderDir }}
              onSortChange={(sort) => {
                if (!sort || !["org_name", "logins", "page_views", "last_login_at", "last_activity_at"].includes(sort.key)) return;
                setOrderByOrgs(sort.key as OrgOrderBy);
                setOrderDir(sort.direction);
                setOrgsPage(1);
              }}
              emptyIcon={Building2}
              emptyMessage="Nenhuma organização encontrada para os filtros aplicados."
            />
          </TabsContent>

          <TabsContent value="users" className="mt-0 space-y-0">
            <div className="mb-3 flex flex-wrap items-center gap-2 rounded-[var(--radius-lg)] border border-border/70 bg-card/95 p-3 shadow-subtle">
              <Select
                value={userStatus}
                onValueChange={(value) => {
                  setUserStatus(value as UserActivityStatus);
                  setUsersPage(1);
                }}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Todos os status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="active">Ativos</SelectItem>
                  <SelectItem value="inactive">Inativos</SelectItem>
                  <SelectItem value="never_logged_in">Nunca logaram</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={userRole}
                onValueChange={(value) => {
                  setUserRole(value as UserPrimaryRole);
                  setUsersPage(1);
                }}
              >
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="Todos os papéis" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os papéis</SelectItem>
                  <SelectItem value="SYSTEM_ADMIN">System Admin</SelectItem>
                  <SelectItem value="ORG_ADMIN">Gestor de Organização</SelectItem>
                  <SelectItem value="GROUP_MANAGER">Gestor de Grupo</SelectItem>
                  <SelectItem value="USER">Usuário</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={orderByUsers}
                onValueChange={(value) => setOrderByUsers(value as UserOrderBy)}
              >
                <SelectTrigger className="w-[220px]" aria-label="Ordenação dos usuários">
                  <SelectValue placeholder="Ordenar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="last_seen_at">Ordenar: última atividade</SelectItem>
                  <SelectItem value="last_login_at">Ordenar: último login</SelectItem>
                  <SelectItem value="user_name">Ordenar: usuário</SelectItem>
                  <SelectItem value="page_views">Ordenar: page views</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={orderDir}
                onValueChange={(value) => setOrderDir(value as "asc" | "desc")}
              >
                <SelectTrigger className="w-[150px]" aria-label="Direção da ordenação">
                  <SelectValue placeholder="Direção" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="desc">Direção: desc</SelectItem>
                  <SelectItem value="asc">Direção: asc</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <ListSectionHeader
              className="mb-3"
              title="Usuários e páginas utilizadas"
              count={typeof usersQuery.data?.total === "number" ? usersQuery.data.total.toLocaleString("pt-BR") : "—"}
              statusLabel={search ? ADMIN_MICROCOPY.listStatus.filtered : ADMIN_MICROCOPY.listStatus.periodRecords}
              isLoading={usersQuery.isLoading}
            />
            <BorisTable
              columns={userColumns}
              data={usersQuery.data?.items ?? []}
              keyExtractor={(userRow) => userRow.user_id}
              page={usersPage}
              pageSize={PAGE_SIZE}
              totalCount={usersQuery.data?.total}
              onPageChange={setUsersPage}
              loading={usersQuery.isLoading}
              error={!!usersQuery.error}
              sortMode="manual"
              sortState={{ key: orderByUsers, direction: orderDir }}
              onSortChange={(sort) => {
                if (!sort || !["user_name", "page_views", "last_login_at", "last_seen_at"].includes(sort.key)) return;
                setOrderByUsers(sort.key as UserOrderBy);
                setOrderDir(sort.direction);
                setUsersPage(1);
              }}
              emptyIcon={Users}
              emptyMessage="Nenhum usuário encontrado para os filtros aplicados."
              onRowClick={(userRow) => setSelectedUser(userRow)}
            />
          </TabsContent>
        </Tabs>
      </div>

        <Dialog open={!!selectedOrg} onOpenChange={(open) => !open && setSelectedOrg(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedOrg?.org_name || "Organização"}</DialogTitle>
            <DialogDescription>{selectedOrg ? selectedOrg.status_reason : "Carregando detalhes da organização."}</DialogDescription>
          </DialogHeader>
          {selectedOrg ? (
            <div className="space-y-5">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg border border-border/70 bg-secondary/20 p-3">
                  <div className="text-xs text-muted-foreground">Último login</div>
                  <div className="mt-1 text-sm font-medium">{selectedOrg.last_login_at ? formatDateTimeBR(selectedOrg.last_login_at) : "—"}</div>
                </div>
                <div className="rounded-lg border border-border/70 bg-secondary/20 p-3">
                  <div className="text-xs text-muted-foreground">Última atividade</div>
                  <div className="mt-1 text-sm font-medium">{selectedOrg.last_activity_at ? formatDateTimeBR(selectedOrg.last_activity_at) : "—"}</div>
                </div>
                <div className="rounded-lg border border-border/70 bg-secondary/20 p-3">
                  <div className="text-xs text-muted-foreground">Logins</div>
                  <div className="mt-1 text-lg font-semibold">{selectedOrg.logins.toLocaleString("pt-BR")}</div>
                </div>
                <div className="rounded-lg border border-border/70 bg-secondary/20 p-3">
                  <div className="text-xs text-muted-foreground">Páginas visitadas</div>
                  <div className="mt-1 text-lg font-semibold">{selectedOrg.page_views.toLocaleString("pt-BR")}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                <div className="rounded-lg border border-border/70 bg-card p-4">
                  <div className="text-xs text-muted-foreground">Usuários ativos</div>
                  <div className="mt-1 text-xl font-semibold">{selectedOrg.admins_active}</div>
                </div>
                <div className="rounded-lg border border-border/70 bg-card p-4">
                  <div className="text-xs text-muted-foreground">Dias com uso</div>
                  <div className="mt-1 text-xl font-semibold">{selectedOrg.active_days}</div>
                </div>
                <div className="rounded-lg border border-border/70 bg-card p-4">
                  <div className="text-xs text-muted-foreground">Ações registradas</div>
                  <div className="mt-1 text-xl font-semibold">{selectedOrg.actions_count}</div>
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedUser} onOpenChange={(open) => !open && setSelectedUser(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{selectedUser?.user_name || "Usuário"}</DialogTitle>
            <DialogDescription>
              {selectedUser
                ? `${getRoleLabel(selectedUser.primary_role)}${selectedUser.organization_name ? ` • ${selectedUser.organization_name}` : ""}`
                : "Carregando usuário"}
            </DialogDescription>
          </DialogHeader>
          {selectedUser ? (
            <div className="space-y-5">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg border border-border/70 bg-secondary/20 p-3">
                  <div className="text-xs text-muted-foreground">Status</div>
                  <div className="mt-1">
                    <StatusTag variant={getUserActivityStatusVariant(selectedUser.activity_status)}>
                      {getUserActivityStatusLabel(selectedUser.activity_status)}
                    </StatusTag>
                  </div>
                </div>
                <div className="rounded-lg border border-border/70 bg-secondary/20 p-3">
                  <div className="text-xs text-muted-foreground">Primeiro login</div>
                  <div className="mt-1 text-sm font-medium">{selectedUser.first_login_at ? formatDateTimeBR(selectedUser.first_login_at) : "—"}</div>
                </div>
                <div className="rounded-lg border border-border/70 bg-secondary/20 p-3">
                  <div className="text-xs text-muted-foreground">Último login</div>
                  <div className="mt-1 text-sm font-medium">{selectedUser.last_login_at ? formatDateTimeBR(selectedUser.last_login_at) : "—"}</div>
                </div>
                <div className="rounded-lg border border-border/70 bg-secondary/20 p-3">
                  <div className="text-xs text-muted-foreground">Última atividade</div>
                  <div className="mt-1 text-sm font-medium">{selectedUser.last_seen_at ? formatDateTimeBR(selectedUser.last_seen_at) : "—"}</div>
                </div>
              </div>

              <div className="rounded-lg border border-border/70 bg-card p-4">
                <div className="text-sm font-semibold text-card-foreground">Páginas mais acessadas</div>
                <div className="mt-2 text-sm text-muted-foreground">
                  {selectedUser.top_pages.length > 0 ? selectedUser.top_pages.map((page) => getPageLabel(page)).join(" • ") : "Sem navegação registrada no período."}
                </div>
              </div>

              <div className="space-y-3">
                <div className="text-sm font-semibold text-card-foreground">Timeline do usuário</div>
                {(userTimelineQuery.data ?? []).map((event, index) => (
                  <div key={`${event.created_at}:${index}`} className="rounded-lg border border-border/70 bg-secondary/20 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-card-foreground">
                          {event.event_type === "login" ? "Fez login" : `Acessou ${getPageLabel(event.page)}`}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {event.route || "Sem rota registrada"}
                          {event.org_name ? ` • ${event.org_name}` : ""}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground whitespace-nowrap">{formatDateTimeBR(event.created_at)}</div>
                    </div>
                  </div>
                ))}
                {!userTimelineQuery.isLoading && !(userTimelineQuery.data ?? []).length ? (
                  <div className="rounded-lg border border-border/70 bg-secondary/20 p-4 text-sm text-muted-foreground">
                    Nenhum evento do usuário no período selecionado.
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
