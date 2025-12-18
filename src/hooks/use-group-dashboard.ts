import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

interface DashboardData {
  group: {
    id: string;
    name: string;
    description: string | null;
    provider: string;
    organization_id: string;
    is_active: boolean;
    is_archived: boolean;
    sync_status: string | null;
    last_sync_at: string | null;
  } | null;
  stats: {
    totalMembers: number;
    totalMessages7d: number;
    activeMembers7d: number;
    engagementRate: number;
    topParticipant: { name: string; count: number } | null;
    lastMessageAt: string | null;
  };
  messagesPerDay: { date: string; count: number }[];
  topParticipants: { name: string; count: number }[];
  recentMessages: {
    id: string;
    memberName: string;
    content: string | null;
    messageType: string;
    createdAt: string;
    hasMedia: boolean;
  }[];
  membersOverview: {
    id: string;
    name: string;
    displayName: string | null;
    messagesCount: number;
    lastMessageAt: string | null;
    isActive: boolean;
  }[];
}

export function useGroupDashboard(groupId: string | undefined) {
  const { isAuthenticated } = useAuth();

  // Fetch group details
  const { data: group, isLoading: groupLoading, error: groupError } = useQuery({
    queryKey: ['group-dashboard', groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('groups')
        .select('id, name, description, provider, organization_id, is_active, is_archived, sync_status, last_sync_at')
        .eq('id', groupId!)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!groupId && isAuthenticated,
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
  });

  // Calculate 7 days ago
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const sevenDaysAgoISO = sevenDaysAgo.toISOString();

  // Fetch dashboard stats
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['group-dashboard-stats', groupId],
    queryFn: async () => {
      // Fetch total members
      const { count: totalMembers } = await supabase
        .from('members')
        .select('*', { count: 'exact', head: true })
        .eq('group_id', groupId!)
        .is('deleted_at', null);

      // Fetch messages in last 7 days
      const { count: totalMessages7d } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('group_id', groupId!)
        .is('deleted_at', null)
        .gte('created_at', sevenDaysAgoISO);

      // Fetch active members in last 7 days (distinct member_ids with messages)
      const { data: activeMembersData } = await supabase
        .from('messages')
        .select('member_id')
        .eq('group_id', groupId!)
        .is('deleted_at', null)
        .not('member_id', 'is', null)
        .gte('created_at', sevenDaysAgoISO);

      const uniqueActiveMembers = new Set(activeMembersData?.map(m => m.member_id) || []);
      const activeMembers7d = uniqueActiveMembers.size;

      // Calculate engagement rate
      const engagementRate = totalMembers && totalMembers > 0 
        ? Math.round((activeMembers7d / totalMembers) * 100) 
        : 0;

      // Get top participant in last 7 days
      const { data: topParticipantData } = await supabase
        .from('messages')
        .select('member_id, members!inner(name)')
        .eq('group_id', groupId!)
        .is('deleted_at', null)
        .not('member_id', 'is', null)
        .gte('created_at', sevenDaysAgoISO);

      const memberCounts: Record<string, { name: string; count: number }> = {};
      topParticipantData?.forEach((msg: any) => {
        const memberId = msg.member_id;
        const memberName = msg.members?.name || 'Desconhecido';
        if (!memberCounts[memberId]) {
          memberCounts[memberId] = { name: memberName, count: 0 };
        }
        memberCounts[memberId].count++;
      });

      const topParticipant = Object.values(memberCounts)
        .sort((a, b) => b.count - a.count)[0] || null;

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
        totalMessages7d: totalMessages7d || 0,
        activeMembers7d,
        engagementRate,
        topParticipant,
        lastMessageAt: lastMessageData?.created_at || null,
      };
    },
    enabled: !!groupId && !!group && isAuthenticated,
  });

  // Fetch messages per day for chart
  const { data: messagesPerDay, isLoading: chartLoading } = useQuery({
    queryKey: ['group-dashboard-chart', groupId],
    queryFn: async () => {
      const { data } = await supabase
        .from('messages')
        .select('created_at')
        .eq('group_id', groupId!)
        .is('deleted_at', null)
        .gte('created_at', sevenDaysAgoISO)
        .order('created_at', { ascending: true });

      // Group by day
      const countsByDay: Record<string, number> = {};
      
      // Initialize all 7 days
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateKey = date.toISOString().split('T')[0];
        countsByDay[dateKey] = 0;
      }

      // Count messages per day
      data?.forEach(msg => {
        const dateKey = msg.created_at.split('T')[0];
        if (countsByDay[dateKey] !== undefined) {
          countsByDay[dateKey]++;
        }
      });

      return Object.entries(countsByDay).map(([date, count]) => ({
        date,
        count,
      }));
    },
    enabled: !!groupId && !!group && isAuthenticated,
  });

  // Fetch top 5 participants
  const { data: topParticipants, isLoading: topParticipantsLoading } = useQuery({
    queryKey: ['group-dashboard-top-participants', groupId],
    queryFn: async () => {
      const { data } = await supabase
        .from('messages')
        .select('member_id, members!inner(name)')
        .eq('group_id', groupId!)
        .is('deleted_at', null)
        .not('member_id', 'is', null)
        .gte('created_at', sevenDaysAgoISO);

      const memberCounts: Record<string, { name: string; count: number }> = {};
      data?.forEach((msg: any) => {
        const memberId = msg.member_id;
        const memberName = msg.members?.name || 'Desconhecido';
        if (!memberCounts[memberId]) {
          memberCounts[memberId] = { name: memberName, count: 0 };
        }
        memberCounts[memberId].count++;
      });

      return Object.values(memberCounts)
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
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
    queryKey: ['group-dashboard-members', groupId],
    queryFn: async () => {
      // Get all members
      const { data: members } = await supabase
        .from('members')
        .select('id, name, display_name')
        .eq('group_id', groupId!)
        .is('deleted_at', null)
        .order('name');

      if (!members) return [];

      // Get message counts per member in last 7 days
      const { data: messageCounts } = await supabase
        .from('messages')
        .select('member_id, created_at')
        .eq('group_id', groupId!)
        .is('deleted_at', null)
        .not('member_id', 'is', null)
        .gte('created_at', sevenDaysAgoISO);

      // Aggregate counts and last message per member
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
        messagesCount: memberStats[member.id]?.count || 0,
        lastMessageAt: memberStats[member.id]?.lastAt || null,
        isActive: (memberStats[member.id]?.count || 0) > 0,
      })).sort((a, b) => b.messagesCount - a.messagesCount);
    },
    enabled: !!groupId && !!group && isAuthenticated,
  });

  const isLoading = groupLoading || statsLoading || chartLoading || topParticipantsLoading || recentLoading || membersLoading;

  return {
    group,
    orgName: orgData?.name || null,
    stats: stats || {
      totalMembers: 0,
      totalMessages7d: 0,
      activeMembers7d: 0,
      engagementRate: 0,
      topParticipant: null,
      lastMessageAt: null,
    },
    messagesPerDay: messagesPerDay || [],
    topParticipants: topParticipants || [],
    recentMessages: recentMessages || [],
    membersOverview: membersOverview || [],
    isLoading,
    groupLoading,
    error: groupError,
  };
}
