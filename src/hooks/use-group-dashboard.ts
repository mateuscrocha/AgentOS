import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { subDays } from "date-fns";
import { formatDateKeySP, getHourSP } from "@/lib/date";
import { notify } from "@/components/ui/sonner";
import { extractBigramsFromRows } from "@/utils/keywords";
import { buildGroupDashboardPeriods } from "@/hooks/group-dashboard-periods";
import { countActiveInboundPeople, rankParticipantsByMessages } from "@/hooks/group-dashboard-aggregations";
import { buildDailyCountSeries, buildDailyUniqueCountSeries } from "@/hooks/group-dashboard-series";
import { buildHourlyActivitySummary, buildParticipantPresenceIndex } from "@/hooks/group-dashboard-activity";
import { buildMemberEngagementDistribution, countUniqueExternalMembers } from "@/hooks/group-dashboard-member-metrics";
import {
  buildBusyDayAvatars,
  buildPeakWindowAvatars,
  buildThemeAvatars,
  computeLowEffortPercentFromDailySeries,
  computePeakTwoHourStart,
} from "@/hooks/group-dashboard-derived";

 

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface DateRange {
  from: Date;
  to: Date;
}

interface UseGroupDashboardOptions {
  groupId: string | undefined;
  dateRange?: DateRange;
}

type MemberChangeEvent = {
  id: string;
  occurredAt: string;
  eventType: string;
  kind: "entrada" | "saida";
  memberId: string | null;
  memberName: string;
  memberAvatarUrl: string | null;
  externalMemberId: string;
  source: string;
};

export function useGroupDashboard({ groupId, dateRange }: UseGroupDashboardOptions) {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const isGroupIdValid = typeof groupId === "string" && UUID_RE.test(groupId);

  // Use provided date range or default to 7 days
  const nowRef = useRef<Date>(new Date());
  const now = nowRef.current;
  const {
    currentPeriodStart,
    currentPeriodEnd,
    periodDays,
    currentPeriodStartISO,
    currentPeriodEndISO,
    previousPeriodStartISO,
    previousPeriodEndISO,
  } = buildGroupDashboardPeriods({
    now,
    dateRange,
  });

  const withMemberExitStatus = async <T extends { id: string }>(
    participants: T[],
  ): Promise<Array<T & { leftAt?: string | null; status?: string | null }>> => {
    if (!participants.length) return [];

    const ids = Array.from(new Set(participants.map((p) => p.id).filter(Boolean)));
    if (!ids.length) return participants;

    const { data: membersMeta } = await supabase
      .from("members")
      .select("id, left_at, status")
      .eq("group_id", groupId!)
      .is("deleted_at", null)
      .in("id", ids);

    const metaById = new Map<string, { left_at: string | null; status: string | null }>();
    for (const row of membersMeta ?? []) {
      metaById.set(row.id, { left_at: row.left_at, status: row.status });
    }

    return participants.map((participant) => {
      const meta = metaById.get(participant.id);
      return {
        ...participant,
        leftAt: meta?.left_at ?? null,
        status: meta?.status ?? null,
      };
    });
  };

  useEffect(() => {
    if (!groupId || !isGroupIdValid || !isAuthenticated) return;
    if (typeof (supabase as any).channel !== "function") return;

    let refreshTimer: number | null = null;
    const scheduleRealtimeRefresh = () => {
      if (refreshTimer !== null) return;

      refreshTimer = globalThis.setTimeout(() => {
        refreshTimer = null;

        void Promise.all([
          queryClient.invalidateQueries({ queryKey: ["group-overview", groupId] }),
          queryClient.invalidateQueries({ queryKey: ["group-dashboard-stats", groupId] }),
          queryClient.invalidateQueries({ queryKey: ["group-dashboard-member-events", groupId] }),
          queryClient.invalidateQueries({ queryKey: ["group-dashboard-members-snapshot", groupId] }),
          queryClient.invalidateQueries({ queryKey: ["group-dashboard-entries-day", groupId] }),
          queryClient.invalidateQueries({ queryKey: ["group-dashboard-exits-day", groupId] }),
          queryClient.invalidateQueries({ queryKey: ["group-dashboard-chart", groupId] }),
          queryClient.invalidateQueries({ queryKey: ["group-dashboard-active-per-day", groupId] }),
          queryClient.invalidateQueries({ queryKey: ["group-dashboard-activity-hour", groupId] }),
          queryClient.invalidateQueries({ queryKey: ["group-dashboard-participants", groupId] }),
          queryClient.invalidateQueries({ queryKey: ["group-dashboard-top-participants", groupId] }),
          queryClient.invalidateQueries({ queryKey: ["group-dashboard-engagement", groupId] }),
          queryClient.invalidateQueries({ queryKey: ["group-dashboard-popular", groupId] }),
          queryClient.invalidateQueries({ queryKey: ["group-dashboard-admins", groupId] }),
          queryClient.invalidateQueries({ queryKey: ["group-dashboard-previous-admins", groupId] }),
          queryClient.invalidateQueries({ queryKey: ["group-dashboard-at-risk", groupId] }),
          queryClient.invalidateQueries({ queryKey: ["group-dashboard-new-members", groupId] }),
          queryClient.invalidateQueries({ queryKey: ["group-dashboard-previous-new-members", groupId] }),
          queryClient.invalidateQueries({ queryKey: ["group-dashboard-exited-members", groupId] }),
          queryClient.invalidateQueries({ queryKey: ["group-dashboard-previous-exited-members", groupId] }),
          queryClient.invalidateQueries({ queryKey: ["group-dashboard-recent", groupId] }),
          queryClient.invalidateQueries({ queryKey: ["group-dashboard-members", groupId] }),
          queryClient.invalidateQueries({ queryKey: ["group-dashboard-members-prev", groupId] }),
          queryClient.invalidateQueries({ queryKey: ["group-dashboard-trending-keywords", groupId] }),
          queryClient.invalidateQueries({ queryKey: ["group-ikigai-suggestions", groupId] }),
        ]);
      }, 400);
    };

    const channel = supabase
      .channel(`realtime:group:${groupId}:dashboard`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "member_events", filter: `group_id=eq.${groupId}` },
        scheduleRealtimeRefresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages", filter: `group_id=eq.${groupId}` },
        scheduleRealtimeRefresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "message_reactions", filter: `group_id=eq.${groupId}` },
        scheduleRealtimeRefresh,
      )
      .subscribe();

    return () => {
      if (refreshTimer !== null) {
        globalThis.clearTimeout(refreshTimer);
      }
      supabase.removeChannel(channel);
    };
  }, [groupId, isGroupIdValid, isAuthenticated, queryClient]);

  // Fetch group details
  const { data: group, isLoading: groupLoading, error: groupError } = useQuery({
    queryKey: ['group-dashboard', groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('groups')
        .select('id, name, description, provider, organization_id, is_active, is_archived, sync_status, last_sync_at, metadata, invite_link')
        .eq('id', groupId!)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!groupId && isGroupIdValid && isAuthenticated,
    staleTime: 60000,
  });

  // Fetch org name for breadcrumb
  const { data: orgData } = useQuery({
    queryKey: ['org-name', group?.organization_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('organizations')
        .select('name')
        .eq('id', group!.organization_id)
        .maybeSingle();
      return data;
    },
    enabled: !!group?.organization_id,
    staleTime: 60000,
  });

  const { data: groupOverview } = useQuery({
    queryKey: ['group-overview', groupId],
    queryFn: async () => {
      const { data } = await supabase
        .from('v_group_overview')
        .select('group_id, messages_count, members_count, last_message_at')
        .eq('group_id', groupId!)
        .maybeSingle();
      return data;
    },
    enabled: !!groupId && isGroupIdValid && isAuthenticated,
    staleTime: 60000,
  });

  const ikigaiKeywords: string[] = Array.isArray((group as any)?.metadata?.ikigai_keywords)
    ? (group as any).metadata.ikigai_keywords
    : Array.isArray((group as any)?.metadata?.ikigai?.keywords)
    ? (group as any).metadata.ikigai.keywords
    : Array.isArray((group as any)?.metadata?.themes)
    ? (group as any).metadata.themes
    : Array.isArray((group as any)?.metadata?.focal_themes)
    ? (group as any).metadata.focal_themes
    : [];

  // Fetch current period stats
  const { data: stats, isLoading: statsLoading, error: statsError } = useQuery({
    queryKey: ['group-dashboard-stats', groupId, currentPeriodStartISO, currentPeriodEndISO],
    queryFn: async () => {
      const { count: totalMembersCountSnapshot } = await supabase
        .from('members')
        .select('*', { count: 'exact', head: true })
        .eq('group_id', groupId!)
        .is('deleted_at', null)
        .neq('status', 'inactive');
      const totalMembers = totalMembersCountSnapshot ?? 0;

      // Fetch messages in current period
      const { count: totalMessages } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('group_id', groupId!)
        .is('deleted_at', null)
        .gte('created_at', currentPeriodStartISO)
        .lte('created_at', currentPeriodEndISO);

      // Fetch active members in period
      const { data: activeMembersData } = await supabase
        .from('messages')
        .select('member_id, sender_phone, from_me, direction, message_type')
        .eq('group_id', groupId!)
        .is('deleted_at', null)
        .eq('direction', 'inbound')
        .eq('from_me', false)
        .neq('message_type', 'poll_vote')
        .gte('created_at', currentPeriodStartISO)
        .lte('created_at', currentPeriodEndISO);

      const activeMembers = countActiveInboundPeople(activeMembersData as any[]);

      const engagementRate = totalMembers && totalMembers > 0 
        ? Math.round((activeMembers / totalMembers) * 100) 
        : 0;

      // Get top participant
      const { data: topParticipantData } = await supabase
        .from('v_messages_with_members')
        .select('member_id_resolved, member_name, profile_pic_url')
        .eq('group_id', groupId!)
        .is('message_deleted_at', null)
        .not('member_id_resolved', 'is', null)
        .gte('message_created_at', currentPeriodStartISO)
        .lte('message_created_at', currentPeriodEndISO);

      const rankedTopParticipants = rankParticipantsByMessages(
        (topParticipantData ?? []).map((row: any) => ({
          member_id: row.member_id_resolved,
          members: {
            name: row.member_name,
            profile_pic_url: row.profile_pic_url,
          },
        })),
      );
      const topParticipant = (await withMemberExitStatus(rankedTopParticipants.slice(0, 1)))[0] ?? null;

      // Get last message timestamp
      const { data: lastMessageData } = await supabase
        .from('messages')
        .select('created_at')
        .eq('group_id', groupId!)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      return {
        totalMembers: totalMembers || 0,
        totalMessages: totalMessages || 0,
        activeMembers,
        engagementRate,
        topParticipant,
        lastMessageAt: groupOverview?.last_message_at || lastMessageData?.created_at || null,
      };
    },
    enabled: !!groupId && !!group && isAuthenticated,
  });

  useEffect(() => {
    if (!statsError) return;
    notify.error('Falha ao carregar dados', 'Não foi possível carregar estatísticas do período.');
  }, [statsError]);

  const hasIkigai = (ikigaiKeywords || []).length > 0;

  const { data: alignedMessagesPercent } = useQuery({
    queryKey: ['group-dashboard-aligned-percent', groupId, currentPeriodStartISO, currentPeriodEndISO, (ikigaiKeywords || []).join('|')],
    queryFn: async () => {
      if (!ikigaiKeywords || ikigaiKeywords.length === 0) return undefined;
      const filters = ikigaiKeywords
        .filter((kw) => typeof kw === 'string' && kw.trim().length > 0)
        .map((kw) => `content.ilike.%${kw}%`)
        .join(',');
      if (!filters) return undefined;
      const { count: alignedCount } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('group_id', groupId!)
        .is('deleted_at', null)
        .gte('created_at', currentPeriodStartISO)
        .lte('created_at', currentPeriodEndISO)
        .or(filters);
      const total = (stats as any)?.totalMessages || 0;
      return total > 0 ? Math.round(((alignedCount || 0) / total) * 100) : 0;
    },
    enabled: !!groupId && !!group && isAuthenticated && hasIkigai && !!stats,
  });

  // Fetch previous period stats for comparison
  const { data: previousStats } = useQuery({
    queryKey: ['group-dashboard-previous-stats', groupId, previousPeriodStartISO, previousPeriodEndISO],
    queryFn: async () => {
      const { count: totalMessages } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('group_id', groupId!)
        .is('deleted_at', null)
        .gte('created_at', previousPeriodStartISO)
        .lte('created_at', previousPeriodEndISO);

      const { data: activeMembersData } = await supabase
        .from('messages')
        .select('member_id, sender_phone, from_me, direction, message_type')
        .eq('group_id', groupId!)
        .is('deleted_at', null)
        .eq('direction', 'inbound')
        .eq('from_me', false)
        .neq('message_type', 'poll_vote')
        .gte('created_at', previousPeriodStartISO)
        .lte('created_at', previousPeriodEndISO);

      const activeMembers = countActiveInboundPeople(activeMembersData as any[]);
      // Compute snapshot of total members at end of previous period
      const { count: joinedBeforePrevEnd } = await supabase
        .from('members')
        .select('*', { count: 'exact', head: true })
        .eq('group_id', groupId!)
        .is('deleted_at', null)
        .lte('joined_at', previousPeriodEndISO);

      const { count: joinedNullPrev } = await supabase
        .from('members')
        .select('*', { count: 'exact', head: true })
        .eq('group_id', groupId!)
        .is('deleted_at', null)
        .is('joined_at', null);

      const { count: exitedBeforePrevEnd } = await supabase
        .from('members')
        .select('*', { count: 'exact', head: true })
        .eq('group_id', groupId!)
        .is('deleted_at', null)
        .lte('left_at', previousPeriodEndISO);

      const totalMembers = (joinedBeforePrevEnd || 0) + (joinedNullPrev || 0) - (exitedBeforePrevEnd || 0);

      const engagementRate = totalMembers && totalMembers > 0 
        ? Math.round((activeMembers / totalMembers) * 100) 
        : 0;

      // Get top participant in previous period
      const { data: topParticipantData } = await supabase
        .from('v_messages_with_members')
        .select('member_id_resolved, member_name, profile_pic_url')
        .eq('group_id', groupId!)
        .is('message_deleted_at', null)
        .not('member_id_resolved', 'is', null)
        .gte('message_created_at', previousPeriodStartISO)
        .lte('message_created_at', previousPeriodEndISO);

      const rankedTopParticipants = rankParticipantsByMessages(
        (topParticipantData ?? []).map((row: any) => ({
          member_id: row.member_id_resolved,
          members: {
            name: row.member_name,
            profile_pic_url: row.profile_pic_url,
          },
        })),
      );
      const topParticipant = (await withMemberExitStatus(rankedTopParticipants.slice(0, 1)))[0] ?? null;

      return {
        totalMessages: totalMessages || 0,
        activeMembers,
        totalMembers,
        engagementRate,
        topParticipant,
      };
    },
    enabled: !!groupId && !!group && isAuthenticated,
  });

  // Fetch previous period activity by hour
  const { data: previousActivityData } = useQuery({
    queryKey: ['group-dashboard-previous-activity-hour', groupId, previousPeriodStartISO, previousPeriodEndISO],
    queryFn: async () => {
      const { data } = await supabase
        .from('messages')
        .select('created_at')
        .eq('group_id', groupId!)
        .is('deleted_at', null)
        .gte('created_at', previousPeriodStartISO)
        .lte('created_at', previousPeriodEndISO);

      const summary = buildHourlyActivitySummary(data as any[]);
      return {
        peakHour: summary.peakHour,
        peakHourMessages: summary.peakHourMessages,
      };
    },
    enabled: !!groupId && !!group && isAuthenticated,
  });

  // Fetch previous period member engagement
  const { data: previousMemberEngagement } = useQuery({
    queryKey: ['group-dashboard-previous-engagement', groupId, previousPeriodStartISO, previousPeriodEndISO],
    queryFn: async () => {
      const { data: members } = await supabase
        .from('members')
        .select('id')
        .eq('group_id', groupId!)
        .is('deleted_at', null);

      const { data: messageCounts } = await supabase
        .from('v_messages_with_members')
        .select('member_id_resolved')
        .eq('group_id', groupId!)
        .is('message_deleted_at', null)
        .not('member_id_resolved', 'is', null)
        .gte('message_created_at', previousPeriodStartISO)
        .lte('message_created_at', previousPeriodEndISO);

      return buildMemberEngagementDistribution(
        members as any[],
        (messageCounts ?? []).map((row: any) => ({ member_id: row.member_id_resolved })) as any[],
      );
    },
    enabled: !!groupId && !!group && isAuthenticated,
  });

  // Fetch previous period new members count
  const { data: previousNewMembersCount } = useQuery({
    queryKey: ['group-dashboard-previous-new-members', groupId, previousPeriodStartISO, previousPeriodEndISO],
    queryFn: async () => {
      const entryTypes = ['GROUP_PARTICIPANT_ADD', 'GROUP_PARTICIPANT_INVITE'] as const;
      const { data } = await supabase
        .from('member_events')
        .select('member_lid, event_type, occurred_at')
        .eq('group_id', groupId!)
        .in('event_type', entryTypes)
        .gte('occurred_at', previousPeriodStartISO)
        .lte('occurred_at', previousPeriodEndISO);

      return countUniqueExternalMembers(data as any[]);
    },
    enabled: !!groupId && !!group && isAuthenticated,
  });

  // Fetch previous period exited members count
  const { data: previousExitedMembersCount } = useQuery({
    queryKey: ['group-dashboard-previous-exited-members', groupId, previousPeriodStartISO, previousPeriodEndISO],
    queryFn: async () => {
      const exitTypes = ['GROUP_PARTICIPANT_LEAVE', 'GROUP_PARTICIPANT_REMOVE'] as const;
      const { data } = await supabase
        .from('member_events')
        .select('member_lid, event_type, occurred_at')
        .eq('group_id', groupId!)
        .in('event_type', exitTypes)
        .gte('occurred_at', previousPeriodStartISO)
        .lte('occurred_at', previousPeriodEndISO);

      return countUniqueExternalMembers(data as any[]);
    },
    enabled: !!groupId && !!group && isAuthenticated,
  });

  // Fetch previous period admin stats
  const { data: previousAdminStats } = useQuery({
    queryKey: ['group-dashboard-previous-admins', groupId, previousPeriodStartISO, previousPeriodEndISO],
    queryFn: async () => {
      const { data: admins } = await supabase
        .from('vw_group_collaborators')
        .select('member_id, phone_e164')
        .eq('group_id', groupId!)
        .eq('classification', 'active');

      if (!admins || admins.length === 0) return null;

      const adminIds = admins.map(a => a.member_id).filter(Boolean) as string[];
      const adminPhones = admins.map(a => a.phone_e164).filter(Boolean) as string[];
      const adminPhoneSet = new Set(adminPhones);

      const { data: periodMessages } = await supabase
        .from('messages')
        .select('member_id, sender_phone')
        .eq('group_id', groupId!)
        .is('deleted_at', null)
        .gte('created_at', previousPeriodStartISO)
        .lte('created_at', previousPeriodEndISO);

      const adminMessages = (periodMessages || []).filter(m => {
        const byId = !!m.member_id && adminIds.includes(m.member_id);
        const byPhone = !!m.sender_phone && adminPhoneSet.has(m.sender_phone as string);
        return byId || byPhone;
      });

      const activeAdminIds = new Set<string>();
      adminMessages.forEach(m => {
        if (m.member_id) {
          activeAdminIds.add(m.member_id);
        } else if (m.sender_phone) {
          const admin = admins.find(a => a.phone_e164 === m.sender_phone);
          if (admin?.member_id) activeAdminIds.add(admin.member_id as string);
        }
      });

      const { count: totalMessages } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('group_id', groupId!)
        .is('deleted_at', null)
        .gte('created_at', previousPeriodStartISO)
        .lte('created_at', previousPeriodEndISO);

      return {
        active: activeAdminIds.size,
        messagesFromAdmins: adminMessages.length,
        totalMessages: totalMessages || 0,
      };
    },
    enabled: !!groupId && !!group && isAuthenticated,
  });

  // Fetch messages per day for chart
  const { data: messagesPerDay, isLoading: chartLoading, error: chartError } = useQuery({
    queryKey: ['group-dashboard-chart', groupId, currentPeriodStartISO, currentPeriodEndISO],
    queryFn: async () => {
      const { data } = await supabase
        .from('messages')
        .select('created_at')
        .eq('group_id', groupId!)
        .is('deleted_at', null)
        .gte('created_at', currentPeriodStartISO)
        .lte('created_at', currentPeriodEndISO)
        .order('created_at', { ascending: true });

      return buildDailyCountSeries(data, {
        periodDays,
        currentPeriodEnd,
        getDate: (msg) => new Date((msg as any).created_at),
      });
    },
    enabled: !!groupId && !!group && isAuthenticated,
  });

  useEffect(() => {
    if (!chartError) return;
    notify.error('Falha ao carregar dados', 'Não foi possível carregar o gráfico de mensagens por dia.');
  }, [chartError]);

  // Fetch member entries per day
  const { data: memberEntriesPerDay } = useQuery({
    queryKey: ['group-dashboard-entries-day', groupId, currentPeriodStartISO, currentPeriodEndISO],
    queryFn: async () => {
      const entryTypes = ['GROUP_PARTICIPANT_ADD', 'GROUP_PARTICIPANT_INVITE'] as const;
      const { data } = await supabase
        .from('member_events')
        .select('occurred_at, event_type')
        .eq('group_id', groupId!)
        .in('event_type', entryTypes)
        .gte('occurred_at', currentPeriodStartISO)
        .lte('occurred_at', currentPeriodEndISO)
        .order('occurred_at', { ascending: true });

      return buildDailyCountSeries(data, {
        periodDays,
        currentPeriodEnd,
        getDate: (m) => new Date((m as any).occurred_at),
      });
    },
    enabled: !!groupId && !!group && isAuthenticated,
  });

  // Fetch member exits per day
  const { data: memberExitsPerDay } = useQuery({
    queryKey: ['group-dashboard-exits-day', groupId, currentPeriodStartISO, currentPeriodEndISO],
    queryFn: async () => {
      const exitTypes = ['GROUP_PARTICIPANT_LEAVE', 'GROUP_PARTICIPANT_REMOVE'] as const;
      const { data } = await supabase
        .from('member_events')
        .select('occurred_at, event_type')
        .eq('group_id', groupId!)
        .in('event_type', exitTypes)
        .gte('occurred_at', currentPeriodStartISO)
        .lte('occurred_at', currentPeriodEndISO)
        .order('occurred_at', { ascending: true });

      return buildDailyCountSeries(data, {
        periodDays,
        currentPeriodEnd,
        getDate: (m) => new Date((m as any).occurred_at),
      });
    },
    enabled: !!groupId && !!group && isAuthenticated,
  });

  const { data: memberEvents, isLoading: memberEventsLoading } = useQuery({
    queryKey: ["group-dashboard-member-events", groupId, currentPeriodStartISO, currentPeriodEndISO],
    queryFn: async () => {
      const eventTypes = [
        "GROUP_PARTICIPANT_ADD",
        "GROUP_PARTICIPANT_INVITE",
        "GROUP_PARTICIPANT_LEAVE",
        "GROUP_PARTICIPANT_REMOVE",
      ] as const;
      const { data, error } = await supabase
        .from("member_events")
        .select("id, created_at, occurred_at, event_type, member_id, member_lid, source, members(name, display_name, profile_pic_url)")
        .eq("group_id", groupId!)
        .in("event_type", eventTypes)
        .gte("occurred_at", currentPeriodStartISO)
        .lte("occurred_at", currentPeriodEndISO)
        .order("occurred_at", { ascending: false })
        .range(0, 999);

      if (error) throw error;

      return ((data ?? []) as any[]).map((e): MemberChangeEvent => {
        const type = (e.event_type as string) || "";
        const kind: MemberChangeEvent["kind"] = type === "GROUP_PARTICIPANT_LEAVE" || type === "GROUP_PARTICIPANT_REMOVE" ? "saida" : "entrada";
        const memberName = e.members?.display_name || e.members?.name || e.member_lid || "Membro";
        const memberAvatarUrl = (e.members?.profile_pic_url as string | null) ?? null;
        return {
          id: e.id as string,
          occurredAt: (e.occurred_at as string) || (e.created_at as string),
          eventType: type,
          kind,
          memberId: (e.member_id as string | null) ?? null,
          memberName,
          memberAvatarUrl,
          externalMemberId: e.member_lid as string,
          source: (e.source as string) || "",
        };
      });
    },
    enabled: !!groupId && !!group && isAuthenticated,
  });

  // Fetch active members per day for secondary chart line
  const { data: activeMembersPerDay } = useQuery({
    queryKey: ['group-dashboard-active-per-day', groupId, currentPeriodStartISO, currentPeriodEndISO],
    queryFn: async () => {
      const { data } = await supabase
        .from('messages')
        .select('member_id, created_at')
        .eq('group_id', groupId!)
        .is('deleted_at', null)
        .not('member_id', 'is', null)
        .gte('created_at', currentPeriodStartISO)
        .lte('created_at', currentPeriodEndISO)
        .order('created_at', { ascending: true });

      return buildDailyUniqueCountSeries(data, {
        periodDays,
        currentPeriodEnd,
        getDate: (msg) => new Date((msg as any).created_at),
        getKey: (msg) => (msg as any).member_id as string | null,
      });
    },
    enabled: !!groupId && !!group && isAuthenticated,
  });

  // Fetch activity by hour
  const { data: activityData, error: activityError } = useQuery({
    queryKey: ['group-dashboard-activity-hour', groupId, currentPeriodStartISO, currentPeriodEndISO],
    queryFn: async () => {
      const { data } = await supabase
        .from('messages')
        .select('created_at')
        .eq('group_id', groupId!)
        .is('deleted_at', null)
        .gte('created_at', currentPeriodStartISO)
        .lte('created_at', currentPeriodEndISO);

      return buildHourlyActivitySummary(data as any[]);
    },
    enabled: !!groupId && !!group && isAuthenticated,
  });

  useEffect(() => {
    if (!activityError) return;
    notify.error('Falha ao carregar dados', 'Não foi possível carregar a atividade por hora.');
  }, [activityError]);

  // Fetch participants in period with member avatars to build day/hour stacks
  const { data: periodParticipants } = useQuery({
    queryKey: ['group-dashboard-participants', groupId, currentPeriodStartISO, currentPeriodEndISO],
    queryFn: async () => {
      const { data } = await supabase
        .from('v_messages_feed')
        .select('member_id, member_avatar, created_at')
        .eq('group_id', groupId!)
        .not('member_id', 'is', null)
        .gte('created_at', currentPeriodStartISO)
        .lte('created_at', currentPeriodEndISO);

      return buildParticipantPresenceIndex(data as any[]);
    },
    enabled: !!groupId && !!group && isAuthenticated,
  });

  // Fetch top 5 participants
  const { data: topParticipants, isLoading: topParticipantsLoading } = useQuery({
    queryKey: ['group-dashboard-top-participants', groupId, currentPeriodStartISO, currentPeriodEndISO],
    queryFn: async () => {
      const { data } = await supabase
        .from('v_messages_with_members')
        .select('member_id_resolved, member_name, profile_pic_url')
        .eq('group_id', groupId!)
        .is('message_deleted_at', null)
        .not('member_id_resolved', 'is', null)
        .gte('message_created_at', currentPeriodStartISO)
        .lte('message_created_at', currentPeriodEndISO);

      const rankedParticipants = rankParticipantsByMessages(
        (data ?? []).map((row: any) => ({
          member_id: row.member_id_resolved,
          members: {
            name: row.member_name,
            profile_pic_url: row.profile_pic_url,
          },
        })),
      ).slice(0, 5);

      return withMemberExitStatus(rankedParticipants);
    },
    enabled: !!groupId && !!group && isAuthenticated,
  });

  // Fetch member engagement distribution
  const { data: memberEngagement } = useQuery({
    queryKey: ['group-dashboard-engagement', groupId, currentPeriodStartISO, currentPeriodEndISO],
    queryFn: async () => {
      const { data: members } = await supabase
        .from('members')
        .select('id')
        .eq('group_id', groupId!)
        .is('deleted_at', null);

      const { data: messageCounts } = await supabase
        .from('v_messages_with_members')
        .select('member_id_resolved')
        .eq('group_id', groupId!)
        .is('message_deleted_at', null)
        .not('member_id_resolved', 'is', null)
        .gte('message_created_at', currentPeriodStartISO)
        .lte('message_created_at', currentPeriodEndISO);

      return buildMemberEngagementDistribution(
        members as any[],
        (messageCounts ?? []).map((row: any) => ({ member_id: row.member_id_resolved })) as any[],
      );
    },
    enabled: !!groupId && !!group && isAuthenticated,
  });

  // Fetch popular messages (restrito ao grupo e período)
  const { data: popularMessages } = useQuery({
    queryKey: ['group-dashboard-popular', groupId, currentPeriodStartISO, currentPeriodEndISO],
    queryFn: async () => {
      const { data: periodReactions } = await supabase
        .from('message_reactions')
        .select('message_id, reacted_at')
        .eq('group_id', groupId!)
        .is('deleted_at', null)
        .is('removed_at', null)
        .gte('reacted_at', currentPeriodStartISO)
        .lte('reacted_at', currentPeriodEndISO);

      if (!periodReactions || periodReactions.length === 0) return [];

      const messageReactions: Record<string, number> = {};
      for (const r of periodReactions) {
        if (r.message_id) {
          messageReactions[r.message_id] = (messageReactions[r.message_id] || 0) + 1;
        }
      }

      const topMessageIds = Object.entries(messageReactions)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([id]) => id);

      if (topMessageIds.length === 0) return [];

      const { data: messages } = await supabase
        .from('v_messages_feed')
        .select('message_id, content_preview, message_type, member_name, member_avatar, created_at')
        .eq('group_id', groupId!)
        .in('message_id', topMessageIds);

      return topMessageIds
        .map(id => {
          const msg = messages?.find(m => m.message_id === id);
          if (!msg) return null;
          return {
            id,
            content: msg.content_preview || null,
            messageType: msg.message_type || 'text',
            memberName: msg.member_name || 'Desconhecido',
            avatarUrl: (msg as any)?.member_avatar || null,
            reactionCount: messageReactions[id] || 0,
            createdAt: msg.created_at || null,
          };
        })
        .filter(Boolean) as {
          id: string;
          content: string | null;
          messageType: string;
          memberName: string;
          avatarUrl?: string | null;
          reactionCount: number;
          createdAt?: string | null;
        }[];
    },
    enabled: !!groupId && !!group && isAuthenticated,
  });

  // Fetch admin stats
  const { data: adminStats } = useQuery({
    queryKey: ['group-dashboard-admins', groupId, currentPeriodStartISO, currentPeriodEndISO],
    queryFn: async () => {
      const { data: admins } = await supabase
        .from('vw_group_collaborators')
        .select('member_id, display_name, profile_pic_url, phone_e164')
        .eq('group_id', groupId!)
        .eq('classification', 'active');

      if (!admins || admins.length === 0) return null;

      const adminIds = admins.map(a => a.member_id).filter(Boolean) as string[];
      const adminPhones = admins.map(a => a.phone_e164).filter(Boolean) as string[];
      const adminPhoneSet = new Set(adminPhones);

      const { data: periodMessages } = await supabase
        .from('messages')
        .select('member_id, sender_phone')
        .eq('group_id', groupId!)
        .is('deleted_at', null)
        .gte('created_at', currentPeriodStartISO)
        .lte('created_at', currentPeriodEndISO);

      const adminMessages = (periodMessages || []).filter(m => {
        const byId = !!m.member_id && adminIds.includes(m.member_id);
        const byPhone = !!m.sender_phone && adminPhoneSet.has(m.sender_phone as string);
        return byId || byPhone;
      });

      const adminCounts: Record<string, number> = {};
      adminMessages.forEach(m => {
        if (m.member_id) {
          adminCounts[m.member_id] = (adminCounts[m.member_id] || 0) + 1;
        } else if (m.sender_phone) {
          const admin = admins.find(a => a.phone_e164 === m.sender_phone);
          if (admin?.member_id) {
            const id = admin.member_id as string;
            adminCounts[id] = (adminCounts[id] || 0) + 1;
          }
        }
      });

      const activeAdminIds = new Set(Object.keys(adminCounts));
      const activeCount = activeAdminIds.size;

      let topAdmin: { id: string; name: string; messages: number; avatarUrl: string | null } | null = null;
      let maxMessages = 0;
      admins.forEach(admin => {
        const id = admin.member_id as string | null;
        if (!id) return;
        const count = adminCounts[id] || 0;
        if (count > maxMessages) {
          maxMessages = count;
          const rawLabel = ((admin as any).display_name || '').toString().trim();
          const digits = rawLabel.replace(/\D/g, "");
          const isPhoneLike = digits.length >= 6 && /^[+()\d\s.-]{7,}$/.test(rawLabel);
          const label = rawLabel && !isPhoneLike ? rawLabel : "Administrador";
          topAdmin = {
            id,
            name: label,
            messages: count,
            avatarUrl: ((admin as any).profile_pic_url as string | null) ?? null,
          };
        }
      });

      const { count: totalMessages } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('group_id', groupId!)
        .is('deleted_at', null)
        .gte('created_at', currentPeriodStartISO)
        .lte('created_at', currentPeriodEndISO);

      return {
        total: admins.length,
        active: activeCount,
        inactive: admins.length - activeCount,
        messagesFromAdmins: adminMessages.length,
        totalMessages: totalMessages || 0,
        topAdmin,
      };
    },
    enabled: !!groupId && !!group && isAuthenticated,
  });

  // Fetch at-risk members based on current period inactivity
  const { data: atRiskMembers } = useQuery({
    queryKey: ['group-dashboard-at-risk', groupId, currentPeriodStartISO, currentPeriodEndISO],
    queryFn: async () => {
      const overview = membersOverview || [];
      const inactive = overview
        .filter(m => (m as any).messagesCount === 0)
        .map(m => ({
          id: (m as any).id as string,
          name: (m as any).name as string,
          avatarUrl: (m as any).avatarUrl || null,
          daysSinceLastMessage: periodDays,
        }));
      return inactive;
    },
    enabled: !!groupId && !!group && isAuthenticated,
  });

  // Fetch new members count
  const { data: newMembersCount } = useQuery({
    queryKey: ['group-dashboard-new-members', groupId, currentPeriodStartISO, currentPeriodEndISO],
    queryFn: async () => {
      const entryTypes = ['GROUP_PARTICIPANT_ADD', 'GROUP_PARTICIPANT_INVITE'] as const;
      const { data } = await supabase
        .from('member_events')
        .select('member_lid, event_type, occurred_at')
        .eq('group_id', groupId!)
        .in('event_type', entryTypes)
        .gte('occurred_at', currentPeriodStartISO)
        .lte('occurred_at', currentPeriodEndISO);

      return countUniqueExternalMembers(data as any[]);
    },
    enabled: !!groupId && !!group && isAuthenticated,
  });

  // Fetch exited members count
  const { data: exitedMembersCount } = useQuery({
    queryKey: ['group-dashboard-exited-members', groupId, currentPeriodStartISO, currentPeriodEndISO],
    queryFn: async () => {
      const exitTypes = ['GROUP_PARTICIPANT_LEAVE', 'GROUP_PARTICIPANT_REMOVE'] as const;
      const { data } = await supabase
        .from('member_events')
        .select('member_lid, event_type, occurred_at')
        .eq('group_id', groupId!)
        .in('event_type', exitTypes)
        .gte('occurred_at', currentPeriodStartISO)
        .lte('occurred_at', currentPeriodEndISO);

      return countUniqueExternalMembers(data as any[]);
    },
    enabled: !!groupId && !!group && isAuthenticated,
  });

  // Fetch recent messages
  const { data: recentMessages, isLoading: recentLoading } = useQuery({
    queryKey: ['group-dashboard-recent', groupId],
    queryFn: async () => {
      const { data } = await supabase
        .from('v_messages_feed')
        .select('message_id, member_name, content_preview, message_type, created_at, media_url')
        .eq('group_id', groupId!)
        .order('created_at', { ascending: false })
        .limit(10);

      return data?.map(msg => ({
        id: msg.message_id!,
        memberName: msg.member_name || 'Desconhecido',
        content: msg.content_preview,
        messageType: msg.message_type || 'text',
        createdAt: msg.created_at!,
        hasMedia: !!msg.media_url,
      })) || [];
    },
    enabled: !!groupId && !!group && isAuthenticated,
  });

  // Fetch members overview
  const { data: membersOverview, isLoading: membersLoading } = useQuery({
    queryKey: ['group-dashboard-members', groupId, currentPeriodStartISO, currentPeriodEndISO],
    queryFn: async () => {
      const { data: members } = await supabase
        .from('members')
        .select('id, name, display_name, profile_pic_url')
        .eq('group_id', groupId!)
        .is('deleted_at', null)
        .order('name');

      if (!members) return [];

      const { data: messageCounts } = await supabase
        .from('messages')
        .select('member_id, created_at')
        .eq('group_id', groupId!)
        .is('deleted_at', null)
        .not('member_id', 'is', null)
        .gte('created_at', currentPeriodStartISO)
        .lte('created_at', currentPeriodEndISO);

      const memberStats: Record<string, { count: number; lastAt: string | null }> = {};
      messageCounts?.forEach(msg => {
        if (!memberStats[msg.member_id!]) {
          memberStats[msg.member_id!] = { count: 0, lastAt: null };
        }
        memberStats[msg.member_id!].count++;
        if (!memberStats[msg.member_id!].lastAt || msg.created_at > memberStats[msg.member_id!].lastAt!) {
          memberStats[msg.member_id!].lastAt = msg.created_at;
        }
      });

      return members.map(member => ({
        id: member.id,
        name: member.name,
        displayName: member.display_name,
        avatarUrl: (member as any).profile_pic_url || null,
        messagesCount: memberStats[member.id]?.count || 0,
        lastMessageAt: memberStats[member.id]?.lastAt || null,
        isActive: (memberStats[member.id]?.count || 0) > 0,
      })).sort((a, b) => b.messagesCount - a.messagesCount);
    },
    enabled: !!groupId && !!group && isAuthenticated,
  });

  // Fetch previous members overview
  const { data: previousMembersOverview } = useQuery({
    queryKey: ['group-dashboard-members-prev', groupId, previousPeriodStartISO, previousPeriodEndISO],
    queryFn: async () => {
      const { data: members } = await supabase
        .from('members')
        .select('id, name, display_name')
        .eq('group_id', groupId!)
        .is('deleted_at', null)
        .order('name');

      if (!members) return [];

      const { data: messageCounts } = await supabase
        .from('messages')
        .select('member_id, created_at')
        .eq('group_id', groupId!)
        .is('deleted_at', null)
        .not('member_id', 'is', null)
        .gte('created_at', previousPeriodStartISO)
        .lte('created_at', previousPeriodEndISO);

      const memberStats: Record<string, number> = {};
      messageCounts?.forEach(msg => {
        memberStats[msg.member_id!] = (memberStats[msg.member_id!] || 0) + 1;
      });

      return members.map(member => ({
        id: member.id,
        name: member.name,
        displayName: member.display_name,
        messagesCount: memberStats[member.id] || 0,
        isActive: (memberStats[member.id] || 0) > 0,
      })).sort((a, b) => b.messagesCount - a.messagesCount);
    },
    enabled: !!groupId && !!group && isAuthenticated,
  });

  const isLoading = groupLoading || statsLoading || chartLoading || topParticipantsLoading || recentLoading || membersLoading || memberEventsLoading;

  // Derived: days with activity in the selected period
  const daysWithActivity = (messagesPerDay || [])
    .slice(Math.max(0, (messagesPerDay || []).length - periodDays))
    .filter(d => d.count > 0).length;

  // Derived: current members and members at start of period
  const computeMembersSnapshot = async () => {
    const { count: joinedBeforeEnd } = await supabase
      .from('members')
      .select('*', { count: 'exact', head: true })
      .eq('group_id', groupId!)
      .is('deleted_at', null)
      .lte('joined_at', currentPeriodEndISO);

    const { count: joinedNull } = await supabase
      .from('members')
      .select('*', { count: 'exact', head: true })
      .eq('group_id', groupId!)
      .is('deleted_at', null)
      .is('joined_at', null);

    const { count: exitedBeforeEnd } = await supabase
      .from('members')
      .select('*', { count: 'exact', head: true })
      .eq('group_id', groupId!)
      .is('deleted_at', null)
      .lte('left_at', currentPeriodEndISO);

    const currentMembers = (joinedBeforeEnd || 0) + (joinedNull || 0) - (exitedBeforeEnd || 0);

    const { count: joinedBeforeStart } = await supabase
      .from('members')
      .select('*', { count: 'exact', head: true })
      .eq('group_id', groupId!)
      .is('deleted_at', null)
      .lte('joined_at', currentPeriodStartISO);

    const { count: exitedBeforeStart } = await supabase
      .from('members')
      .select('*', { count: 'exact', head: true })
      .eq('group_id', groupId!)
      .is('deleted_at', null)
      .lte('left_at', currentPeriodStartISO);

    const membersAtPeriodStart = (joinedBeforeStart || 0) + (joinedNull || 0) - (exitedBeforeStart || 0);

    return { currentMembers, membersAtPeriodStart };
  };

  const { data: membersSnapshot } = useQuery({
    queryKey: ['group-dashboard-members-snapshot', groupId, currentPeriodStartISO, currentPeriodEndISO],
    queryFn: computeMembersSnapshot,
    enabled: !!groupId && !!group && isAuthenticated,
  });

  const activePercent = (membersSnapshot?.currentMembers || 0) > 0
    ? Math.round(((stats?.activeMembers || 0) / (membersSnapshot?.currentMembers || 1)) * 100)
    : 0;

  const activeDaysPercent = periodDays > 0 ? Math.round((daysWithActivity / periodDays) * 100) : 0;

  const lowEffortPercent = computeLowEffortPercentFromDailySeries(messagesPerDay as any[], periodDays);

  const recurringPercent = (() => {
    const idsCurrent = new Set((membersOverview || []).filter(m => m.messagesCount > 0).map(m => m.id));
    const idsPrev = new Set((previousMembersOverview || []).filter(m => m.messagesCount > 0).map(m => m.id));
    let intersection = 0;
    idsCurrent.forEach(id => { if (idsPrev.has(id)) intersection++; });
    const denom = membersSnapshot?.currentMembers || 0;
    return denom > 0 ? Math.round((intersection / denom) * 100) : 0;
  })();

  // Derive busiest day key and peak 2-hour window start
  const busiestDayKey = (() => {
    const slice = (messagesPerDay || []).slice(Math.max(0, (messagesPerDay || []).length - periodDays));
    if (slice.length === 0) return null;
    return slice.reduce((max, curr) => (curr.count > (max?.count || 0) ? curr : max), slice[0]).date || null;
  })();

  const peakTwoHourStart = computePeakTwoHourStart(activityData?.activityByHour as any[]);

  const recurringIds = new Set((membersOverview || []).filter(m => m.messagesCount >= 5).map(m => m.id));

  const busyDayAvatars = buildBusyDayAvatars({
    busiestDayKey,
    participantsByDay: periodParticipants?.participantsByDay,
    recurringIds,
    limit: 8,
  });

  const peakWindowAvatars = buildPeakWindowAvatars({
    peakTwoHourStart,
    participantsByHour: periodParticipants?.participantsByHour,
    recurringIds,
    limit: 8,
  });

  const themeAvatars = buildThemeAvatars({
    membersOverview: membersOverview as any[],
    participantsByDay: periodParticipants?.participantsByDay,
    recurringIds,
    limit: 8,
  });

  const stopwordsPt = new Set([
    'a','à','às','ao','aos','ainda','algum','alguma','alguns','algumas','além','am','ano','anos','antes','após','as','até','cada','coisa','coisas','como','da','das','de','dela','dele','deles','demais','depois','desde','desta','deste','do','dos','e','ela','ele','eles','em','entre','era','eram','essa','esse','esta','este','eu','faz','foi','fora','houve','isso','isto','já','la','lá','lhe','lhes','logo','maior','mais','me','mesmo','meu','meus','minha','minhas','muito','na','nas','não','nas','nem','no','nos','nós','nossa','nossas','nosso','nossos','nunca','o','os','ou','para','pela','pelas','pelo','pelos','per','pode','por','porque','pra','quais','qual','quando','que','quem','se','sem','ser','seu','seus','sua','suas','sobre','só','sua','são','tanto','também','te','tem','tenho','tendo','ter','tinha','tiveram','tivemos','tive','todo','toda','todos','todas','tu','tá','um','uma','uns','umas','vai','você','vocês','vos','vou','www','http','https','kkk','rs','haha','hahaha','bom','boa','dia','noite','tarde','oi','olá','ok','blz','vlw','obrigado','obrigada',
    'fui','vou','passei','vazei','pegar','fazer','testar','bem','sempre','algo','tambem','nao','sim','time'
  ]);

  const phraseStopwords = new Set(['bom dia','boa noite','bem vindo']);

  const techHints = new Set(['api','sql','sdk','http','https','ios','android','docker','kafka','react','next','supabase','postgres','node','js','ts','typescript','javascript']);

  const MIN_COUNT = 3;
  const MIN_DAYS = 2;

  const normalize = (s: string) => s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  const canonical = (t: string): string => {
    let s = t;
    s = s.replace(/^(.*?)(mente)$/i, '$1');
    s = s.replace(/^(.*?)(es)$/i, '$1');
    s = s.replace(/^(.*?)(s)$/i, '$1');
    return s;
  };

  const isVerbCandidate = (t: string): boolean => {
    return /(ar|er|ir|ando|endo|indo|ei|ou|ava|ia|amos|iram|arei|erai|irei)$/i.test(t);
  };

  const isAdverbCandidate = (t: string): boolean => {
    return /mente$/i.test(t) || ['bem','sempre','tambem','nao','sim'].includes(t);
  };

  const isTitleOrCaps = (raw: string): boolean => {
    return /^[A-Z][a-z]+$/.test(raw) || /^[A-Z0-9_-]+$/.test(raw);
  };

  const isTechnicalCandidate = (raw: string, t: string): boolean => {
    if (techHints.has(t)) return true;
    if (/[0-9]/.test(raw)) return true;
    if (raw.includes('-') || raw.includes('.')) return true;
    if (isTitleOrCaps(raw)) return true;
    return t.length >= 4;
  };

  const tokenize = (text: string): { raw: string; token: string }[] => {
    const cleaned = normalize(text)
      .replace(/https?:\/\/\S+|www\.[^\s]+/g, ' ')
      .replace(/[^\p{L}\p{N}\s]/gu, ' ');
    const parts = cleaned.split(/\s+/).filter(Boolean);
    const tokens = parts
      .map(raw => ({ raw, token: canonical(raw.trim()) }))
      .filter(x => x.token.length >= 3)
      .filter(x => !/^[0-9]+$/.test(x.token))
      .filter(x => !stopwordsPt.has(x.token))
      .filter(x => !isVerbCandidate(x.token))
      .filter(x => !isAdverbCandidate(x.token))
      .filter(x => isTechnicalCandidate(x.raw, x.token));
    return tokens;
  };

  const bigramsFor = (tokens: { raw: string; token: string }[]): string[] => {
    const result: string[] = [];
    for (let i = 0; i < tokens.length - 1; i++) {
      const a = tokens[i];
      const b = tokens[i + 1];
      if (!a || !b) continue;
      const p = `${a.token} ${b.token}`;
      if (phraseStopwords.has(p)) continue;
      if (stopwordsPt.has(a.token) || stopwordsPt.has(b.token)) continue;
      const badCombo = (isVerbCandidate(a.token) && isVerbCandidate(b.token)) || (isVerbCandidate(a.token) && isAdverbCandidate(b.token)) || (isAdverbCandidate(a.token) && isVerbCandidate(b.token));
      if (badCombo) continue;
      const goodCombo = (!isVerbCandidate(a.token) && !isAdverbCandidate(a.token) && !isVerbCandidate(b.token) && !isAdverbCandidate(b.token)) && (isTechnicalCandidate(a.raw, a.token) || isTechnicalCandidate(b.raw, b.token));
      if (!goodCombo) continue;
      result.push(p);
    }
    return result;
  };

  const { data: suggestionsData } = useQuery({
    queryKey: ['group-ikigai-suggestions', groupId, currentPeriodStartISO, currentPeriodEndISO],
    queryFn: async () => {
      const { data } = await supabase
        .from('messages')
        .select('content, message_type, id, created_at, member_id, sender_phone')
        .eq('group_id', groupId!)
        .is('deleted_at', null)
        .eq('message_type', 'text')
        .gte('created_at', currentPeriodStartISO)
        .lte('created_at', currentPeriodEndISO)
        .limit(5000);

      const perMessageTokens: { raw: string; token: string }[][] = [];
      const bigramToMsgIdx: Record<string, number[]> = {};
      const tokenCounts: Map<string, number> = new Map();
      const tokenParticipants: Map<string, Set<string>> = new Map();
      const bigramCounts: Map<string, number> = new Map();
      const tokenDates: Map<string, Set<string>> = new Map();
      const bigramDates: Map<string, Set<string>> = new Map();

      (data || []).forEach((m, idx) => {
        const content = m.content || '';
        const tokens = tokenize(content);
        perMessageTokens.push(tokens);
        const dateKey = new Date(m.created_at!).toISOString().slice(0,10);
        const participantKey = ((m.member_id as string) || (m.sender_phone as string) || '').toString();
        tokens.forEach(x => {
          tokenCounts.set(x.token, (tokenCounts.get(x.token) || 0) + 1);
          if (participantKey) {
            if (!tokenParticipants.has(x.token)) tokenParticipants.set(x.token, new Set());
            tokenParticipants.get(x.token)!.add(participantKey);
          }
          if (!tokenDates.has(x.token)) tokenDates.set(x.token, new Set());
          tokenDates.get(x.token)!.add(dateKey);
        });
        const bigs = bigramsFor(tokens);
        const seen = new Set<string>();
        bigs.forEach(bg => {
          if (seen.has(bg)) return;
          seen.add(bg);
          bigramCounts.set(bg, (bigramCounts.get(bg) || 0) + 1);
          if (!bigramToMsgIdx[bg]) bigramToMsgIdx[bg] = [];
          bigramToMsgIdx[bg].push(idx);
          if (!bigramDates.has(bg)) bigramDates.set(bg, new Set());
          bigramDates.get(bg)!.add(dateKey);
        });
      });

      const existing = new Set((ikigaiKeywords || []).map(k => normalize(k)));

      const sortedBigrams = Array.from(bigramCounts.entries())
        .filter(([bg]) => {
          const base = normalize(bg);
          if (existing.has(base)) return false;
          const [t1, t2] = base.split(' ');
          return !existing.has(t1) && !existing.has(t2);
        })
        .filter(([bg, c]) => c >= MIN_COUNT && (bigramDates.get(bg)?.size || 0) >= MIN_DAYS)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6);

      const themes = sortedBigrams.map(([phrase, count]) => {
        const msgIdxs = bigramToMsgIdx[phrase] || [];
        const localCounts: Map<string, number> = new Map();
        const [p1, p2] = phrase.split(' ');
        msgIdxs.forEach(i => {
          const toks = perMessageTokens[i] || [];
          toks.forEach(t => {
            const tt = t.token;
            if (tt === p1 || tt === p2) return;
            if (stopwordsPt.has(tt)) return;
            localCounts.set(tt, (localCounts.get(tt) || 0) + 1);
          });
        });
        const keywords = Array.from(localCounts.entries())
          .filter(([t]) => !existing.has(t))
          .filter(([t, c]) => c >= MIN_COUNT && (tokenDates.get(t)?.size || 0) >= MIN_DAYS)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 6)
          .map(([term, c]) => ({ term, count: c }));
        return { phrase, count, keywords };
      });

      const globalKeywords = Array.from(tokenCounts.entries())
        .filter(([t]) => !existing.has(t))
        .filter(([t, c]) => c >= MIN_COUNT && (tokenDates.get(t)?.size || 0) >= MIN_DAYS)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 50)
        .map(([term, c]) => ({ term, count: c, participants: (tokenParticipants.get(term)?.size || 0) }));

      return { themes, keywords: globalKeywords };
    },
    enabled: !!groupId && !!group && isAuthenticated,
  });

  const { data: trendingKeywords } = useQuery({
    queryKey: [
      "group-dashboard-trending-keywords",
      groupId,
      currentPeriodStartISO,
      currentPeriodEndISO,
      previousPeriodStartISO,
      previousPeriodEndISO,
    ],
    queryFn: async () => {
      const currQuery = await supabase
        .from("v_messages_feed")
        .select("content_preview,message_type,created_at")
        .eq("group_id", groupId!)
        .eq("message_type", "text")
        .gte("created_at", currentPeriodStartISO)
        .lte("created_at", currentPeriodEndISO)
        .limit(2000);

      if (currQuery.error) throw currQuery.error;

      const prevQuery = await supabase
        .from("v_messages_feed")
        .select("content_preview,message_type,created_at")
        .eq("group_id", groupId!)
        .eq("message_type", "text")
        .gte("created_at", previousPeriodStartISO)
        .lte("created_at", previousPeriodEndISO)
        .limit(2000);

      if (prevQuery.error) throw prevQuery.error;

      const currRows = (currQuery.data || []).map((d: any) => (d.content_preview || "") as string);
      const prevRows = (prevQuery.data || []).map((d: any) => (d.content_preview || "") as string);

      const currBigrams = extractBigramsFromRows(currRows);
      const prevBigrams = extractBigramsFromRows(prevRows);

      const prevBigramMap: Record<string, number> = {};
      (prevBigrams || []).forEach((b) => {
        prevBigramMap[b.phrase] = Number(b.count || 0);
      });

      const bigrams = (currBigrams || [])
        .map((b) => {
          const prev = prevBigramMap[b.phrase] || 0;
          const delta = prev
            ? Math.round(((Number(b.count || 0) - prev) / prev) * 100)
            : b.count
              ? 100
              : 0;
          return { phrase: b.phrase, count: Number(b.count || 0), delta };
        })
        .sort((a, b) => b.count - a.count)
        .slice(0, 8);

      return { bigrams };
    },
    enabled: !!groupId && !!group && isAuthenticated,
    retry: 1,
  });

  return {
    group,
    orgName: orgData?.name || null,
    stats: stats ? {
      ...stats,
      totalMessages7d: stats.totalMessages,
      activeMembers7d: stats.activeMembers,
    } : {
      totalMembers: 0,
      totalMessages7d: 0,
      activeMembers7d: 0,
      engagementRate: 0,
      topParticipant: null,
      lastMessageAt: null,
    },
    previousStats: previousStats ? {
      totalMessages7d: previousStats.totalMessages,
      activeMembers7d: previousStats.activeMembers,
      engagementRate: previousStats.engagementRate,
      topParticipant: previousStats.topParticipant,
      totalMembersSnapshot: previousStats.totalMembers,
    } : null,
    messagesPerDay: messagesPerDay || [],
    activeMembersPerDay: activeMembersPerDay || [],
    topParticipants: topParticipants || [],
    recentMessages: recentMessages || [],
    membersOverview: membersOverview || [],
    previousMembersOverview: previousMembersOverview || [],
    activityByHour: activityData?.activityByHour || [],
    peakHour: activityData?.peakHour ?? null,
    peakHourMessages: activityData?.peakHourMessages || 0,
    previousPeakHour: previousActivityData?.peakHour ?? null,
    previousPeakHourMessages: previousActivityData?.peakHourMessages || 0,
    memberEngagement: memberEngagement || { recorrentes: 0, esporadicos: 0, inativos: 0 },
    previousMemberEngagement: previousMemberEngagement || null,
    popularMessages: popularMessages || [],
    adminStats: adminStats || null,
    previousAdminStats: previousAdminStats || null,
    atRiskMembers: atRiskMembers || [],
    newMembersCount: newMembersCount || 0,
    previousNewMembersCount: previousNewMembersCount || 0,
    exitedMembersCount: exitedMembersCount || 0,
    previousExitedMembersCount: previousExitedMembersCount || 0,
    memberEntriesPerDay: memberEntriesPerDay || [],
    memberExitsPerDay: memberExitsPerDay || [],
    memberEvents: memberEvents || [],
    currentMembers: membersSnapshot?.currentMembers || stats?.totalMembers || 0,
    membersAtPeriodStart: membersSnapshot?.membersAtPeriodStart || undefined,
    daysWithActivity,
    alignedMessagesPercent: alignedMessagesPercent,
    hasIkigai,
    ikigaiKeywordsList: ikigaiKeywords,
    ikigaiSuggestions: suggestionsData || { themes: [], keywords: [] },
    trendingBigrams: ((trendingKeywords as any)?.bigrams || []) as Array<{ phrase: string; count: number; delta: number }>,
    busyDayAvatars,
    peakWindowAvatars,
    themeAvatars,
    activePercent,
    activeDaysPercent,
    lowEffortPercent,
    recurringPercent,
    isLoading,
    groupLoading,
    error: groupError,
    periodDays,
  };
}
