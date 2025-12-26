import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { subDays } from "date-fns";
import { formatDateKeySP, getHourSP } from "@/lib/date";

 

interface DateRange {
  from: Date;
  to: Date;
}

interface UseGroupDashboardOptions {
  groupId: string | undefined;
  dateRange?: DateRange;
}

export function useGroupDashboard({ groupId, dateRange }: UseGroupDashboardOptions) {
  const { isAuthenticated } = useAuth();

  // Use provided date range or default to 7 days
  const now = new Date();
  const currentPeriodEnd = dateRange?.to || now;
  const currentPeriodStart = dateRange?.from || subDays(now, 6);
  
  // Calculate previous period for comparison (same duration before current period)
  const periodDays = Math.ceil((currentPeriodEnd.getTime() - currentPeriodStart.getTime()) / (1000 * 60 * 60 * 24));
  const previousPeriodEnd = new Date(currentPeriodStart.getTime() - 1);
  const previousPeriodStart = subDays(previousPeriodEnd, periodDays - 1);

  const currentPeriodStartISO = currentPeriodStart.toISOString();
  const currentPeriodEndISO = currentPeriodEnd.toISOString();
  const previousPeriodStartISO = previousPeriodStart.toISOString();
  const previousPeriodEndISO = previousPeriodEnd.toISOString();

  // Chart should respect selected period strictly
  const chartDays = periodDays;
  const chartStartISO = currentPeriodStartISO;

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
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['group-dashboard-stats', groupId, currentPeriodStartISO, currentPeriodEndISO],
    queryFn: async () => {
      // Fetch total members
      const { count: totalMembers } = await supabase
        .from('members')
        .select('*', { count: 'exact', head: true })
        .eq('group_id', groupId!)
        .is('deleted_at', null);

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
        .select('member_id')
        .eq('group_id', groupId!)
        .is('deleted_at', null)
        .not('member_id', 'is', null)
        .gte('created_at', currentPeriodStartISO)
        .lte('created_at', currentPeriodEndISO);

      const uniqueActiveMembers = new Set(activeMembersData?.map(m => m.member_id) || []);
      const activeMembers = uniqueActiveMembers.size;

      const engagementRate = totalMembers && totalMembers > 0 
        ? Math.round((activeMembers / totalMembers) * 100) 
        : 0;

      // Get top participant
      const { data: topParticipantData } = await supabase
        .from('messages')
        .select('member_id, members!inner(name, profile_pic_url)')
        .eq('group_id', groupId!)
        .is('deleted_at', null)
        .not('member_id', 'is', null)
        .gte('created_at', currentPeriodStartISO)
        .lte('created_at', currentPeriodEndISO);

      const memberCounts: Record<string, { name: string; count: number; avatarUrl: string | null }> = {};
      topParticipantData?.forEach((msg: any) => {
        const memberId = msg.member_id;
        const memberName = msg.members?.name || 'Desconhecido';
        const avatarUrl = (msg.members as any)?.profile_pic_url || null;
        if (!memberCounts[memberId]) {
          memberCounts[memberId] = { name: memberName, count: 0, avatarUrl };
        }
        memberCounts[memberId].count++;
        if (!memberCounts[memberId].avatarUrl && avatarUrl) {
          memberCounts[memberId].avatarUrl = avatarUrl;
        }
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
        totalMessages: totalMessages || 0,
        activeMembers,
        engagementRate,
        topParticipant,
        lastMessageAt: lastMessageData?.created_at || null,
      };
    },
    enabled: !!groupId && !!group && isAuthenticated,
  });

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
        .select('member_id')
        .eq('group_id', groupId!)
        .is('deleted_at', null)
        .not('member_id', 'is', null)
        .gte('created_at', previousPeriodStartISO)
        .lte('created_at', previousPeriodEndISO);

      const uniqueActiveMembers = new Set(activeMembersData?.map(m => m.member_id) || []);
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
        ? Math.round((uniqueActiveMembers.size / totalMembers) * 100) 
        : 0;

      // Get top participant in previous period
      const { data: topParticipantData } = await supabase
        .from('messages')
        .select('member_id, members!inner(name, profile_pic_url)')
        .eq('group_id', groupId!)
        .is('deleted_at', null)
        .not('member_id', 'is', null)
        .gte('created_at', previousPeriodStartISO)
        .lte('created_at', previousPeriodEndISO);

      const memberCounts: Record<string, { name: string; count: number; avatarUrl: string | null }> = {};
      topParticipantData?.forEach((msg: any) => {
        const memberId = msg.member_id;
        const memberName = msg.members?.name || 'Desconhecido';
        const avatarUrl = (msg.members as any)?.profile_pic_url || null;
        if (!memberCounts[memberId]) {
          memberCounts[memberId] = { name: memberName, count: 0, avatarUrl };
        }
        memberCounts[memberId].count++;
        if (!memberCounts[memberId].avatarUrl && avatarUrl) {
          memberCounts[memberId].avatarUrl = avatarUrl;
        }
      });

      const topParticipant = Object.values(memberCounts)
        .sort((a, b) => b.count - a.count)[0] || null;

      return {
        totalMessages: totalMessages || 0,
        activeMembers: uniqueActiveMembers.size,
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

      const countsByHour: Record<number, number> = {};
      for (let i = 0; i < 24; i++) {
        countsByHour[i] = 0;
      }

      data?.forEach(msg => {
        const hour = getHourSP(msg.created_at);
        countsByHour[hour]++;
      });

      const activityByHour = Object.entries(countsByHour).map(([hour, count]) => ({
        hour: parseInt(hour),
        count,
      }));

      const peakEntry = activityByHour.reduce((max, curr) => 
        curr.count > max.count ? curr : max, { hour: 0, count: 0 });

      return {
        peakHour: peakEntry.count > 0 ? peakEntry.hour : null,
        peakHourMessages: peakEntry.count,
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

      if (!members) return { recorrentes: 0, esporadicos: 0, inativos: 0 };

      const { data: messageCounts } = await supabase
        .from('messages')
        .select('member_id')
        .eq('group_id', groupId!)
        .is('deleted_at', null)
        .not('member_id', 'is', null)
        .gte('created_at', previousPeriodStartISO)
        .lte('created_at', previousPeriodEndISO);

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

  // Fetch previous period new members count
  const { data: previousNewMembersCount } = useQuery({
    queryKey: ['group-dashboard-previous-new-members', groupId, previousPeriodStartISO, previousPeriodEndISO],
    queryFn: async () => {
      const { count } = await supabase
        .from('members')
        .select('*', { count: 'exact', head: true })
        .eq('group_id', groupId!)
        .is('deleted_at', null)
        .gte('joined_at', previousPeriodStartISO)
        .lte('joined_at', previousPeriodEndISO);

      return count || 0;
    },
    enabled: !!groupId && !!group && isAuthenticated,
  });

  // Fetch previous period exited members count
  const { data: previousExitedMembersCount } = useQuery({
    queryKey: ['group-dashboard-previous-exited-members', groupId, previousPeriodStartISO, previousPeriodEndISO],
    queryFn: async () => {
      const { count } = await supabase
        .from('members')
        .select('*', { count: 'exact', head: true })
        .eq('group_id', groupId!)
        .is('deleted_at', null)
        .gte('left_at', previousPeriodStartISO)
        .lte('left_at', previousPeriodEndISO);

      return count || 0;
    },
    enabled: !!groupId && !!group && isAuthenticated,
  });

  // Fetch previous period admin stats
  const { data: previousAdminStats } = useQuery({
    queryKey: ['group-dashboard-previous-admins', groupId, previousPeriodStartISO, previousPeriodEndISO],
    queryFn: async () => {
      const { data: admins } = await supabase
        .from('members')
        .select('id, name, is_admin, is_owner, is_super_admin, phone_e164')
        .eq('group_id', groupId!)
        .is('deleted_at', null)
        .or('is_admin.eq.true,is_owner.eq.true,is_super_admin.eq.true');

      if (!admins || admins.length === 0) return null;

      const adminIds = admins.map(a => a.id);
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
          if (admin) activeAdminIds.add(admin.id);
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
  const { data: messagesPerDay, isLoading: chartLoading } = useQuery({
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

      const countsByDay: Record<string, number> = {};
      for (let i = periodDays - 1; i >= 0; i--) {
        const date = subDays(currentPeriodEnd, i);
        const dateKey = formatDateKeySP(date);
        countsByDay[dateKey] = 0;
      }

      data?.forEach(msg => {
        const dateKey = formatDateKeySP(new Date(msg.created_at));
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

  // Fetch member entries per day
  const { data: memberEntriesPerDay } = useQuery({
    queryKey: ['group-dashboard-entries-day', groupId, chartStartISO, currentPeriodEndISO],
    queryFn: async () => {
      const { data } = await supabase
        .from('members')
        .select('joined_at')
        .eq('group_id', groupId!)
        .is('deleted_at', null)
        .gte('joined_at', chartStartISO)
        .lte('joined_at', currentPeriodEndISO)
        .order('joined_at', { ascending: true });

      const countsByDay: Record<string, number> = {};
      for (let i = chartDays - 1; i >= 0; i--) {
        const date = subDays(currentPeriodEnd, i);
        const dateKey = formatDateKeySP(date);
        countsByDay[dateKey] = 0;
      }

      data?.forEach(m => {
        const dateKey = formatDateKeySP(new Date(m.joined_at));
        if (countsByDay[dateKey] !== undefined) {
          countsByDay[dateKey]++;
        }
      });

      return Object.entries(countsByDay).map(([date, count]) => ({ date, count }));
    },
    enabled: !!groupId && !!group && isAuthenticated,
  });

  // Fetch member exits per day
  const { data: memberExitsPerDay } = useQuery({
    queryKey: ['group-dashboard-exits-day', groupId, chartStartISO, currentPeriodEndISO],
    queryFn: async () => {
      const { data } = await supabase
        .from('members')
        .select('left_at')
        .eq('group_id', groupId!)
        .is('deleted_at', null)
        .gte('left_at', chartStartISO)
        .lte('left_at', currentPeriodEndISO)
        .order('left_at', { ascending: true });

      const countsByDay: Record<string, number> = {};
      for (let i = chartDays - 1; i >= 0; i--) {
        const date = subDays(currentPeriodEnd, i);
        const dateKey = formatDateKeySP(date);
        countsByDay[dateKey] = 0;
      }

      data?.forEach(m => {
        const dateKey = formatDateKeySP(new Date(m.left_at));
        if (countsByDay[dateKey] !== undefined) {
          countsByDay[dateKey]++;
        }
      });

      return Object.entries(countsByDay).map(([date, count]) => ({ date, count }));
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

      const membersByDay: Record<string, Set<string>> = {};
      // Initialize all days in range to ensure full alignment
      for (let i = periodDays - 1; i >= 0; i--) {
        const date = subDays(currentPeriodEnd, i);
        const dateKey = formatDateKeySP(date);
        membersByDay[dateKey] = new Set<string>();
      }

      data?.forEach(msg => {
        const dateKey = formatDateKeySP(new Date(msg.created_at));
        const memberId = msg.member_id as string | null;
        if (memberId && membersByDay[dateKey]) {
          membersByDay[dateKey].add(memberId);
        }
      });

      return Object.entries(membersByDay).map(([date, set]) => ({
        date,
        count: set.size,
      }));
    },
    enabled: !!groupId && !!group && isAuthenticated,
  });

  // Fetch activity by hour
  const { data: activityData } = useQuery({
    queryKey: ['group-dashboard-activity-hour', groupId, currentPeriodStartISO, currentPeriodEndISO],
    queryFn: async () => {
      const { data } = await supabase
        .from('messages')
        .select('created_at')
        .eq('group_id', groupId!)
        .is('deleted_at', null)
        .gte('created_at', currentPeriodStartISO)
        .lte('created_at', currentPeriodEndISO);

      const countsByHour: Record<number, number> = {};
      for (let i = 0; i < 24; i++) {
        countsByHour[i] = 0;
      }

      data?.forEach(msg => {
        const hour = getHourSP(msg.created_at);
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

      const participantsByDay: Record<string, { id: string; avatarUrl: string | null }[]> = {};
      const participantsByHour: Record<number, { id: string; avatarUrl: string | null }[]> = {};
      const seenDay: Record<string, Set<string>> = {};
      const seenHour: Record<number, Set<string>> = {};
      for (let i = 0; i < 24; i++) {
        participantsByHour[i] = [];
        seenHour[i] = new Set<string>();
      }

      (data || []).forEach((msg: any) => {
        const memberId = msg.member_id as string | null;
        if (!memberId) return;
        const avatarUrl = msg.member_avatar || null;
        const dateKey = formatDateKeySP(new Date(msg.created_at));
        const hour = getHourSP(msg.created_at);

        if (!participantsByDay[dateKey]) {
          participantsByDay[dateKey] = [];
          seenDay[dateKey] = new Set<string>();
        }
        if (!seenDay[dateKey].has(memberId)) {
          participantsByDay[dateKey].push({ id: memberId, avatarUrl });
          seenDay[dateKey].add(memberId);
        }

        if (!seenHour[hour].has(memberId)) {
          participantsByHour[hour].push({ id: memberId, avatarUrl });
          seenHour[hour].add(memberId);
        }
      });

      return { participantsByDay, participantsByHour };
    },
    enabled: !!groupId && !!group && isAuthenticated,
  });

  // Fetch top 5 participants
  const { data: topParticipants, isLoading: topParticipantsLoading } = useQuery({
    queryKey: ['group-dashboard-top-participants', groupId, currentPeriodStartISO, currentPeriodEndISO],
    queryFn: async () => {
      const { data } = await supabase
        .from('messages')
        .select('member_id, members!inner(name, profile_pic_url)')
        .eq('group_id', groupId!)
        .is('deleted_at', null)
        .not('member_id', 'is', null)
        .gte('created_at', currentPeriodStartISO)
        .lte('created_at', currentPeriodEndISO);

      const memberCounts: Record<string, { name: string; count: number; avatarUrl: string | null }> = {};
      data?.forEach((msg: any) => {
        const memberId = msg.member_id;
        const memberName = msg.members?.name || 'Desconhecido';
        const avatarUrl = (msg.members as any)?.profile_pic_url || null;
        if (!memberCounts[memberId]) {
          memberCounts[memberId] = { name: memberName, count: 0, avatarUrl };
        }
        memberCounts[memberId].count++;
        if (!memberCounts[memberId].avatarUrl && avatarUrl) {
          memberCounts[memberId].avatarUrl = avatarUrl;
        }
      });

      return Object.values(memberCounts)
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
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

      if (!members) return { recorrentes: 0, esporadicos: 0, inativos: 0 };

      const { data: messageCounts } = await supabase
        .from('messages')
        .select('member_id')
        .eq('group_id', groupId!)
        .is('deleted_at', null)
        .not('member_id', 'is', null)
        .gte('created_at', currentPeriodStartISO)
        .lte('created_at', currentPeriodEndISO);

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
        .from('members')
        .select('id, name, is_admin, is_owner, is_super_admin, phone_e164')
        .eq('group_id', groupId!)
        .is('deleted_at', null)
        .or('is_admin.eq.true,is_owner.eq.true,is_super_admin.eq.true');

      if (!admins || admins.length === 0) return null;

      const adminIds = admins.map(a => a.id);
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
          if (admin) {
            adminCounts[admin.id] = (adminCounts[admin.id] || 0) + 1;
          }
        }
      });

      const activeAdminIds = new Set(Object.keys(adminCounts));
      const activeCount = activeAdminIds.size;

      let topAdmin: { name: string; messages: number } | null = null;
      let maxMessages = 0;
      admins.forEach(admin => {
        const count = adminCounts[admin.id] || 0;
        if (count > maxMessages) {
          maxMessages = count;
          topAdmin = { name: admin.name, messages: count };
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
      const { count } = await supabase
        .from('members')
        .select('*', { count: 'exact', head: true })
        .eq('group_id', groupId!)
        .is('deleted_at', null)
        .gte('joined_at', currentPeriodStartISO)
        .lte('joined_at', currentPeriodEndISO);

      return count || 0;
    },
    enabled: !!groupId && !!group && isAuthenticated,
  });

  // Fetch exited members count
  const { data: exitedMembersCount } = useQuery({
    queryKey: ['group-dashboard-exited-members', groupId, currentPeriodStartISO, currentPeriodEndISO],
    queryFn: async () => {
      const { count } = await supabase
        .from('members')
        .select('*', { count: 'exact', head: true })
        .eq('group_id', groupId!)
        .is('deleted_at', null)
        .gte('left_at', currentPeriodStartISO)
        .lte('left_at', currentPeriodEndISO);

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

  const isLoading = groupLoading || statsLoading || chartLoading || topParticipantsLoading || recentLoading || membersLoading;

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

  const computeLowEffortPercent = () => {
    const slice = (messagesPerDay || []).slice(Math.max(0, (messagesPerDay || []).length - periodDays));
    const avg = slice.length > 0 ? Math.round(slice.reduce((sum, d) => sum + d.count, 0) / slice.length) : 0;
    const excess = slice.filter(d => d.count > avg).length;
    const percent = periodDays > 0 ? Math.round((excess / periodDays) * 100) : 0;
    const lowEffort = Math.max(0, Math.min(100, 100 - percent));
    return lowEffort;
  };

  const lowEffortPercent = computeLowEffortPercent();

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

  const peakTwoHourStart = (() => {
    const hours = activityData?.activityByHour || [];
    if (!hours || hours.length === 0) return null;
    let bestStart = 0;
    let bestSum = 0;
    for (let i = 0; i < 24; i++) {
      const a = hours.find(h => h.hour === i)?.count || 0;
      const b = hours.find(h => h.hour === ((i + 1) % 24))?.count || 0;
      const sum = a + b;
      if (sum > bestSum) {
        bestSum = sum;
        bestStart = i;
      }
    }
    return bestSum > 0 ? bestStart : null;
  })();

  const recurringIds = new Set((membersOverview || []).filter(m => m.messagesCount >= 5).map(m => m.id));

  const pickAvatars = (list: { id: string; avatarUrl: string | null }[], limit = 8) => {
    const res: { id: string; avatarUrl: string | null }[] = [];
    const seen = new Set<string>();
    // prioritize recurring
    list.forEach(m => {
      if (res.length >= limit) return;
      if (recurringIds.has(m.id) && !seen.has(m.id)) {
        res.push(m);
        seen.add(m.id);
      }
    });
    // fill with others
    list.forEach(m => {
      if (res.length >= limit) return;
      if (!seen.has(m.id)) {
        res.push(m);
        seen.add(m.id);
      }
    });
    return res;
  };

  const busyDayAvatars = (() => {
    if (!busiestDayKey || !periodParticipants?.participantsByDay) return [] as { id: string; avatarUrl: string | null }[];
    const list = periodParticipants.participantsByDay[busiestDayKey] || [];
    return pickAvatars(list, 8);
  })();

  const peakWindowAvatars = (() => {
    if (peakTwoHourStart === null || !periodParticipants?.participantsByHour) return [] as { id: string; avatarUrl: string | null }[];
    const a = periodParticipants.participantsByHour[peakTwoHourStart] || [];
    const b = periodParticipants.participantsByHour[((peakTwoHourStart + 1) % 24)] || [];
    const merged: { id: string; avatarUrl: string | null }[] = [];
    const seen = new Set<string>();
    [...a, ...b].forEach(m => { if (!seen.has(m.id)) { merged.push(m); seen.add(m.id); } });
    return pickAvatars(merged, 8);
  })();

  const themeAvatars = (() => {
    const recurringIdsList = (membersOverview || []).filter(m => m.messagesCount >= 5).map(m => m.id);
    const fromParticipants: { id: string; avatarUrl: string | null }[] = [];
    const seen = new Set<string>();
    // gather avatars from period participants first
    Object.values(periodParticipants?.participantsByDay || {}).forEach(arr => {
      arr.forEach(m => {
        if (recurringIds.has(m.id) && !seen.has(m.id)) {
          fromParticipants.push(m);
          seen.add(m.id);
        }
      });
    });
    // fallback to membersOverview avatars if missing
    recurringIdsList.forEach(id => {
      if (!seen.has(id)) {
        const mo = (membersOverview || []).find(m => m.id === id);
        fromParticipants.push({ id, avatarUrl: (mo as any)?.avatarUrl || null });
        seen.add(id);
      }
    });
    return pickAvatars(fromParticipants, 8);
  })();

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
        .select('content, message_type, id, created_at')
        .eq('group_id', groupId!)
        .is('deleted_at', null)
        .eq('message_type', 'text')
        .gte('created_at', currentPeriodStartISO)
        .lte('created_at', currentPeriodEndISO)
        .limit(5000);

      const perMessageTokens: { raw: string; token: string }[][] = [];
      const bigramToMsgIdx: Record<string, number[]> = {};
      const tokenCounts: Map<string, number> = new Map();
      const bigramCounts: Map<string, number> = new Map();
      const tokenDates: Map<string, Set<string>> = new Map();
      const bigramDates: Map<string, Set<string>> = new Map();

      (data || []).forEach((m, idx) => {
        const content = m.content || '';
        const tokens = tokenize(content);
        perMessageTokens.push(tokens);
        const dateKey = new Date(m.created_at!).toISOString().slice(0,10);
        tokens.forEach(x => {
          tokenCounts.set(x.token, (tokenCounts.get(x.token) || 0) + 1);
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
        .slice(0, 20)
        .map(([term, c]) => ({ term, count: c }));

      return { themes, keywords: globalKeywords };
    },
    enabled: !!groupId && !!group && isAuthenticated,
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
    currentMembers: membersSnapshot?.currentMembers || stats?.totalMembers || 0,
    membersAtPeriodStart: membersSnapshot?.membersAtPeriodStart || undefined,
    daysWithActivity,
    alignedMessagesPercent: alignedMessagesPercent,
    hasIkigai,
    ikigaiKeywordsList: ikigaiKeywords,
    ikigaiSuggestions: suggestionsData || { themes: [], keywords: [] },
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
