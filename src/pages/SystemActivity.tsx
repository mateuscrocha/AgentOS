import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
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
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { LoadingState } from "@/components/ui/loading-state";
import { Progress } from "@/components/ui/progress";
import { StatusTag } from "@/components/ui/status-tag";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { FilterChips } from "@/components/ui/filter-chips";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

type ActivationEventType =
  | "ORG_ACTIVATION_STARTED"
  | "ORG_ACTIVATION_DISMISSED"
  | "ORG_ACTIVATION_RESUMED"
  | "ORG_ACTIVATION_COMPLETED"
  | "GROUP_WELCOME_STARTED"
  | "GROUP_WELCOME_COMPLETED";

type ActivationEventRow = {
  created_at: string;
  entity_id: string;
  entity_type: "organization" | "group" | "member" | "message";
  event_type: ActivationEventType;
  metadata: Record<string, any> | null;
  user_id: string | null;
};

const PAGE_SIZE = 20;
const TIMELINE_LIMIT = 12;
const ENGAGEMENT_LIMIT = 8;
const ACTIVATION_EVENT_LIMIT = 8;
const ACTIVATION_EVENT_TYPES: ActivationEventType[] = [
  "ORG_ACTIVATION_STARTED",
  "ORG_ACTIVATION_DISMISSED",
  "ORG_ACTIVATION_RESUMED",
  "ORG_ACTIVATION_COMPLETED",
  "GROUP_WELCOME_STARTED",
  "GROUP_WELCOME_COMPLETED",
];

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

function getPeriodLabel(period: PeriodType, customRange?: DateRange) {
  if (period === "7d") return "Ultimos 7 dias";
  if (period === "30d") return "Ultimos 30 dias";
  if (period === "90d") return "Ultimos 90 dias";
  if (period === "custom" && customRange) {
    return `${customRange.from.toLocaleDateString("pt-BR")} - ${customRange.to.toLocaleDateString("pt-BR")}`;
  }
  return "Periodo";
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

function getActivationEventLabel(eventType: ActivationEventType) {
  if (eventType === "ORG_ACTIVATION_STARTED") return "Ativação da organização iniciada";
  if (eventType === "ORG_ACTIVATION_DISMISSED") return "Ativação da organização pausada";
  if (eventType === "ORG_ACTIVATION_RESUMED") return "Ativação da organização retomada";
  if (eventType === "ORG_ACTIVATION_COMPLETED") return "Ativação da organização concluída";
  if (eventType === "GROUP_WELCOME_STARTED") return "Boas-vindas do grupo exibidas";
  return "Boas-vindas do grupo concluídas";
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

  const neverLoggedUsersQuery = useQuery({
    queryKey: ["system-user-never-logged-preview", startISO, endISO],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("system_user_activity_list", {
        _start: startISO,
        _end: endISO,
        _recent_days: 7,
        _search: null,
        _status: "never_logged_in",
        _role: null,
        _order_by: "user_name",
        _order_dir: "asc",
        _limit: 5,
        _offset: 0,
      });
      if (error) throw error;
      return (data ?? []) as UserActivityRow[];
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

  const activationEventsQuery = useQuery({
    queryKey: ["system-activation-events", startISO, endISO],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("created_at, entity_id, entity_type, event_type, metadata, user_id")
        .in("event_type", ACTIVATION_EVENT_TYPES)
        .gte("created_at", startISO)
        .lte("created_at", endISO)
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) throw error;
      return (data ?? []) as ActivationEventRow[];
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
    neverLoggedUsersQuery.error,
    topPagesQuery.error,
    dailyMetricsQuery.error,
    timelineQuery.error,
    activationEventsQuery.error,
  ].some(Boolean);

  const kpis = kpiQuery.data;
  const previousKpis = previousKpiQuery.data;
  const topOrg = orgRankingQuery.data?.[0] ?? null;
  const topPage = topPagesQuery.data?.[0] ?? null;

  const primaryCards = useMemo(() => {
    if (!kpis) return [];
    const previous = previousKpis ?? ({} as KpiRow);
    return [
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
        title: "Nunca logaram",
        value: toCount(kpis.never_logged_in_users),
        trend: getTrendMeta(toCount(kpis.never_logged_in_users), toCount(previous.never_logged_in_users)),
        icon: UserX,
        description: "Contas ainda sem primeiro acesso",
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

  const attentionCards = useMemo(() => {
    if (!kpis) return [];
    const previous = previousKpis ?? ({} as KpiRow);
    return [
      {
        title: "Contas sem ativação",
        value: toCount(kpis.never_logged_in_users),
        trend: getTrendMeta(toCount(kpis.never_logged_in_users), toCount(previous.never_logged_in_users)),
        description: "Usuarios criados que nunca fizeram login.",
        icon: UserX,
      },
      {
        title: "Inativos há 30 dias",
        value: toCount(kpis.users_inactive_30d),
        trend: getTrendMeta(toCount(kpis.users_inactive_30d), toCount(previous.users_inactive_30d)),
        description: "Usuarios com maior risco de abandono.",
        icon: UserMinus,
      },
      {
        title: "Ritmo recente de admins",
        value: `${toCount(kpis.admins_active_today).toLocaleString("pt-BR")} hoje / ${toCount(kpis.admins_active_7d).toLocaleString("pt-BR")} em 7d`,
        trend: getTrendMeta(toCount(kpis.admins_active_today), toCount(previous.admins_active_today)),
        description: "Ajuda a ver recorrencia, nao so volume total.",
        icon: TrendingUp,
      },
    ];
  }, [kpis, previousKpis]);

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

  const insights = useMemo(() => buildInsightLines(kpis ?? null, topOrg, topPage), [kpis, topOrg, topPage]);
  const activationSummary = useMemo(() => {
    const rows = activationEventsQuery.data ?? [];
    const orgStarted = new Set<string>();
    const orgCompleted = new Set<string>();
    const groupWelcomeStarted = new Set<string>();
    const groupWelcomeCompleted = new Set<string>();

    let orgDismissedCount = 0;
    let orgResumedCount = 0;

    for (const row of rows) {
      if (row.event_type === "ORG_ACTIVATION_STARTED") orgStarted.add(row.entity_id);
      if (row.event_type === "ORG_ACTIVATION_COMPLETED") orgCompleted.add(row.entity_id);
      if (row.event_type === "GROUP_WELCOME_STARTED") groupWelcomeStarted.add(row.entity_id);
      if (row.event_type === "GROUP_WELCOME_COMPLETED") groupWelcomeCompleted.add(row.entity_id);
      if (row.event_type === "ORG_ACTIVATION_DISMISSED") orgDismissedCount += 1;
      if (row.event_type === "ORG_ACTIVATION_RESUMED") orgResumedCount += 1;
    }

    return {
      orgStarted: orgStarted.size,
      orgCompleted: orgCompleted.size,
      orgDismissed: orgDismissedCount,
      orgResumed: orgResumedCount,
      groupWelcomeStarted: groupWelcomeStarted.size,
      groupWelcomeCompleted: groupWelcomeCompleted.size,
      recent: rows.slice(0, ACTIVATION_EVENT_LIMIT),
    };
  }, [activationEventsQuery.data]);

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
    if (orgStatus !== "all") items.push({ key: "orgStatus", label: `Status: ${getStatusLabel(orgStatus)}`, onRemove: () => setOrgStatus("all") });
    if (lastActivityFilter !== "all") items.push({ key: "lastActivity", label: `Atividade: ${lastActivityFilter} dias`, onRemove: () => setLastActivityFilter("all") });
    if (daysWithoutLoginFilter !== "all") items.push({ key: "daysWithoutLogin", label: daysWithoutLoginFilter === "never" ? "Nunca logou" : `Sem login: ${daysWithoutLoginFilter} dias`, onRemove: () => setDaysWithoutLoginFilter("all") });
    if (scoreFilter !== "all") items.push({ key: "score", label: `Score: ${scoreFilter}`, onRemove: () => setScoreFilter("all") });
    if (userStatus !== "all") items.push({ key: "userStatus", label: `Usuarios: ${getUserActivityStatusLabel(userStatus)}`, onRemove: () => setUserStatus("all") });
    if (userRole !== "all") items.push({ key: "userRole", label: `Papel: ${getRoleLabel(userRole)}`, onRemove: () => setUserRole("all") });
    if (selectedOrgForAdmins) items.push({ key: "adminOrg", label: "Gestores filtrados por organizacao", onRemove: () => setSelectedOrgForAdmins(null) });
    return items;
  }, [customRange, daysWithoutLoginFilter, lastActivityFilter, orgStatus, search, scoreFilter, selectedOrgForAdmins, selectedPeriod, userRole, userStatus]);

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
      sortable: true,
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
      sortable: true,
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
      sortable: true,
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
      sortable: true,
      render: (admin: AdminActivityRow) => (admin.last_activity_at ? <span className="text-xs text-muted-foreground">{formatDateTimeBR(admin.last_activity_at)}</span> : "—"),
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
      <div className="mx-auto max-w-[1480px] space-y-8 animate-fade-in">
        <AdminPageHeader
          breadcrumbItems={[{ label: "Central de Comando", href: "/" }, { label: "Atividade" }]}
          title="Comportamento de usuários"
          description="Visão mais clara de login, navegação e risco de abandono para entender onde o uso está saudável e onde precisa de ação."
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
            primaryCards.length ? (
              <>
                {primaryCards.map((card) => {
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
                      onClick={card.title === "Nunca logaram" ? focusNeverLoggedUsers : undefined}
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
        } : undefined} className="-mt-2" />

        {hasAnyError ? (
          <div className="rounded-[var(--radius-lg)] border border-destructive/30 bg-destructive/5 p-4 shadow-subtle">
          <div className="text-sm font-semibold text-card-foreground">Falha ao carregar parte dos dados</div>
          <div className="text-xs text-muted-foreground mt-1">Verifique sua sessão e tente novamente.</div>
        </div>
      ) : null}

        <section className="rounded-[var(--radius-xl)] border border-warning/25 bg-[hsl(var(--warning)/0.08)] p-5 shadow-subtle">
          <div className="grid gap-4 xl:grid-cols-[0.78fr_1.22fr] xl:items-start">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-warning">Ação imediata</div>
              <h3 className="mt-2 text-xl font-semibold tracking-[-0.02em] text-card-foreground">Contas sem primeiro login</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Esse é o grupo mais importante para ativação: contas criadas que ainda não fizeram o primeiro acesso.
              </p>
              <div className="mt-4 flex items-end gap-3">
                <div className="text-4xl font-semibold tracking-[-0.04em] text-card-foreground">
                  {toCount(kpis?.never_logged_in_users).toLocaleString("pt-BR")}
                </div>
                <div className="pb-1 text-sm text-muted-foreground">usuários sem login</div>
              </div>
              <Button variant="default" className="mt-4" onClick={focusNeverLoggedUsers}>
                Ver lista completa
              </Button>
            </div>

            <div className="space-y-2">
              {(neverLoggedUsersQuery.data ?? []).map((userRow) => (
                <button
                  key={userRow.user_id}
                  type="button"
                  onClick={() => {
                    focusNeverLoggedUsers();
                    setSelectedUser(userRow);
                  }}
                  className="w-full rounded-[var(--radius-lg)] border border-border/70 bg-card/90 p-3 text-left shadow-subtle transition-colors hover:bg-card"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-card-foreground">{userRow.user_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {getRoleLabel(userRow.primary_role)}
                        {userRow.organization_name ? ` • ${userRow.organization_name}` : ""}
                      </div>
                    </div>
                    <StatusTag variant="warning">Nunca logou</StatusTag>
                  </div>
                </button>
              ))}
              {!neverLoggedUsersQuery.isLoading && !(neverLoggedUsersQuery.data ?? []).length ? (
                <div className="rounded-[var(--radius-lg)] border border-border/70 bg-card/90 p-4 text-sm text-muted-foreground">
                  Nenhuma conta pendente de primeiro login no período.
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[0.92fr_1.08fr]">
          <div className="rounded-[var(--radius-xl)] border border-border/70 bg-card/95 p-5 shadow-subtle">
            <ExecutiveSectionHeader
              eyebrow="Ativação"
              title="Camada de onboarding do Boris"
              description="Leitura rápida de início, pausa e conclusão da ativação no período."
              icon={MousePointerClick}
              className="mb-4"
            />
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
              <div className="rounded-[var(--radius-md)] border border-border/70 bg-secondary/20 p-4">
                <div className="text-xs text-muted-foreground">Orgs que iniciaram</div>
                <div className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-card-foreground">
                  {activationSummary.orgStarted.toLocaleString("pt-BR")}
                </div>
              </div>
              <div className="rounded-[var(--radius-md)] border border-border/70 bg-secondary/20 p-4">
                <div className="text-xs text-muted-foreground">Orgs concluídas</div>
                <div className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-card-foreground">
                  {activationSummary.orgCompleted.toLocaleString("pt-BR")}
                </div>
              </div>
              <div className="rounded-[var(--radius-md)] border border-border/70 bg-secondary/20 p-4">
                <div className="text-xs text-muted-foreground">Pausas</div>
                <div className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-card-foreground">
                  {activationSummary.orgDismissed.toLocaleString("pt-BR")}
                </div>
              </div>
              <div className="rounded-[var(--radius-md)] border border-border/70 bg-secondary/20 p-4">
                <div className="text-xs text-muted-foreground">Retomadas</div>
                <div className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-card-foreground">
                  {activationSummary.orgResumed.toLocaleString("pt-BR")}
                </div>
              </div>
              <div className="rounded-[var(--radius-md)] border border-border/70 bg-secondary/20 p-4">
                <div className="text-xs text-muted-foreground">Welcome de grupo exibido</div>
                <div className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-card-foreground">
                  {activationSummary.groupWelcomeStarted.toLocaleString("pt-BR")}
                </div>
              </div>
              <div className="rounded-[var(--radius-md)] border border-border/70 bg-secondary/20 p-4">
                <div className="text-xs text-muted-foreground">Welcome concluído</div>
                <div className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-card-foreground">
                  {activationSummary.groupWelcomeCompleted.toLocaleString("pt-BR")}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[var(--radius-xl)] border border-border/70 bg-card/95 p-5 shadow-subtle">
            <ExecutiveSectionHeader
              eyebrow="Timeline"
              title="Eventos recentes de ativação"
              description="Últimos sinais da camada de primeiro login e boas-vindas do grupo."
              icon={Activity}
              className="mb-4"
            />
            <div className="space-y-3">
              {activationSummary.recent.map((event, index) => (
                <div key={`${event.created_at}:${event.event_type}:${index}`} className="rounded-[var(--radius-md)] border border-border/70 bg-secondary/20 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-card-foreground">
                        {getActivationEventLabel(event.event_type)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {event.entity_type === "organization" ? "Organização" : "Grupo"} • {event.entity_id.slice(0, 8)}
                      </div>
                    </div>
                    <div className="text-xs whitespace-nowrap text-muted-foreground">{formatDateTimeBR(event.created_at)}</div>
                  </div>
                </div>
              ))}
              {!activationEventsQuery.isLoading && !activationSummary.recent.length ? (
                <div className="rounded-[var(--radius-md)] border border-border/70 bg-secondary/20 p-4 text-sm text-muted-foreground">
                  Nenhum evento de ativação registrado no período selecionado.
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-[var(--radius-xl)] border border-border/70 bg-card/95 p-5 shadow-subtle">
            <ExecutiveSectionHeader
              eyebrow="Leitura rápida"
              title="O que merece atenção agora"
              description="Primeiro mostramos o que ajuda a decidir rápido; o detalhamento fica logo abaixo."
              icon={AlertTriangle}
              className="mb-4"
            />
            <div className="space-y-3">
              {insights.map((insight, index) => (
                <div key={index} className="rounded-[var(--radius-md)] border border-border/70 bg-secondary/20 p-4 text-sm text-card-foreground">
                  {insight}
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-3">
            {attentionCards.map((card) => (
              <div key={card.title} className="rounded-[var(--radius-lg)] border border-border/70 bg-card/95 p-4 shadow-subtle">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      {card.title}
                    </div>
                    <div className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-card-foreground">
                      {typeof card.value === "number" ? card.value.toLocaleString("pt-BR") : card.value}
                    </div>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] border border-primary/15 bg-primary/10 shadow-subtle">
                    <card.icon className="h-4 w-4 text-primary" />
                  </div>
                </div>
                <div className="mt-3 inline-flex rounded-full border border-border/70 bg-muted/30 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                  {card.trend.label}
                </div>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{card.description}</p>
                {card.title === "Contas sem ativação" ? (
                  <Button variant="outline" size="sm" className="mt-3" onClick={focusNeverLoggedUsers}>
                    Ver quem ainda não logou
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        </section>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <section className="rounded-[var(--radius-xl)] border border-border/70 bg-card/95 p-5 shadow-subtle">
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

          <section className="rounded-[var(--radius-xl)] border border-border/70 bg-card/95 p-5 shadow-subtle">
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

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[0.95fr_1.05fr]">
          <section className="rounded-[var(--radius-xl)] border border-border/70 bg-card/95 p-5 shadow-subtle">
            <ExecutiveSectionHeader
              eyebrow="Navegação"
              title="Páginas mais acessadas"
              description="Ajuda a entender onde o produto está concentrando uso no período."
              icon={BarChart3}
              className="mb-4"
            />
            <div className="space-y-3">
              {(topPagesQuery.data ?? []).slice(0, 6).map((page, index) => (
                <div key={page.page ?? index} className="rounded-[var(--radius-md)] border border-border/70 bg-secondary/20 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-card-foreground">{getPageLabel(page.page)}</div>
                      <div className="text-xs text-muted-foreground">{page.admins.toLocaleString("pt-BR")} admins diferentes navegaram por aqui</div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-semibold text-card-foreground">{page.page_views.toLocaleString("pt-BR")}</div>
                      <div className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">page views</div>
                    </div>
                  </div>
                </div>
              ))}
              {!topPagesQuery.isLoading && !(topPagesQuery.data ?? []).length ? (
                <div className="rounded-[var(--radius-md)] border border-border/70 bg-secondary/20 p-4 text-sm text-muted-foreground">
                  Nenhuma navegação registrada no período selecionado.
                </div>
              ) : null}
            </div>
          </section>

          <section className="rounded-[var(--radius-xl)] border border-border/70 bg-card/95 p-5 shadow-subtle">
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
                  <Bar dataKey="usage_score" radius={[0, 8, 8, 0]} fill="var(--color-usage_score)" />
                  <Bar dataKey="logins" radius={[0, 8, 8, 0]} fill="var(--color-logins)" />
                </BarChart>
              </ChartContainer>
            </div>
          </section>
        </div>

        <div className="grid grid-cols-1 gap-4">
          <section className="rounded-[var(--radius-xl)] border border-border/70 bg-card/95 p-5 shadow-subtle">
            <ExecutiveSectionHeader
              eyebrow="Timeline"
              title="Atividade recente"
              description="Eventos recentes de login, navegação e alterações operacionais."
              icon={Activity}
              className="mb-4"
            />
            <div className="space-y-3">
              {(timelineQuery.data ?? []).map((event, index) => (
                <div key={`${event.created_at}:${index}`} className="rounded-[var(--radius-md)] border border-border/70 bg-secondary/20 p-3">
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
                <div className="rounded-[var(--radius-md)] border border-border/70 bg-secondary/20 p-4 text-sm text-muted-foreground">
                  Nenhum evento recente no período selecionado.
                </div>
              ) : null}
            </div>
          </section>
        </div>

        <Tabs value={tab} onValueChange={(value) => setTab(value as TabKey)} className="space-y-3">
          <TabsList className="h-10 rounded-[var(--radius-lg)] border border-border/70 bg-card/95 p-1 shadow-subtle">
            <TabsTrigger value="orgs">Organizações</TabsTrigger>
            <TabsTrigger value="admins">Gestores</TabsTrigger>
            <TabsTrigger value="users">Usuários</TabsTrigger>
          </TabsList>

          <TabsContent value="orgs" className="mt-0 space-y-0">
            <div className="mb-3 flex flex-wrap items-center gap-2 rounded-[var(--radius-lg)] border border-border/70 bg-card/95 p-3 shadow-subtle">
              <Select
                value={orgStatus}
                onValueChange={(value) => {
                  setOrgStatus(value as "all" | OrgUsageStatus);
                  setOrgsPage(1);
                }}
              >
                <SelectTrigger className="w-[180px]" aria-label="Status da organização">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="engajada">Engajadas</SelectItem>
                  <SelectItem value="ativa">Ativas</SelectItem>
                  <SelectItem value="morna">Mornas</SelectItem>
                  <SelectItem value="em_risco">Em risco</SelectItem>
                  <SelectItem value="abandonada">Abandonadas</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={lastActivityFilter}
                onValueChange={(value) => {
                  setLastActivityFilter(value as any);
                  setOrgsPage(1);
                }}
              >
                <SelectTrigger className="w-[180px]" aria-label="Última atividade">
                  <SelectValue placeholder="Última atividade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Última atividade</SelectItem>
                  <SelectItem value="0-3">Até 3 dias</SelectItem>
                  <SelectItem value="0-7">Até 7 dias</SelectItem>
                  <SelectItem value="0-30">Até 30 dias</SelectItem>
                  <SelectItem value="31+">Mais de 30 dias</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={daysWithoutLoginFilter}
                onValueChange={(value) => {
                  setDaysWithoutLoginFilter(value as any);
                  setOrgsPage(1);
                }}
              >
                <SelectTrigger className="w-[180px]" aria-label="Dias sem login">
                  <SelectValue placeholder="Dias sem login" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Dias sem login</SelectItem>
                  <SelectItem value="0-7">0 a 7 dias</SelectItem>
                  <SelectItem value="8-30">8 a 30 dias</SelectItem>
                  <SelectItem value="31+">Mais de 30 dias</SelectItem>
                  <SelectItem value="never">Nunca logou</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={scoreFilter}
                onValueChange={(value) => {
                  setScoreFilter(value as any);
                  setOrgsPage(1);
                }}
              >
                <SelectTrigger className="w-[180px]" aria-label="Score de uso">
                  <SelectValue placeholder="Score de uso" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Score de uso</SelectItem>
                  <SelectItem value="76-100">76 a 100</SelectItem>
                  <SelectItem value="51-75">51 a 75</SelectItem>
                  <SelectItem value="26-50">26 a 50</SelectItem>
                  <SelectItem value="0-25">0 a 25</SelectItem>
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
                  <SelectItem value="usage_score">Ordenar: score de uso</SelectItem>
                  <SelectItem value="last_login_at">Ordenar: último login</SelectItem>
                  <SelectItem value="last_activity_at">Ordenar: última atividade</SelectItem>
                  <SelectItem value="org_name">Ordenar: organização</SelectItem>
                  <SelectItem value="logins">Ordenar: logins</SelectItem>
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
              sortMode="manual"
              sortState={{ key: orderByOrgs, direction: orderDir }}
              onSortChange={(sort) => {
                if (!sort || !["org_name", "usage_score", "last_login_at", "last_activity_at"].includes(sort.key)) return;
                setOrderByOrgs(sort.key as OrgOrderBy);
                setOrderDir(sort.direction);
                setOrgsPage(1);
              }}
              emptyIcon={Building2}
              emptyMessage="Nenhuma organização encontrada para os filtros aplicados."
            />
          </TabsContent>

          <TabsContent value="admins" className="mt-0 space-y-0">
            <div className="mb-3 flex flex-wrap items-center gap-2 rounded-[var(--radius-lg)] border border-border/70 bg-card/95 p-3 shadow-subtle">
              <Select
                value={orderByAdmins}
                onValueChange={(value) => setOrderByAdmins(value as AdminOrderBy)}
              >
                <SelectTrigger className="w-[220px]" aria-label="Ordenação dos gestores">
                  <SelectValue placeholder="Ordenar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="last_activity_at">Ordenar: última atividade</SelectItem>
                  <SelectItem value="user_name">Ordenar: gestor</SelectItem>
                  <SelectItem value="active_days">Ordenar: dias ativos</SelectItem>
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
              {selectedOrgForAdmins ? (
                <Button variant="ghost" size="sm" onClick={() => setSelectedOrgForAdmins(null)}>
                  Remover filtro de organização
                </Button>
              ) : null}
            </div>
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
              sortMode="manual"
              sortState={{ key: orderByAdmins, direction: orderDir }}
              onSortChange={(sort) => {
                if (!sort || !["user_name", "active_days", "last_activity_at"].includes(sort.key)) return;
                setOrderByAdmins(sort.key as AdminOrderBy);
                setOrderDir(sort.direction);
                setAdminsPage(1);
              }}
              emptyIcon={Users}
              emptyMessage="Nenhum gestor encontrado no período."
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
