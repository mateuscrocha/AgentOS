import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronDown, Copy, FileText } from "lucide-react";

import { AdminLayout } from "@/components/layout/AdminLayout";
import { GroupPageTop } from "@/components/group-navigation/GroupPageTop";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
      <div className="space-y-6 animate-fade-in">
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
          <div className="space-y-4 w-full max-w-[1100px] mx-auto">
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

            <Accordion
              type="single"
              collapsible
              value={openSummaryId}
              onValueChange={(v) => setOpenSummaryId(v)}
              className="space-y-4"
            >
            {filteredConversationsView.map((s) => {
              const isOpen = openSummaryId === s.id;
              const showAllTopics = !!showAllTopicsByDay[s.id];
              const topicsVisible = s.topics.slice(0, showAllTopics ? 50 : 3);
              const topicsExtra = Math.max(0, s.topics.length - 3);

              const countsLine = [
                s.topics.length > 0 ? `${s.topics.length} tópico${s.topics.length === 1 ? "" : "s"}` : "",
                s.keywords.length > 0 ? `${s.keywords.length} palavra${s.keywords.length === 1 ? "" : "s"}-chave` : "",
                s.linksCount > 0 ? `${s.linksCount} link${s.linksCount === 1 ? "" : "s"}` : "",
              ]
                .filter(Boolean)
                .join(" • ");

              return (
                <AccordionItem key={s.id} value={s.id} className="border-0">
                  <Card
                    className={cn(
                      "group rounded-xl border border-border bg-card transition-colors",
                      "hover:bg-secondary/10 focus-within:ring-1 focus-within:ring-ring/15",
                      isOpen ? "shadow-card" : ""
                    )}
                  >
                    <AccordionTrigger className="px-4 py-4 sm:px-5 sm:py-5 hover:no-underline justify-start items-start gap-2 font-normal focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/20">
                      <div className="min-w-0 flex-1 text-left space-y-3">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <div className="text-sm font-semibold text-foreground">
                            {formatDateDescriptiveBR(s.dateLabel)}
                          </div>
                          <div className="rounded-full bg-muted/50 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                            Resumo do dia
                          </div>
                        </div>

                        {countsLine ? (
                          <div className="text-xs text-muted-foreground/80">{countsLine}</div>
                        ) : null}

                        <div
                          className={cn(
                            "rounded-xl border border-border bg-card px-4 py-3 shadow-sm",
                            "border-l-2 border-l-primary/20",
                            "group-hover:border-l-primary/30",
                          )}
                        >
                          <p className="max-w-[86ch] text-[15px] leading-relaxed font-semibold text-foreground line-clamp-3">
                            {pickHumanDaySummary(s.topics, s.keywords)}
                          </p>
                        </div>

                        {!isOpen ? (
                          <p className="text-xs text-muted-foreground line-clamp-1 max-w-[96ch]">
                            {s.preview || "Resumo disponível para este dia."}
                          </p>
                        ) : null}
                      </div>

                      <div className="shrink-0 mt-0.5 flex items-center gap-2 text-xs font-medium text-muted-foreground/80">
                        <span>Ver detalhes</span>
                      </div>
                    </AccordionTrigger>

                    <AccordionContent className="px-4 pb-4 sm:px-5 sm:pb-5 transition-all duration-200">
                      <div className="space-y-6">
                        <div className="space-y-3">
                          <div className="text-sm font-semibold text-foreground">Assuntos que mais movimentaram o dia</div>
                          {topicsVisible.length > 0 ? (
                            <div className="space-y-2">
                              {topicsVisible.map((t) => {
                                const title = cleanInlineLabel(t.title || "");
                                const preview = pickTopicPreview(t.content || "");

                                return (
                                  <div
                                    key={t.id}
                                    className={cn(
                                      "rounded-xl border border-border bg-card p-4 sm:p-5",
                                      "border-l-2 border-l-transparent",
                                      "transition-colors duration-200",
                                      "hover:bg-secondary/20 hover:border-l-primary/30",
                                    )}
                                  >
                                    <div className="text-sm font-medium text-foreground">{title || "Tópico"}</div>
                                    <p className="mt-1 max-w-[86ch] text-sm text-muted-foreground leading-relaxed line-clamp-3">
                                      {preview || "Sem detalhes adicionais para este tópico."}
                                    </p>
                                  </div>
                                );
                              })}

                              {topicsExtra > 0 ? (
                                <div className="pt-1">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      setShowAllTopicsByDay((curr) => ({ ...curr, [s.id]: !showAllTopics }));
                                    }}
                                  >
                                    {showAllTopics ? "Ver menos tópicos" : "Ver mais tópicos"}
                                  </Button>
                                </div>
                              ) : null}
                            </div>
                          ) : (
                            <div className="text-sm text-muted-foreground">Nenhum tópico disponível para este dia.</div>
                          )}
                        </div>

                        <Separator className="bg-border/60" />

                        <div className="space-y-3">
                          <div className="space-y-1">
                            <div className="text-sm font-semibold text-foreground">Palavras-chave</div>
                            <div className="text-xs text-muted-foreground">Linguagem mais usada no dia</div>
                          </div>
                          {s.keywords.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5">
                              {s.keywords.map((kw) => {
                                const isSelected =
                                  normalizeWhitespace(selectedKeyword || "").toLowerCase() ===
                                  normalizeWhitespace(kw.keyword || "").toLowerCase();

                                return (
                                  <Button
                                    key={kw.id}
                                    size="sm"
                                    variant="ghost"
                                    className={cn(
                                      "h-6 rounded-full px-2.5 text-[11px] font-medium whitespace-nowrap",
                                      "bg-muted/30 hover:bg-muted/50",
                                      isSelected
                                        ? "text-foreground bg-secondary hover:bg-secondary/80 ring-1 ring-primary/20"
                                        : "text-muted-foreground hover:text-foreground"
                                    )}
                                    aria-pressed={isSelected}
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
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
                        </div>

                        <Separator className="bg-border/60" />

                        <Collapsible className="rounded-xl border border-border bg-card">
                          <div className="flex items-center justify-between gap-3 px-4 py-3">
                            <CollapsibleTrigger asChild>
                              <button
                                type="button"
                                className={cn(
                                  "group flex min-w-0 items-center gap-2 text-left",
                                  "text-sm font-semibold text-foreground",
                                  "hover:text-foreground/90",
                                  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/20"
                                )}
                              >
                                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                                <span className="truncate">Resumo completo do WhatsApp</span>
                              </button>
                            </CollapsibleTrigger>

                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="secondary"
                                className="h-8 hover:bg-primary/10"
                                onClick={async (e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  await copyToClipboard(s.summary_text || "");
                                  setCopiedRawId(s.id);
                                  window.setTimeout(() => setCopiedRawId((curr) => (curr === s.id ? null : curr)), 1400);
                                }}
                              >
                                {copiedRawId === s.id ? (
                                  <Check className="mr-2 h-4 w-4" />
                                ) : (
                                  <Copy className="mr-2 h-4 w-4" />
                                )}
                                Copiar resumo
                              </Button>
                              <Button
                                size="sm"
                                variant="secondary"
                                className="h-8 hover:bg-primary/10"
                                onClick={async (e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  await copyToClipboard(toPlainText(s.summary_text || ""));
                                  setCopiedPlainId(s.id);
                                  window.setTimeout(() => setCopiedPlainId((curr) => (curr === s.id ? null : curr)), 1400);
                                }}
                              >
                                {copiedPlainId === s.id ? (
                                  <Check className="mr-2 h-4 w-4" />
                                ) : (
                                  <Copy className="mr-2 h-4 w-4" />
                                )}
                                Copiar versão limpa
                              </Button>
                            </div>
                          </div>

                          <CollapsibleContent className="px-4 pb-4">
                            <section className="rounded-xl border border-border bg-muted/10 p-4 sm:p-5">
                              <ScrollArea className="max-h-[460px] pr-3">
                                <div className="text-[13px] leading-relaxed font-mono text-card-foreground break-words">
                                  {renderWhatsappToReact(s.summary_text)}
                                </div>
                              </ScrollArea>
                            </section>
                          </CollapsibleContent>
                        </Collapsible>
                      </div>
                    </AccordionContent>
                  </Card>
                </AccordionItem>
              );
            })}

            </Accordion>

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
