import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Building2,
  Flame,
  MousePointerClick,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
  UserMinus,
  UserX,
  Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useUserRoles } from "@/hooks/use-user-roles";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { AdminPageHeader } from "@/components/layout/AdminPageHeader";
import { ExecutiveSectionHeader } from "@/components/dashboard/ExecutiveSectionHeader";
import { ListSectionHeader } from "@/components/dashboard/ListSectionHeader";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { ADMIN_MICROCOPY } from "@/components/dashboard/admin-microcopy";
import { PeriodFilter } from "@/components/group-dashboard/PeriodFilter";
import { BorisTable, RowActions } from "@/components/ui/boris-table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { LoadingState } from "@/components/ui/loading-state";
import { Progress } from "@/components/ui/progress";
import { StatusTag } from "@/components/ui/status-tag";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { getDateRange, type DateRange, type PeriodType } from "@/components/group-dashboard/period-utils";
import { formatDateTickBR, formatDateTimeBR } from "@/lib/date";
import AccessDenied from "./AccessDenied";

type OrgUsageStatus = "engajada" | "ativa" | "morna" | "em_risco" | "abandonada";
type UserActivityStatus = "all" | "active" | "inactive" | "never_logged_in";
type UserPrimaryRole = "all" | "SYSTEM_ADMIN" | "ORG_ADMIN" | "GROUP_MANAGER" | "USER";
type TabKey = "orgs" | "admins" | "users";

type OrgOrderBy = "usage_score" | "last_login_at" | "last_activity_at" | "org_name" | "logins";
type AdminOrderBy = "last_activity_at" | "user_name" | "active_days";
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
  status: OrgUsageStatus;
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

type AdminActivityRow = {
  user_id: string;
  user_name: string | null;
  org_id: string;
  org_name: string;
  last_activity_at: string | null;
  last_login_at: string | null;
  active_days: number;
  top_pages: string[];
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

type DailyMetricsRow = {
  day: string;
  admins_active: number;
  logins: number;
  page_views: number;
};

type DailyOrgStatusRow = {
  day: string;
  orgs_active: number;
  orgs_inactive: number;
};

type TopPageRow = {
  page: string;
  page_views: number;
  admins: number;
};

type TimelineRow = {
  created_at: string;
  actor_name: string;
  org_name: string | null;
  event_kind: string;
  event_label: string;
  route: string | null;
  page: string | null;
};

const PAGE_SIZE = 20;
const TIMELINE_LIMIT = 12;
const ENGAGEMENT_LIMIT = 8;

function rpc<T>(name: string, params: Record<string, unknown>) {
  return (supabase as any).rpc(name, params) as Promise<{ data: T; error: any }>;
}

function toCount(value: unknown) {
  return Number(value ?? 0);
}

function getStatusLabel(status: OrgUsageStatus) {
  if (status === "engajada") return "🔥 Engajada";
  if (status === "ativa") return "🙂 Ativa";
  if (status === "morna") return "😐 Morna";
  if (status === "em_risco") return "⚠️ Em risco";
  return "❄️ Abandonada";
}

function getStatusVariant(status: OrgUsageStatus): "success" | "warning" | "error" | "neutral" {
  if (status === "engajada" || status === "ativa") return "success";
  if (status === "morna") return "warning";
  if (status === "em_risco") return "error";
  return "neutral";
}

function getPageLabel(page: string | null) {
  if (page === "dashboard") return "Dashboard geral";
  if (page === "grupos") return "Grupos";
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

function getTrendMeta(current: number, previous: number) {
  const delta = current - previous;
  if (!previous && !current) {
    return { label: "Sem variação", type: "neutral" as const, icon: Activity };
  }
  if (!previous) {
    return { label: `+${current}`, type: "positive" as const, icon: TrendingUp };
  }
  const pct = Math.round((Math.abs(delta) / Math.max(previous, 1)) * 100);
  if (delta > 0) return { label: `+${pct}%`, type: "positive" as const, icon: TrendingUp };
  if (delta < 0) return { label: `-${pct}%`, type: "negative" as const, icon: TrendingDown };
  return { label: "Estável", type: "neutral" as const, icon: Activity };
}

function buildComparisonSeries<T extends Record<string, any>>(
  current: T[],
  previous: T[],
  keys: string[],
) {
  const size = Math.max(current.length, previous.length);
  return Array.from({ length: size }).map((_, index) => {
    const curr = current[index] ?? {};
    const prev = previous[index] ?? {};
    const label = curr.day ? formatDateTickBR(curr.day) : prev.day ? formatDateTickBR(prev.day) : `${index + 1}`;
    return keys.reduce<Record<string, any>>(
      (acc, key) => {
        acc[key] = Number(curr[key] ?? 0);
        acc[`previous_${key}`] = Number(prev[key] ?? 0);
        return acc;
      },
      { label },
    );
  });
}

function getScoreBand(scoreFilter: string) {
  if (scoreFilter === "0-25") return { min: 0, max: 25 };
  if (scoreFilter === "26-50") return { min: 26, max: 50 };
  if (scoreFilter === "51-75") return { min: 51, max: 75 };
  if (scoreFilter === "76-100") return { min: 76, max: 100 };
  return { min: null as number | null, max: null as number | null };
}

function getLoginBand(daysFilter: string) {
  if (daysFilter === "0-7") return { min: 0, max: 7 };
  if (daysFilter === "8-30") return { min: 8, max: 30 };
  if (daysFilter === "31+") return { min: 31, max: null as number | null };
  if (daysFilter === "never") return { min: null as number | null, max: null as number | null };
  return { min: null as number | null, max: null as number | null };
}

function getActivityBand(activityFilter: string) {
  if (activityFilter === "0-3") return { min: 0, max: 3 };
  if (activityFilter === "0-7") return { min: 0, max: 7 };
  if (activityFilter === "0-30") return { min: 0, max: 30 };
  if (activityFilter === "31+") return { min: 31, max: null as number | null };
  return { min: null as number | null, max: null as number | null };
}

function buildInsightLines(kpis: KpiRow | null, topOrg: OrgIntelligenceRow | null, topPage: TopPageRow | null) {
  if (!kpis) return [];
  const insights = [
    `${toCount(kpis.never_logged_in_users).toLocaleString("pt-BR")} usuários nunca logaram.`,
    `${toCount(kpis.orgs_at_risk).toLocaleString("pt-BR")} organizações estão em risco de abandono.`,
  ];

  if (topOrg) {
    insights.push(`${topOrg.org_name} é a organização mais ativa no período com score ${topOrg.usage_score}%.`);
  }

  if (topPage) {
    insights.push(`${getPageLabel(topPage.page)} é a funcionalidade mais usada no período.`);
  }

  return insights.slice(0, 4);
}

export default function SystemActivity() {
  const navigate = useNavigate();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { isSystemAdmin, isLoading: rolesLoading } = useUserRoles();

  const [tab, setTab] = useState<TabKey>("orgs");
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>("30d");
  const [customRange, setCustomRange] = useState<DateRange | undefined>();
  const [selectedUser, setSelectedUser] = useState<UserActivityRow | null>(null);
  const [selectedOrg, setSelectedOrg] = useState<OrgIntelligenceRow | null>(null);
  const [selectedOrgForAdmins, setSelectedOrgForAdmins] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const [orgStatus, setOrgStatus] = useState<"all" | OrgUsageStatus>("all");
  const [lastActivityFilter, setLastActivityFilter] = useState<"all" | "0-3" | "0-7" | "0-30" | "31+">("all");
  const [daysWithoutLoginFilter, setDaysWithoutLoginFilter] = useState<"all" | "0-7" | "8-30" | "31+" | "never">("all");
  const [scoreFilter, setScoreFilter] = useState<"all" | "0-25" | "26-50" | "51-75" | "76-100">("all");
  const [userStatus, setUserStatus] = useState<UserActivityStatus>("all");
  const [userRole, setUserRole] = useState<UserPrimaryRole>("all");

  const [orgsPage, setOrgsPage] = useState(1);
  const [adminsPage, setAdminsPage] = useState(1);
  const [usersPage, setUsersPage] = useState(1);

  const [orderByOrgs, setOrderByOrgs] = useState<OrgOrderBy>("usage_score");
  const [orderByAdmins, setOrderByAdmins] = useState<AdminOrderBy>("last_activity_at");
  const [orderByUsers, setOrderByUsers] = useState<UserOrderBy>("last_seen_at");
  const [orderDir, setOrderDir] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  const currentRange = useMemo(() => getDateRange(selectedPeriod, customRange), [selectedPeriod, customRange]);
  const previousRange = useMemo(() => {
    const duration = currentRange.to.getTime() - currentRange.from.getTime();
    const prevEnd = new Date(currentRange.from.getTime() - 1);
    const prevStart = new Date(prevEnd.getTime() - duration);
    return { from: prevStart, to: prevEnd };
  }, [currentRange.from, currentRange.to]);

  const startISO = currentRange.from.toISOString();
  const endISO = currentRange.to.toISOString();
  const previousStartISO = previousRange.from.toISOString();
  const previousEndISO = previousRange.to.toISOString();
  const todayStart = useMemo(() => {
    const d = new Date(currentRange.to);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }, [currentRange.to]);

  const scoreBand = useMemo(() => getScoreBand(scoreFilter), [scoreFilter]);
  const loginBand = useMemo(() => getLoginBand(daysWithoutLoginFilter), [daysWithoutLoginFilter]);
  const activityBand = useMemo(() => getActivityBand(lastActivityFilter), [lastActivityFilter]);

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

  const previousKpiQuery = useQuery({
    queryKey: ["system-activity-kpis-v2-previous", previousStartISO, previousEndISO, previousStartISO],
    queryFn: async () => {
      const { data, error } = await rpc<KpiRow[]>("system_activity_kpis", {
        _start: previousStartISO,
        _end: previousEndISO,
        _today_start: previousStartISO,
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
      lastActivityFilter,
      daysWithoutLoginFilter,
      scoreFilter,
      orderByOrgs,
      orderDir,
      orgsPage,
    ],
    queryFn: async () => {
      const { data, error } = await rpc<OrgIntelligenceRow[]>("system_activity_orgs_intelligence", {
        _start: startISO,
        _end: endISO,
        _search: debouncedSearch || null,
        _status: orgStatus === "all" ? null : orgStatus,
        _days_since_login_min: daysWithoutLoginFilter === "never" ? null : loginBand.min,
        _days_since_login_max: daysWithoutLoginFilter === "never" ? -1 : loginBand.max,
        _days_since_activity_min: activityBand.min,
        _days_since_activity_max: activityBand.max,
        _score_min: scoreBand.min,
        _score_max: scoreBand.max,
        _order_by: orderByOrgs,
        _order_dir: orderDir,
        _limit: PAGE_SIZE,
        _offset: (orgsPage - 1) * PAGE_SIZE,
      });
      if (error) throw error;
      const filteredData = daysWithoutLoginFilter === "never"
        ? (data ?? []).filter((item) => item.last_login_at == null)
        : (data ?? []);
      const total = filteredData[0]?.total_count ?? 0;
      return { items: filteredData, total };
    },
    enabled: isAuthenticated && isSystemAdmin,
  });

  const orgRankingQuery = useQuery({
    queryKey: ["system-activity-org-ranking", startISO, endISO],
    queryFn: async () => {
      const { data, error } = await rpc<OrgIntelligenceRow[]>("system_activity_orgs_intelligence", {
        _start: startISO,
        _end: endISO,
        _order_by: "usage_score",
        _order_dir: "desc",
        _limit: ENGAGEMENT_LIMIT,
        _offset: 0,
      });
      if (error) throw error;
      return data ?? [];
    },
    enabled: isAuthenticated && isSystemAdmin,
  });

  const adminsQuery = useQuery({
    queryKey: ["system-activity-admins-v2", startISO, endISO, debouncedSearch, orderByAdmins, orderDir, adminsPage, selectedOrgForAdmins],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("activity_org_admins", {
        _start: startISO,
        _end: endISO,
        _org_id: selectedOrgForAdmins,
        _search: debouncedSearch || null,
        _order_by: orderByAdmins,
        _order_dir: orderDir,
        _limit: PAGE_SIZE,
        _offset: (adminsPage - 1) * PAGE_SIZE,
      });
      if (error) throw error;
      const total = data?.[0]?.total_count ?? 0;
      return { items: (data ?? []) as AdminActivityRow[], total };
    },
    retry: false,
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
        _limit: 8,
      });
      if (error) throw error;
      return (data ?? []) as TopPageRow[];
    },
    enabled: isAuthenticated && isSystemAdmin,
  });

  const dailyMetricsQuery = useQuery({
    queryKey: ["system-activity-daily-metrics", startISO, endISO],
    queryFn: async () => {
      const { data, error } = await rpc<DailyMetricsRow[]>("system_activity_daily_metrics", {
        _start: startISO,
        _end: endISO,
      });
      if (error) throw error;
      return data ?? [];
    },
    enabled: isAuthenticated && isSystemAdmin,
  });

  const previousDailyMetricsQuery = useQuery({
    queryKey: ["system-activity-daily-metrics-previous", previousStartISO, previousEndISO],
    queryFn: async () => {
      const { data, error } = await rpc<DailyMetricsRow[]>("system_activity_daily_metrics", {
        _start: previousStartISO,
        _end: previousEndISO,
      });
      if (error) throw error;
      return data ?? [];
    },
    enabled: isAuthenticated && isSystemAdmin,
  });

  const dailyOrgStatusQuery = useQuery({
    queryKey: ["system-activity-daily-org-status", startISO, endISO],
    queryFn: async () => {
      const { data, error } = await rpc<DailyOrgStatusRow[]>("system_activity_daily_org_status", {
        _start: startISO,
        _end: endISO,
      });
      if (error) throw error;
      return data ?? [];
    },
    enabled: isAuthenticated && isSystemAdmin,
  });

  const timelineQuery = useQuery({
    queryKey: ["system-activity-recent-timeline", startISO, endISO],
    queryFn: async () => {
      const { data, error } = await rpc<TimelineRow[]>("system_activity_recent_timeline", {
        _start: startISO,
        _end: endISO,
        _limit: TIMELINE_LIMIT,
      });
      if (error) throw error;
      return data ?? [];
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

  const selectedOrgAdminsQuery = useQuery({
    queryKey: ["system-activity-org-detail-admins", selectedOrg?.org_id, startISO, endISO],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("activity_org_admins", {
        _start: startISO,
        _end: endISO,
        _org_id: selectedOrg!.org_id,
        _limit: 8,
        _offset: 0,
        _order_by: "last_activity_at",
        _order_dir: "desc",
      });
      if (error) throw error;
      return (data ?? []) as AdminActivityRow[];
    },
    enabled: isAuthenticated && isSystemAdmin && !!selectedOrg?.org_id,
  });

  const hasAnyError = [
    kpiQuery.error,
    previousKpiQuery.error,
    orgsQuery.error,
    topPagesQuery.error,
    dailyMetricsQuery.error,
    dailyOrgStatusQuery.error,
    timelineQuery.error,
  ].some(Boolean);

  const kpis = kpiQuery.data;
  const previousKpis = previousKpiQuery.data;
  const topOrg = orgRankingQuery.data?.[0] ?? null;
  const topPage = topPagesQuery.data?.[0] ?? null;

  const headlineCards = useMemo(() => {
    if (!kpis) return [];
    const previous = previousKpis ?? ({} as KpiRow);
    return [
      {
        title: "Organizações",
        value: toCount(kpis.organizations_total),
        trend: getTrendMeta(toCount(kpis.organizations_total), toCount(previous.organizations_total)),
        icon: Building2,
        description: "Base total",
      },
      {
        title: "Organizações com atividade",
        value: toCount(kpis.organizations_with_activity),
        trend: getTrendMeta(toCount(kpis.organizations_with_activity), toCount(previous.organizations_with_activity)),
        icon: Flame,
        description: "Com uso no período",
      },
      {
        title: "Admins ativos",
        value: toCount(kpis.admins_active),
        trend: getTrendMeta(toCount(kpis.admins_active), toCount(previous.admins_active)),
        icon: Users,
        description: "No período filtrado",
      },
      {
        title: "Logins",
        value: toCount(kpis.logins),
        trend: getTrendMeta(toCount(kpis.logins), toCount(previous.logins)),
        icon: Activity,
        description: "Acessos registrados",
      },
      {
        title: "Visualizações de página",
        value: toCount(kpis.page_views),
        trend: getTrendMeta(toCount(kpis.page_views), toCount(previous.page_views)),
        icon: MousePointerClick,
        description: "Navegação registrada",
      },
      {
        title: "Usuários que nunca logaram",
        value: toCount(kpis.never_logged_in_users),
        trend: getTrendMeta(toCount(kpis.never_logged_in_users), toCount(previous.never_logged_in_users)),
        icon: UserX,
        description: "Contas sem ativação",
      },
      {
        title: "Admins ativos hoje",
        value: toCount(kpis.admins_active_today),
        trend: getTrendMeta(toCount(kpis.admins_active_today), toCount(previous.admins_active_today)),
        icon: Activity,
        description: "Últimas 24h",
      },
      {
        title: "Admins ativos nos últimos 7 dias",
        value: toCount(kpis.admins_active_7d),
        trend: getTrendMeta(toCount(kpis.admins_active_7d), toCount(previous.admins_active_7d)),
        icon: TrendingUp,
        description: "Recorrência semanal",
      },
      {
        title: "Usuários inativos há 30 dias",
        value: toCount(kpis.users_inactive_30d),
        trend: getTrendMeta(toCount(kpis.users_inactive_30d), toCount(previous.users_inactive_30d)),
        icon: UserMinus,
        description: "Risco de churn",
      },
      {
        title: "Organizações em risco",
        value: toCount(kpis.orgs_at_risk),
        trend: getTrendMeta(toCount(kpis.orgs_at_risk), toCount(previous.orgs_at_risk)),
        icon: ShieldAlert,
        description: "Sem login recente",
      },
    ];
  }, [kpis, previousKpis]);

  const featureUsageData = useMemo(
    () =>
      (topPagesQuery.data ?? []).map((item, index) => ({
        ...item,
        label: getPageLabel(item.page),
        fill: index === 0 ? "hsl(var(--primary))" : "hsl(var(--primary) / 0.65)",
      })),
    [topPagesQuery.data],
  );

  const orgEngagementData = useMemo(
    () =>
      (orgRankingQuery.data ?? []).map((item, index) => ({
        ...item,
        label: item.org_name,
        fill: index === 0 ? "hsl(var(--warning))" : "hsl(var(--primary) / 0.75)",
      })),
    [orgRankingQuery.data],
  );

  const dailyUsageChartData = useMemo(
    () => buildComparisonSeries(dailyMetricsQuery.data ?? [], previousDailyMetricsQuery.data ?? [], ["admins_active", "logins"]),
    [dailyMetricsQuery.data, previousDailyMetricsQuery.data],
  );

  const dailyLoginChartData = useMemo(
    () => buildComparisonSeries(dailyMetricsQuery.data ?? [], previousDailyMetricsQuery.data ?? [], ["logins", "page_views"]),
    [dailyMetricsQuery.data, previousDailyMetricsQuery.data],
  );

  const orgStatusTrendData = useMemo(
    () => (dailyOrgStatusQuery.data ?? []).map((item) => ({ label: formatDateTickBR(item.day), ...item })),
    [dailyOrgStatusQuery.data],
  );

  const insights = useMemo(() => buildInsightLines(kpis ?? null, topOrg, topPage), [kpis, topOrg, topPage]);

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

  const orgColumns = [
    {
      key: "org_name",
      header: "Organização",
      render: (org: OrgIntelligenceRow) => (
        <div className="min-w-0">
          <div className="font-semibold text-card-foreground truncate">{org.org_name}</div>
          <div className="text-xs text-muted-foreground truncate">{org.org_id}</div>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (org: OrgIntelligenceRow) => (
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <StatusTag variant={getStatusVariant(org.status)}>{getStatusLabel(org.status)}</StatusTag>
            </span>
          </TooltipTrigger>
          <TooltipContent>{org.status_reason}</TooltipContent>
        </Tooltip>
      ),
    },
    {
      key: "admins_active",
      header: "Admins",
      hideOn: "sm",
      render: (org: OrgIntelligenceRow) => <span className="tabular-nums font-semibold">{org.admins_active}</span>,
    },
    {
      key: "active_days",
      header: "Dias ativos",
      hideOn: "sm",
      render: (org: OrgIntelligenceRow) => <span className="tabular-nums">{org.active_days}</span>,
    },
    {
      key: "usage_score",
      header: "Score de uso",
      render: (org: OrgIntelligenceRow) => (
        <div className="w-32 space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{org.usage_score}%</span>
            <span>{org.logins} logins</span>
          </div>
          <Progress value={org.usage_score} className="h-2.5" />
        </div>
      ),
    },
    {
      key: "last_login_at",
      header: "Último login",
      hideOn: "md",
      render: (org: OrgIntelligenceRow) => (org.last_login_at ? <span className="text-xs text-muted-foreground">{formatDateTimeBR(org.last_login_at)}</span> : "—"),
    },
    {
      key: "last_activity_at",
      header: "Última atividade",
      hideOn: "md",
      render: (org: OrgIntelligenceRow) => (org.last_activity_at ? <span className="text-xs text-muted-foreground">{formatDateTimeBR(org.last_activity_at)}</span> : "—"),
    },
    {
      key: "actions",
      header: "Ações",
      render: (org: OrgIntelligenceRow) => (
        <RowActions>
          <DropdownMenuItem onSelect={() => setSelectedOrg(org)}>Ver atividade</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => navigate(`/organization/${org.org_id}`)}>Abrir organização</DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              setSelectedOrgForAdmins(org.org_id);
              setTab("admins");
              setAdminsPage(1);
            }}
          >
            Ver admins
          </DropdownMenuItem>
        </RowActions>
      ),
    },
  ];

  const adminColumns = [
    {
      key: "user_name",
      header: "Gestor",
      render: (admin: AdminActivityRow) => (
        <div className="min-w-0">
          <div className="font-semibold text-card-foreground truncate">{admin.user_name || "—"}</div>
          <div className="text-xs text-muted-foreground truncate">{admin.user_id}</div>
        </div>
      ),
    },
    {
      key: "org_name",
      header: "Organização",
      hideOn: "sm",
      render: (admin: AdminActivityRow) => <span className="text-sm text-muted-foreground">{admin.org_name}</span>,
    },
    {
      key: "active_days",
      header: "Dias ativos",
      hideOn: "sm",
      render: (admin: AdminActivityRow) => <span className="tabular-nums">{admin.active_days}</span>,
    },
    {
      key: "top_pages",
      header: "Top funcionalidades",
      hideOn: "md",
      render: (admin: AdminActivityRow) => (
        <span className="text-xs text-muted-foreground">
          {(admin.top_pages ?? []).length ? admin.top_pages.map((page) => getPageLabel(page)).join(" • ") : "—"}
        </span>
      ),
    },
    {
      key: "last_login_at",
      header: "Último login",
      hideOn: "md",
      render: (admin: AdminActivityRow) => (admin.last_login_at ? <span className="text-xs text-muted-foreground">{formatDateTimeBR(admin.last_login_at)}</span> : "—"),
    },
    {
      key: "last_activity_at",
      header: "Última atividade",
      hideOn: "md",
      render: (admin: AdminActivityRow) => (admin.last_activity_at ? <span className="text-xs text-muted-foreground">{formatDateTimeBR(admin.last_activity_at)}</span> : "—"),
    },
  ];

  const userColumns = [
    {
      key: "user_name",
      header: "Usuário",
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
      key: "page_views",
      header: "Page views",
      hideOn: "md",
      render: (userRow: UserActivityRow) => <span className="tabular-nums">{userRow.page_views.toLocaleString("pt-BR")}</span>,
    },
    {
      key: "last_login_at",
      header: "Último login",
      hideOn: "md",
      render: (userRow: UserActivityRow) => (userRow.last_login_at ? <span className="text-xs text-muted-foreground">{formatDateTimeBR(userRow.last_login_at)}</span> : "—"),
    },
    {
      key: "last_seen_at",
      header: "Última atividade",
      hideOn: "md",
      render: (userRow: UserActivityRow) => (userRow.last_seen_at ? <span className="text-xs text-muted-foreground">{formatDateTimeBR(userRow.last_seen_at)}</span> : "—"),
    },
  ];

  const showClearFilters =
    selectedPeriod !== "30d" ||
    !!customRange ||
    !!search ||
    orgStatus !== "all" ||
    lastActivityFilter !== "all" ||
    daysWithoutLoginFilter !== "all" ||
    scoreFilter !== "all" ||
    userStatus !== "all" ||
    userRole !== "all" ||
    orderByOrgs !== "usage_score" ||
    orderByAdmins !== "last_activity_at" ||
    orderByUsers !== "last_seen_at" ||
    orderDir !== "desc" ||
    !!selectedOrgForAdmins;

  return (
    <AdminLayout title="Atividade" subtitle="Central de Comando › Atividade">
      <div className="space-y-8 animate-fade-in">
        <AdminPageHeader
          breadcrumbItems={[{ label: "Central de Comando", href: "/" }, { label: "Atividade" }]}
          title="Product Usage Dashboard"
          description="Painel de inteligência de uso para adoção, engajamento e risco de churn."
          filters={
            <div className="flex flex-wrap items-center gap-2">
              <PeriodFilter
                value={selectedPeriod}
                customRange={customRange}
                onChange={(period, range) => {
                  setSelectedPeriod(period);
                  setCustomRange(period === "custom" ? range : undefined);
                  setOrgsPage(1);
                  setAdminsPage(1);
                  setUsersPage(1);
                }}
              />
              <select
                value={orgStatus}
                onChange={(e) => {
                  setOrgStatus(e.target.value as "all" | OrgUsageStatus);
                  setOrgsPage(1);
                }}
                className="px-3 py-2 rounded-lg border border-border bg-card text-sm"
                aria-label="Status da organização"
              >
                <option value="all">Todas</option>
                <option value="engajada">Engajadas</option>
                <option value="ativa">Ativas</option>
                <option value="morna">Mornas</option>
                <option value="em_risco">Em risco</option>
                <option value="abandonada">Abandonadas</option>
              </select>
              <select
                value={lastActivityFilter}
                onChange={(e) => {
                  setLastActivityFilter(e.target.value as any);
                  setOrgsPage(1);
                }}
                className="px-3 py-2 rounded-lg border border-border bg-card text-sm"
                aria-label="Última atividade"
              >
                <option value="all">Última atividade</option>
                <option value="0-3">Até 3 dias</option>
                <option value="0-7">Até 7 dias</option>
                <option value="0-30">Até 30 dias</option>
                <option value="31+">Mais de 30 dias</option>
              </select>
              <select
                value={daysWithoutLoginFilter}
                onChange={(e) => {
                  setDaysWithoutLoginFilter(e.target.value as any);
                  setOrgsPage(1);
                }}
                className="px-3 py-2 rounded-lg border border-border bg-card text-sm"
                aria-label="Dias sem login"
              >
                <option value="all">Dias sem login</option>
                <option value="0-7">0 a 7 dias</option>
                <option value="8-30">8 a 30 dias</option>
                <option value="31+">Mais de 30 dias</option>
                <option value="never">Nunca logou</option>
              </select>
              <select
                value={scoreFilter}
                onChange={(e) => {
                  setScoreFilter(e.target.value as any);
                  setOrgsPage(1);
                }}
                className="px-3 py-2 rounded-lg border border-border bg-card text-sm"
                aria-label="Score de uso"
              >
                <option value="all">Score de uso</option>
                <option value="76-100">76 a 100</option>
                <option value="51-75">51 a 75</option>
                <option value="26-50">26 a 50</option>
                <option value="0-25">0 a 25</option>
              </select>
              <select
                value={tab === "orgs" ? orderByOrgs : tab === "admins" ? orderByAdmins : orderByUsers}
                onChange={(e) => {
                  if (tab === "orgs") setOrderByOrgs(e.target.value as OrgOrderBy);
                  if (tab === "admins") setOrderByAdmins(e.target.value as AdminOrderBy);
                  if (tab === "users") setOrderByUsers(e.target.value as UserOrderBy);
                }}
                className="px-3 py-2 rounded-lg border border-border bg-card text-sm"
                aria-label="Ordenação"
              >
                {tab === "orgs" ? (
                  <>
                    <option value="usage_score">Ordenar: score de uso</option>
                    <option value="last_login_at">Ordenar: último login</option>
                    <option value="last_activity_at">Ordenar: última atividade</option>
                    <option value="org_name">Ordenar: organização</option>
                    <option value="logins">Ordenar: logins</option>
                  </>
                ) : tab === "admins" ? (
                  <>
                    <option value="last_activity_at">Ordenar: última atividade</option>
                    <option value="user_name">Ordenar: gestor</option>
                    <option value="active_days">Ordenar: dias ativos</option>
                  </>
                ) : (
                  <>
                    <option value="last_seen_at">Ordenar: última atividade</option>
                    <option value="last_login_at">Ordenar: último login</option>
                    <option value="user_name">Ordenar: usuário</option>
                    <option value="page_views">Ordenar: page views</option>
                  </>
                )}
              </select>
              <select
                value={orderDir}
                onChange={(e) => setOrderDir(e.target.value as "asc" | "desc")}
                className="px-3 py-2 rounded-lg border border-border bg-card text-sm"
                aria-label="Direção da ordenação"
              >
                <option value="desc">Direção: desc</option>
                <option value="asc">Direção: asc</option>
              </select>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por organização, gestor ou usuário"
                className="w-72 px-3 py-2 rounded-lg border border-border bg-card text-sm"
              />
            </div>
          }
          showClearFilters={showClearFilters}
          onClearFilters={() => {
            setSelectedPeriod("30d");
            setCustomRange(undefined);
            setSearch("");
            setOrgStatus("all");
            setLastActivityFilter("all");
            setDaysWithoutLoginFilter("all");
            setScoreFilter("all");
            setUserStatus("all");
            setUserRole("all");
            setSelectedOrgForAdmins(null);
            setOrderByOrgs("usage_score");
            setOrderByAdmins("last_activity_at");
            setOrderByUsers("last_seen_at");
            setOrderDir("desc");
            setOrgsPage(1);
            setAdminsPage(1);
            setUsersPage(1);
          }}
          generalKpis={
            headlineCards.length ? (
              <>
                {headlineCards.map((card) => {
                  const TrendIcon = card.trend.icon;
                  return (
                    <StatsCard
                      key={card.title}
                      title={card.title}
                      value={card.value.toLocaleString("pt-BR")}
                      change={`${card.trend.label} `}
                      changeType={card.trend.type}
                      description={card.description}
                      icon={card.icon}
                      variant="kpi"
                      numericValue
                      help={{
                        whatIs: card.description,
                        howToInterpret: "Ajuda a entender adoção, frequência e risco do uso do produto.",
                        whatToObserve: "Leia em conjunto com tendências, score de uso e organizações em risco.",
                      }}
                      valueClassName="font-mono"
                      titleClassName="max-w-[13ch]"
                    />
                  );
                })}
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

        <section className="rounded-xl border border-border/70 bg-card p-5">
          <ExecutiveSectionHeader
            eyebrow="Insights do sistema"
            title="Leituras automáticas"
            description="Resumo rápido das principais conclusões de adoção e risco no período."
            icon={AlertTriangle}
            className="mb-4"
          />
          <div className="grid gap-3 lg:grid-cols-2">
            {insights.map((insight, index) => (
              <div key={index} className="rounded-lg border border-border/70 bg-secondary/20 p-4 text-sm text-card-foreground">
                {insight}
              </div>
            ))}
          </div>
        </section>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <section className="rounded-xl border border-border/70 bg-card p-5">
            <ExecutiveSectionHeader
              eyebrow="Tendência"
              title="Admins ativos por dia"
              description="Comparação do período atual com a janela imediatamente anterior."
              icon={Users}
              className="mb-4"
            />
            <div className="h-[260px]">
              <ChartContainer
                config={{
                  admins_active: { label: "Atual", color: "hsl(var(--primary))" },
                  previous_admins_active: { label: "Período anterior", color: "hsl(var(--muted-foreground))" },
                }}
                className="h-full w-full"
              >
                <LineChart data={dailyUsageChartData}>
                  <CartesianGrid stroke="hsl(var(--border))" strokeOpacity={0.2} vertical={false} />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} />
                  <YAxis axisLine={false} tickLine={false} width={28} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line type="monotone" dataKey="admins_active" stroke="var(--color-admins_active)" strokeWidth={2.5} dot={false} />
                  <Line type="monotone" dataKey="previous_admins_active" stroke="var(--color-previous_admins_active)" strokeDasharray="5 4" strokeWidth={2} dot={false} />
                </LineChart>
              </ChartContainer>
            </div>
          </section>

          <section className="rounded-xl border border-border/70 bg-card p-5">
            <ExecutiveSectionHeader
              eyebrow="Tendência"
              title="Logins por dia"
              description="Leitura do ritmo de acesso com comparação da semana anterior."
              icon={Activity}
              className="mb-4"
            />
            <div className="h-[260px]">
              <ChartContainer
                config={{
                  logins: { label: "Logins", color: "hsl(var(--warning))" },
                  previous_logins: { label: "Período anterior", color: "hsl(var(--muted-foreground))" },
                  page_views: { label: "Page views", color: "hsl(var(--primary))" },
                }}
                className="h-full w-full"
              >
                <LineChart data={dailyLoginChartData}>
                  <CartesianGrid stroke="hsl(var(--border))" strokeOpacity={0.2} vertical={false} />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} />
                  <YAxis axisLine={false} tickLine={false} width={28} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line type="monotone" dataKey="logins" stroke="var(--color-logins)" strokeWidth={2.5} dot={false} />
                  <Line type="monotone" dataKey="previous_logins" stroke="var(--color-previous_logins)" strokeDasharray="5 4" strokeWidth={2} dot={false} />
                </LineChart>
              </ChartContainer>
            </div>
          </section>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <section className="rounded-xl border border-border/70 bg-card p-5">
            <ExecutiveSectionHeader
              eyebrow="Analytics"
              title="Funcionalidades mais usadas"
              description="Ranking das áreas mais acessadas do produto."
              icon={BarChart3}
              className="mb-4"
            />
            <div className="h-[320px]">
              <ChartContainer
                config={{ page_views: { label: "Page views", color: "hsl(var(--primary))" } }}
                className="h-full w-full"
              >
                <BarChart data={featureUsageData} layout="vertical" margin={{ left: 24 }}>
                  <CartesianGrid stroke="hsl(var(--border))" strokeOpacity={0.15} horizontal={false} />
                  <XAxis type="number" axisLine={false} tickLine={false} />
                  <YAxis dataKey="label" type="category" width={120} axisLine={false} tickLine={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="page_views" radius={[0, 8, 8, 0]}>
                    {featureUsageData.map((entry) => (
                      <Cell key={entry.page} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            </div>
          </section>

          <section className="rounded-xl border border-border/70 bg-card p-5">
            <ExecutiveSectionHeader
              eyebrow="Ranking"
              title="Engajamento por organização"
              description="Top organizações mais ativas considerando logins, uso e ações."
              icon={Flame}
              className="mb-4"
            />
            <div className="h-[320px]">
              <ChartContainer
                config={{
                  usage_score: { label: "Score", color: "hsl(var(--warning))" },
                  logins: { label: "Logins", color: "hsl(var(--primary))" },
                }}
                className="h-full w-full"
              >
                <BarChart data={orgEngagementData} layout="vertical" margin={{ left: 32 }}>
                  <CartesianGrid stroke="hsl(var(--border))" strokeOpacity={0.15} horizontal={false} />
                  <XAxis type="number" axisLine={false} tickLine={false} />
                  <YAxis dataKey="label" type="category" width={140} axisLine={false} tickLine={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Legend />
                  <Bar dataKey="usage_score" radius={[0, 8, 8, 0]} fill="var(--color-usage_score)" />
                  <Bar dataKey="logins" radius={[0, 8, 8, 0]} fill="var(--color-logins)" />
                </BarChart>
              </ChartContainer>
            </div>
          </section>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <section className="rounded-xl border border-border/70 bg-card p-5">
            <ExecutiveSectionHeader
              eyebrow="Saúde da base"
              title="Organizações ativas vs inativas"
              description="Variação diária entre organizações com sinal de uso e organizações sem sinal."
              icon={ShieldAlert}
              className="mb-4"
            />
            <div className="h-[280px]">
              <ChartContainer
                config={{
                  orgs_active: { label: "Ativas", color: "hsl(var(--primary))" },
                  orgs_inactive: { label: "Inativas", color: "hsl(var(--destructive))" },
                }}
                className="h-full w-full"
              >
                <AreaChart data={orgStatusTrendData}>
                  <CartesianGrid stroke="hsl(var(--border))" strokeOpacity={0.2} vertical={false} />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} />
                  <YAxis axisLine={false} tickLine={false} width={28} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Area type="monotone" dataKey="orgs_active" stroke="var(--color-orgs_active)" fill="var(--color-orgs_active)" fillOpacity={0.22} />
                  <Area type="monotone" dataKey="orgs_inactive" stroke="var(--color-orgs_inactive)" fill="var(--color-orgs_inactive)" fillOpacity={0.12} />
                </AreaChart>
              </ChartContainer>
            </div>
          </section>

          <section className="rounded-xl border border-border/70 bg-card p-5">
            <ExecutiveSectionHeader
              eyebrow="Timeline"
              title="Atividade recente"
              description="Eventos recentes de login, navegação e alterações operacionais."
              icon={Activity}
              className="mb-4"
            />
            <div className="space-y-3">
              {(timelineQuery.data ?? []).map((event, index) => (
                <div key={`${event.created_at}:${index}`} className="rounded-lg border border-border/70 bg-secondary/20 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-card-foreground">
                        {event.actor_name} {event.event_label}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {event.org_name ? `${event.org_name} • ` : ""}
                        {event.route || getPageLabel(event.page)}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground whitespace-nowrap">{formatDateTimeBR(event.created_at)}</div>
                  </div>
                </div>
              ))}
              {!timelineQuery.isLoading && !(timelineQuery.data ?? []).length ? (
                <div className="rounded-lg border border-border/70 bg-secondary/20 p-4 text-sm text-muted-foreground">
                  Nenhum evento recente no período selecionado.
                </div>
              ) : null}
            </div>
          </section>
        </div>

        <Tabs value={tab} onValueChange={(value) => setTab(value as TabKey)} className="space-y-3">
          <TabsList className="h-10 rounded-lg border border-border/70 bg-card p-1">
            <TabsTrigger value="orgs">Organizações</TabsTrigger>
            <TabsTrigger value="admins">Gestores</TabsTrigger>
            <TabsTrigger value="users">Usuários</TabsTrigger>
          </TabsList>

          <TabsContent value="orgs" className="mt-0 space-y-0">
            <ListSectionHeader
              className="mb-3"
              title="Tabela de organizações"
              count={typeof orgsQuery.data?.total === "number" ? orgsQuery.data.total.toLocaleString("pt-BR") : "—"}
              statusLabel={orgStatus === "all" ? ADMIN_MICROCOPY.listStatus.periodRecords : `${ADMIN_MICROCOPY.listStatus.filtered} • ${getStatusLabel(orgStatus)}`}
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
              emptyIcon={Building2}
              emptyMessage="Nenhuma organização encontrada para os filtros aplicados."
            />
          </TabsContent>

          <TabsContent value="admins" className="mt-0 space-y-0">
            <ListSectionHeader
              className="mb-3"
              title={selectedOrgForAdmins ? "Gestores da organização selecionada" : "Lista de gestores"}
              count={typeof adminsQuery.data?.total === "number" ? adminsQuery.data.total.toLocaleString("pt-BR") : "—"}
              statusLabel={selectedOrgForAdmins ? "Filtro por organização ativo" : ADMIN_MICROCOPY.listStatus.periodRecords}
              isLoading={adminsQuery.isLoading}
            />
            <BorisTable
              columns={adminColumns}
              data={adminsQuery.data?.items ?? []}
              keyExtractor={(admin) => `${admin.user_id}:${admin.org_id}`}
              page={adminsPage}
              pageSize={PAGE_SIZE}
              totalCount={adminsQuery.data?.total}
              onPageChange={setAdminsPage}
              loading={adminsQuery.isLoading}
              error={!!adminsQuery.error}
              emptyIcon={Users}
              emptyMessage="Nenhum gestor encontrado no período."
            />
          </TabsContent>

          <TabsContent value="users" className="mt-0 space-y-0">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <select
                value={userStatus}
                onChange={(e) => {
                  setUserStatus(e.target.value as UserActivityStatus);
                  setUsersPage(1);
                }}
                className="px-3 py-2 rounded-lg border border-border bg-card text-sm"
              >
                <option value="all">Todos os status</option>
                <option value="active">Ativos</option>
                <option value="inactive">Inativos</option>
                <option value="never_logged_in">Nunca logaram</option>
              </select>
              <select
                value={userRole}
                onChange={(e) => {
                  setUserRole(e.target.value as UserPrimaryRole);
                  setUsersPage(1);
                }}
                className="px-3 py-2 rounded-lg border border-border bg-card text-sm"
              >
                <option value="all">Todos os papéis</option>
                <option value="SYSTEM_ADMIN">System Admin</option>
                <option value="ORG_ADMIN">Gestor de Organização</option>
                <option value="GROUP_MANAGER">Gestor de Grupo</option>
                <option value="USER">Usuário</option>
              </select>
            </div>
            <ListSectionHeader
              className="mb-3"
              title="Lista de usuários"
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
              emptyIcon={Users}
              emptyMessage="Nenhum usuário encontrado para os filtros aplicados."
              onRowClick={(userRow) => setSelectedUser(userRow)}
            />
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={!!selectedOrg} onOpenChange={(open) => !open && setSelectedOrg(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{selectedOrg?.org_name || "Organização"}</DialogTitle>
            <DialogDescription>{selectedOrg ? selectedOrg.status_reason : "Carregando detalhes da organização."}</DialogDescription>
          </DialogHeader>
          {selectedOrg ? (
            <div className="space-y-5">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg border border-border/70 bg-secondary/20 p-3">
                  <div className="text-xs text-muted-foreground">Status</div>
                  <div className="mt-1">
                    <StatusTag variant={getStatusVariant(selectedOrg.status)}>{getStatusLabel(selectedOrg.status)}</StatusTag>
                  </div>
                </div>
                <div className="rounded-lg border border-border/70 bg-secondary/20 p-3">
                  <div className="text-xs text-muted-foreground">Score de uso</div>
                  <div className="mt-1 text-lg font-semibold">{selectedOrg.usage_score}%</div>
                </div>
                <div className="rounded-lg border border-border/70 bg-secondary/20 p-3">
                  <div className="text-xs text-muted-foreground">Último login</div>
                  <div className="mt-1 text-sm font-medium">{selectedOrg.last_login_at ? formatDateTimeBR(selectedOrg.last_login_at) : "—"}</div>
                </div>
                <div className="rounded-lg border border-border/70 bg-secondary/20 p-3">
                  <div className="text-xs text-muted-foreground">Última atividade</div>
                  <div className="mt-1 text-sm font-medium">{selectedOrg.last_activity_at ? formatDateTimeBR(selectedOrg.last_activity_at) : "—"}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <div className="rounded-lg border border-border/70 bg-card p-4">
                  <div className="text-xs text-muted-foreground">Logins</div>
                  <div className="mt-1 text-xl font-semibold">{selectedOrg.logins}</div>
                </div>
                <div className="rounded-lg border border-border/70 bg-card p-4">
                  <div className="text-xs text-muted-foreground">Page views</div>
                  <div className="mt-1 text-xl font-semibold">{selectedOrg.page_views}</div>
                </div>
                <div className="rounded-lg border border-border/70 bg-card p-4">
                  <div className="text-xs text-muted-foreground">Dias ativos</div>
                  <div className="mt-1 text-xl font-semibold">{selectedOrg.active_days}</div>
                </div>
                <div className="rounded-lg border border-border/70 bg-card p-4">
                  <div className="text-xs text-muted-foreground">Ações realizadas</div>
                  <div className="mt-1 text-xl font-semibold">{selectedOrg.actions_count}</div>
                </div>
              </div>

              <div className="rounded-lg border border-border/70 bg-card p-4">
                <div className="mb-3 text-sm font-semibold text-card-foreground">Admins mais ativos</div>
                <div className="space-y-2">
                  {(selectedOrgAdminsQuery.data ?? []).map((admin) => (
                    <div key={`${admin.user_id}:${admin.org_id}`} className="flex items-center justify-between rounded-lg border border-border/70 bg-secondary/20 p-3">
                      <div>
                        <div className="text-sm font-medium">{admin.user_name || "—"}</div>
                        <div className="text-xs text-muted-foreground">{admin.last_activity_at ? formatDateTimeBR(admin.last_activity_at) : "Sem atividade recente"}</div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedOrg(null);
                          setSelectedOrgForAdmins(selectedOrg.org_id);
                          setTab("admins");
                        }}
                      >
                        Ver admins
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
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
