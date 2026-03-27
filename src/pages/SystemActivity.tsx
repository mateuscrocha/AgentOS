import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  ArrowRight,
  Building2,
  Clock3,
  MousePointerClick,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  UserX,
  Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useUserRoles } from "@/hooks/use-user-roles";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { AdminPageHeader } from "@/components/layout/AdminPageHeader";
import { ListSectionHeader } from "@/components/dashboard/ListSectionHeader";
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
type OrgStatus = "all" | "engajada" | "ativa" | "morna" | "em_risco" | "abandonada";
type TabKey = "orgs" | "users";

type OrgOrderBy = "last_login_at" | "last_activity_at" | "org_name" | "status" | "logins" | "page_views";
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

function toPercent(numerator: number, denominator: number) {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 100);
}

function getPageLabel(page: string | null) {
  if (page === "dashboard") return "Dashboard geral";
  if (page === "organizacoes") return "Organizações";
  if (page === "grupos") return "Grupos";
  if (page === "membros") return "Membros";
  if (page === "mensagens") return "Mensagens";
  if (page === "suporte") return "Suporte";
  if (page === "eventos") return "Eventos";
  if (page === "enquetes") return "Enquetes";
  if (page === "crm") return "CRM";
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

function getOrgStatusLabel(status: string) {
  if (status === "engajada") return "Engajada";
  if (status === "ativa") return "Ativa";
  if (status === "morna") return "Morna";
  if (status === "em_risco") return "Em risco";
  if (status === "abandonada") return "Abandonada";
  return "Todos";
}

function getOrgStatusVariant(status: string): "success" | "warning" | "neutral" | "error" {
  if (status === "engajada") return "success";
  if (status === "ativa") return "success";
  if (status === "morna") return "warning";
  if (status === "em_risco") return "warning";
  if (status === "abandonada") return "error";
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
  const [orgStatus, setOrgStatus] = useState<OrgStatus>("all");
  const [userStatus, setUserStatus] = useState<UserActivityStatus>("all");
  const [userRole, setUserRole] = useState<UserPrimaryRole>("all");

  const [orgsPage, setOrgsPage] = useState(1);
  const [usersPage, setUsersPage] = useState(1);

  const [orderByOrgs, setOrderByOrgs] = useState<OrgOrderBy>("last_activity_at");
  const [orderByUsers, setOrderByUsers] = useState<UserOrderBy>("last_seen_at");
  const [orgOrderDir, setOrgOrderDir] = useState<"asc" | "desc">("desc");
  const [userOrderDir, setUserOrderDir] = useState<"asc" | "desc">("desc");

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
      orgStatus,
      orderByOrgs,
      orgOrderDir,
      orgsPage,
    ],
    queryFn: async () => {
      const { data, error } = await rpc<OrgIntelligenceRow[]>("system_activity_orgs_intelligence", {
        _start: startISO,
        _end: endISO,
        _search: debouncedSearch || null,
        _status: orgStatus === "all" ? null : orgStatus,
        _days_since_login_min: null,
        _days_since_login_max: null,
        _days_since_activity_min: null,
        _days_since_activity_max: null,
        _score_min: null,
        _score_max: null,
        _order_by: orderByOrgs,
        _order_dir: orgOrderDir,
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
      userOrderDir,
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
        _order_dir: userOrderDir,
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
        description: "Usuários cadastrados que ainda não entraram",
      },
    ];
  }, [kpis]);

  const heroMetrics = useMemo(() => {
    if (!kpis) return null;

    const activeOrgs = toCount(kpis.organizations_with_activity);
    const totalOrgs = toCount(kpis.organizations_total);
    const atRiskOrgs = toCount(kpis.orgs_at_risk);

    return {
      activeOrgs,
      totalOrgs,
      atRiskOrgs,
      adoptionRate: toPercent(activeOrgs, totalOrgs),
      riskRate: toPercent(atRiskOrgs, totalOrgs),
    };
  }, [kpis]);

  const journeySteps = useMemo(() => {
    if (!kpis) return [];

    return [
      {
        key: "first_access_pending",
        title: "Pendentes do 1o acesso",
        value: toCount(kpis.never_logged_in_users),
        tone: "warning" as const,
        description: "Usuários cadastrados que ainda não cruzaram a barreira inicial.",
      },
      {
        key: "active_week",
        title: "Operação ativa 7d",
        value: toCount(kpis.admins_active_7d),
        tone: "success" as const,
        description: "Pessoas operacionais com presença real na última semana.",
      },
      {
        key: "inactive_30d",
        title: "Usuários inativos 30d",
        value: toCount(kpis.users_inactive_30d),
        tone: "neutral" as const,
        description: "Quem já entrou, mas perdeu ritmo de uso.",
      },
      {
        key: "orgs_risk",
        title: "Organizações em risco",
        value: toCount(kpis.orgs_at_risk),
        tone: "error" as const,
        description: "Contas com sinal fraco de retorno ou abandono.",
      },
    ];
  }, [kpis]);

  const pageHighlights = useMemo(() => {
    const pages = topPagesQuery.data ?? [];
    return {
      mostUsed: pages.slice(0, 5),
      leastUsed: [...pages]
        .sort((a, b) => a.page_views - b.page_views || a.admins - b.admins || a.page.localeCompare(b.page, "pt-BR"))
        .slice(0, 5),
    };
  }, [topPagesQuery.data]);

  const orgListStatusLabel = useMemo(() => {
    if (search) return "Busca refinada para contas";
    if (orgStatus !== "all") return `Status: ${getOrgStatusLabel(orgStatus)}`;
    return "Base observada no período";
  }, [orgStatus, search]);

  const userListStatusLabel = useMemo(() => {
    if (search) return "Busca refinada para usuários";
    if (userStatus !== "all") return `Status: ${getUserActivityStatusLabel(userStatus)}`;
    if (userRole !== "all") return `Papel: ${getRoleLabel(userRole)}`;
    return "Base observada no período";
  }, [search, userRole, userStatus]);

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
    if (orgStatus !== "all") items.push({ key: "orgStatus", label: `Orgs: ${getOrgStatusLabel(orgStatus)}`, onRemove: () => setOrgStatus("all") });
    if (userStatus !== "all") items.push({ key: "userStatus", label: `Usuarios: ${getUserActivityStatusLabel(userStatus)}`, onRemove: () => setUserStatus("all") });
    if (userRole !== "all") items.push({ key: "userRole", label: `Papel: ${getRoleLabel(userRole)}`, onRemove: () => setUserRole("all") });
    return items;
  }, [customRange, orgStatus, search, selectedPeriod, userRole, userStatus]);

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

  const focusRiskOrgs = () => {
    setTab("orgs");
    setOrgStatus("em_risco");
    setOrgsPage(1);
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
          <div className="mt-2 flex flex-wrap items-center gap-2 md:hidden">
            <StatusTag variant={getOrgStatusVariant(org.status)}>{getOrgStatusLabel(org.status)}</StatusTag>
            <span className="text-[11px] text-muted-foreground">{org.logins.toLocaleString("pt-BR")} logins</span>
            <span className="text-[11px] text-muted-foreground">{org.page_views.toLocaleString("pt-BR")} páginas</span>
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground md:hidden">
            {org.last_activity_at ? `Última atividade em ${formatDateTimeBR(org.last_activity_at)}` : "Sem atividade recente"}
          </div>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      render: (org: OrgIntelligenceRow) => (
        <StatusTag variant={getOrgStatusVariant(org.status)}>{getOrgStatusLabel(org.status)}</StatusTag>
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
          <div className="mt-2 flex flex-wrap items-center gap-2 md:hidden">
            <StatusTag variant={getUserActivityStatusVariant(userRow.activity_status)}>{getUserActivityStatusLabel(userRow.activity_status)}</StatusTag>
            {userRow.organization_name ? <span className="text-[11px] text-muted-foreground truncate">{userRow.organization_name}</span> : null}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground md:hidden">
            {userRow.last_seen_at ? `Última atividade em ${formatDateTimeBR(userRow.last_seen_at)}` : "Sem atividade recente"}
          </div>
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
    orgStatus !== "all" ||
    userStatus !== "all" ||
    userRole !== "all" ||
    orderByOrgs !== "last_activity_at" ||
    orderByUsers !== "last_seen_at" ||
    orgOrderDir !== "desc" ||
    userOrderDir !== "desc";

  return (
    <AdminLayout title="Atividade" subtitle="Central de Comando › Atividade">
      <div className="mx-auto max-w-[1480px] space-y-8 animate-fade-in">
        <AdminPageHeader
          breadcrumbItems={[{ label: "Central de Comando", href: "/" }, { label: "Atividade" }]}
          title="Comportamento de usuários"
          description="Acompanhe adoção, retorno e risco de uso com foco no que realmente pede ação dentro da administração."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" onClick={focusRiskOrgs}>
                Ver organizações em risco
              </Button>
              <Button onClick={focusNeverLoggedUsers} className="gap-2">
                Ver quem ainda não entrou
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          }
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
            setOrgStatus("all");
            setUserStatus("all");
            setUserRole("all");
            setOrderByOrgs("last_activity_at");
            setOrderByUsers("last_seen_at");
            setOrgOrderDir("desc");
            setUserOrderDir("desc");
            setOrgsPage(1);
            setUsersPage(1);
          }}
        />

        {heroMetrics ? (
          <section className="relative overflow-hidden rounded-[28px] border border-border/70 bg-[linear-gradient(135deg,rgba(255,247,237,0.96)_0%,rgba(255,255,255,0.98)_42%,rgba(255,250,245,0.96)_100%)] p-5 shadow-subtle">
            <div className="absolute inset-y-0 right-0 w-1/3 bg-[radial-gradient(circle_at_top_right,rgba(251,146,60,0.18),transparent_58%)]" />
            <div className="relative grid gap-5 xl:grid-cols-[1.45fr_1fr]">
              <div className="space-y-5">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusTag variant={heroMetrics.riskRate >= 40 ? "error" : heroMetrics.riskRate >= 20 ? "warning" : "success"}>
                    {heroMetrics.riskRate >= 40 ? "Risco alto no portfólio" : heroMetrics.riskRate >= 20 ? "Atenção moderada" : "Base com retorno saudável"}
                  </StatusTag>
                  <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/80 px-3 py-1 text-xs text-muted-foreground">
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                    Leitura orientada por recorrência e risco
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Leitura do período</div>
                  <h3 className="max-w-3xl text-2xl font-semibold tracking-[-0.03em] text-card-foreground sm:text-[2rem] sm:leading-[1.1]">
                    {heroMetrics.activeOrgs.toLocaleString("pt-BR")} de {heroMetrics.totalOrgs.toLocaleString("pt-BR")} organizações deram sinal real de uso no recorte.
                  </h3>
                  <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
                    Esta visão ajuda a separar presença ocasional de uso recorrente, localizar contas em retração e entender quais superfícies realmente puxam a rotina operacional.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-[20px] border border-border/70 bg-background/80 p-4">
                    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                      <TrendingUp className="h-3.5 w-3.5 text-primary" />
                      Cobertura ativa
                    </div>
                    <div className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-card-foreground">{heroMetrics.adoptionRate}%</div>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Percentual da base organizacional com login ou navegação no período.</p>
                  </div>
                  <div className="rounded-[20px] border border-border/70 bg-background/80 p-4">
                    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                      <ShieldAlert className="h-3.5 w-3.5 text-warning" />
                      Exposição a risco
                    </div>
                    <div className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-card-foreground">{heroMetrics.riskRate}%</div>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Participação de contas em risco ou abandonadas dentro da base total.</p>
                  </div>
                  <div className="rounded-[20px] border border-border/70 bg-background/80 p-4">
                    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                      <Clock3 className="h-3.5 w-3.5 text-primary" />
                      Próxima prioridade
                    </div>
                    <div className="mt-2 text-base font-semibold text-card-foreground">
                      {toCount(kpis.never_logged_in_users) > 0 ? "Ativação inicial" : "Retenção operacional"}
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      {toCount(kpis.never_logged_in_users) > 0
                        ? "Existem usuários criados que ainda não completaram o primeiro acesso."
                        : "O foco principal agora é recuperar frequência e aprofundar o uso."}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-2">
                {primaryCards.map((card) => (
                  <div key={card.title} className="rounded-[22px] border border-border/70 bg-background/82 p-4 shadow-[0_1px_0_rgba(255,255,255,0.75)_inset]">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{card.title}</div>
                        <div className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-card-foreground">{card.value.toLocaleString("pt-BR")}</div>
                      </div>
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-primary/15 bg-primary/[0.08]">
                        <card.icon className="h-4 w-4 text-primary" />
                      </div>
                    </div>
                    <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{card.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {journeySteps.length ? (
          <section className="rounded-[24px] border border-border/70 bg-card/95 p-4 shadow-subtle">
            <div className="flex flex-col gap-2 border-b border-border/70 pb-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Jornada operacional</div>
                <h3 className="mt-1 text-base font-semibold tracking-[-0.02em] text-card-foreground sm:text-lg">Da ativação inicial ao risco de retorno</h3>
              </div>
              <p className="max-w-2xl text-xs leading-relaxed text-muted-foreground sm:text-sm">
                Um resumo rápido para entender onde a base trava: entrada, frequência e sinais de abandono.
              </p>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {journeySteps.map((step) => (
                <div key={step.key} className="rounded-[20px] border border-border/70 bg-background/70 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{step.title}</div>
                      <div className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-card-foreground">{step.value.toLocaleString("pt-BR")}</div>
                    </div>
                    <StatusTag variant={step.tone}>
                      {step.tone === "success" ? "Saudável" : step.tone === "warning" ? "Atenção" : step.tone === "error" ? "Crítico" : "Monitorar"}
                    </StatusTag>
                  </div>
                  <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{step.description}</p>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <FilterChips items={activeFilterChips} onClearAll={showClearFilters ? () => {
          setSelectedPeriod("30d");
          setCustomRange(undefined);
          setSearch("");
          setOrgStatus("all");
          setUserStatus("all");
          setUserRole("all");
          setOrderByOrgs("last_activity_at");
          setOrderByUsers("last_seen_at");
          setOrgOrderDir("desc");
          setUserOrderDir("desc");
          setOrgsPage(1);
          setUsersPage(1);
        } : undefined} className="-mt-2" />

        {hasAnyError ? (
          <div className="rounded-[var(--radius-lg)] border border-destructive/30 bg-destructive/5 p-4 shadow-subtle">
          <div className="text-sm font-semibold text-card-foreground">Falha ao carregar parte dos dados</div>
          <div className="text-xs text-muted-foreground mt-1">Verifique sua sessão e tente novamente.</div>
        </div>
      ) : null}

        <section className="space-y-4">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Superfícies de navegação</div>
              <h3 className="mt-1 text-xl font-semibold tracking-[-0.02em] text-card-foreground">Onde a atenção se concentra e onde ela some</h3>
            </div>
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Páginas muito usadas revelam rotina operacional. Páginas pouco acessadas ajudam a localizar áreas escondidas, pouco validadas ou com baixo valor percebido.
            </p>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
          <div className="rounded-[24px] border border-border/70 bg-card/95 p-5 shadow-subtle">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Páginas</div>
                <div className="text-lg font-semibold text-card-foreground">Mais usadas</div>
              </div>
              <MousePointerClick className="h-4 w-4 text-primary" />
            </div>
            <div className="space-y-3">
              {pageHighlights.mostUsed.map((page, index) => (
                <div key={`${page.page}:${index}`} className="rounded-[20px] border border-border/70 bg-secondary/20 p-4 transition-colors hover:bg-secondary/30">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/[0.08] text-[11px] font-semibold text-primary">{index + 1}</div>
                        <div className="text-sm font-semibold text-card-foreground">{getPageLabel(page.page)}</div>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">{page.admins.toLocaleString("pt-BR")} usuários passaram por aqui</div>
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

          <div className="rounded-[24px] border border-border/70 bg-card/95 p-5 shadow-subtle">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Páginas</div>
                <div className="text-lg font-semibold text-card-foreground">Menos usadas</div>
              </div>
              <Activity className="h-4 w-4 text-primary" />
            </div>
            <div className="space-y-3">
              {pageHighlights.leastUsed.map((page, index) => (
                <div key={`${page.page}:least:${index}`} className="rounded-[20px] border border-border/70 bg-secondary/20 p-4 transition-colors hover:bg-secondary/30">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-muted-foreground">{index + 1}</div>
                        <div className="text-sm font-semibold text-card-foreground">{getPageLabel(page.page)}</div>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">{page.admins.toLocaleString("pt-BR")} usuários passaram por aqui</div>
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
          </div>
        </section>

        <Tabs value={tab} onValueChange={(value) => setTab(value as TabKey)} className="space-y-3">
          <TabsList className="h-10 rounded-[var(--radius-lg)] border border-border/70 bg-card/95 p-1 shadow-subtle">
            <TabsTrigger value="orgs">Organizações</TabsTrigger>
            <TabsTrigger value="users">Usuários</TabsTrigger>
          </TabsList>

          <TabsContent value="orgs" className="mt-0 space-y-0">
            <div className="mb-2 flex flex-col gap-1 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Leitura por organização</div>
                <h3 className="mt-1 text-base font-semibold tracking-[-0.02em] text-card-foreground sm:text-lg">Quem voltou, quem esfriou e quem já pede intervenção</h3>
              </div>
              <p className="max-w-2xl text-xs leading-relaxed text-muted-foreground sm:text-sm">
                Use status, último sinal e navegação para separar conta saudável de conta sem recorrência.
              </p>
            </div>
            <div className="mb-3 flex flex-wrap items-center gap-2 rounded-[var(--radius-lg)] border border-border/70 bg-card/95 p-3 shadow-subtle">
              <Select
                value={orgStatus}
                onValueChange={(value) => {
                  setOrgStatus(value as OrgStatus);
                  setOrgsPage(1);
                }}
              >
                <SelectTrigger className="w-[190px]" aria-label="Status das organizações">
                  <SelectValue placeholder="Todos os status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="engajada">Engajadas</SelectItem>
                  <SelectItem value="ativa">Ativas</SelectItem>
                  <SelectItem value="morna">Mornas</SelectItem>
                  <SelectItem value="em_risco">Em risco</SelectItem>
                  <SelectItem value="abandonada">Abandonadas</SelectItem>
                </SelectContent>
              </Select>
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
                value={orgOrderDir}
                onValueChange={(value) => setOrgOrderDir(value as "asc" | "desc")}
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
              title="Contas com sinal de uso"
              count={typeof orgsQuery.data?.total === "number" ? orgsQuery.data.total.toLocaleString("pt-BR") : "—"}
              statusLabel={orgListStatusLabel}
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
              sortState={{ key: orderByOrgs, direction: orgOrderDir }}
              onSortChange={(sort) => {
                if (!sort || !["org_name", "status", "logins", "page_views", "last_login_at", "last_activity_at"].includes(sort.key)) return;
                setOrderByOrgs(sort.key as OrgOrderBy);
                setOrgOrderDir(sort.direction);
                setOrgsPage(1);
              }}
              emptyIcon={Building2}
              emptyMessage="Nenhuma organização encontrada para os filtros aplicados."
            />
          </TabsContent>

          <TabsContent value="users" className="mt-0 space-y-0">
            <div className="mb-2 flex flex-col gap-1 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Leitura por usuário</div>
                <h3 className="mt-1 text-base font-semibold tracking-[-0.02em] text-card-foreground sm:text-lg">Quem está ativo, quem nunca entrou e quem perdeu tração</h3>
              </div>
              <p className="max-w-2xl text-xs leading-relaxed text-muted-foreground sm:text-sm">
                Priorize reativação de inativos e remova atrito de quem ainda não completou o primeiro acesso.
              </p>
            </div>
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
                value={userOrderDir}
                onValueChange={(value) => setUserOrderDir(value as "asc" | "desc")}
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
              title="Usuários e tração de uso"
              count={typeof usersQuery.data?.total === "number" ? usersQuery.data.total.toLocaleString("pt-BR") : "—"}
              statusLabel={userListStatusLabel}
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
              sortState={{ key: orderByUsers, direction: userOrderDir }}
              onSortChange={(sort) => {
                if (!sort || !["user_name", "page_views", "last_login_at", "last_seen_at"].includes(sort.key)) return;
                setOrderByUsers(sort.key as UserOrderBy);
                setUserOrderDir(sort.direction);
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
