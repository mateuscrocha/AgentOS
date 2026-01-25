import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Check, Copy, FileText } from "lucide-react";

import { AdminLayout } from "@/components/layout/AdminLayout";
import { GroupPageTop } from "@/components/group-navigation/GroupPageTop";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { StatusTag } from "@/components/ui/status-tag";
import { supabase } from "@/integrations/supabase/client";
import { formatDateDescriptiveBR } from "@/lib/date";
import { renderWhatsappToReact } from "@/lib/whatsapp-format";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";

import AccessDenied from "./AccessDenied";

type GroupDailySummaryRow = {
  id: string;
  group_id: string;
  summary_date: string;
  summary_text: string;
  created_at: string;
};

type GroupDailyTopicRow = {
  id: string;
  group_id: string;
  topic_date: string;
  rank: number;
  title: string;
  content: string;
  created_at: string;
};

type GroupDailyKeywordRow = {
  id: string;
  group_id: string;
  keyword_date: string;
  keyword: string;
  rank: number;
  created_at: string;
};

function asNoonUTCFromDateOnly(dateOnly: string): string {
  const raw = (dateOnly || "").trim();
  if (!raw) return raw;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return `${raw}T12:00:00.000Z`;
  return raw;
}

function dateKey(value: unknown): string {
  if (typeof value === "string") {
    const m = value.match(/\d{4}-\d{2}-\d{2}/);
    return m?.[0] ?? value.trim();
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  return getString(value);
}

function getString(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function getGroupSummariesErrorCopy(error: unknown): { title: string; message: string; isAccessDenied?: boolean } {
  const anyErr = error as any;
  const code = getString(anyErr?.code);
  const msg = getString(anyErr?.message);
  const lower = msg.toLowerCase();

  const isAccessDenied =
    code === "PGRST301" ||
    code === "42501" ||
    code === "401" ||
    code === "403" ||
    lower.includes("permission") ||
    lower.includes("not authorized") ||
    lower.includes("jwt") ||
    lower.includes("unauthorized");

  if (isAccessDenied) {
    return {
      title: "Acesso negado",
      message: "Você não tem permissão para acessar as conversas deste grupo.",
      isAccessDenied: true,
    };
  }

  const isSchema =
    code === "42P01" ||
    code === "42703" ||
    code === "PGRST204" ||
    lower.includes("does not exist") ||
    lower.includes("relation") ||
    lower.includes("column") ||
    lower.includes("schema");

  if (isSchema) {
    return {
      title: "Atualização pendente",
      message: "O servidor ainda não está atualizado para esta versão. Tente novamente em instantes.",
    };
  }

  const isNetwork =
    lower.includes("failed to fetch") ||
    lower.includes("networkerror") ||
    lower.includes("fetch failed") ||
    lower.includes("load failed");

  if (isNetwork) {
    return {
      title: "Falha de conexão",
      message: "Não foi possível conectar ao servidor. Verifique sua internet e tente novamente.",
    };
  }

  return {
    title: "Não foi possível carregar as conversas",
    message: "Tente novamente.",
  };
}

function normalizeWhitespace(input: string): string {
  return (input || "").replace(/\s+/g, " ").trim();
}

function stripEmojis(input: string): string {
  const raw = (input || "").toString();
  return raw.replace(/\u200D|\uFE0F/g, "").replace(/\p{Extended_Pictographic}/gu, "");
}

function cleanPreviewText(input: string): string {
  const raw = (input || "").toString();
  const withoutCodeBlocks = raw.replace(/```[\s\S]*?```/g, " ");
  const lines = withoutCodeBlocks
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(?:[-•]|\d+\.)\s+/, "").trim())
    .filter(Boolean);
  const joined = lines.join(" ");
  const withoutUrls = joined.replace(/https?:\/\/[^\s)\]}>,]+/gi, " ");
  const withoutMarkers = withoutUrls.replace(/[*_~`]+/g, " ");
  const withoutEmojis = stripEmojis(withoutMarkers);
  return normalizeWhitespace(withoutEmojis);
}

function pickPreviewText(text: string): string {
  const normalized = cleanPreviewText(text);
  if (!normalized) return "";
  const min = 180;
  const max = 220;
  if (normalized.length <= max) return normalized;

  const window = normalized.slice(0, max + 1);
  let cut = -1;
  for (let i = Math.min(window.length - 1, max); i >= min; i--) {
    const ch = window[i];
    if (ch === "." || ch === "!" || ch === "?" || ch === "…") {
      cut = i + 1;
      break;
    }
  }

  if (cut === -1) {
    cut = max;
    const sliced = normalized.slice(0, cut);
    return sliced.replace(/\s+\S*$/, "").trimEnd() + "…";
  }

  return normalized.slice(0, cut).trimEnd() + "…";
}

function pickTopicPreview(text: string): string {
  const normalized = cleanPreviewText(text);
  if (!normalized) return "";
  const max = 160;
  if (normalized.length <= max) return normalized;
  const sliced = normalized.slice(0, max);
  return sliced.replace(/\s+\S*$/, "").trimEnd() + "…";
}

function joinHumanList(items: string[]): string {
  const clean = items.map((s) => normalizeWhitespace(s)).filter(Boolean);
  if (clean.length === 0) return "";
  if (clean.length === 1) return clean[0];
  if (clean.length === 2) return `${clean[0]} e ${clean[1]}`;
  return `${clean.slice(0, -1).join(", ")} e ${clean[clean.length - 1]}`;
}

function pickHumanDaySummary(topics: GroupDailyTopicRow[], keywords: GroupDailyKeywordRow[]): string {
  const titles = Array.from(
    new Set(
      (topics || [])
        .map((t) => cleanInlineLabel(t.title || ""))
        .filter(Boolean)
        .slice(0, 3)
    )
  ).slice(0, 2);

  if (titles.length > 0) {
    return `O dia girou em torno de ${joinHumanList(titles)}.`;
  }

  const terms = Array.from(
    new Set(
      (keywords || [])
        .map((kw) => cleanInlineLabel(kw.keyword || ""))
        .filter(Boolean)
        .slice(0, 3)
    )
  );

  if (terms.length > 0) {
    return `O dia girou em torno de ${joinHumanList(terms)}.`;
  }

  return "Dia com conversas variadas entre os membros.";
}

function cleanInlineLabel(input: string): string {
  return normalizeWhitespace(stripEmojis(input));
}

function countLinks(text: string): number {
  const raw = (text || "").toString();
  const matches = raw.match(/https?:\/\/[^\s)\]}>,]+/gi);
  return matches?.length ?? 0;
}

type TopicKind = "dor" | "desejo" | "tema";

function classifyTopic(topic: Pick<GroupDailyTopicRow, "title" | "content">): TopicKind {
  const hay = `${topic.title || ""} ${topic.content || ""}`.toLowerCase();

  const isPain = /\b(dor|dores|problema|problemas|reclama|reclamação|reclamações|dificuldade|dificuldades|bug|erro|erros|falha|falhas)\b/i.test(
    hay,
  );
  if (isPain) return "dor";

  const isDesire = /\b(desejo|quer|querem|queria|queriam|gostaria|gostariam|oportunidade|oportunidades|melhoria|melhorias)\b/i.test(
    hay,
  );
  if (isDesire) return "desejo";

  return "tema";
}

function topicKindMeta(kind: TopicKind): {
  label: string;
  tagVariant: "success" | "warning" | "error" | "neutral";
  cardClassName: string;
  accentClassName: string;
} {
  if (kind === "dor") {
    return {
      label: "Dor",
      tagVariant: "error",
      cardClassName: "border-destructive/20 bg-destructive/5",
      accentClassName: "border-l-destructive/35",
    };
  }

  if (kind === "desejo") {
    return {
      label: "Oportunidade",
      tagVariant: "success",
      cardClassName: "border-success/20 bg-success/5",
      accentClassName: "border-l-success/35",
    };
  }

  return {
    label: "Tema",
    tagVariant: "neutral",
    cardClassName: "border-border bg-card",
    accentClassName: "border-l-muted-foreground/15",
  };
}

function isObjectionTopic(topic: Pick<GroupDailyTopicRow, "title" | "content">): boolean {
  const hay = `${topic.title || ""} ${topic.content || ""}`.toLowerCase();
  return /\b(objeção|objeções|resistência|resistências|discorda|discordam|discordância|contra|contrário|não quero|não queremos|não gostei|não gostam)\b/i.test(
    hay,
  );
}

function formatCount(value: number, singular: string, plural: string): string {
  return `${value} ${value === 1 ? singular : plural}`;
}

function getIntensityLevel(total: number): { level: 1 | 2 | 3; label: string } {
  if (total >= 12) return { level: 3, label: "Alta" };
  if (total >= 6) return { level: 2, label: "Média" };
  return { level: 1, label: "Baixa" };
}

function SectionDivider({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="min-w-0">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</div>
        {subtitle ? <div className="text-xs text-muted-foreground/80">{subtitle}</div> : null}
      </div>
      <Separator className="flex-1 bg-border/60" />
    </div>
  );
}

function TopicCard({
  topic,
  kind,
  emphasis,
}: {
  topic: GroupDailyTopicRow;
  kind: TopicKind;
  emphasis?: "top" | "default";
}) {
  const meta = topicKindMeta(kind);
  const title = cleanInlineLabel(topic.title || "") || "Assunto";

  return (
    <div
      className={cn(
        "rounded-2xl border p-4 sm:p-5",
        "transition-colors duration-200",
        meta.cardClassName,
        meta.accentClassName,
        "border-l-2",
        emphasis === "top" && "shadow-sm",
      )}
    >
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <StatusTag variant={meta.tagVariant}>{meta.label}</StatusTag>
          <Badge
            variant="secondary"
            className={cn(
              "h-5 px-2 text-[11px] font-medium text-muted-foreground bg-muted/40 hover:bg-muted/40",
              emphasis === "top" && "text-foreground/80",
            )}
          >
            Top {topic.rank}
          </Badge>
        </div>

        <div
          className={cn(
            "font-semibold text-foreground leading-snug max-w-[92ch]",
            emphasis === "top" ? "text-base sm:text-[15px]" : "text-sm",
          )}
        >
          {title}
        </div>

        <div className="rounded-lg bg-muted/30 px-3 py-2.5">
          <div className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap break-words max-w-[92ch]">
            {topic.content || "Sem detalhes adicionais para este assunto."}
          </div>
        </div>
      </div>
    </div>
  );
}

async function copyToClipboard(text: string): Promise<void> {
  const raw = (text ?? "").toString();
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(raw);
    return;
  }
  const el = document.createElement("textarea");
  el.value = raw;
  el.style.position = "fixed";
  el.style.left = "-9999px";
  document.body.appendChild(el);
  el.select();
  document.execCommand("copy");
  document.body.removeChild(el);
}

function toPlainText(text: string): string {
  const raw = (text || "").toString();
  const withoutCodeBlocks = raw.replace(/```[\s\S]*?```/g, " ");
  const withoutInlineCode = withoutCodeBlocks.replace(/`([^`]+?)`/g, "$1");
  const withoutMarkers = withoutInlineCode.replace(/[*_~]+/g, "");
  return withoutMarkers.replace(/\r\n/g, "\n").trim();
}

const GroupSummaries = () => {
  const { groupId } = useParams();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const normalizedGroupId = typeof groupId === "string" ? groupId.trim() : "";
  const [openSummaryId, setOpenSummaryId] = useState<string | undefined>(undefined);
  const [daysLimit, setDaysLimit] = useState(30);
  const [copiedRawId, setCopiedRawId] = useState<string | null>(null);
  const [copiedPlainId, setCopiedPlainId] = useState<string | null>(null);
  const [showAllTopicsByDay, setShowAllTopicsByDay] = useState<Record<string, boolean>>({});
  const [selectedKeyword, setSelectedKeyword] = useState<string | null>(null);

  const { data: groupInfo } = useQuery({
    queryKey: ["group-info", groupId],
    queryFn: async () => {
      const { data: group } = await supabase
        .from("groups")
        .select("name, organization_id, provider, sync_status")
        .eq("id", groupId)
        .maybeSingle();
      if (!group) return null;
      const { data: org } = await supabase
        .from("organizations")
        .select("name")
        .eq("id", group.organization_id)
        .maybeSingle();
      return {
        groupName: group.name,
        orgName: org?.name,
        orgId: group.organization_id,
        provider: group.provider,
        syncStatus: group.sync_status,
      };
    },
    enabled: !!groupId && isAuthenticated,
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
  });

  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQuery({
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
            .filter((d) => d.length > 0)
        )
      );

      if (dates.length === 0) {
        return { summaries: [], topics: [], keywords: [] } as {
          summaries: GroupDailySummaryRow[];
          topics: GroupDailyTopicRow[];
          keywords: GroupDailyKeywordRow[];
        };
      }

      const { data: topicsData, error: topicsError } = await (supabase as any)
        .from("group_daily_topics")
        .select("id, group_id, topic_date, rank, title, content, created_at")
        .eq("group_id", normalizedGroupId)
        .in("topic_date", dates)
        .order("topic_date", { ascending: false })
        .order("rank", { ascending: true })
        .limit(1000);
      if (topicsError) throw topicsError;

      const { data: keywordsData, error: keywordsError } = await (supabase as any)
        .from("group_daily_keywords")
        .select("id, group_id, keyword_date, keyword, rank, created_at")
        .eq("group_id", normalizedGroupId)
        .in("keyword_date", dates)
        .order("keyword_date", { ascending: false })
        .order("rank", { ascending: true })
        .limit(2000);
      if (keywordsError) throw keywordsError;

      return {
        summaries,
        topics: (topicsData ?? []) as unknown as GroupDailyTopicRow[],
        keywords: (keywordsData ?? []) as unknown as GroupDailyKeywordRow[],
      };
    },
    enabled: normalizedGroupId.length > 0 && isAuthenticated,
  });

  const conversationsView = useMemo(() => {
    const topicsByDate: Record<string, GroupDailyTopicRow[]> = {};
    const keywordsByDate: Record<string, GroupDailyKeywordRow[]> = {};

    for (const t of (data?.topics ?? [])) {
      const k = dateKey(t.topic_date);
      if (!k) continue;
      (topicsByDate[k] ||= []).push(t);
    }

    for (const kw of (data?.keywords ?? [])) {
      const k = dateKey(kw.keyword_date);
      if (!k) continue;
      (keywordsByDate[k] ||= []).push(kw);
    }

    return (data?.summaries ?? []).map((s) => {
      const text = s.summary_text || "";
      const preview = pickPreviewText(text);
      const k = dateKey(s.summary_date);
      const topics = topicsByDate[k] ?? [];
      const keywords = keywordsByDate[k] ?? [];
      return {
        ...s,
        dateLabel: asNoonUTCFromDateOnly(k),
        preview,
        topics,
        keywords,
        linksCount: countLinks(text),
      };
    });
  }, [data]);

  const filteredConversationsView = useMemo(() => {
    const k = normalizeWhitespace(selectedKeyword || "").toLowerCase();
    if (!k) return conversationsView;
    return conversationsView.filter((s) =>
      (s.keywords || []).some((kw) => normalizeWhitespace(kw.keyword || "").toLowerCase() === k)
    );
  }, [conversationsView, selectedKeyword]);

  useEffect(() => {
    if (filteredConversationsView.length === 0) return;
    if (!openSummaryId || !filteredConversationsView.some((s) => s.id === openSummaryId)) {
      setOpenSummaryId(filteredConversationsView[0].id);
    }
  }, [filteredConversationsView, openSummaryId]);

  if (authLoading) {
    return (
      <AdminLayout title="Diário" subtitle="Verificando acesso...">
        <div className="space-y-3 animate-fade-in">
          {Array.from({ length: 4 }).map((_, idx) => (
            <Card key={idx} className="rounded-xl border border-border bg-card p-4 sm:p-5">
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="space-y-2 min-w-0 flex-1">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-4 w-full max-w-[520px]" />
                  </div>
                  <Skeleton className="h-8 w-24 rounded-md" />
                </div>
                <Skeleton className="h-3 w-56" />
              </div>
            </Card>
          ))}
        </div>
      </AdminLayout>
    );
  }

  const errorCopy = error ? getGroupSummariesErrorCopy(error) : null;
  if (errorCopy?.isAccessDenied) {
    return <AccessDenied message={errorCopy.message} />;
  }

  return (
    <AdminLayout
      title="Diário"
      subtitle="Resumo, tópicos e palavras-chave por dia"
    >
      <div className="animate-fade-in -mx-4 sm:-mx-6 -mt-4 sm:-mt-6 px-4 sm:px-6 pt-4 sm:pt-6 pb-8 sm:pb-10 bg-[#FBFAF6] space-y-6">
        <GroupPageTop
          breadcrumbItems={[
            { label: "Central do Bóris", href: "/" },
            { label: groupInfo?.orgName || "Organização", href: `/organization/${groupInfo?.orgId}` },
            { label: groupInfo?.groupName || "Grupo", href: `/groups/${groupId}` },
            { label: "Diário" },
          ]}
          group={{
            groupId: groupId as string,
            organizationId: groupInfo?.orgId || undefined,
            name: groupInfo?.groupName || "",
            provider: groupInfo?.provider || "",
            totalMembers: (totalMembersCount ?? 0) as number,
            lastMessageAt: lastMessageAt ?? null,
            syncStatus: groupInfo?.syncStatus || null,
          }}
        />

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, idx) => (
              <Card key={idx} className="rounded-xl border border-border bg-card p-4 sm:p-5">
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="space-y-2 min-w-0 flex-1">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-4 w-full max-w-[520px]" />
                    </div>
                    <Skeleton className="h-8 w-24 rounded-md" />
                  </div>
                  <Skeleton className="h-3 w-56" />
                </div>
              </Card>
            ))}
          </div>
        ) : error ? (
          <ErrorState title={errorCopy?.title} message={errorCopy?.message} retry={refetch} />
        ) : conversationsView.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="Nenhuma conversa registrada ainda"
            message="Nenhuma conversa registrada ainda. Quando o Bóris gerar resumos, eles aparecerão aqui."
          />
        ) : (
          <div className="space-y-4 w-full">
            {selectedKeyword ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm text-muted-foreground">
                  Filtrando por: <span className="font-medium text-foreground">{selectedKeyword}</span>
                </div>
                <Button size="sm" variant="ghost" onClick={() => setSelectedKeyword(null)}>
                  Limpar filtro
                </Button>
              </div>
            ) : null}

            {selectedKeyword && filteredConversationsView.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="Nenhum dia corresponde ao filtro"
                message="Tente escolher outra palavra-chave ou limpar o filtro para ver todos os dias."
              />
            ) : null}

            {filteredConversationsView.length > 0 ? (() => {
              const selectedSummary =
                filteredConversationsView.find((s) => s.id === openSummaryId) ?? filteredConversationsView[0];
              const selectedTopicsWithKind = (selectedSummary?.topics || []).map((t) => ({
                topic: t,
                kind: classifyTopic(t),
              }));
              const selectedPainTopics = selectedTopicsWithKind.filter((t) => t.kind === "dor");
              const selectedDesireTopics = selectedTopicsWithKind.filter((t) => t.kind === "desejo");
              const selectedObjectionTopics = selectedTopicsWithKind.filter(
                (t) => t.kind === "tema" && isObjectionTopic(t.topic),
              );
              const selectedTopicsSorted = selectedTopicsWithKind
                .slice()
                .sort((a, b) => (a.topic.rank ?? 999) - (b.topic.rank ?? 999));
              const showAllTopics = !!showAllTopicsByDay[selectedSummary?.id || ""];
              const visibleTopics = showAllTopics ? selectedTopicsSorted : selectedTopicsSorted.slice(0, 4);
              return (
                <div className="grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)] gap-7">
                  <div className="order-2 lg:order-1">
                    <Card className="rounded-2xl border border-border/60 bg-card/70 p-4 sm:p-5">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Dias</div>
                        <div className="text-xs text-muted-foreground">Navegação rápida</div>
                      </div>

                      <ScrollArea className="mt-4 h-[420px] sm:h-[520px] lg:h-[calc(100vh-360px)] pr-2">
                        <div className="space-y-2">
                          {filteredConversationsView.map((s) => {
                            const topicsWithKind = (s.topics || []).map((t) => ({ topic: t, kind: classifyTopic(t) }));
                            const pains = topicsWithKind.filter((t) => t.kind === "dor").length;
                            const desires = topicsWithKind.filter((t) => t.kind === "desejo").length;
                            const objections = topicsWithKind.filter(
                              (t) => t.kind === "tema" && isObjectionTopic(t.topic),
                            ).length;
                            const total = (s.topics?.length ?? 0) + (s.keywords?.length ?? 0) + (s.linksCount ?? 0);
                            const intensity = getIntensityLevel(total);
                            const isSelected = s.id === selectedSummary?.id;
                            const microSummary = `${formatCount(pains, "dor", "dores")} • ${formatCount(
                              desires,
                              "desejo",
                              "desejos",
                            )} • ${formatCount(objections, "objeção", "objeções")}`;

                            return (
                              <button
                                key={s.id}
                                type="button"
                                onClick={() => setOpenSummaryId(s.id)}
                                className={cn(
                                  "w-full text-left rounded-xl border px-3 py-3 transition",
                                  "hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/30",
                                  isSelected
                                    ? "border-primary/60 bg-primary/10 ring-1 ring-primary/15 shadow-sm"
                                    : "border-border/50 bg-card/50",
                                )}
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <div className={cn("text-sm font-semibold", isSelected ? "text-foreground" : "text-foreground/80")}>
                                    {formatDateDescriptiveBR(s.dateLabel)}
                                  </div>
                                  <div className="flex items-center gap-1">
                                    {[1, 2, 3].map((level) => (
                                      <span
                                        key={level}
                                        className={cn(
                                          "h-1.5 w-5 rounded-full",
                                          intensity.level >= level ? "bg-primary" : "bg-muted",
                                        )}
                                      />
                                    ))}
                                  </div>
                                </div>
                                <div className={cn("mt-2 text-xs", isSelected ? "text-muted-foreground" : "text-muted-foreground/80")}>
                                  {microSummary}
                                </div>
                                <div className={cn("mt-1 text-[11px]", isSelected ? "text-muted-foreground" : "text-muted-foreground/70")}>
                                  Intensidade {intensity.label}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </ScrollArea>
                    </Card>
                  </div>

                  <div className="order-1 lg:order-2 space-y-7">
                    <section className="rounded-3xl border border-primary/30 bg-primary/10 px-7 py-8 sm:px-10 sm:py-10 shadow-[0_10px_28px_rgba(0,0,0,0.08)] ring-1 ring-primary/20">
                      <div className="space-y-3">
                        <div className="text-xs font-semibold uppercase tracking-wide text-foreground/70">
                          Resumo do dia
                        </div>
                        <div className="text-[24px] sm:text-[30px] leading-snug font-semibold text-foreground">
                          {pickHumanDaySummary(selectedSummary?.topics || [], selectedSummary?.keywords || [])}
                        </div>
                        <p className="text-sm sm:text-[15px] leading-relaxed text-foreground/70 max-w-[92ch]">
                          {selectedSummary?.preview || "Resumo disponível para este dia."}
                        </p>
                      </div>
                    </section>

                    <section className="space-y-2.5">
                      <SectionDivider title="Principais temas do dia" subtitle="Peso relativo e classificação" />
                      {visibleTopics.length > 0 ? (
                        <div className="space-y-2">
                          {visibleTopics.map(({ topic, kind }, idx) => (
                            <TopicCard key={topic.id} topic={topic} kind={kind} emphasis={idx === 0 ? "top" : "default"} />
                          ))}
                          {Math.max(0, selectedTopicsSorted.length - 4) > 0 ? (
                            <div className="pt-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
                                onClick={() =>
                                  setShowAllTopicsByDay((curr) => ({
                                    ...curr,
                                    [selectedSummary?.id || ""]: !showAllTopics,
                                  }))
                                }
                              >
                                {showAllTopics ? "Ver menos" : `Ver mais (${Math.max(0, selectedTopicsSorted.length - 4)})`}
                              </Button>
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground">Nenhum tópico disponível para este dia.</div>
                      )}
                    </section>

                    <section className="space-y-2.5">
                      <SectionDivider title="Dores, desejos e objeções" subtitle="Resumo executivo" />
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                        <div className="rounded-xl border border-destructive/15 bg-destructive/5 p-3">
                          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Dores</div>
                          <div className="mt-2 divide-y divide-border/30">
                            {selectedPainTopics.slice(0, 3).map(({ topic }) => (
                              <div key={topic.id} className="text-[11px] text-foreground/85 line-clamp-1 pt-1.5 first:pt-0">
                                {cleanInlineLabel(topic.title || "Assunto")}
                              </div>
                            ))}
                            {selectedPainTopics.length === 0 ? (
                              <div className="text-[11px] text-muted-foreground">Nenhuma dor explícita.</div>
                            ) : null}
                          </div>
                        </div>
                        <div className="rounded-xl border border-success/15 bg-success/5 p-3">
                          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Desejos</div>
                          <div className="mt-2 divide-y divide-border/30">
                            {selectedDesireTopics.slice(0, 3).map(({ topic }) => (
                              <div key={topic.id} className="text-[11px] text-foreground/85 line-clamp-1 pt-1.5 first:pt-0">
                                {cleanInlineLabel(topic.title || "Assunto")}
                              </div>
                            ))}
                            {selectedDesireTopics.length === 0 ? (
                              <div className="text-[11px] text-muted-foreground">Nenhum desejo explícito.</div>
                            ) : null}
                          </div>
                        </div>
                        <div className="rounded-xl border border-border/50 bg-card/60 p-3">
                          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Objeções</div>
                          <div className="mt-2 divide-y divide-border/30">
                            {selectedObjectionTopics.slice(0, 3).map(({ topic }) => (
                              <div key={topic.id} className="text-[11px] text-foreground/85 line-clamp-1 pt-1.5 first:pt-0">
                                {cleanInlineLabel(topic.title || "Assunto")}
                              </div>
                            ))}
                            {selectedObjectionTopics.length === 0 ? (
                              <div className="text-[11px] text-muted-foreground">Nenhuma objeção explícita.</div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </section>

                    <section className="space-y-2">
                      <SectionDivider title="Palavras-chave" subtitle="Apoio visual e filtro" />
                      {selectedSummary?.keywords?.length ? (
                        <div className="flex flex-wrap gap-1">
                          {selectedSummary.keywords.map((kw) => {
                            const isSelected =
                              normalizeWhitespace(selectedKeyword || "").toLowerCase() ===
                              normalizeWhitespace(kw.keyword || "").toLowerCase();

                            return (
                              <Button
                                key={kw.id}
                                size="sm"
                                variant="ghost"
                                className={cn(
                                  "h-7 rounded-full px-3 text-[11px] sm:text-[12px] font-semibold whitespace-nowrap",
                                  "bg-gradient-to-r from-primary/20 via-primary/15 to-primary/10 text-foreground/90",
                                  "border border-primary/20 shadow-sm transition",
                                  "hover:shadow-md hover:scale-[1.02] hover:bg-gradient-to-r hover:from-primary/25 hover:via-primary/20 hover:to-primary/15",
                                  "focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                                  isSelected ? "bg-primary/25 text-foreground border-primary/40 ring-1 ring-primary/30" : "",
                                )}
                                aria-pressed={isSelected}
                                onClick={(e) => {
                                  e.preventDefault();
                                  setSelectedKeyword((curr) => {
                                    const next = normalizeWhitespace(kw.keyword || "");
                                    if (!next) return curr;
                                    if (normalizeWhitespace(curr || "").toLowerCase() === next.toLowerCase()) return null;
                                    return next;
                                  });
                                }}
                              >
                                {kw.keyword}
                              </Button>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground">Nenhuma palavra-chave disponível para este dia.</div>
                      )}
                    </section>

                    <section className="rounded-2xl border border-dashed border-border/60 bg-muted/10">
                      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                        <div className="space-y-1">
                          <div className="text-sm font-semibold text-muted-foreground">Resumo completo do WhatsApp</div>
                          <div className="text-[11px] text-muted-foreground/80">Leitura profunda</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 bg-transparent text-muted-foreground hover:text-foreground"
                            onClick={async (e) => {
                              e.preventDefault();
                              await copyToClipboard(selectedSummary?.summary_text || "");
                              setCopiedRawId(selectedSummary?.id || null);
                              window.setTimeout(() =>
                                setCopiedRawId((curr) => (curr === selectedSummary?.id ? null : curr)),
                              1400);
                            }}
                          >
                            {copiedRawId === selectedSummary?.id ? (
                              <Check className="mr-2 h-4 w-4" />
                            ) : (
                              <Copy className="mr-2 h-4 w-4" />
                            )}
                            Copiar resumo
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 bg-transparent text-muted-foreground hover:text-foreground"
                            onClick={async (e) => {
                              e.preventDefault();
                              await copyToClipboard(toPlainText(selectedSummary?.summary_text || ""));
                              setCopiedPlainId(selectedSummary?.id || null);
                              window.setTimeout(() =>
                                setCopiedPlainId((curr) => (curr === selectedSummary?.id ? null : curr)),
                              1400);
                            }}
                          >
                            {copiedPlainId === selectedSummary?.id ? (
                              <Check className="mr-2 h-4 w-4" />
                            ) : (
                              <Copy className="mr-2 h-4 w-4" />
                            )}
                            Copiar versão limpa
                          </Button>
                        </div>
                      </div>

                      <div className="px-4 pb-4">
                        <section className="rounded-xl bg-card/60 p-4 sm:p-5">
                          <div className="text-[12px] leading-relaxed font-mono text-muted-foreground break-words whitespace-pre-wrap">
                            {renderWhatsappToReact(selectedSummary?.summary_text || "")}
                          </div>
                        </section>
                      </div>
                    </section>
                  </div>
                </div>
              );
            })() : null}

            {conversationsView.length >= daysLimit ? (
              <div className="pt-2">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setDaysLimit((curr) => curr + 30)}
                >
                  Carregar mais
                </Button>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default GroupSummaries;
