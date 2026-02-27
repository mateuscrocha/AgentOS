import { useMemo } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export interface MessageFeed {
  message_id: string;
  group_id: string;
  created_at: string;
  message_type: string;
  content_preview: string | null;
  member_id: string | null;
  member_name: string;
  member_avatar: string | null;
  whatsapp_provider_id: string | null;
  media_url: string | null;
  media_mime_type: string | null;
  thumbnail_url: string | null;
}

export interface ReactionSummary {
  message_id: string;
  emoji: string;
  count: number;
  reactors: {
    member_id: string | null;
    member_name: string | null;
    member_avatar: string | null;
    reacted_at: string;
  }[];
}

const MENTION_REGEX = /@([0-9]{5,})/g;
const GROUP_MESSAGES_STALE_TIME_MS = 30_000;
const GROUP_MESSAGES_GC_TIME_MS = 5 * 60_000;

type GroupInfo = {
  groupName: string;
  orgName?: string;
  orgId: string;
  provider: string;
  syncStatus: string | null;
};

interface UseGroupMessagesOptions {
  groupId: string | undefined;
  page: number;
  pageSize: number;
  typeFilter: string;
  search: string;
  fromIso: string | null;
  toIso: string | null;
}

export function useGroupMessages({
  groupId,
  page,
  pageSize,
  typeFilter,
  search,
  fromIso,
  toIso,
}: UseGroupMessagesOptions) {
  const { isAuthenticated } = useAuth();

  const { data: groupInfo } = useQuery({
    queryKey: ["group-info", groupId],
    queryFn: async () => {
      const { data: group, error: groupError } = await supabase
        .from("groups")
        .select("name, organization_id, provider, sync_status")
        .eq("id", groupId)
        .maybeSingle();
      if (groupError) throw groupError;
      if (!group) return null;

      const { data: org, error: orgError } = await supabase
        .from("organizations")
        .select("name")
        .eq("id", group.organization_id)
        .maybeSingle();
      if (orgError) throw orgError;

      return {
        groupName: group.name,
        orgName: org?.name,
        orgId: group.organization_id,
        provider: group.provider,
        syncStatus: group.sync_status,
      } as GroupInfo;
    },
    enabled: !!groupId && isAuthenticated,
    staleTime: GROUP_MESSAGES_STALE_TIME_MS,
    gcTime: GROUP_MESSAGES_GC_TIME_MS,
  });

  const { data: totalMembersCount } = useQuery({
    queryKey: ["group-members-total", groupId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("members")
        .select("*", { count: "exact", head: true })
        .eq("group_id", groupId)
        .is("deleted_at", null);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!groupId && isAuthenticated,
    staleTime: GROUP_MESSAGES_STALE_TIME_MS,
    gcTime: GROUP_MESSAGES_GC_TIME_MS,
  });

  const { data: lastMessageAt } = useQuery({
    queryKey: ["group-last-message", groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("created_at")
        .eq("group_id", groupId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(1);
      if (error) throw error;
      const first = (data ?? [])[0] as { created_at: string } | undefined;
      return first?.created_at ?? null;
    },
    enabled: !!groupId && isAuthenticated,
    staleTime: GROUP_MESSAGES_STALE_TIME_MS,
    gcTime: GROUP_MESSAGES_GC_TIME_MS,
  });

  const {
    data: messagesData,
    isLoading: messagesLoading,
    isFetching: messagesFetching,
    error: messagesError,
    refetch: refetchMessages,
  } = useQuery({
    queryKey: ["group-messages-feed", groupId, page, typeFilter, search, fromIso, toIso],
    queryFn: async () => {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = supabase
        .from("v_messages_feed")
        .select("*", { count: "exact" })
        .eq("group_id", groupId)
        .order("created_at", { ascending: false });

      if (typeFilter) query = query.eq("message_type", typeFilter);
      if (search) query = query.ilike("content_preview", `%${search}%`);
      if (fromIso) query = query.gte("created_at", fromIso);
      if (toIso) query = query.lte("created_at", toIso);

      const { data, error, count } = await query.range(from, to);

      if (error) {
        let fallbackQuery = supabase
          .from("messages")
          .select("*", { count: "exact" })
          .eq("group_id", groupId)
          .order("created_at", { ascending: false });

        if (typeFilter) fallbackQuery = fallbackQuery.eq("message_type", typeFilter);
        if (search) {
          fallbackQuery = fallbackQuery.or(`content.ilike.%${search}%,text.ilike.%${search}%,sender_name.ilike.%${search}%`);
        }
        if (fromIso) fallbackQuery = fallbackQuery.gte("created_at", fromIso);
        if (toIso) fallbackQuery = fallbackQuery.lte("created_at", toIso);

        const { data: msgData, error: msgError, count: msgCount } = await fallbackQuery.range(from, to);
        if (msgError) throw msgError;

        const memberIds = Array.from(new Set((msgData ?? []).map((m: any) => m.member_id).filter(Boolean))) as string[];
        let membersById: Record<string, { name: string; profile_pic_url: string | null }> = {};

        if (memberIds.length > 0) {
          const { data: members, error: membersError } = await supabase
            .from("members")
            .select("id,name,profile_pic_url")
            .in("id", memberIds);
          if (membersError) throw membersError;

          membersById = (members ?? []).reduce((acc: any, m: any) => {
            acc[String(m.id)] = {
              name: String(m.name || ""),
              profile_pic_url: (m.profile_pic_url as string | null) || null,
            };
            return acc;
          }, {} as Record<string, { name: string; profile_pic_url: string | null }>);
        }

        const items: MessageFeed[] = (msgData ?? []).map((m: any) => {
          const member = m.member_id ? membersById[String(m.member_id)] : null;
          const memberName = member?.name || String(m.sender_name || "Unknown");
          const memberAvatar = member?.profile_pic_url || null;

          return {
            message_id: m.id,
            group_id: m.group_id,
            created_at: m.created_at,
            message_type: m.message_type,
            content_preview: m.content?.slice(0, 160) ?? null,
            member_id: m.member_id,
            member_name: memberName,
            member_avatar: memberAvatar,
            whatsapp_provider_id: m.whatsapp_provider_id,
            media_url: m.media_url,
            media_mime_type: m.media_mime_type,
            thumbnail_url: m.thumbnail_url,
          };
        });

        return { items, count: msgCount ?? 0 };
      }

      const items: MessageFeed[] = (data ?? []).map((d: any) => ({
        message_id: d.message_id,
        group_id: d.group_id,
        created_at: d.created_at,
        message_type: d.message_type,
        content_preview: d.content_preview,
        member_id: d.member_id,
        member_name: d.member_name || d.member_display_name || "Unknown",
        member_avatar: d.member_avatar || null,
        whatsapp_provider_id: d.whatsapp_provider_id,
        media_url: d.media_url,
        media_mime_type: d.media_mime_type,
        thumbnail_url: d.thumbnail_url,
      }));

      return { items, count: count ?? 0 };
    },
    enabled: !!groupId && isAuthenticated,
    placeholderData: keepPreviousData,
    staleTime: GROUP_MESSAGES_STALE_TIME_MS,
    gcTime: GROUP_MESSAGES_GC_TIME_MS,
  });

  const messageIdsKey = useMemo(() => {
    const ids = (messagesData?.items || []).map((m) => m.message_id);
    return ids.join(",");
  }, [messagesData?.items]);

  const mentionIdsKey = useMemo(() => {
    const ids = new Set<string>();
    for (const item of messagesData?.items || []) {
      const src = (item.content_preview || "").toString();
      for (const match of src.matchAll(MENTION_REGEX)) {
        if (match[1]) ids.add(match[1]);
      }
    }
    return Array.from(ids).sort().join(",");
  }, [messagesData?.items]);

  const { data: pageMentionsMap } = useQuery({
    queryKey: ["group-messages-page-mentions", groupId, mentionIdsKey],
    queryFn: async () => {
      if (!mentionIdsKey) return {} as Record<string, string>;

      const mentionIds = mentionIdsKey.split(",").filter(Boolean);
      const plusPhones = mentionIds.map((id) => (id.startsWith("+") ? id : `+${id}`));
      const providerCandidates = [
        ...mentionIds,
        ...mentionIds.map((id) => `${id}@c.us`),
        ...mentionIds.map((id) => `${id}@s.whatsapp.net`),
      ];

      const [{ data: byProvider }, { data: byPhone }] = await Promise.all([
        (supabase as any)
          .from("members")
          .select("whatsapp_provider_id,name,display_name,phone_e164")
          .eq("group_id", groupId)
          .in("whatsapp_provider_id", providerCandidates),
        (supabase as any)
          .from("members")
          .select("phone_e164,name,display_name")
          .eq("group_id", groupId)
          .in("phone_e164", plusPhones),
      ]);

      const map: Record<string, string> = {};
      const toDigits = (value: string) => value.replace(/\D/g, "");
      const labelFrom = (row: any) => String(row?.display_name || row?.name || row?.phone_e164 || "").trim();

      for (const row of byProvider || []) {
        const key = toDigits(String((row as any).whatsapp_provider_id || ""));
        const label = labelFrom(row);
        if (key && label) map[key] = label;
      }
      for (const row of byPhone || []) {
        const key = String((row as any).phone_e164 || "").replace(/^\+/, "");
        const label = labelFrom(row);
        if (key && label) map[key] = label;
      }
      return map;
    },
    enabled: !!groupId && isAuthenticated && !!mentionIdsKey,
    staleTime: GROUP_MESSAGES_STALE_TIME_MS,
    gcTime: GROUP_MESSAGES_GC_TIME_MS,
  });

  const { data: reactionsData } = useQuery({
    queryKey: ["message-reactions", groupId, messageIdsKey],
    queryFn: async () => {
      if (!messagesData?.items?.length) return {} as Record<string, ReactionSummary[]>;

      const messageIds = messagesData.items.map((m) => m.message_id);
      const { data, error } = await supabase
        .from("v_message_reactions_summary")
        .select("*")
        .in("message_id", messageIds);
      if (error) return {} as Record<string, ReactionSummary[]>;

      const grouped: Record<string, ReactionSummary[]> = {};
      for (const r of data || []) {
        if (!grouped[(r as any).message_id]) grouped[(r as any).message_id] = [];
        grouped[(r as any).message_id].push({
          message_id: (r as any).message_id,
          emoji: (r as any).emoji,
          count: Number((r as any).count),
          reactors: ((r as any).reactors as any[]) || [],
        });
      }
      return grouped;
    },
    enabled: !!groupId && isAuthenticated && !!messagesData?.items?.length,
    staleTime: GROUP_MESSAGES_STALE_TIME_MS,
    gcTime: GROUP_MESSAGES_GC_TIME_MS,
  });

  const reactionsMap = useMemo(() => reactionsData || {}, [reactionsData]);

  return {
    groupInfo,
    totalMembersCount,
    lastMessageAt,
    messagesData,
    pageMentionsMap: pageMentionsMap || {},
    reactionsMap,
    messagesLoading,
    messagesFetching,
    messagesError,
    refetchMessages,
  };
}
