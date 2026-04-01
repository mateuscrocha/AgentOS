import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Headset, Layers, Clock3, Activity, CheckCircle2, MessageCircleWarning, TimerReset, Radio, PauseCircle } from "lucide-react";

import { AdminLayout } from "@/components/layout/AdminLayout";
import { AdminPageHeader } from "@/components/layout/AdminPageHeader";
import { BorisTable } from "@/components/ui/boris-table";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { ExecutiveSectionHeader } from "@/components/dashboard/ExecutiveSectionHeader";
import { ListSectionHeader } from "@/components/dashboard/ListSectionHeader";
import { ADMIN_MICROCOPY } from "@/components/dashboard/admin-microcopy";
import { UserInline } from "@/components/ui/UserInline";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { useUserRoles } from "@/hooks/use-user-roles";
import { supabase } from "@/integrations/supabase/client";
import { formatDateSimpleBR } from "@/lib/date";
import { DEFAULT_SUPPORT_BUSINESS_HOURS, businessMsBetween } from "@/lib/business-time";
import { compareDemandClusters, type DemandClusterTrendStat } from "@/lib/support-demand-clusters";
import { PeriodFilter } from "@/components/group-dashboard/PeriodFilter";
import { getDateRange, type DateRange, type PeriodType } from "@/components/group-dashboard/period-utils";
import { cn } from "@/lib/utils";
import { buildSupportNowSummary, memberIdentityKey, type SupportNowStatus, type SupportNowSummary } from "@/lib/support-now";

import AccessDenied from "./AccessDenied";

type SupportAssignmentRow = {
  group_id: string;
  member_id: string;
  status: "active" | "inactive";
  is_active: boolean;
};

type SupportMemberRow = {
  id: string;
  name: string;
  display_name: string | null;
  phone_e164: string | null;
  lid: string | null;
  profile_pic_url: string | null;
};

type GroupRow = {
  id: string;
  name: string;
  organization_id: string;
  is_archived?: boolean | null;
  status?: string | null;
};

type GroupOverviewRow = {
  group_id: string;
  last_access_at: string | null;
};

type AttendantAgg = {
  identityKey: string;
  name: string;
  avatarUrl: string | null;
  phone: string | null;
  activeGroupsCount: number;
  inactive7dGroupsCount: number;
  lastGroupActivityAt: string | null;
  groupsPreview: string[];
  supportMessages30d: number;
  answeredInteractions30d: number;
  answeredWithinSla30d: number;
  slaPct30d: number | null;
  avgResponseMs30d: number | null;
};

type SupportDashboardData = {
  attendants: AttendantAgg[];
  totalAssignedGroups: number;
  inactive7dAssignedGroups: number;
  supportMessages30d: number;
  answeredInteractions30d: number;
  answeredWithinSla30d: number;
  slaPct30d: number | null;
  openPendingInteractions: number;
  openPendingSlaBreached: number;
  demandClusters: DemandClusterTrendStat[];
  demandClusterSampleCapped: boolean;
  avgResponseMs30d: number | null;
  sequenceSampleCapped: boolean;
  supportMessagesSampleCapped: boolean;
  nowSummary: SupportNowSummary;
};

type OrganizationOption = {
  id: string;
  name: string;
};

const PAGE_SIZE = 20;
const KPI_LOOKBACK_DAYS = 30;
const SUPPORT_MESSAGES_SAMPLE_LIMIT = 12000;
const SEQUENCE_MESSAGES_SAMPLE_LIMIT = 12000;
const RESPONSE_SLA_BUSINESS_MINUTES = 30;
const DEMAND_CLUSTER_SAMPLE_LIMIT = 4000;
const NOW_STATE_LOOKBACK_DAYS = 14;
const NOW_STATE_SAMPLE_LIMIT = 12000;
const SYSTEM_SUPPORT_KPI_HELP = {
  attendants: {
    whatIs: "Total de atendentes ativos configurados nos grupos filtrados.",
    howToInterpret: "Base da visão consolidada por atendente.",
  },
  groups: {
    whatIs: "Quantidade de grupos vinculados aos atendentes no recorte atual.",
    howToInterpret: "Usado para capacidade e distribuição de carteira operacional.",
  },
  inactive: {
    whatIs: `Grupos vinculados sem atividade por ${INACTIVITY_DAYS} dias.`,
    howToInterpret: "Sinaliza grupos frios dentro do recorte.",
  },
  avgGroups: {
    whatIs: "Média de grupos vinculados por atendente ativo.",
    howToInterpret: "Ajuda a avaliar balanceamento de carga em alto nível.",
  },
  tmr: {
    whatIs: "Tempo médio de resposta útil (horário comercial) consolidado dos grupos filtrados.",
    howToInterpret: "Quanto menor, melhor. Métrica aproximada por sequência de mensagens.",
  },
  sla: {
    whatIs: `Percentual de respostas dentro de ${RESPONSE_SLA_BUSINESS_MINUTES} minutos úteis nos grupos filtrados.`,
    howToInterpret: "Quanto maior, melhor. Mostra aderência ao SLA no recorte.",
  },
  pending: {
    whatIs: "Pendências abertas sem resposta de atendente nos grupos filtrados.",
    howToInterpret: "No MVP, conta no máximo uma pendência aberta por grupo.",
  },
  messages: {
    whatIs: "Mensagens enviadas por atendentes nos grupos filtrados (amostral).",
    howToInterpret: "Usado para contexto de volume e leitura de esforço.",
  },
} as const;

const SUPPORT_KPI_CARD = "rounded-[26px] shadow-subtle";
const SUPPORT_KPI_VALUE = "text-2xl sm:text-3xl";

function formatRelativeMinutes(ms: number | null) {
  if (!ms || !Number.isFinite(ms)) return "Sem leitura";
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return rem ? `${hours}h ${rem}m` : `${hours}h`;
}

function formatRelativeSince(date?: string | null) {
  if (!date) return "Sem atividade recente";
  const diffMs = Date.now() - new Date(date).getTime();
  if (!Number.isFinite(diffMs) || diffMs < 0) return "Agora";
  const minutes = Math.round(diffMs / 60000);
  if (minutes <= 1) return "Agora";
  if (minutes < 60) return `Há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Há ${hours}h`;
  const days = Math.floor(hours / 24);
  return `Há ${days}d`;
}

export default function SystemSupport() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { isSystemAdmin, isLoading: rolesLoading } = useUserRoles();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const [orgFilter, setOrgFilter] = useState<string>("all");
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>("30d");
  const [customRange, setCustomRange] = useState<DateRange | undefined>();

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  const currentRange = getDateRange(selectedPeriod, customRange);
  const currentStartISO = currentRange.from.toISOString();
  const currentEndISO = currentRange.to.toISOString();
  const rangeDurationMs = Math.max(1, currentRange.to.getTime() - currentRange.from.getTime() + 1);
  const previousRange = useMemo(() => {
    const prevTo = new Date(currentRange.from.getTime() - 1);
    const prevFrom = new Date(prevTo.getTime() - (rangeDurationMs - 1));
    return { from: prevFrom, to: prevTo };
  }, [currentRange.from, rangeDurationMs]);
  const previousStartISO = previousRange.from.toISOString();
  const previousEndISO = previousRange.to.toISOString();

  const organizationsQuery = useQuery({
    queryKey: ["system-support-organizations"],
    queryFn: async (): Promise<OrganizationOption[]> => {
      const { data, error } = await supabase.from("organizations").select("id, name").order("name");
      if (error) throw error;
      return (data ?? []) as OrganizationOption[];
    },
    enabled: isAuthenticated && isSystemAdmin,
  });

  const supportQuery = useQuery({
    queryKey: ["system-support-dashboard", orgFilter, currentStartISO, currentEndISO, previousStartISO, previousEndISO],
    queryFn: async (): Promise<SupportDashboardData> => {
      const { data: assignmentsData, error: assignmentsError } = await (supabase as any)
        .from("group_support_members")
        .select("group_id, member_id, status, is_active")
        .is("deleted_at", null)
        .eq("status", "active")
        .eq("is_active", true);
      if (assignmentsError) throw assignmentsError;

      const assignments = (assignmentsData ?? []) as SupportAssignmentRow[];
      if (assignments.length === 0) {
        return {
          attendants: [],
          totalAssignedGroups: 0,
          inactive7dAssignedGroups: 0,
          supportMessages30d: 0,
          answeredInteractions30d: 0,
          answeredWithinSla30d: 0,
          slaPct30d: null,
          openPendingInteractions: 0,
          openPendingSlaBreached: 0,
          demandClusters: [],
          demandClusterSampleCapped: false,
          avgResponseMs30d: null,
          sequenceSampleCapped: false,
          supportMessagesSampleCapped: false,
          nowSummary: {
            items: [],
            counts: {
              awaiting_attendant: 0,
              awaiting_customer: 0,
              in_progress: 0,
              inactive: 0,
            },
          },
        };
      }

      const memberIds = Array.from(new Set(assignments.map((a) => a.member_id).filter(Boolean)));
      const groupIds = Array.from(new Set(assignments.map((a) => a.group_id).filter(Boolean)));

      const [membersRes, groupsRes, overviewRes] = await Promise.all([
        supabase
          .from("members")
          .select("id, name, display_name, phone_e164, lid, profile_pic_url")
          .in("id", memberIds),
        supabase
          .from("groups")
          .select("id, name, organization_id, is_archived, status")
          .in("id", groupIds),
        supabase
          .from("v_group_overview")
          .select("group_id, last_access_at")
          .in("group_id", groupIds),
      ]);

      if (membersRes.error) throw membersRes.error;
      if (groupsRes.error) throw groupsRes.error;
      if (overviewRes.error) throw overviewRes.error;

      const members = (membersRes.data ?? []) as SupportMemberRow[];
      const groups = (groupsRes.data ?? []) as GroupRow[];
      const overviewRows = (overviewRes.data ?? []) as GroupOverviewRow[];

      const memberById = new Map(members.map((m) => [m.id, m]));
      const memberIdentityById = new Map(members.map((m) => [m.id, memberIdentityKey(m)]));
      const groupById = new Map(groups.map((g) => [g.id, g]));
      const overviewByGroupId = new Map(overviewRows.map((o) => [o.group_id, o]));
      const supportIdentityKeysByGroup = new Map<string, Set<string>>();

      const buckets = new Map<string, {
        member: SupportMemberRow;
        groupIds: Set<string>;
        groupsPreview: string[];
        supportMessages30d: number;
        answeredInteractions30d: number;
        responseTotalMs: number;
        responseCount: number;
        answeredWithinSla30d: number;
      }>();

      for (const assignment of assignments) {
        const member = memberById.get(assignment.member_id);
        const group = groupById.get(assignment.group_id);
        if (!member || !group || group.is_archived) continue;

        const key = memberIdentityKey(member);
        const groupSupportSet = supportIdentityKeysByGroup.get(group.id) ?? new Set<string>();
        groupSupportSet.add(key);
        supportIdentityKeysByGroup.set(group.id, groupSupportSet);

        const current = buckets.get(key);
        if (!current) {
          buckets.set(key, {
            member,
            groupIds: new Set([group.id]),
            groupsPreview: [group.name],
            supportMessages30d: 0,
            answeredInteractions30d: 0,
            responseTotalMs: 0,
            responseCount: 0,
            answeredWithinSla30d: 0,
          });
          continue;
        }

        current.groupIds.add(group.id);
        if (current.groupsPreview.length < 3 && !current.groupsPreview.includes(group.name)) {
          current.groupsPreview.push(group.name);
        }
        const currentHasPhone = !!normalizePhoneForIdentity(current.member.phone_e164);
        const candidateHasPhone = !!normalizePhoneForIdentity(member.phone_e164);
        if (!currentHasPhone && candidateHasPhone) current.member = member;
      }

      const filteredGroupIds = orgFilter === "all"
        ? groupIds
        : groupIds.filter((id) => groupById.get(id)?.organization_id === orgFilter);
      const filteredGroupIdsSet = new Set(filteredGroupIds);

      for (const [groupId] of supportIdentityKeysByGroup) {
        if (!filteredGroupIdsSet.has(groupId)) {
          supportIdentityKeysByGroup.delete(groupId);
        }
      }

      for (const [key, bucket] of buckets) {
        bucket.groupIds = new Set(Array.from(bucket.groupIds).filter((id) => filteredGroupIdsSet.has(id)));
        bucket.groupsPreview = bucket.groupsPreview.filter((name) => {
          const exists = Array.from(bucket.groupIds).some((id) => groupById.get(id)?.name === name);
          return exists;
        });
        if (bucket.groupIds.size === 0) buckets.delete(key);
      }

      if (filteredGroupIds.length === 0) {
        return {
          attendants: [],
          totalAssignedGroups: 0,
          inactive7dAssignedGroups: 0,
          supportMessages30d: 0,
          answeredInteractions30d: 0,
          answeredWithinSla30d: 0,
          slaPct30d: null,
          openPendingInteractions: 0,
          openPendingSlaBreached: 0,
          demandClusters: [],
          demandClusterSampleCapped: false,
          avgResponseMs30d: null,
          sequenceSampleCapped: false,
          supportMessagesSampleCapped: false,
          nowSummary: {
            items: [],
            counts: {
              awaiting_attendant: 0,
              awaiting_customer: 0,
              in_progress: 0,
              inactive: 0,
            },
          },
        };
      }

      const nowStateStartISO = new Date(Date.now() - NOW_STATE_LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();

      const [supportMessagesSampleRes, sequenceMessagesSampleRes, demandMessagesSampleRes, previousDemandMessagesSampleRes, nowMessagesSampleRes] = await Promise.all([
        supabase
          .from("messages")
          .select("group_id, member_id, sender_phone, created_at")
          .in("group_id", filteredGroupIds)
          .is("deleted_at", null)
          .gte("created_at", currentStartISO)
          .lte("created_at", currentEndISO)
          .order("created_at", { ascending: false })
          .limit(SUPPORT_MESSAGES_SAMPLE_LIMIT),
        supabase
          .from("messages")
          .select("group_id, member_id, sender_phone, created_at")
          .in("group_id", filteredGroupIds)
          .is("deleted_at", null)
          .gte("created_at", currentStartISO)
          .lte("created_at", currentEndISO)
          .order("created_at", { ascending: true })
          .limit(SEQUENCE_MESSAGES_SAMPLE_LIMIT),
        supabase
          .from("messages")
          .select("group_id, member_id, sender_phone, text, content")
          .in("group_id", filteredGroupIds)
          .is("deleted_at", null)
          .gte("created_at", currentStartISO)
          .lte("created_at", currentEndISO)
          .eq("message_type", "text")
          .order("created_at", { ascending: false })
          .limit(DEMAND_CLUSTER_SAMPLE_LIMIT),
        supabase
          .from("messages")
          .select("group_id, member_id, sender_phone, text, content")
          .in("group_id", filteredGroupIds)
          .is("deleted_at", null)
          .gte("created_at", previousStartISO)
          .lte("created_at", previousEndISO)
          .eq("message_type", "text")
          .order("created_at", { ascending: false })
          .limit(DEMAND_CLUSTER_SAMPLE_LIMIT),
        supabase
          .from("messages")
          .select("group_id, member_id, sender_phone, created_at")
          .in("group_id", filteredGroupIds)
          .is("deleted_at", null)
          .gte("created_at", nowStateStartISO)
          .order("created_at", { ascending: true })
          .limit(NOW_STATE_SAMPLE_LIMIT),
      ]);
      if (supportMessagesSampleRes.error) throw supportMessagesSampleRes.error;
      if (sequenceMessagesSampleRes.error) throw sequenceMessagesSampleRes.error;
      if (demandMessagesSampleRes.error) throw demandMessagesSampleRes.error;
      if (previousDemandMessagesSampleRes.error) throw previousDemandMessagesSampleRes.error;
      if (nowMessagesSampleRes.error) throw nowMessagesSampleRes.error;

      const supportMessagesSample = (supportMessagesSampleRes.data ?? []) as Array<{
        group_id: string;
        member_id: string | null;
        sender_phone: string | null;
        created_at: string;
      }>;
      const sequenceMessagesSample = (sequenceMessagesSampleRes.data ?? []) as Array<{
        group_id: string;
        member_id: string | null;
        sender_phone: string | null;
        created_at: string;
      }>;
      const demandMessagesSample = (demandMessagesSampleRes.data ?? []) as Array<{
        group_id: string;
        member_id: string | null;
        sender_phone: string | null;
        text: string | null;
        content: string | null;
      }>;
      const previousDemandMessagesSample = (previousDemandMessagesSampleRes.data ?? []) as Array<{
        group_id: string;
        member_id: string | null;
        sender_phone: string | null;
        text: string | null;
        content: string | null;
      }>;
      const nowMessagesSample = (nowMessagesSampleRes.data ?? []) as Array<{
        group_id: string;
        member_id: string | null;
        sender_phone: string | null;
        created_at: string;
      }>;

      let supportMessages30d = 0;
      for (const msg of supportMessagesSample) {
        const identity = messageIdentityKey(msg, memberIdentityById);
        if (!identity) continue;
        const supportSet = supportIdentityKeysByGroup.get(msg.group_id);
        if (!supportSet?.has(identity)) continue;
        const bucket = buckets.get(identity);
        if (!bucket) continue;
        bucket.supportMessages30d += 1;
        supportMessages30d += 1;
      }

      const isClientDemandMessage = (msg: { group_id: string; member_id: string | null; sender_phone: string | null }) => {
        const identity = messageIdentityKey(msg, memberIdentityById);
        const supportSet = supportIdentityKeysByGroup.get(msg.group_id);
        return !identity || !supportSet?.has(identity);
      };
      const demandClusters = compareDemandClusters(
        demandMessagesSample
          .filter(isClientDemandMessage)
          .map((msg) => (msg.text || msg.content || "").trim()),
        previousDemandMessagesSample
          .filter(isClientDemandMessage)
          .map((msg) => (msg.text || msg.content || "").trim()),
      );

      let answeredInteractions30d = 0;
      let answeredWithinSla30d = 0;
      let openPendingInteractions = 0;
      let openPendingSlaBreached = 0;
      let totalResponseMs = 0;
      let totalResponseCount = 0;
      const pendingByGroup = new Map<string, { at: string; authorKey: string | null }>();

      for (const msg of sequenceMessagesSample) {
        const identity = messageIdentityKey(msg, memberIdentityById);
        const supportSet = supportIdentityKeysByGroup.get(msg.group_id);
        const isSupport = !!identity && !!supportSet?.has(identity);

        if (!isSupport) {
          pendingByGroup.set(msg.group_id, { at: msg.created_at, authorKey: identity });
          continue;
        }

        if (!identity) continue;
        const pending = pendingByGroup.get(msg.group_id);
        if (!pending) continue;

        const lagMs = businessMsBetween(pending.at, msg.created_at, DEFAULT_SUPPORT_BUSINESS_HOURS);
        const validLag = Number.isFinite(lagMs) && lagMs >= 0 && lagMs <= 72 * 60 * 60 * 1000;
        const differentAuthors = !pending.authorKey || pending.authorKey !== identity;
        if (!validLag || !differentAuthors) continue;

        const bucket = buckets.get(identity);
        if (bucket) {
          bucket.answeredInteractions30d += 1;
          bucket.responseTotalMs += lagMs;
          bucket.responseCount += 1;
          if (lagMs <= RESPONSE_SLA_BUSINESS_MINUTES * 60 * 1000) {
            bucket.answeredWithinSla30d += 1;
          }
        }
        if (lagMs <= RESPONSE_SLA_BUSINESS_MINUTES * 60 * 1000) answeredWithinSla30d += 1;
        answeredInteractions30d += 1;
        totalResponseMs += lagMs;
        totalResponseCount += 1;
        pendingByGroup.delete(msg.group_id);
      }

      for (const [, pending] of pendingByGroup) {
        openPendingInteractions += 1;
        const pendingBusinessMs = businessMsBetween(pending.at, new Date(), DEFAULT_SUPPORT_BUSINESS_HOURS);
        if (pendingBusinessMs > RESPONSE_SLA_BUSINESS_MINUTES * 60 * 1000) {
          openPendingSlaBreached += 1;
        }
      }

      const assignedGroupsDistinct = new Set<string>();
      let inactive7dAssignedGroups = 0;
      for (const groupId of filteredGroupIds) {
        const group = groupById.get(groupId);
        if (!group || group.is_archived) continue;
        assignedGroupsDistinct.add(groupId);
        const lastAccessAt = overviewByGroupId.get(groupId)?.last_access_at ?? null;
        if (daysSince(lastAccessAt) >= INACTIVITY_DAYS) inactive7dAssignedGroups += 1;
      }

      const attendants: AttendantAgg[] = Array.from(buckets.entries()).map(([identityKey, bucket]) => {
        let inactive7dGroupsCount = 0;
        let lastGroupActivityAt: string | null = null;

        for (const groupId of bucket.groupIds) {
          const lastAccessAt = overviewByGroupId.get(groupId)?.last_access_at ?? null;
          if (daysSince(lastAccessAt) >= INACTIVITY_DAYS) inactive7dGroupsCount += 1;
          if (lastAccessAt && (!lastGroupActivityAt || lastAccessAt > lastGroupActivityAt)) {
            lastGroupActivityAt = lastAccessAt;
          }
        }

        const displayName = (bucket.member.display_name || bucket.member.name || "Atendente").trim();
        return {
          identityKey,
          name: displayName,
          avatarUrl: bucket.member.profile_pic_url,
          phone: bucket.member.phone_e164,
          activeGroupsCount: bucket.groupIds.size,
          inactive7dGroupsCount,
          lastGroupActivityAt,
          groupsPreview: bucket.groupsPreview,
          supportMessages30d: bucket.supportMessages30d,
          answeredInteractions30d: bucket.answeredInteractions30d,
          answeredWithinSla30d: bucket.answeredWithinSla30d,
          slaPct30d: bucket.answeredInteractions30d > 0
            ? (bucket.answeredWithinSla30d / bucket.answeredInteractions30d) * 100
            : null,
          avgResponseMs30d: bucket.responseCount ? bucket.responseTotalMs / bucket.responseCount : null,
        };
      }).filter((row) => row.activeGroupsCount > 0).sort((a, b) => {
        if (a.activeGroupsCount !== b.activeGroupsCount) return b.activeGroupsCount - a.activeGroupsCount;
        return a.name.localeCompare(b.name, "pt-BR");
      });

      const nowSummary = buildSupportNowSummary({
        filteredGroupIds,
        nowMessagesSample,
        supportIdentityKeysByGroup,
        memberIdentityById,
        groupById,
        overviewByGroupId,
        responseSlaBusinessMinutes: RESPONSE_SLA_BUSINESS_MINUTES,
      });

      return {
        attendants,
        totalAssignedGroups: assignedGroupsDistinct.size,
        inactive7dAssignedGroups,
        supportMessages30d,
        answeredInteractions30d,
        answeredWithinSla30d,
        slaPct30d: answeredInteractions30d > 0 ? (answeredWithinSla30d / answeredInteractions30d) * 100 : null,
        openPendingInteractions,
        openPendingSlaBreached,
        demandClusters,
        demandClusterSampleCapped: demandMessagesSample.length >= DEMAND_CLUSTER_SAMPLE_LIMIT,
        avgResponseMs30d: totalResponseCount ? totalResponseMs / totalResponseCount : null,
        sequenceSampleCapped: sequenceMessagesSample.length >= SEQUENCE_MESSAGES_SAMPLE_LIMIT,
        supportMessagesSampleCapped: supportMessagesSample.length >= SUPPORT_MESSAGES_SAMPLE_LIMIT,
        nowSummary,
      };
    },
    enabled: isAuthenticated && isSystemAdmin,
  });

  const filteredAttendants = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    if (!q) return supportQuery.data?.attendants ?? [];
    return (supportQuery.data?.attendants ?? []).filter((row) =>
      row.name.toLowerCase().includes(q) ||
      (row.phone || "").toLowerCase().includes(q) ||
      row.groupsPreview.some((g) => g.toLowerCase().includes(q)),
    );
  }, [debouncedSearch, supportQuery.data?.attendants]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, orgFilter, selectedPeriod, customRange?.from, customRange?.to]);

  const pagedAttendants = useMemo(() => {
    const from = (page - 1) * PAGE_SIZE;
    return filteredAttendants.slice(from, from + PAGE_SIZE);
  }, [filteredAttendants, page]);

  if (authLoading || rolesLoading) {
    return (
      <AdminLayout title="Atendimento" subtitle="Carregando...">
        <LoadingState message="Verificando permissões..." />
      </AdminLayout>
    );
  }

  if (!isSystemAdmin) return <AccessDenied />;

  if (supportQuery.isLoading) {
    return (
      <AdminLayout title="Atendimento" subtitle="Carregando...">
        <LoadingState message="Consolidando grupos por atendente..." />
      </AdminLayout>
    );
  }

  if (supportQuery.error) {
    return (
      <AdminLayout title="Atendimento" subtitle="Erro">
        <ErrorState
          title="Falha ao carregar atendimento"
          message="Não foi possível consolidar os grupos por atendente."
          retry={() => supportQuery.refetch()}
        />
      </AdminLayout>
    );
  }

  const attendants = supportQuery.data?.attendants ?? [];
  const totalAssignedGroups = supportQuery.data?.totalAssignedGroups ?? 0;
  const inactive7dAssignedGroups = supportQuery.data?.inactive7dAssignedGroups ?? 0;
  const supportMessages30d = supportQuery.data?.supportMessages30d ?? 0;
  const answeredInteractions30d = supportQuery.data?.answeredInteractions30d ?? 0;
  const answeredWithinSla30d = supportQuery.data?.answeredWithinSla30d ?? 0;
  const slaPct30d = supportQuery.data?.slaPct30d ?? null;
  const openPendingInteractions = supportQuery.data?.openPendingInteractions ?? 0;
  const openPendingSlaBreached = supportQuery.data?.openPendingSlaBreached ?? 0;
  const demandClusters = supportQuery.data?.demandClusters ?? [];
  const avgResponseMs30d = supportQuery.data?.avgResponseMs30d ?? null;
  const nowSummary = supportQuery.data?.nowSummary;
  const avgGroupsPerAttendant = attendants.length ? totalAssignedGroups / attendants.length : 0;
  const periodLabel = selectedPeriod === "custom" ? "período" : selectedPeriod;
  const organizationNameById = new Map((organizationsQuery.data ?? []).map((org) => [org.id, org.name]));
  const nowStatusMeta: Array<{
    key: SupportNowStatus;
    title: string;
    description: string;
    icon: typeof MessageCircleWarning;
    accent: string;
  }> = [
    {
      key: "awaiting_attendant",
      title: "Aguardando atendente",
      description: "Cliente falou por último e o time ainda deve resposta.",
      icon: MessageCircleWarning,
      accent: "border-rose-500/20 bg-rose-500/[0.06] text-rose-950 dark:text-rose-100",
    },
    {
      key: "in_progress",
      title: "Em atendimento",
      description: "Houve troca recente entre cliente e suporte nas últimas horas.",
      icon: Radio,
      accent: "border-sky-500/20 bg-sky-500/[0.06] text-sky-950 dark:text-sky-100",
    },
    {
      key: "awaiting_customer",
      title: "Aguardando cliente",
      description: "O time respondeu por último e a próxima ação depende do cliente.",
      icon: TimerReset,
      accent: "border-amber-500/20 bg-amber-500/[0.08] text-amber-950 dark:text-amber-100",
    },
    {
      key: "inactive",
      title: "Sem atividade recente",
      description: `Sem sinal forte de conversa recente nos últimos ${INACTIVITY_DAYS} dias.`,
      icon: PauseCircle,
      accent: "border-slate-500/20 bg-slate-500/[0.06] text-slate-950 dark:text-slate-100",
    },
  ];

  const columns = [
    {
      key: "attendant",
      header: "Atendente",
      sortable: true,
      sortValue: (row: AttendantAgg) => row.name || "",
      render: (row: AttendantAgg) => (
        <div className="space-y-0.5">
          <UserInline name={row.name} avatarUrl={row.avatarUrl} />
          {row.phone ? <div className="pl-8 text-xs text-muted-foreground">{row.phone}</div> : null}
        </div>
      ),
    },
    {
      key: "groups",
      header: "Grupos",
      sortable: true,
      sortValue: (row: AttendantAgg) => row.activeGroupsCount,
      render: (row: AttendantAgg) => <span className="font-medium tabular-nums">{row.activeGroupsCount}</span>,
    },
    {
      key: "inactive7d",
      header: `Inativos ${INACTIVITY_DAYS}d`,
      hideOn: "sm",
      sortable: true,
      sortValue: (row: AttendantAgg) => row.inactive7dGroupsCount,
      render: (row: AttendantAgg) => (
        <Badge variant={row.inactive7dGroupsCount > 0 ? "secondary" : "outline"}>
          {row.inactive7dGroupsCount}
        </Badge>
      ),
    },
    {
      key: "tmr",
      header: "TMR (aprox.)",
      hideOn: "md",
      sortable: true,
      sortValue: (row: AttendantAgg) => row.avgResponseMs30d ?? Number.MAX_SAFE_INTEGER,
      render: (row: AttendantAgg) => formatRelativeMinutes(row.avgResponseMs30d),
    },
    {
      key: "sla",
      header: `SLA ${RESPONSE_SLA_BUSINESS_MINUTES}m`,
      hideOn: "lg",
      sortable: true,
      sortValue: (row: AttendantAgg) => row.slaPct30d ?? -1,
      render: (row: AttendantAgg) => (
        <span className="tabular-nums">{`${(row.slaPct30d ?? 0).toFixed(1).replace(".", ",")}%`}</span>
      ),
    },
    {
      key: "answered",
      header: "Interações resp. (30d)",
      hideOn: "lg",
      sortable: true,
      sortValue: (row: AttendantAgg) => row.answeredInteractions30d,
      render: (row: AttendantAgg) => <span className="tabular-nums">{row.answeredInteractions30d}</span>,
    },
    {
      key: "lastActivity",
      header: "Última atividade",
      hideOn: "md",
      sortable: true,
      sortValue: (row: AttendantAgg) => row.lastGroupActivityAt ?? "",
      render: (row: AttendantAgg) => row.lastGroupActivityAt ? formatDateSimpleBR(row.lastGroupActivityAt) : "Sem atividade",
    },
    {
      key: "preview",
      header: "Grupos (amostra)",
      hideOn: "lg",
      sortable: true,
      sortValue: (row: AttendantAgg) => row.groupsPreview.join(", "),
      render: (row: AttendantAgg) => (
        <span className="text-sm text-muted-foreground">
          {row.groupsPreview.join(", ")}
          {row.activeGroupsCount > row.groupsPreview.length ? "..." : ""}
        </span>
      ),
    },
  ];

  return (
    <AdminLayout title="Atendimento" subtitle="Central de Comando › Atendimento">
      <div className="space-y-8 animate-fade-in">
        <AdminPageHeader
          breadcrumbItems={[{ label: "Central de Comando", href: "/" }, { label: "Atendimento" }]}
          title="Atendimento"
          description="Visão operacional por atendente e grupos vinculados para os KPIs de atendimento."
          filters={(
            <div className="flex flex-wrap items-center gap-2">
              <PeriodFilter
                value={selectedPeriod}
                customRange={customRange}
                onChange={(period, range) => {
                  setSelectedPeriod(period);
                  setCustomRange(period === "custom" ? range : undefined);
                }}
              />
              <Select value={orgFilter} onValueChange={setOrgFilter}>
                <SelectTrigger className="w-[240px] bg-card border-border">
                  <SelectValue placeholder="Organização" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as organizações</SelectItem>
                  {(organizationsQuery.data ?? []).map((org) => (
                    <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <input
                type="text"
                placeholder="Buscar atendente, telefone ou grupo"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-72 px-3 py-2 rounded-lg border border-border bg-card text-sm"
              />
            </div>
          )}
          showClearFilters={!!search || orgFilter !== "all" || selectedPeriod !== "30d" || !!customRange}
          onClearFilters={() => {
            setSearch("");
            setOrgFilter("all");
            setSelectedPeriod("30d");
            setCustomRange(undefined);
          }}
          filteredKpis={(
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              <StatsCard
                title="Atendentes ativos"
                value={attendants.length}
                icon={Headset}
                variant="kpi"
                help={SYSTEM_SUPPORT_KPI_HELP.attendants}
                className={`${SUPPORT_KPI_CARD} border-sky-500/15 bg-gradient-to-br from-sky-500/[0.08] via-card to-card`}
                valueClassName={`${SUPPORT_KPI_VALUE} text-sky-950 dark:text-sky-100`}
                numericValue
              />
              <StatsCard
                title="Grupos vinculados"
                value={totalAssignedGroups}
                icon={Layers}
                variant="kpi"
                help={SYSTEM_SUPPORT_KPI_HELP.groups}
                className={`${SUPPORT_KPI_CARD} border-indigo-500/15 bg-gradient-to-br from-indigo-500/[0.08] via-card to-card`}
                valueClassName={`${SUPPORT_KPI_VALUE} text-indigo-950 dark:text-indigo-100`}
                numericValue
              />
              <StatsCard
                title={`Grupos inativos (${INACTIVITY_DAYS}d)`}
                value={inactive7dAssignedGroups}
                icon={Clock3}
                variant="kpi"
                help={SYSTEM_SUPPORT_KPI_HELP.inactive}
                className={`${SUPPORT_KPI_CARD} border-amber-500/15 bg-gradient-to-br from-amber-500/[0.10] via-card to-card`}
                valueClassName={`${SUPPORT_KPI_VALUE} text-amber-950 dark:text-amber-100`}
                numericValue
              />
              <StatsCard
                title="Média grupos"
                value={avgGroupsPerAttendant.toFixed(1).replace(".", ",")}
                icon={Activity}
                variant="kpi"
                help={SYSTEM_SUPPORT_KPI_HELP.avgGroups}
                className={`${SUPPORT_KPI_CARD} border-teal-500/15 bg-gradient-to-br from-teal-500/[0.08] via-card to-card`}
                valueClassName={`${SUPPORT_KPI_VALUE} text-teal-950 dark:text-teal-100`}
                numericValue
              />
              <StatsCard
                title={`TMR útil (${periodLabel})`}
                value={formatRelativeMinutes(avgResponseMs30d)}
                icon={Clock3}
                variant="kpi"
                help={SYSTEM_SUPPORT_KPI_HELP.tmr}
                className={`${SUPPORT_KPI_CARD} border-violet-500/15 bg-gradient-to-br from-violet-500/[0.08] via-card to-card`}
                valueClassName={`${SUPPORT_KPI_VALUE} text-violet-950 dark:text-violet-100`}
                description={`${answeredInteractions30d.toLocaleString("pt-BR")} interações • horário comercial`}
                numericValue
              />
              <StatsCard
                title={`SLA ${RESPONSE_SLA_BUSINESS_MINUTES}min (útil)`}
                value={`${(slaPct30d ?? 0).toFixed(1).replace(".", ",")}%`}
                icon={CheckCircle2}
                variant="kpi"
                help={SYSTEM_SUPPORT_KPI_HELP.sla}
                className={`${SUPPORT_KPI_CARD} border-emerald-500/15 bg-gradient-to-br from-emerald-500/[0.08] via-card to-card`}
                valueClassName={`${SUPPORT_KPI_VALUE} text-emerald-950 dark:text-emerald-100`}
                description={`${answeredWithinSla30d.toLocaleString("pt-BR")} respostas no SLA`}
                numericValue
              />
              <StatsCard
                title="Pendências abertas"
                value={openPendingInteractions.toLocaleString("pt-BR")}
                icon={Headset}
                variant="kpi"
                help={SYSTEM_SUPPORT_KPI_HELP.pending}
                className={`${SUPPORT_KPI_CARD} border-rose-500/15 bg-gradient-to-br from-rose-500/[0.08] via-card to-card`}
                valueClassName={`${SUPPORT_KPI_VALUE} text-rose-950 dark:text-rose-100`}
                description={`${openPendingSlaBreached.toLocaleString("pt-BR")} fora do SLA`}
                numericValue
              />
              <StatsCard
                title={`Msgs atendentes (${periodLabel})`}
                value={supportMessages30d.toLocaleString("pt-BR")}
                icon={Activity}
                variant="kpi"
                help={SYSTEM_SUPPORT_KPI_HELP.messages}
                className={`${SUPPORT_KPI_CARD} border-cyan-500/15 bg-gradient-to-br from-cyan-500/[0.08] via-card to-card`}
                valueClassName={`${SUPPORT_KPI_VALUE} text-cyan-950 dark:text-cyan-100`}
                description="Amostral em grupos vinculados"
                numericValue
              />
            </div>
          )}
        />

        {(supportQuery.data?.sequenceSampleCapped || supportQuery.data?.supportMessagesSampleCapped || supportQuery.data?.demandClusterSampleCapped) ? (
          <div className="rounded-xl border border-warning/30 bg-warning/5 px-4 py-3 text-xs leading-relaxed text-warning">
            Métricas de atendimento do período usam amostragem para manter performance em bases maiores. TMR é aproximado e considera horário comercial (seg-sex, 08h-18h SP).
          </div>
        ) : null}

        <section className="rounded-[28px] border border-border/70 bg-card p-5 shadow-subtle">
          <ExecutiveSectionHeader
            eyebrow="Operação ao vivo"
            title="Resumo Agora"
            description="Leitura do estado atual dos grupos vinculados. Este bloco ignora o filtro de período e usa a janela recente para mostrar quem está esperando o quê agora."
            icon={MessageCircleWarning}
            className="mb-4"
          />
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 2xl:grid-cols-4">
            {nowStatusMeta.map((meta) => {
              const count = nowSummary?.counts[meta.key] ?? 0;
              const items = (nowSummary?.items ?? []).filter((item) => item.status === meta.key).slice(0, 4);
              const Icon = meta.icon;

              return (
                <div key={meta.key} className={cn("rounded-[24px] border p-4", meta.accent)}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{meta.title}</div>
                      <div className="mt-2 text-3xl font-semibold tracking-[-0.04em] tabular-nums">{count.toLocaleString("pt-BR")}</div>
                    </div>
                    <div className="rounded-2xl border border-current/10 bg-background/80 p-2 text-current">
                      <Icon className="h-4 w-4" />
                    </div>
                  </div>
                  <p className="mt-2 text-sm leading-5 text-muted-foreground">{meta.description}</p>
                  <div className="mt-4 space-y-2">
                    {items.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-border/60 bg-background/60 px-3 py-2 text-sm text-muted-foreground">
                        Nenhum grupo nesta faixa agora.
                      </div>
                    ) : items.map((item) => {
                      const orgName = organizationNameById.get(item.organizationId) ?? "Organização";
                      return (
                        <div key={item.groupId} className="rounded-2xl border border-border/60 bg-background/80 px-3 py-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium text-foreground">{item.groupName}</div>
                              <div className="truncate text-xs text-muted-foreground">{orgName}</div>
                            </div>
                            <Badge variant={item.slaBreached ? "destructive" : "outline"}>
                              {item.assignedAttendants.toLocaleString("pt-BR")} atend.
                            </Badge>
                          </div>
                          <div className="mt-2 text-xs text-muted-foreground">
                            {item.status === "awaiting_attendant"
                              ? `${formatRelativeSince(item.waitingSinceAt)} • pendência ${formatRelativeMinutes(item.waitingBusinessMs)}${item.slaBreached ? " • fora do SLA" : ""}`
                              : `${formatRelativeSince(item.lastMessageAt)} • última atividade`}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-2xl border border-border/60 bg-card p-5">
          <ExecutiveSectionHeader
            eyebrow="Qualitativo"
            title="Clusterização de demandas (MVP)"
            description="Palavras-chave em mensagens de texto de clientes no período e filtros selecionados, comparadas ao período anterior equivalente."
            icon={Layers}
            className="mb-2"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            {demandClusters.filter((c) => c.count > 0).slice(0, 8).map((cluster) => (
              <div key={cluster.key} className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-sm">
                <span className="font-medium text-foreground">{cluster.label}</span>
                <span className="text-muted-foreground tabular-nums">
                  {cluster.count.toLocaleString("pt-BR")} ({cluster.pct.toFixed(0).replace(".", ",")}%)
                </span>
                <span className={
                  cluster.deltaCount > 0
                    ? "text-xs tabular-nums text-warning"
                    : cluster.deltaCount < 0
                      ? "text-xs tabular-nums text-success"
                      : "text-xs tabular-nums text-muted-foreground"
                }>
                  {cluster.deltaCount > 0 ? "+" : ""}{cluster.deltaCount}
                </span>
              </div>
            ))}
            {!demandClusters.some((c) => c.count > 0) ? (
              <div className="text-sm text-muted-foreground">Sem mensagens de texto suficientes para clusterização no período.</div>
            ) : null}
          </div>
        </section>

        {attendants.length === 0 ? (
          <EmptyState
            icon={Headset}
            title="Nenhum atendente configurado"
            message="Defina atendentes nos grupos para habilitar a visão consolidada por atendente."
          />
        ) : (
          <>
            <ListSectionHeader
              className="mb-3"
              title="Lista de atendentes"
              count={filteredAttendants.length.toLocaleString("pt-BR")}
              statusLabel={ADMIN_MICROCOPY.listStatus.selectedScopeRecords}
              isLoading={supportQuery.isFetching}
            />
            <BorisTable
              columns={columns as any}
              data={pagedAttendants}
              keyExtractor={(row) => row.identityKey}
              page={page}
              pageSize={PAGE_SIZE}
              totalCount={filteredAttendants.length}
              onPageChange={setPage}
              loading={supportQuery.isFetching}
              error={false}
              emptyIcon={Headset}
              emptyMessage="Nenhum atendente encontrado para esse filtro."
            />
          </>
        )}
      </div>
    </AdminLayout>
  );
}
