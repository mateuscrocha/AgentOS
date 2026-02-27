import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import {
  asNoonUTCFromDateOnly,
  classifyTopic,
  cleanInlineLabel,
  countLinks,
  dateKey,
  getIntensityLevel,
  isObjectionTopic,
  normalizeWhitespace,
  pickPreviewText,
  type TopicKind,
} from "@/lib/summary-utils";

export type GroupDailySummaryRow = {
  id: string;
  group_id: string;
  summary_date: string;
  summary_text: string;
  created_at: string;
};

export type GroupDailyTopicRow = {
  id: string;
  group_id: string;
  topic_date: string;
  rank: number;
  title: string;
  content: string;
  created_at: string;
};

export type GroupDailyKeywordRow = {
  id: string;
  group_id: string;
  keyword_date: string;
  keyword: string;
  rank: number;
  mentions_count?: number | null;
  messages_count?: number | null;
  participants_count?: number | null;
  created_at: string;
};

type GroupSummariesPayload = {
  summaries: GroupDailySummaryRow[];
  topics: GroupDailyTopicRow[];
  keywords: GroupDailyKeywordRow[];
};
const GROUP_SUMMARIES_STALE_TIME_MS = 30_000;
const GROUP_SUMMARIES_GC_TIME_MS = 5 * 60_000;

export type GroupDailySummaryView = GroupDailySummaryRow & {
  dateKey: string;
  dateLabel: string;
  preview: string;
  topics: GroupDailyTopicRow[];
  keywords: GroupDailyKeywordRow[];
  linksCount: number;
  painsCount: number;
  desiresCount: number;
  objectionsCount: number;
  intensity: { level: 1 | 2 | 3; label: string };
  topicsWithKind: Array<{ topic: GroupDailyTopicRow; kind: TopicKind }>;
  keywordsNormalized: string[];
};

export function useGroupSummaries({
  groupId,
  enabled,
}: {
  groupId: string;
  enabled: boolean;
}) {
  const normalizedGroupId = typeof groupId === "string" ? groupId.trim() : "";
  const [openSummaryId, setOpenSummaryId] = useState<string | undefined>(undefined);
  const [daysLimit, setDaysLimit] = useState(30);
  const [showAllTopicsByDay, setShowAllTopicsByDay] = useState<Record<string, boolean>>({});
  const [selectedKeyword, setSelectedKeyword] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["group-conversations", normalizedGroupId, daysLimit],
    queryFn: async () => {
      const { data: summariesData, error: summariesError } = await (supabase as any)
        .from("group_daily_summaries")
        .select("id, group_id, summary_date, summary_text, created_at")
        .eq("group_id", normalizedGroupId)
        .order("summary_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(daysLimit);
      if (summariesError) throw summariesError;

      const summaries = (summariesData ?? []) as unknown as GroupDailySummaryRow[];
      const dates = Array.from(
        new Set(
          summaries
            .map((s) => dateKey(s.summary_date))
            .filter((d) => d.length > 0),
        ),
      );

      if (dates.length === 0) {
        return { summaries: [], topics: [], keywords: [] } as GroupSummariesPayload;
      }

      const [topicsResult, keywordsResult] = await Promise.all([
        (supabase as any)
          .from("group_daily_topics")
          .select("id, group_id, topic_date, rank, title, content, created_at")
          .eq("group_id", normalizedGroupId)
          .in("topic_date", dates)
          .order("topic_date", { ascending: false })
          .order("rank", { ascending: true })
          .limit(1000),
        (supabase as any)
          .from("group_daily_keywords")
          .select("id, group_id, keyword_date, keyword, rank, mentions_count, messages_count, participants_count, created_at")
          .eq("group_id", normalizedGroupId)
          .in("keyword_date", dates)
          .order("keyword_date", { ascending: false })
          .order("rank", { ascending: true })
          .limit(2000),
      ]);

      if (topicsResult.error) throw topicsResult.error;
      if (keywordsResult.error) throw keywordsResult.error;

      return {
        summaries,
        topics: (topicsResult.data ?? []) as unknown as GroupDailyTopicRow[],
        keywords: (keywordsResult.data ?? []) as unknown as GroupDailyKeywordRow[],
      } as GroupSummariesPayload;
    },
    enabled: normalizedGroupId.length > 0 && enabled,
    staleTime: GROUP_SUMMARIES_STALE_TIME_MS,
    gcTime: GROUP_SUMMARIES_GC_TIME_MS,
  });

  const conversationsView = useMemo<GroupDailySummaryView[]>(() => {
    const topicsByDate: Record<string, GroupDailyTopicRow[]> = {};
    const keywordsByDate: Record<string, GroupDailyKeywordRow[]> = {};

    for (const t of (query.data?.topics ?? [])) {
      const k = dateKey(t.topic_date);
      if (!k) continue;
      (topicsByDate[k] ||= []).push(t);
    }

    for (const kw of (query.data?.keywords ?? [])) {
      const k = dateKey(kw.keyword_date);
      if (!k) continue;
      (keywordsByDate[k] ||= []).push(kw);
    }

    return (query.data?.summaries ?? []).map((s) => {
      const text = s.summary_text || "";
      const preview = pickPreviewText(text);
      const k = dateKey(s.summary_date);
      const topics = topicsByDate[k] ?? [];
      const keywords = keywordsByDate[k] ?? [];

      const topicsWithKind = topics.map((t) => ({ topic: t, kind: classifyTopic(t) }));
      const painsCount = topicsWithKind.filter((t) => t.kind === "dor").length;
      const desiresCount = topicsWithKind.filter((t) => t.kind === "desejo").length;
      const objectionsCount = topicsWithKind.filter((t) => t.kind === "tema" && isObjectionTopic(t.topic)).length;

      const linksCount = countLinks(text);
      const total = (topics.length ?? 0) + (keywords.length ?? 0) + (linksCount ?? 0);
      const intensity = getIntensityLevel(total);

      const keywordsNormalized = Array.from(
        new Set(
          keywords
            .map((kw) => normalizeWhitespace(kw.keyword || "").toLowerCase())
            .filter(Boolean),
        ),
      );

      return {
        ...s,
        dateKey: k,
        dateLabel: asNoonUTCFromDateOnly(k),
        preview,
        topics,
        keywords,
        linksCount,
        painsCount,
        desiresCount,
        objectionsCount,
        intensity,
        topicsWithKind,
        keywordsNormalized,
      };
    });
  }, [query.data]);

  const keywordDayCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const day of conversationsView) {
      for (const k of day.keywordsNormalized) {
        map.set(k, (map.get(k) ?? 0) + 1);
      }
    }
    return map;
  }, [conversationsView]);

  const filteredConversationsView = useMemo(() => {
    const k = normalizeWhitespace(selectedKeyword || "").toLowerCase();
    if (!k) return conversationsView;
    return conversationsView.filter((s) => s.keywordsNormalized.includes(k));
  }, [conversationsView, selectedKeyword]);

  const selectedSummary = useMemo(() => {
    if (filteredConversationsView.length === 0) return null;
    return filteredConversationsView.find((s) => s.id === openSummaryId) ?? filteredConversationsView[0];
  }, [filteredConversationsView, openSummaryId]);

  const dateRange = useMemo(() => {
    const days = filteredConversationsView.length > 0 ? filteredConversationsView : conversationsView;
    if (days.length === 0) return null;
    const newest = days[0].dateKey;
    const oldest = days[days.length - 1].dateKey;
    return { newest, oldest, daysCount: days.length };
  }, [conversationsView, filteredConversationsView]);

  const kpis = useMemo(() => {
    const uniqueKeywords = new Set<string>();
    let pains = 0;
    let desires = 0;
    let objections = 0;

    for (const day of conversationsView) {
      pains += day.painsCount;
      desires += day.desiresCount;
      objections += day.objectionsCount;
      for (const k of day.keywordsNormalized) uniqueKeywords.add(k);
    }

    return {
      daysLoaded: conversationsView.length,
      pains,
      desires,
      objections,
      uniqueKeywords: uniqueKeywords.size,
    };
  }, [conversationsView]);

  useEffect(() => {
    if (filteredConversationsView.length === 0) return;
    if (!openSummaryId || !filteredConversationsView.some((s) => s.id === openSummaryId)) {
      setOpenSummaryId(filteredConversationsView[0].id);
    }
  }, [filteredConversationsView, openSummaryId]);

  const selectedTopicsSorted = useMemo(() => {
    const base = selectedSummary?.topicsWithKind ?? [];
    return base.slice().sort((a, b) => (a.topic.rank ?? 999) - (b.topic.rank ?? 999));
  }, [selectedSummary]);

  const visibleTopics = useMemo(() => {
    const selectedId = selectedSummary?.id || "";
    const showAll = !!showAllTopicsByDay[selectedId];
    const sorted = selectedTopicsSorted;
    return {
      showAll,
      sorted,
      visible: showAll ? sorted : sorted.slice(0, 4),
      hiddenCount: Math.max(0, sorted.length - 4),
    };
  }, [selectedSummary?.id, selectedTopicsSorted, showAllTopicsByDay]);

  const selectedExecutive = useMemo(() => {
    const list = selectedSummary?.topicsWithKind ?? [];
    const pains = list.filter((t) => t.kind === "dor");
    const desires = list.filter((t) => t.kind === "desejo");
    const objections = list.filter((t) => t.kind === "tema" && isObjectionTopic(t.topic));
    return { pains, desires, objections };
  }, [selectedSummary]);

  const displayKeyword = (value: string) => cleanInlineLabel(value || "");

  return {
    normalizedGroupId,
    openSummaryId,
    setOpenSummaryId,
    daysLimit,
    setDaysLimit,
    showAllTopicsByDay,
    setShowAllTopicsByDay,
    selectedKeyword,
    setSelectedKeyword,
    conversationsView,
    filteredConversationsView,
    selectedSummary,
    keywordDayCounts,
    dateRange,
    kpis,
    selectedTopicsSorted,
    visibleTopics,
    selectedExecutive,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    displayKeyword,
  };
}
