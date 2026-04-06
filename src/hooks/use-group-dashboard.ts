import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { subDays } from "date-fns";
import { buildGroupDashboardPeriods } from "@/hooks/group-dashboard-periods";
import { countActiveInboundPeople } from "@/hooks/group-dashboard-aggregations";
import { buildDailyCountSeries, buildDailyUniqueCountSeries } from "@/hooks/group-dashboard-series";
import { buildHourlyActivitySummary } from "@/hooks/group-dashboard-activity";
import { buildMemberEngagementDistribution, countUniqueExternalMembers } from "@/hooks/group-dashboard-member-metrics";
import { fetchAllPages } from "@/hooks/group-dashboard-pagination";
import { computeLowEffortPercentFromDailySeries } from "@/hooks/group-dashboard-derived";

 

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

type GroupMessageFact = {
  member_id: string | null;
  sender_phone: string | null;
  from_me: boolean | null;
  direction: string | null;
  message_type: string | null;
  created_at: string;
};

type GroupMemberLite = {
  id: string;
  name: string | null;
  display_name: string | null;
  profile_pic_url: string | null;
  joined_at: string | null;
  left_at: string | null;
  status: string | null;
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
        .select('id, name, description, provider, organization_id, is_active, is_archived, sync_status, last_sync_at, metadata, invite_link, provider_phone')
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

  const { data: membersList = [], isLoading: membersListLoading } = useQuery({
    queryKey: ['group-dashboard-members-list', groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('members')
        .select('id, name, display_name, profile_pic_url, joined_at, left_at, status')
        .eq('group_id', groupId!)
        .is('deleted_at', null)
        .order('name');

      if (error) throw error;
      return (data ?? []) as GroupMemberLite[];
    },
    enabled: !!groupId && !!group && isAuthenticated,
    staleTime: 60000,
  });

  const { data: currentPeriodMessages = [], isLoading: currentPeriodMessagesLoading } = useQuery({
    queryKey: ['group-dashboard-period-messages', groupId, currentPeriodStartISO, currentPeriodEndISO],
    queryFn: async () => {
      const data = await fetchAllPages<GroupMessageFact>((from, to) =>
        supabase
          .from('messages')
          .select('member_id, sender_phone, from_me, direction, message_type, created_at')
          .eq('group_id', groupId!)
          .is('deleted_at', null)
          .gte('created_at', currentPeriodStartISO)
          .lte('created_at', currentPeriodEndISO)
          .order('created_at', { ascending: true })
          .range(from, to),
        { pageSize: 5000 },
      );

      return (data ?? []) as GroupMessageFact[];
    },
    enabled: !!groupId && !!group && isAuthenticated,
  });

  const { data: previousPeriodMessages = [], isLoading: previousPeriodMessagesLoading } = useQuery({
    queryKey: ['group-dashboard-previous-period-messages', groupId, previousPeriodStartISO, previousPeriodEndISO],
    queryFn: async () => {
      const data = await fetchAllPages<GroupMessageFact>((from, to) =>
        supabase
          .from('messages')
          .select('member_id, sender_phone, from_me, direction, message_type, created_at')
          .eq('group_id', groupId!)
          .is('deleted_at', null)
          .gte('created_at', previousPeriodStartISO)
          .lte('created_at', previousPeriodEndISO)
          .order('created_at', { ascending: true })
          .range(from, to),
        { pageSize: 5000 },
      );

      return (data ?? []) as GroupMessageFact[];
    },
    enabled: !!groupId && !!group && isAuthenticated,
  });

  const previousActivityData = useMemo(() => {
    const summary = buildHourlyActivitySummary(previousPeriodMessages as any[]);
    return {
      peakHour: summary.peakHour,
      peakHourMessages: summary.peakHourMessages,
    };
  }, [previousPeriodMessages]);

  const messagesPerDay = useMemo(
    () =>
      buildDailyCountSeries(currentPeriodMessages, {
        periodDays,
        currentPeriodEnd,
        getDate: (msg) => new Date((msg as any).created_at),
      }),
    [currentPeriodMessages, periodDays, currentPeriodEnd],
  );

  const { data: memberEventsRaw = [], isLoading: memberEventsLoading } = useQuery({
    queryKey: ["group-dashboard-member-events-raw", groupId, currentPeriodStartISO, currentPeriodEndISO],
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

  const { data: previousMemberEventsRaw = [] } = useQuery({
    queryKey: ["group-dashboard-previous-member-events-raw", groupId, previousPeriodStartISO, previousPeriodEndISO],
    queryFn: async () => {
      const eventTypes = [
        "GROUP_PARTICIPANT_ADD",
        "GROUP_PARTICIPANT_INVITE",
        "GROUP_PARTICIPANT_LEAVE",
        "GROUP_PARTICIPANT_REMOVE",
      ] as const;
      const { data, error } = await supabase
        .from("member_events")
        .select("member_lid, event_type, occurred_at")
        .eq("group_id", groupId!)
        .in("event_type", eventTypes)
        .gte("occurred_at", previousPeriodStartISO)
        .lte("occurred_at", previousPeriodEndISO)
        .order("occurred_at", { ascending: true });

      if (error) throw error;
      return (data ?? []) as Array<{ member_lid?: string | null; event_type?: string | null; occurred_at?: string | null }>;
    },
    enabled: !!groupId && !!group && isAuthenticated,
  });

  const activeMembersPerDay = useMemo(
    () =>
      buildDailyUniqueCountSeries(
        currentPeriodMessages.filter((msg) => !!msg.member_id),
        {
          periodDays,
          currentPeriodEnd,
          getDate: (msg) => new Date((msg as any).created_at),
          getKey: (msg) => (msg as any).member_id as string | null,
        },
      ),
    [currentPeriodMessages, periodDays, currentPeriodEnd],
  );

  const activityData = useMemo(
    () => buildHourlyActivitySummary(currentPeriodMessages as any[]),
    [currentPeriodMessages],
  );

  const memberEngagement = useMemo(
    () => buildMemberEngagementDistribution(membersList as any[], currentPeriodMessages as any[]),
    [membersList, currentPeriodMessages],
  );

  const membersOverview = useMemo(() => {
    if (!membersList.length) return [];

    const memberStats: Record<string, { count: number; lastAt: string | null }> = {};
    currentPeriodMessages.forEach((msg) => {
      if (!msg.member_id) return;
      if (!memberStats[msg.member_id]) {
        memberStats[msg.member_id] = { count: 0, lastAt: null };
      }
      memberStats[msg.member_id].count++;
      if (!memberStats[msg.member_id].lastAt || msg.created_at > memberStats[msg.member_id].lastAt!) {
        memberStats[msg.member_id].lastAt = msg.created_at;
      }
    });

    return membersList
      .map((member) => ({
        id: member.id,
        name: member.name,
        displayName: member.display_name,
        avatarUrl: member.profile_pic_url || null,
        messagesCount: memberStats[member.id]?.count || 0,
        lastMessageAt: memberStats[member.id]?.lastAt || null,
        isActive: (memberStats[member.id]?.count || 0) > 0,
      }))
      .sort((a, b) => b.messagesCount - a.messagesCount);
  }, [membersList, currentPeriodMessages]);


  const previousMembersOverview = useMemo(() => {
    if (!membersList.length) return [];

    const memberStats: Record<string, { count: number; lastAt: string | null }> = {};
    previousPeriodMessages.forEach((msg) => {
      if (!msg.member_id) return;
      if (!memberStats[msg.member_id]) {
        memberStats[msg.member_id] = { count: 0, lastAt: null };
      }
      memberStats[msg.member_id].count++;
      if (!memberStats[msg.member_id].lastAt || msg.created_at > memberStats[msg.member_id].lastAt!) {
        memberStats[msg.member_id].lastAt = msg.created_at;
      }
    });

    return membersList
      .map((member) => ({
        id: member.id,
        name: member.name,
        displayName: member.display_name,
        avatarUrl: member.profile_pic_url || null,
        messagesCount: memberStats[member.id]?.count || 0,
        lastMessageAt: memberStats[member.id]?.lastAt || null,
        isActive: (memberStats[member.id]?.count || 0) > 0,
      }))
      .sort((a, b) => b.messagesCount - a.messagesCount);
  }, [membersList, previousPeriodMessages]);

  const topParticipantsBase = useMemo(
    () =>
      membersOverview
        .filter((member) => member.messagesCount > 0)
        .slice(0, 5)
        .map((member) => ({
          id: member.id,
          name: member.displayName || member.name || "Desconhecido",
          count: member.messagesCount,
          avatarUrl: member.avatarUrl,
          leftAt: membersList.find((candidate) => candidate.id === member.id)?.left_at ?? null,
          status: membersList.find((candidate) => candidate.id === member.id)?.status ?? null,
        })),
    [membersList, membersOverview],
  );

  const topParticipants = topParticipantsBase;

  const previousTopParticipant = useMemo(() => {
    const first = previousMembersOverview[0];
    if (!first) return null;

    const memberMeta = membersList.find((member) => member.id === first.id);
    return {
      id: first.id,
      name: first.displayName || first.name || "Desconhecido",
      count: first.messagesCount,
      avatarUrl: first.avatarUrl,
      leftAt: memberMeta?.left_at ?? null,
      status: memberMeta?.status ?? null,
    };
  }, [membersList, previousMembersOverview]);

  const previousMemberEngagement = useMemo(
    () => buildMemberEngagementDistribution(membersList as any[], previousPeriodMessages as any[]),
    [membersList, previousPeriodMessages],
  );

  const stats = useMemo(() => {
    const totalMembers = groupOverview?.members_count ?? membersList.length ?? 0;
    const totalMessages = currentPeriodMessages.length;
    const activeMembers = countActiveInboundPeople(
      currentPeriodMessages.filter((msg) =>
        msg.direction === 'inbound' &&
        msg.from_me === false &&
        msg.message_type !== 'poll_vote',
      ) as any[],
    );
    const engagementRate = totalMembers > 0 ? Math.round((activeMembers / totalMembers) * 100) : 0;

    return {
      totalMembers,
      totalMessages,
      activeMembers,
      engagementRate,
      topParticipant: topParticipants[0] ?? null,
      lastMessageAt: groupOverview?.last_message_at || currentPeriodMessages[currentPeriodMessages.length - 1]?.created_at || null,
    };
  }, [groupOverview?.last_message_at, groupOverview?.members_count, membersList.length, currentPeriodMessages, topParticipants]);

  const previousStats = useMemo(() => {
    const activeMembers = countActiveInboundPeople(
      previousPeriodMessages.filter((msg) =>
        msg.direction === 'inbound' &&
        msg.from_me === false &&
        msg.message_type !== 'poll_vote',
      ) as any[],
    );
    const totalMembers = previousMembersOverview.length;
    const engagementRate = totalMembers > 0 ? Math.round((activeMembers / totalMembers) * 100) : 0;

    return {
      totalMessages: previousPeriodMessages.length,
      activeMembers,
      totalMembers,
      engagementRate,
      topParticipant: previousTopParticipant,
    };
  }, [previousMembersOverview.length, previousPeriodMessages, previousTopParticipant]);

  const statsLoading = currentPeriodMessagesLoading || membersListLoading;
  const chartLoading = currentPeriodMessagesLoading;
  const membersLoading = membersListLoading || currentPeriodMessagesLoading;
  const isLoading = groupLoading || statsLoading || chartLoading || membersLoading || memberEventsLoading || previousPeriodMessagesLoading;

  // Derived: days with activity in the selected period
  const daysWithActivity = (messagesPerDay || [])
    .slice(Math.max(0, (messagesPerDay || []).length - periodDays))
    .filter(d => d.count > 0).length;

  // Derived: current members and members at start of period
  const membersSnapshot = useMemo(() => {
    const isMemberPresentAt = (member: GroupMemberLite, cutoffISO: string) => {
      const joinedBeforeCutoff = !member.joined_at || member.joined_at <= cutoffISO;
      const leftBeforeOrAtCutoff = !!member.left_at && member.left_at <= cutoffISO;
      return joinedBeforeCutoff && !leftBeforeOrAtCutoff;
    };

    const currentMembers = membersList.filter((member) => isMemberPresentAt(member, currentPeriodEndISO)).length;
    const membersAtPeriodStart = membersList.filter((member) => isMemberPresentAt(member, currentPeriodStartISO)).length;

    return { currentMembers, membersAtPeriodStart };
  }, [currentPeriodEndISO, currentPeriodStartISO, membersList]);

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

  const memberEvents = memberEventsRaw;

  const memberEntriesPerDay = useMemo(() => {
    const entries = memberEventsRaw.filter((event) => event.kind === "entrada");
    return buildDailyCountSeries(entries as any[], {
      periodDays,
      currentPeriodEnd,
      getDate: (item) => new Date((item as any).occurredAt),
    });
  }, [memberEventsRaw, periodDays, currentPeriodEnd]);

  const memberExitsPerDay = useMemo(() => {
    const exits = memberEventsRaw.filter((event) => event.kind === "saida");
    return buildDailyCountSeries(exits as any[], {
      periodDays,
      currentPeriodEnd,
      getDate: (item) => new Date((item as any).occurredAt),
    });
  }, [memberEventsRaw, periodDays, currentPeriodEnd]);

  const newMembersCount = useMemo(
    () =>
      countUniqueExternalMembers(
        memberEventsRaw
          .filter((event) => event.kind === "entrada")
          .map((event) => ({ member_lid: event.externalMemberId })),
      ),
    [memberEventsRaw],
  );

  const exitedMembersCount = useMemo(
    () =>
      countUniqueExternalMembers(
        memberEventsRaw
          .filter((event) => event.kind === "saida")
          .map((event) => ({ member_lid: event.externalMemberId })),
      ),
    [memberEventsRaw],
  );

  const previousNewMembersCount = useMemo(
    () =>
      countUniqueExternalMembers(
        previousMemberEventsRaw.filter((event) => {
          const type = String(event.event_type ?? "");
          return type === "GROUP_PARTICIPANT_ADD" || type === "GROUP_PARTICIPANT_INVITE";
        }),
      ),
    [previousMemberEventsRaw],
  );

  const previousExitedMembersCount = useMemo(
    () =>
      countUniqueExternalMembers(
        previousMemberEventsRaw.filter((event) => {
          const type = String(event.event_type ?? "");
          return type === "GROUP_PARTICIPANT_LEAVE" || type === "GROUP_PARTICIPANT_REMOVE";
        }),
      ),
    [previousMemberEventsRaw],
  );

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
    membersOverview: membersOverview || [],
    previousMembersOverview: previousMembersOverview || [],
    activityByHour: activityData?.activityByHour || [],
    peakHour: activityData?.peakHour ?? null,
    peakHourMessages: activityData?.peakHourMessages || 0,
    previousPeakHour: previousActivityData?.peakHour ?? null,
    previousPeakHourMessages: previousActivityData?.peakHourMessages || 0,
    memberEngagement: memberEngagement || { recorrentes: 0, esporadicos: 0, inativos: 0 },
    previousMemberEngagement: previousMemberEngagement || null,
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
