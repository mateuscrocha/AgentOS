import { useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Headset,
  Search,
  UserPlus,
  MessageSquare,
  Activity,
  Clock3,
  CheckCircle2,
  Loader2,
  Trash2,
  UserCheck,
} from "lucide-react";

import { AdminLayout } from "@/components/layout/AdminLayout";
import { GroupPageTop } from "@/components/group-navigation/GroupPageTop";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { StatusTag } from "@/components/ui/status-tag";
import { notify } from "@/components/ui/sonner";
import { useAuth } from "@/hooks/use-auth";
import { useUserRoles } from "@/hooks/use-user-roles";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_SUPPORT_BUSINESS_HOURS, businessMsBetween } from "@/lib/business-time";
import { compareDemandClusters, type DemandClusterTrendStat } from "@/lib/support-demand-clusters";
import { cn, formatPhoneE164BR, getInitialsFromName } from "@/lib/utils";

import AccessDenied from "./AccessDenied";

type GroupInfo = {
  groupName: string;
  orgName?: string;
  orgId: string;
  provider: string | null;
  syncStatus: string | null;
};

export type MemberRow = {
  id: string;
  group_id: string;
  name: string;
  display_name: string | null;
  phone_e164: string | null;
  lid: string | null;
  profile_pic_url: string | null;
  status: string | null;
  left_at: string | null;
  deleted_at: string | null;
  last_seen_message_at: string | null;
};

type SupportAssignment = {
  id: string;
  group_id: string;
  member_id: string;
  status: "active" | "inactive";
  is_active: boolean;
  granted_at: string | null;
  revoked_at: string | null;
  deleted_at: string | null;
};

export type SupportMemberMetric = {
  identityKey: string;
  messageCount: number;
  participationShare: number;
  lastMessageAt: string | null;
  answeredInteractions: number;
  answeredWithinSla: number;
  slaPct: number | null;
  avgResponseMs: number | null;
};

export type SupportKpis = {
  totalMessages30d: number;
  supportMessages30d: number;
  supportParticipationPct: number;
  answeredInteractions: number;
  answeredWithinSla: number;
  slaPct: number | null;
  openPendingInteractions: number;
  openPendingSlaBreached: number;
  demandClusters: DemandClusterTrendStat[];
  demandClusterSampleCapped: boolean;
  avgResponseMs: number | null;
  sequenceSampleCapped: boolean;
  supportMessageSampleCapped: boolean;
  perSupport: Record<string, SupportMemberMetric>;
};

type SupportGroupRow = {
  identityKey: string;
  member: MemberRow;
  members: MemberRow[];
  assignments: SupportAssignment[];
  isActive: boolean;
};

const SUPPORT_MESSAGE_SAMPLE_LIMIT = 5000;
const SEQUENCE_SAMPLE_LIMIT = 3000;
const DEMAND_CLUSTER_SAMPLE_LIMIT = 2000;
const KPI_LOOKBACK_DAYS = 30;
const GROUP_INACTIVITY_DAYS = 7;
const RESPONSE_SLA_BUSINESS_MINUTES = 30;
const GROUP_SUPPORT_KPI_HELP = {
  attendants: {
    whatIs: "Quantidade de pessoas marcadas como atendentes ativos neste grupo.",
    howToInterpret: "Mostra quem entra na contagem dos KPIs de atendimento do grupo.",
  },
  supportMessages: {
    whatIs: "Volume de mensagens enviadas pelos atendentes ativos no período analisado.",
    howToInterpret: "Ajuda a estimar atuação do time no grupo.",
  },
  participation: {
    whatIs: "Percentual de mensagens dos atendentes sobre o total de mensagens do grupo no período.",
    howToInterpret: "Percentual alto indica maior presença do time na conversa; muito alto pode indicar suporte reativo intenso.",
  },
  tmr: {
    whatIs: "Tempo médio entre mensagem do cliente e primeira resposta do atendente, em horário comercial.",
    howToInterpret: "Quanto menor, melhor. É uma métrica aproximada baseada na sequência de mensagens.",
    whatToObserve: "Compare com SLA e volume de pendências.",
  },
  sla: {
    whatIs: `Percentual de respostas dentro de ${RESPONSE_SLA_BUSINESS_MINUTES} minutos úteis.`,
    howToInterpret: "Quanto maior, melhor. Indica aderência ao SLA definido para atendimento.",
  },
  pending: {
    whatIs: "Pendência aberta sem resposta de atendente na sequência atual da conversa.",
    howToInterpret: "Mostra se existe atendimento aguardando retorno neste momento (MVP: até 1 pendência por grupo).",
  },
  inactivity: {
    whatIs: `Status de atividade do grupo considerando ${GROUP_INACTIVITY_DAYS} dias sem mensagem.`,
    howToInterpret: "Ajuda a identificar grupos frios/inativos e risco de abandono.",
  },
} as const;

export function normalizePhoneForIdentity(phone?: string | null) {
  const raw = (phone || "").trim();
  if (!raw) return "";
  return raw.replace(/[^\d+]/g, "");
}

export function memberIdentityKey(member: Pick<MemberRow, "id" | "phone_e164" | "lid">) {
  const phone = normalizePhoneForIdentity(member.phone_e164);
  if (phone) return `phone:${phone}`;
  if (member.lid) return `lid:${String(member.lid).trim()}`;
  return `member:${member.id}`;
}

function messageIdentityKey(message: { member_id: string | null; sender_phone: string | null }, memberIdentityById: Map<string, string>) {
  if (message.member_id && memberIdentityById.has(message.member_id)) {
    return memberIdentityById.get(message.member_id)!;
  }
  const phone = normalizePhoneForIdentity(message.sender_phone);
  if (phone) return `phone:${phone}`;
  return null;
}

function formatRelativeMinutes(ms: number | null) {
  if (!ms || !Number.isFinite(ms)) return "N/A";
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return rem ? `${hours}h ${rem}m` : `${hours}h`;
}

function formatDateTime(date?: string | null) {
  if (!date) return "-";
  try {
    return new Date(date).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "-";
  }
}

function diffDaysFromNow(date?: string | null) {
  if (!date) return null;
  const diffMs = Date.now() - new Date(date).getTime();
  if (!Number.isFinite(diffMs) || diffMs < 0) return 0;
  return Math.floor(diffMs / (24 * 60 * 60 * 1000));
}

export function buildSupportKpis(
  totalMessages30d: number,
  supportMessagesCount30d: number,
  supportMessagesSample: Array<{ member_id: string | null; sender_phone: string | null; created_at: string }>,
  sequenceMessagesSample: Array<{ member_id: string | null; sender_phone: string | null; created_at: string }>,
  demandMessagesSample: Array<{ member_id: string | null; sender_phone: string | null; text: string | null; content: string | null }>,
  previousDemandMessagesSample: Array<{ member_id: string | null; sender_phone: string | null; text: string | null; content: string | null }>,
  activeSupportMembers: MemberRow[],
) : SupportKpis {
  const memberIdentityById = new Map(activeSupportMembers.map((m) => [m.id, memberIdentityKey(m)]));
  const supportIdentitySet = new Set(activeSupportMembers.map((m) => memberIdentityKey(m)));
  const perSupport: Record<string, SupportMemberMetric> = {};

  for (const m of activeSupportMembers) {
    const key = memberIdentityKey(m);
    if (!perSupport[key]) {
      perSupport[key] = {
        identityKey: key,
        messageCount: 0,
        participationShare: 0,
        lastMessageAt: null,
        answeredInteractions: 0,
        answeredWithinSla: 0,
        slaPct: null,
        avgResponseMs: null,
      };
    }
  }

  const responseAcc: Record<string, { totalMs: number; count: number }> = {};
  let answeredInteractions = 0;
  let answeredWithinSla = 0;
  let openPendingInteractions = 0;
  let openPendingSlaBreached = 0;
  let totalResponseMs = 0;
  let totalResponseCount = 0;

  for (const msg of supportMessagesSample) {
    const key = messageIdentityKey(msg, memberIdentityById);
    if (!key || !supportIdentitySet.has(key)) continue;
    const bucket = perSupport[key] ?? {
      identityKey: key,
      messageCount: 0,
      participationShare: 0,
      lastMessageAt: null,
      answeredInteractions: 0,
      answeredWithinSla: 0,
      slaPct: null,
      avgResponseMs: null,
    };
    bucket.messageCount += 1;
    if (!bucket.lastMessageAt || msg.created_at > bucket.lastMessageAt) {
      bucket.lastMessageAt = msg.created_at;
    }
    perSupport[key] = bucket;
  }

  let pendingNonSupportAt: string | null = null;
  let pendingNonSupportKey: string | null = null;
  for (const msg of sequenceMessagesSample) {
    const currentKey = messageIdentityKey(msg, memberIdentityById);
    const isSupport = !!currentKey && supportIdentitySet.has(currentKey);

    if (!isSupport) {
      pendingNonSupportAt = msg.created_at;
      pendingNonSupportKey = currentKey;
      continue;
    }

    if (!pendingNonSupportAt || !currentKey) continue;

    const lagMs = businessMsBetween(pendingNonSupportAt, msg.created_at, DEFAULT_SUPPORT_BUSINESS_HOURS);
    const validLag = Number.isFinite(lagMs) && lagMs >= 0 && lagMs <= 72 * 60 * 60 * 1000;
    const differentAuthors = !pendingNonSupportKey || pendingNonSupportKey !== currentKey;
    if (!validLag || !differentAuthors) continue;

    answeredInteractions += 1;
    if (lagMs <= RESPONSE_SLA_BUSINESS_MINUTES * 60 * 1000) {
      answeredWithinSla += 1;
      const bucketForSla = perSupport[currentKey];
      if (bucketForSla) bucketForSla.answeredWithinSla += 1;
    }
    totalResponseMs += lagMs;
    totalResponseCount += 1;
    const acc = responseAcc[currentKey] ?? { totalMs: 0, count: 0 };
    acc.totalMs += lagMs;
    acc.count += 1;
    responseAcc[currentKey] = acc;
    const bucket = perSupport[currentKey];
    if (bucket) bucket.answeredInteractions += 1;

    // Consider the first support response as the response for that pending interaction.
    pendingNonSupportAt = null;
    pendingNonSupportKey = null;
  }

  if (pendingNonSupportAt) {
    openPendingInteractions = 1;
    const pendingBusinessMs = businessMsBetween(pendingNonSupportAt, new Date(), DEFAULT_SUPPORT_BUSINESS_HOURS);
    if (pendingBusinessMs > RESPONSE_SLA_BUSINESS_MINUTES * 60 * 1000) {
      openPendingSlaBreached = 1;
    }
  }

  for (const key of Object.keys(perSupport)) {
    perSupport[key].participationShare = totalMessages30d > 0 ? perSupport[key].messageCount / totalMessages30d : 0;
    const acc = responseAcc[key];
    perSupport[key].avgResponseMs = acc?.count ? acc.totalMs / acc.count : null;
    perSupport[key].slaPct = perSupport[key].answeredInteractions > 0
      ? (perSupport[key].answeredWithinSla / perSupport[key].answeredInteractions) * 100
      : null;
  }

  const currentDemandTexts = demandMessagesSample
    .filter((msg) => {
      const key = messageIdentityKey(msg, memberIdentityById);
      return !key || !supportIdentitySet.has(key);
    })
    .map((msg) => (msg.text || msg.content || "").trim());
  const previousDemandTexts = previousDemandMessagesSample
    .filter((msg) => {
      const key = messageIdentityKey(msg, memberIdentityById);
      return !key || !supportIdentitySet.has(key);
    })
    .map((msg) => (msg.text || msg.content || "").trim());
  const demandClusters = compareDemandClusters(currentDemandTexts, previousDemandTexts);

  return {
    totalMessages30d,
    supportMessages30d: supportMessagesCount30d,
    supportParticipationPct: totalMessages30d > 0 ? (supportMessagesCount30d / totalMessages30d) * 100 : 0,
    answeredInteractions,
    answeredWithinSla,
    slaPct: answeredInteractions > 0 ? (answeredWithinSla / answeredInteractions) * 100 : null,
    openPendingInteractions,
    openPendingSlaBreached,
    demandClusters,
    demandClusterSampleCapped: demandMessagesSample.length >= DEMAND_CLUSTER_SAMPLE_LIMIT,
    avgResponseMs: totalResponseCount > 0 ? totalResponseMs / totalResponseCount : null,
    sequenceSampleCapped: sequenceMessagesSample.length >= SEQUENCE_SAMPLE_LIMIT,
    supportMessageSampleCapped: supportMessagesSample.length >= SUPPORT_MESSAGE_SAMPLE_LIMIT,
    perSupport,
  };
}

const GroupSupport = () => {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const { isLoading: rolesLoading, canEditGroup } = useUserRoles();
  const [search, setSearch] = useState("");
  const searchQuery = search.trim();

  const { data: groupInfo } = useQuery({
    queryKey: ["group-support-group-info", groupId],
    queryFn: async (): Promise<GroupInfo | null> => {
      const { data: group, error } = await supabase
        .from("groups")
        .select("id, name, organization_id, provider, sync_status")
        .eq("id", groupId)
        .maybeSingle();
      if (error) throw error;
      if (!group) return null;

      const { data: org } = await supabase
        .from("organizations")
        .select("name")
        .eq("id", group.organization_id)
        .maybeSingle();

      return {
        groupName: group.name,
        orgName: org?.name ?? "Organização",
        orgId: group.organization_id,
        provider: group.provider,
        syncStatus: group.sync_status,
      };
    },
    enabled: !!groupId && isAuthenticated,
  });

  const canManageSupport = !!groupId && canEditGroup(groupId, groupInfo?.orgId);

  const { data: totalMembersCount } = useQuery({
    queryKey: ["group-support-total-members", groupId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("members")
        .select("id", { head: true, count: "exact" })
        .eq("group_id", groupId)
        .is("deleted_at", null)
        .neq("status", "inactive");
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!groupId && isAuthenticated,
  });

  const { data: lastMessageAt } = useQuery({
    queryKey: ["group-support-last-message", groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("created_at")
        .eq("group_id", groupId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(1);
      if (error) throw error;
      return (data?.[0] as { created_at: string } | undefined)?.created_at ?? null;
    },
    enabled: !!groupId && isAuthenticated,
  });

  const supportAssignmentsQuery = useQuery({
    queryKey: ["group-support-assignments", groupId],
    queryFn: async (): Promise<SupportAssignment[]> => {
      const { data, error } = await (supabase as any)
        .from("group_support_members")
        .select("id, group_id, member_id, status, is_active, granted_at, revoked_at, deleted_at")
        .eq("group_id", groupId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as SupportAssignment[];
    },
    enabled: !!groupId && isAuthenticated,
  });

  const supportMembersQuery = useQuery({
    queryKey: ["group-support-members", groupId, supportAssignmentsQuery.data?.map((a) => a.member_id).sort().join(",")],
    queryFn: async (): Promise<MemberRow[]> => {
      const ids = Array.from(new Set((supportAssignmentsQuery.data ?? []).map((a) => a.member_id).filter(Boolean)));
      if (ids.length === 0) return [];
      const { data, error } = await supabase
        .from("members")
        .select("id, group_id, name, display_name, phone_e164, lid, profile_pic_url, status, left_at, deleted_at, last_seen_message_at")
        .in("id", ids)
        .is("deleted_at", null);
      if (error) throw error;
      return (data ?? []) as MemberRow[];
    },
    enabled: !!groupId && isAuthenticated && !!supportAssignmentsQuery.data,
  });

  const lookbackStartISO = useMemo(() => {
    const dt = new Date();
    dt.setDate(dt.getDate() - KPI_LOOKBACK_DAYS);
    return dt.toISOString();
  }, []);
  const previousLookbackStartISO = useMemo(() => {
    const dt = new Date();
    dt.setDate(dt.getDate() - (KPI_LOOKBACK_DAYS * 2));
    return dt.toISOString();
  }, []);

  const supportRows = useMemo<SupportGroupRow[]>(() => {
    const membersById = new Map((supportMembersQuery.data ?? []).map((m) => [m.id, m]));
    const grouped = new Map<string, SupportGroupRow>();

    for (const assignment of supportAssignmentsQuery.data ?? []) {
      const member = membersById.get(assignment.member_id);
      if (!member) continue;
      const key = memberIdentityKey(member);
      const current = grouped.get(key);
      if (!current) {
        grouped.set(key, {
          identityKey: key,
          member,
          members: [member],
          assignments: [assignment],
          isActive: assignment.is_active && assignment.status === "active",
        });
        continue;
      }

      if (!current.members.some((m) => m.id === member.id)) current.members.push(member);
      current.assignments.push(assignment);
      current.isActive = current.isActive || (assignment.is_active && assignment.status === "active");
      const currentHasPhone = !!normalizePhoneForIdentity(current.member.phone_e164);
      const candidateHasPhone = !!normalizePhoneForIdentity(member.phone_e164);
      if (!currentHasPhone && candidateHasPhone) current.member = member;
    }

    return Array.from(grouped.values()).sort((a, b) => {
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
      const aName = (a.member.display_name || a.member.name || "").toLowerCase();
      const bName = (b.member.display_name || b.member.name || "").toLowerCase();
      return aName.localeCompare(bName, "pt-BR");
    });
  }, [supportAssignmentsQuery.data, supportMembersQuery.data]);

  const activeSupportMembers = useMemo(() => {
    const ids = new Set<string>();
    const all: MemberRow[] = [];
    for (const row of supportRows) {
      if (!row.isActive) continue;
      for (const m of row.members) {
        if (ids.has(m.id)) continue;
        ids.add(m.id);
        all.push(m);
      }
    }
    return all;
  }, [supportRows]);

  const kpisQuery = useQuery({
    queryKey: ["group-support-kpis", groupId, lookbackStartISO, activeSupportMembers.map((m) => m.id).sort().join(",")],
    queryFn: async (): Promise<SupportKpis> => {
      const activeSupportMemberIds = activeSupportMembers.map((m) => m.id);

      const totalMessagesPromise = supabase
        .from("messages")
        .select("id", { head: true, count: "exact" })
        .eq("group_id", groupId)
        .is("deleted_at", null)
        .gte("created_at", lookbackStartISO);

      const supportMessagesCountPromise = activeSupportMemberIds.length > 0
        ? supabase
            .from("messages")
            .select("id", { head: true, count: "exact" })
            .eq("group_id", groupId)
            .is("deleted_at", null)
            .gte("created_at", lookbackStartISO)
            .in("member_id", activeSupportMemberIds)
        : Promise.resolve({ count: 0, error: null } as const);

      const supportMessagesSamplePromise = activeSupportMemberIds.length > 0
        ? supabase
            .from("messages")
            .select("member_id, sender_phone, created_at")
            .eq("group_id", groupId)
            .is("deleted_at", null)
            .gte("created_at", lookbackStartISO)
            .in("member_id", activeSupportMemberIds)
            .order("created_at", { ascending: false })
            .limit(SUPPORT_MESSAGE_SAMPLE_LIMIT)
        : Promise.resolve({ data: [], error: null } as const);

      const sequenceMessagesSamplePromise = supabase
        .from("messages")
        .select("member_id, sender_phone, created_at")
        .eq("group_id", groupId)
        .is("deleted_at", null)
        .gte("created_at", lookbackStartISO)
        .order("created_at", { ascending: true })
        .limit(SEQUENCE_SAMPLE_LIMIT);

      const demandMessagesSamplePromise = supabase
        .from("messages")
        .select("member_id, sender_phone, text, content")
        .eq("group_id", groupId)
        .is("deleted_at", null)
        .gte("created_at", lookbackStartISO)
        .eq("message_type", "text")
        .order("created_at", { ascending: false })
        .limit(DEMAND_CLUSTER_SAMPLE_LIMIT);

      const previousDemandMessagesSamplePromise = supabase
        .from("messages")
        .select("member_id, sender_phone, text, content")
        .eq("group_id", groupId)
        .is("deleted_at", null)
        .gte("created_at", previousLookbackStartISO)
        .lt("created_at", lookbackStartISO)
        .eq("message_type", "text")
        .order("created_at", { ascending: false })
        .limit(DEMAND_CLUSTER_SAMPLE_LIMIT);

      const [totalMessages, supportCount, supportMessagesSample, sequenceMessagesSample, demandMessagesSample, previousDemandMessagesSample] = await Promise.all([
        totalMessagesPromise,
        supportMessagesCountPromise,
        supportMessagesSamplePromise,
        sequenceMessagesSamplePromise,
        demandMessagesSamplePromise,
        previousDemandMessagesSamplePromise,
      ]);

      const err =
        totalMessages.error ||
        (supportCount as any).error ||
        (supportMessagesSample as any).error ||
        sequenceMessagesSample.error ||
        demandMessagesSample.error ||
        previousDemandMessagesSample.error;
      if (err) throw err;

      return buildSupportKpis(
        totalMessages.count ?? 0,
        (supportCount as any).count ?? 0,
        ((supportMessagesSample as any).data ?? []) as Array<{ member_id: string | null; sender_phone: string | null; created_at: string }>,
        (sequenceMessagesSample.data ?? []) as Array<{ member_id: string | null; sender_phone: string | null; created_at: string }>,
        (demandMessagesSample.data ?? []) as Array<{ member_id: string | null; sender_phone: string | null; text: string | null; content: string | null }>,
        (previousDemandMessagesSample.data ?? []) as Array<{ member_id: string | null; sender_phone: string | null; text: string | null; content: string | null }>,
        activeSupportMembers,
      );
    },
    enabled: !!groupId && isAuthenticated && !!supportAssignmentsQuery.data && !!supportMembersQuery.data,
  });

  const candidateMembersQuery = useQuery({
    queryKey: ["group-support-candidates", groupId, search],
    queryFn: async (): Promise<MemberRow[]> => {
      let query = supabase
        .from("members")
        .select("id, group_id, name, display_name, phone_e164, lid, profile_pic_url, status, left_at, deleted_at, last_seen_message_at")
        .eq("group_id", groupId)
        .is("deleted_at", null)
        .order("last_seen_message_at", { ascending: false, nullsFirst: false })
        .limit(20);

      const q = search.trim();
      if (q) {
        query = query.or(`name.ilike.%${q}%,display_name.ilike.%${q}%,phone_e164.ilike.%${q}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as MemberRow[];
    },
    enabled: !!groupId && isAuthenticated && canManageSupport && searchQuery.length >= 2,
  });

  const supportIdentityKeys = useMemo(() => new Set(supportRows.map((r) => r.identityKey)), [supportRows]);
  const activeSupportPreview = useMemo(() => supportRows.filter((r) => r.isActive).slice(0, 8), [supportRows]);
  const inactiveDays = diffDaysFromNow(lastMessageAt);
  const isGroupInactive = inactiveDays !== null && inactiveDays >= GROUP_INACTIVITY_DAYS;

  const assignMutation = useMutation({
    mutationFn: async (member: MemberRow) => {
      const identity = memberIdentityKey(member);
      let peersQuery = supabase
        .from("members")
        .select("id, group_id, name, display_name, phone_e164, lid, profile_pic_url, status, left_at, deleted_at, last_seen_message_at")
        .eq("group_id", groupId)
        .is("deleted_at", null);
      const phone = normalizePhoneForIdentity(member.phone_e164);
      if (phone) peersQuery = peersQuery.eq("phone_e164", member.phone_e164);
      else if (member.lid) peersQuery = peersQuery.eq("lid", member.lid);
      else peersQuery = peersQuery.eq("id", member.id);
      const { data: peers, error: peersError } = await peersQuery;
      if (peersError) throw peersError;

      const rows = ((peers ?? [member]) as MemberRow[]).map((m) => ({
        group_id: groupId,
        member_id: m.id,
        status: "active",
        is_active: true,
        granted_at: new Date().toISOString(),
        granted_by_user_id: user?.id ?? null,
        revoked_at: null,
        deleted_at: null,
      }));

      const { error } = await (supabase as any)
        .from("group_support_members")
        .upsert(rows, { onConflict: "group_id,member_id" });
      if (error) throw error;

      return { identity, count: rows.length };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group-support-assignments", groupId] });
      notify.success("Suporte atualizado", "A pessoa foi marcada como suporte neste grupo.");
    },
    onError: (error: any) => {
      notify.error("Falha ao designar suporte", error?.message || "Tente novamente.");
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ row, nextActive }: { row: SupportGroupRow; nextActive: boolean }) => {
      const ids = row.assignments.map((a) => a.id);
      const patch = {
        is_active: nextActive,
        status: nextActive ? "active" : "inactive",
        revoked_at: nextActive ? null : new Date().toISOString(),
      };
      const { error } = await (supabase as any)
        .from("group_support_members")
        .update(patch)
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["group-support-assignments", groupId] });
      notify.success(
        vars.nextActive ? "Suporte ativado" : "Suporte desativado",
        vars.nextActive ? "A pessoa voltou a contar nos KPIs de atendimento." : "A pessoa deixou de contar nos KPIs de atendimento.",
      );
    },
    onError: (error: any) => {
      notify.error("Falha ao atualizar status", error?.message || "Tente novamente.");
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (row: SupportGroupRow) => {
      const ids = row.assignments.map((a) => a.id);
      const { error } = await (supabase as any)
        .from("group_support_members")
        .delete()
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group-support-assignments", groupId] });
      notify.success("Suporte removido", "A pessoa foi removida da lista de atendimento deste grupo.");
    },
    onError: (error: any) => {
      notify.error("Falha ao remover suporte", error?.message || "Tente novamente.");
    },
  });

  const isBusy = assignMutation.isPending || toggleMutation.isPending || removeMutation.isPending;
  const pageError = (supportAssignmentsQuery.error || supportMembersQuery.error || kpisQuery.error) as any;
  const errorCode = pageError?.code;

  if (authLoading || rolesLoading) {
    return (
      <AdminLayout title="Atendimento" subtitle="Verificando acesso...">
        <LoadingState message="Verificando permissões..." />
      </AdminLayout>
    );
  }

  if (!groupId) {
    return (
      <AdminLayout title="Atendimento" subtitle="Erro">
        <ErrorState title="Grupo inválido" message="Não foi possível identificar o grupo." retry={() => navigate("/")} />
      </AdminLayout>
    );
  }

  if (pageError && (String(pageError?.message || "").includes("permission") || errorCode === "PGRST301")) {
    return <AccessDenied message="Você não tem permissão para acessar o atendimento deste grupo." />;
  }

  if ((supportAssignmentsQuery.isLoading || supportMembersQuery.isLoading || kpisQuery.isLoading) && !supportAssignmentsQuery.data) {
    return (
      <AdminLayout title="Atendimento" subtitle="Carregando...">
        <LoadingState message="Carregando configuração e métricas de suporte..." />
      </AdminLayout>
    );
  }

  if (pageError) {
    return (
      <AdminLayout title="Atendimento" subtitle="Erro">
        <ErrorState
          title="Falha ao carregar atendimento"
          message="Não foi possível carregar a configuração ou os indicadores de suporte deste grupo."
          retry={() => {
            supportAssignmentsQuery.refetch();
            supportMembersQuery.refetch();
            kpisQuery.refetch();
          }}
        />
      </AdminLayout>
    );
  }

  const kpis = kpisQuery.data;
  const activeSupportRowsCount = supportRows.filter((r) => r.isActive).length;

  return (
    <AdminLayout
      title="Atendimento"
      subtitle={`${activeSupportRowsCount.toLocaleString("pt-BR")} suportes ativos`}
    >
      <div className="animate-fade-in -mx-4 sm:-mx-6 -mt-4 sm:-mt-6 px-4 sm:px-6 pt-4 sm:pt-6 pb-8 sm:pb-10 bg-background space-y-6">
        <GroupPageTop
          breadcrumbItems={[
            { label: "Central do Bóris", href: "/" },
            { label: groupInfo?.orgName || "Organização", href: `/organization/${groupInfo?.orgId}` },
            { label: groupInfo?.groupName || "Grupo", href: `/groups/${groupId}` },
            { label: "Atendimento" },
          ]}
          group={{
            groupId,
            organizationId: groupInfo?.orgId,
            name: groupInfo?.groupName || "",
            provider: groupInfo?.provider || "",
            totalMembers: totalMembersCount ?? 0,
            lastMessageAt: lastMessageAt ?? null,
            syncStatus: groupInfo?.syncStatus || null,
          }}
          filters={(
            <div className="w-full space-y-3">
              <div className="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
                  <div>
                  <div className="text-sm font-medium text-foreground">Atendentes do grupo</div>
                  <div className="text-xs text-muted-foreground">
                    Métricas dos últimos {KPI_LOOKBACK_DAYS} dias por grupo e atendente, usando horário comercial (seg-sex, 08h-18h SP) para TMR.
                  </div>
                </div>
              </div>

              {canManageSupport ? (
                <div className="rounded-xl border border-border/60 bg-background/60 p-3">
                  <div className="flex items-center gap-2 mb-2 text-xs font-medium text-muted-foreground">
                    <UserPlus className="h-3.5 w-3.5" />
                    Designar suporte (admin de sistema/organização/grupo)
                  </div>
                  <div className="space-y-3">
                    <div className="rounded-lg border border-border/60 bg-card/60 p-3">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div className="text-xs font-medium text-muted-foreground">
                          Já incluídos ({activeSupportRowsCount.toLocaleString("pt-BR")})
                        </div>
                        {activeSupportRowsCount > 0 ? (
                          <div className="text-[11px] text-muted-foreground">
                            A lista completa aparece abaixo em “Lista de suporte por grupo”.
                          </div>
                        ) : null}
                      </div>
                      {activeSupportPreview.length === 0 ? (
                          <div className="mt-2 text-sm text-muted-foreground">Nenhum atendente ativo configurado.</div>
                      ) : (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {activeSupportPreview.map((row) => {
                            const label = (row.member.display_name || row.member.name || "Membro").trim();
                            return (
                              <div
                                key={row.identityKey}
                                className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-2.5 py-1.5 text-sm"
                              >
                                <Avatar className="h-5 w-5">
                                  {row.member.profile_pic_url ? <AvatarImage src={row.member.profile_pic_url} alt="" referrerPolicy="no-referrer" /> : null}
                                  <AvatarFallback className="text-[10px]">{getInitialsFromName(label) || "M"}</AvatarFallback>
                                </Avatar>
                                <span className="max-w-[180px] truncate">{label}</span>
                                <UserCheck className="h-3.5 w-3.5 text-success" />
                              </div>
                            );
                          })}
                          {activeSupportRowsCount > activeSupportPreview.length ? (
                            <div className="inline-flex items-center rounded-full border border-border bg-background px-2.5 py-1.5 text-xs text-muted-foreground">
                              +{(activeSupportRowsCount - activeSupportPreview.length).toLocaleString("pt-BR")} outros
                            </div>
                          ) : null}
                        </div>
                      )}
                    </div>

                    <div className="rounded-lg border border-border/60 bg-card/60 p-3 space-y-2">
                      <div className="text-xs font-medium text-muted-foreground">Buscar e adicionar suporte</div>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <input
                          type="text"
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          placeholder="Digite nome, atendente ou telefone"
                          className="w-full h-10 rounded-xl border border-border/60 bg-background pl-9 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        />
                      </div>
                      <div className="rounded-lg border border-border/60 bg-background/70">
                        {searchQuery.length < 2 ? (
                          <div className="p-3 text-sm text-muted-foreground">
                            Digite pelo menos 2 caracteres para buscar membros e ir adicionando aos atendentes.
                          </div>
                        ) : candidateMembersQuery.isLoading ? (
                          <div className="p-3 flex items-center gap-2 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Buscando membros...
                          </div>
                        ) : candidateMembersQuery.error ? (
                            <div className="p-3 text-sm text-destructive">Falha ao carregar membros para designação de atendente.</div>
                        ) : (candidateMembersQuery.data?.length ?? 0) === 0 ? (
                          <div className="p-3 text-sm text-muted-foreground">Nenhum membro encontrado para esse filtro.</div>
                        ) : (
                          <div className="max-h-72 overflow-auto divide-y divide-border/50">
                            {(candidateMembersQuery.data ?? []).map((m) => {
                              const alreadySupport = supportIdentityKeys.has(memberIdentityKey(m));
                              const disabled = alreadySupport || isBusy;
                              const label = (m.display_name || m.name || "Membro").trim();
                              const phone = formatPhoneE164BR(m.phone_e164) || null;
                              return (
                                <div key={m.id} className="p-2.5 flex items-center gap-2">
                                  <Avatar className="h-8 w-8">
                                    {m.profile_pic_url ? <AvatarImage src={m.profile_pic_url} alt="" referrerPolicy="no-referrer" /> : null}
                                    <AvatarFallback className="text-[11px]">{getInitialsFromName(label) || "M"}</AvatarFallback>
                                  </Avatar>
                                  <div className="min-w-0 flex-1">
                                    <div className="text-sm font-medium text-foreground truncate">{label}</div>
                                    <div className="text-xs text-muted-foreground truncate">
                                      {phone || m.lid || "Sem telefone"}
                                    </div>
                                  </div>
                                  <Button
                                    type="button"
                                    variant={alreadySupport ? "secondary" : "outline"}
                                    size="sm"
                                    disabled={disabled}
                                    onClick={() => assignMutation.mutate(m)}
                                    className="shrink-0"
                                  >
                                    {alreadySupport ? (
                                      <>
                                        <UserCheck className="h-4 w-4 mr-1" />
                                        Adicionado
                                      </>
                                    ) : (
                                      <>
                                        <UserPlus className="h-4 w-4 mr-1" />
                                        Adicionar
                                      </>
                                    )}
                                  </Button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">
                  Você pode visualizar os indicadores de atendimento, mas não possui permissão para alterar os atendentes deste grupo.
                </div>
              )}
            </div>
          )}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatsCard
            title="Atendentes ativos"
            value={activeSupportRowsCount.toLocaleString("pt-BR")}
            icon={Headset}
            variant="kpi"
            help={GROUP_SUPPORT_KPI_HELP.attendants}
            valueClassName="text-2xl sm:text-3xl"
            description="Pessoas marcadas para contagem de atendimento"
          />
          <StatsCard
            title="Mensagens dos atendentes (30d)"
            value={(kpis?.supportMessages30d ?? 0).toLocaleString("pt-BR")}
            icon={MessageSquare}
            variant="kpi"
            help={GROUP_SUPPORT_KPI_HELP.supportMessages}
            valueClassName="text-2xl sm:text-3xl"
            description="Volume total enviado por suportes ativos"
          />
          <StatsCard
            title="Participação no grupo (30d)"
            value={`${(kpis?.supportParticipationPct ?? 0).toFixed(1).replace(".", ",")}%`}
            icon={Activity}
            variant="kpi"
            help={GROUP_SUPPORT_KPI_HELP.participation}
            valueClassName="text-2xl sm:text-3xl"
            description={`${(kpis?.totalMessages30d ?? 0).toLocaleString("pt-BR")} mensagens no grupo`}
          />
          <StatsCard
            title="TMR útil (aprox.)"
            value={formatRelativeMinutes(kpis?.avgResponseMs ?? null)}
            icon={Clock3}
            variant="kpi"
            help={GROUP_SUPPORT_KPI_HELP.tmr}
            valueClassName="text-2xl sm:text-3xl"
            description={`${(kpis?.answeredInteractions ?? 0).toLocaleString("pt-BR")} interações respondidas • horário comercial`}
          />
          <StatsCard
            title={`SLA ${RESPONSE_SLA_BUSINESS_MINUTES}min (útil)`}
            value={`${(kpis?.slaPct ?? 0).toFixed(1).replace(".", ",")}%`}
            icon={CheckCircle2}
            variant="kpi"
            help={GROUP_SUPPORT_KPI_HELP.sla}
            valueClassName="text-2xl sm:text-3xl"
            description={`${(kpis?.answeredWithinSla ?? 0).toLocaleString("pt-BR")} respostas no SLA`}
          />
          <StatsCard
            title="Pendências sem resposta"
            value={(kpis?.openPendingInteractions ?? 0).toLocaleString("pt-BR")}
            icon={MessageSquare}
            variant="kpi"
            help={GROUP_SUPPORT_KPI_HELP.pending}
            valueClassName="text-2xl sm:text-3xl"
            description={`${(kpis?.openPendingSlaBreached ?? 0).toLocaleString("pt-BR")} fora do SLA`}
          />
          <StatsCard
            title={`Inatividade (${GROUP_INACTIVITY_DAYS}d)`}
            value={isGroupInactive ? "Inativo" : "Ativo"}
            icon={isGroupInactive ? Clock3 : CheckCircle2}
            variant="kpi"
            help={GROUP_SUPPORT_KPI_HELP.inactivity}
            valueClassName="text-2xl sm:text-3xl"
            description={
              lastMessageAt
                ? `Última mensagem há ${(inactiveDays ?? 0).toLocaleString("pt-BR")} dia(s)`
                : "Sem mensagens registradas"
            }
          />
        </div>

        {(kpis?.sequenceSampleCapped || kpis?.supportMessageSampleCapped || kpis?.demandClusterSampleCapped) && (
          <div className="rounded-xl border border-warning/30 bg-warning/5 p-3 text-xs text-warning">
            Alguns indicadores aproximados usam amostragem da janela recente para manter performance em grupos com alto volume. TMR considera horário comercial (seg-sex, 08h-18h SP).
          </div>
        )}

        <section className="rounded-2xl border border-border/60 bg-card/70 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Clusterização de demandas (MVP)</h2>
              <p className="text-xs text-muted-foreground">
                Classificação por palavras-chave nas mensagens de clientes (texto), com comparação ao período anterior ({KPI_LOOKBACK_DAYS}d vs {KPI_LOOKBACK_DAYS}d anteriores).
              </p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {(kpis?.demandClusters ?? []).filter((c) => c.count > 0).slice(0, 6).map((cluster) => (
              <div
                key={cluster.key}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-sm"
              >
                <span className="font-medium text-foreground">{cluster.label}</span>
                <span className="text-muted-foreground tabular-nums">
                  {cluster.count.toLocaleString("pt-BR")} ({cluster.pct.toFixed(0).replace(".", ",")}%)
                </span>
                <span className={cn(
                  "text-xs tabular-nums",
                  cluster.deltaCount > 0 && "text-warning",
                  cluster.deltaCount < 0 && "text-success",
                  cluster.deltaCount === 0 && "text-muted-foreground",
                )}>
                  {cluster.deltaCount > 0 ? "+" : ""}{cluster.deltaCount}
                </span>
              </div>
            ))}
            {!(kpis?.demandClusters ?? []).some((c) => c.count > 0) ? (
              <div className="text-sm text-muted-foreground">Sem mensagens de texto suficientes para clusterização no período.</div>
            ) : null}
          </div>
        </section>

        <section className="rounded-2xl border border-border/60 bg-card/70 overflow-hidden">
          <div className="px-4 py-3 border-b border-border/60">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Lista de atendentes do grupo</h2>
                <p className="text-xs text-muted-foreground">
                  Status e atuação consolidados por identidade (telefone/lid) para evitar duplicidades por atendente.
                </p>
              </div>
            </div>
          </div>

          {supportRows.length === 0 ? (
            <EmptyState
              icon={Headset}
              title="Nenhum suporte configurado"
              message="Designe uma ou mais pessoas como atendente para começar a acompanhar atendimento neste grupo."
              className="py-14"
            />
          ) : (
            <div className="divide-y divide-border/60">
              {supportRows.map((row) => {
                const label = (row.member.display_name || row.member.name || "Membro").trim();
                const metric = kpis?.perSupport[row.identityKey];
                const phone = formatPhoneE164BR(row.member.phone_e164) || "-";
                const duplicateCount = row.members.length;

                return (
                  <div key={row.identityKey} className="p-4 space-y-3">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar className="h-10 w-10">
                          {row.member.profile_pic_url ? (
                            <AvatarImage src={row.member.profile_pic_url} alt="" referrerPolicy="no-referrer" />
                          ) : null}
                          <AvatarFallback>{getInitialsFromName(label) || "M"}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="text-sm font-medium text-foreground truncate">{label}</div>
                            <StatusTag variant={row.isActive ? "success" : "neutral"}>
                              {row.isActive ? "Ativo" : "Inativo"}
                            </StatusTag>
                            {duplicateCount > 1 ? (
                              <StatusTag variant="warning">Consolidado ({duplicateCount} IDs)</StatusTag>
                            ) : null}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {phone}
                            {row.member.left_at ? ` • saiu do grupo em ${formatDateTime(row.member.left_at)}` : ""}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {canManageSupport ? (
                          <>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={isBusy}
                              onClick={() => toggleMutation.mutate({ row, nextActive: !row.isActive })}
                            >
                              {row.isActive ? "Desativar" : "Ativar"}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={isBusy}
                              onClick={() => removeMutation.mutate(row)}
                            >
                              <Trash2 className="h-4 w-4 mr-1" />
                              Remover
                            </Button>
                          </>
                        ) : null}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                      <div className="rounded-xl border border-border/60 bg-background/60 p-3">
                        <div className="text-[11px] font-medium text-muted-foreground">Mensagens (30d)</div>
                        <div className="mt-1 text-lg font-semibold text-foreground tabular-nums">
                          {(metric?.messageCount ?? 0).toLocaleString("pt-BR")}
                        </div>
                      </div>
                      <div className="rounded-xl border border-border/60 bg-background/60 p-3">
                        <div className="text-[11px] font-medium text-muted-foreground">Participação no grupo</div>
                        <div className="mt-1 text-lg font-semibold text-foreground tabular-nums">
                          {kpis?.totalMessages30d
                            ? `${(((metric?.messageCount ?? 0) / (kpis.totalMessages30d || 1)) * 100).toFixed(1).replace(".", ",")}%`
                            : "0,0%"}
                        </div>
                      </div>
                      <div className="rounded-xl border border-border/60 bg-background/60 p-3">
                        <div className="text-[11px] font-medium text-muted-foreground">Interações respondidas (aprox.)</div>
                        <div className="mt-1 text-lg font-semibold text-foreground tabular-nums">
                          {(metric?.answeredInteractions ?? 0).toLocaleString("pt-BR")}
                        </div>
                        <div className="mt-1 text-[11px] text-muted-foreground">
                          SLA {RESPONSE_SLA_BUSINESS_MINUTES}m: {((metric?.slaPct ?? 0)).toFixed(1).replace(".", ",")}%
                        </div>
                      </div>
                      <div className="rounded-xl border border-border/60 bg-background/60 p-3">
                        <div className="text-[11px] font-medium text-muted-foreground">Última atuação (30d)</div>
                        <div className="mt-1 text-sm font-medium text-foreground">
                          {formatDateTime(metric?.lastMessageAt ?? null)}
                        </div>
                        <div className="mt-1 text-[11px] text-muted-foreground">
                          TMR útil: {formatRelativeMinutes(metric?.avgResponseMs ?? null)}
                        </div>
                      </div>
                    </div>

                    <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Base: `messages` + `members` do grupo (mesma origem dos demais KPIs)
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </AdminLayout>
  );
};

export default GroupSupport;
