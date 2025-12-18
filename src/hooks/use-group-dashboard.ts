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
  previousStats: {
    totalMessages7d: number;
    activeMembers7d: number;
    engagementRate: number;
  } | null;
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
  activityByHour: { hour: number; count: number }[];
  peakHour: number | null;
  peakHourMessages: number;
  memberEngagement: {
    recorrentes: number;
    esporadicos: number;
    inativos: number;
  };
  popularMessages: {
    id: string;
    content: string | null;
    messageType: string;
    memberName: string;
    reactionCount: number;
  }[];
  adminStats: {
    total: number;
    active: number;
    inactive: number;
    messagesFromAdmins: number;
    totalMessages: number;
    topAdmin: { name: string; messages: number } | null;
  } | null;
  atRiskMembers: {
    id: string;
    name: string;
    daysSinceLastMessage: number;
  }[];
  newMembersCount: number;
}

export function useGroupDashboard(groupId: string | undefined) {
  const { isAuthenticated } = useAuth();

  // Calculate date ranges
  const now = new Date();
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const fourteenDaysAgo = new Date(now);
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
  
  const sevenDaysAgoISO = sevenDaysAgo.toISOString();
  const fourteenDaysAgoISO = fourteenDaysAgo.toISOString();

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

  // Fetch current period stats (7 days)
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

      // Fetch active members in last 7 days
      const { data: activeMembersData } = await supabase
        .from('messages')
        .select('member_id')
        .eq('group_id', groupId!)
        .is('deleted_at', null)
        .not('member_id', 'is', null)
        .gte('created_at', sevenDaysAgoISO);

      const uniqueActiveMembers = new Set(activeMembersData?.map(m => m.member_id) || []);
      const activeMembers7d = uniqueActiveMembers.size;

      const engagementRate = totalMembers && totalMembers > 0 
        ? Math.round((activeMembers7d / totalMembers) * 100) 
        : 0;

      // Get top participant
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

  // Fetch previous period stats (7-14 days ago) for comparison
  const { data: previousStats } = useQuery({
    queryKey: ['group-dashboard-previous-stats', groupId],
    queryFn: async () => {
      const { count: totalMessages7d } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('group_id', groupId!)
        .is('deleted_at', null)
        .gte('created_at', fourteenDaysAgoISO)
        .lt('created_at', sevenDaysAgoISO);

      const { data: activeMembersData } = await supabase
        .from('messages')
        .select('member_id')
        .eq('group_id', groupId!)
        .is('deleted_at', null)
        .not('member_id', 'is', null)
        .gte('created_at', fourteenDaysAgoISO)
        .lt('created_at', sevenDaysAgoISO);

      const uniqueActiveMembers = new Set(activeMembersData?.map(m => m.member_id) || []);
      
      // Get total members at that time (approximate - use current)
      const { count: totalMembers } = await supabase
        .from('members')
        .select('*', { count: 'exact', head: true })
        .eq('group_id', groupId!)
        .is('deleted_at', null);

      const engagementRate = totalMembers && totalMembers > 0 
        ? Math.round((uniqueActiveMembers.size / totalMembers) * 100) 
        : 0;

      return {
        totalMessages7d: totalMessages7d || 0,
        activeMembers7d: uniqueActiveMembers.size,
        engagementRate,
      };
    },
    enabled: !!groupId && !!group && isAuthenticated,
  });

  // Fetch messages per day for chart (14 days)
  const { data: messagesPerDay, isLoading: chartLoading } = useQuery({
    queryKey: ['group-dashboard-chart', groupId],
    queryFn: async () => {
      const { data } = await supabase
        .from('messages')
        .select('created_at')
        .eq('group_id', groupId!)
        .is('deleted_at', null)
        .gte('created_at', fourteenDaysAgoISO)
        .order('created_at', { ascending: true });

      const countsByDay: Record<string, number> = {};
      
      // Initialize all 14 days
      for (let i = 13; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateKey = date.toISOString().split('T')[0];
        countsByDay[dateKey] = 0;
      }

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

  // Fetch activity by hour and peak hour
  const { data: activityData } = useQuery({
    queryKey: ['group-dashboard-activity-hour', groupId],
    queryFn: async () => {
      const { data } = await supabase
        .from('messages')
        .select('created_at')
        .eq('group_id', groupId!)
        .is('deleted_at', null)
        .gte('created_at', sevenDaysAgoISO);

      const countsByHour: Record<number, number> = {};
      for (let i = 0; i < 24; i++) {
        countsByHour[i] = 0;
      }

      data?.forEach(msg => {
        const hour = new Date(msg.created_at).getHours();
        countsByHour[hour]++;
      });

      const activityByHour = Object.entries(countsByHour).map(([hour, count]) => ({
        hour: parseInt(hour),
        count,
      }));

      const peakEntry = activityByHour.reduce((max, curr) => 
        curr.count > max.count ? curr : max, { hour: 0, count: 0 });

      return {
        activityByHour,
        peakHour: peakEntry.count > 0 ? peakEntry.hour : null,
        peakHourMessages: peakEntry.count,
      };
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

  // Fetch member engagement distribution
  const { data: memberEngagement } = useQuery({
    queryKey: ['group-dashboard-engagement', groupId],
    queryFn: async () => {
      // Get all members
      const { data: members } = await supabase
        .from('members')
        .select('id')
        .eq('group_id', groupId!)
        .is('deleted_at', null);

      if (!members) return { recorrentes: 0, esporadicos: 0, inativos: 0 };

      // Get message counts per member
      const { data: messageCounts } = await supabase
        .from('messages')
        .select('member_id')
        .eq('group_id', groupId!)
        .is('deleted_at', null)
        .not('member_id', 'is', null)
        .gte('created_at', sevenDaysAgoISO);

      const counts: Record<string, number> = {};
      messageCounts?.forEach(msg => {
        counts[msg.member_id!] = (counts[msg.member_id!] || 0) + 1;
      });

      let recorrentes = 0;
      let esporadicos = 0;
      let inativos = 0;

      members.forEach(member => {
        const count = counts[member.id] || 0;
        if (count >= 5) recorrentes++;
        else if (count >= 1) esporadicos++;
        else inativos++;
      });

      return { recorrentes, esporadicos, inativos };
    },
    enabled: !!groupId && !!group && isAuthenticated,
  });

  // Fetch popular messages (most reactions)
  const { data: popularMessages } = useQuery({
    queryKey: ['group-dashboard-popular', groupId],
    queryFn: async () => {
      const { data } = await supabase
        .from('v_message_reactions_summary')
        .select('message_id, count, emoji')
        .order('count', { ascending: false })
        .limit(20);

      if (!data || data.length === 0) return [];

      // Group by message and sum reactions
      const messageReactions: Record<string, number> = {};
      data.forEach(r => {
        if (r.message_id) {
          messageReactions[r.message_id] = (messageReactions[r.message_id] || 0) + (r.count || 0);
        }
      });

      const topMessageIds = Object.entries(messageReactions)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([id]) => id);

      if (topMessageIds.length === 0) return [];

      // Fetch message details
      const { data: messages } = await supabase
        .from('v_messages_feed')
        .select('message_id, content_preview, message_type, member_name')
        .eq('group_id', groupId!)
        .in('message_id', topMessageIds);

      return topMessageIds.map(id => {
        const msg = messages?.find(m => m.message_id === id);
        return {
          id,
          content: msg?.content_preview || null,
          messageType: msg?.message_type || 'text',
          memberName: msg?.member_name || 'Desconhecido',
          reactionCount: messageReactions[id] || 0,
        };
      }).filter(m => m.reactionCount > 0);
    },
    enabled: !!groupId && !!group && isAuthenticated,
  });

  // Fetch admin stats
  const { data: adminStats } = useQuery({
    queryKey: ['group-dashboard-admins', groupId],
    queryFn: async () => {
      // Get admin members
      const { data: admins } = await supabase
        .from('members')
        .select('id, name, is_admin, is_owner, is_super_admin')
        .eq('group_id', groupId!)
        .is('deleted_at', null)
        .or('is_admin.eq.true,is_owner.eq.true,is_super_admin.eq.true');

      if (!admins || admins.length === 0) return null;

      const adminIds = admins.map(a => a.id);

      // Get messages from admins
      const { data: adminMessages } = await supabase
        .from('messages')
        .select('member_id')
        .eq('group_id', groupId!)
        .is('deleted_at', null)
        .in('member_id', adminIds)
        .gte('created_at', sevenDaysAgoISO);

      // Get total messages for comparison
      const { count: totalMessages } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('group_id', groupId!)
        .is('deleted_at', null)
        .gte('created_at', sevenDaysAgoISO);

      // Count messages per admin
      const adminCounts: Record<string, number> = {};
      adminMessages?.forEach(msg => {
        if (msg.member_id) {
          adminCounts[msg.member_id] = (adminCounts[msg.member_id] || 0) + 1;
        }
      });

      const activeAdminIds = new Set(Object.keys(adminCounts));
      const activeCount = activeAdminIds.size;

      // Find top admin
      let topAdmin: { name: string; messages: number } | null = null;
      let maxMessages = 0;
      
      admins.forEach(admin => {
        const count = adminCounts[admin.id] || 0;
        if (count > maxMessages) {
          maxMessages = count;
          topAdmin = { name: admin.name, messages: count };
        }
      });

      return {
        total: admins.length,
        active: activeCount,
        inactive: admins.length - activeCount,
        messagesFromAdmins: adminMessages?.length || 0,
        totalMessages: totalMessages || 0,
        topAdmin,
      };
    },
    enabled: !!groupId && !!group && isAuthenticated,
  });

  // Fetch at-risk members (no messages in 7+ days)
  const { data: atRiskMembers } = useQuery({
    queryKey: ['group-dashboard-at-risk', groupId],
    queryFn: async () => {
      // Get all members with their last message
      const { data: members } = await supabase
        .from('members')
        .select('id, name, last_seen_message_at')
        .eq('group_id', groupId!)
        .is('deleted_at', null);

      if (!members) return [];

      const now = new Date();
      const atRisk = members
        .map(member => {
          const lastMsg = member.last_seen_message_at 
            ? new Date(member.last_seen_message_at) 
            : null;
          const daysSince = lastMsg 
            ? Math.floor((now.getTime() - lastMsg.getTime()) / (1000 * 60 * 60 * 24))
            : 999;
          return {
            id: member.id,
            name: member.name,
            daysSinceLastMessage: daysSince,
          };
        })
        .filter(m => m.daysSinceLastMessage >= 7)
        .sort((a, b) => b.daysSinceLastMessage - a.daysSinceLastMessage);

      return atRisk;
    },
    enabled: !!groupId && !!group && isAuthenticated,
  });

  // Fetch new members count (joined in last 7 days)
  const { data: newMembersCount } = useQuery({
    queryKey: ['group-dashboard-new-members', groupId],
    queryFn: async () => {
      const { count } = await supabase
        .from('members')
        .select('*', { count: 'exact', head: true })
        .eq('group_id', groupId!)
        .is('deleted_at', null)
        .gte('joined_at', sevenDaysAgoISO);

      return count || 0;
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
        .gte('created_at', sevenDaysAgoISO);

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
    previousStats: previousStats || null,
    messagesPerDay: messagesPerDay || [],
    topParticipants: topParticipants || [],
    recentMessages: recentMessages || [],
    membersOverview: membersOverview || [],
    activityByHour: activityData?.activityByHour || [],
    peakHour: activityData?.peakHour ?? null,
    peakHourMessages: activityData?.peakHourMessages || 0,
    memberEngagement: memberEngagement || { recorrentes: 0, esporadicos: 0, inativos: 0 },
    popularMessages: popularMessages || [],
    adminStats: adminStats || null,
    atRiskMembers: atRiskMembers || [],
    newMembersCount: newMembersCount || 0,
    isLoading,
    groupLoading,
    error: groupError,
  };
}
