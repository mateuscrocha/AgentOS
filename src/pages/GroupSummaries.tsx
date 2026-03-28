import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronDown, Copy, FileText } from "lucide-react";

import { AdminLayout } from "@/components/layout/AdminLayout";
import { GroupPageTop } from "@/components/group-navigation/GroupPageTop";
import { DiaryPageSkeleton } from "@/components/group-summaries/DiaryPageSkeleton";
import { SectionDivider } from "@/components/group-summaries/SectionDivider";
import { TopicCard } from "@/components/group-summaries/TopicCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { formatDateDescriptiveBR } from "@/lib/date";
import {
  asNoonUTCFromDateOnly,
  cleanInlineLabel,
  formatCount,
  getGroupSummariesErrorCopy,
  normalizeWhitespace,
  pickHumanDaySummary,
  toPlainText,
} from "@/lib/summary-utils";
import { renderWhatsappToReact } from "@/lib/whatsapp-format";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useGroupSummaries } from "@/hooks/use-group-summaries";

import AccessDenied from "./AccessDenied";

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

type UseGroupSummariesReturn = ReturnType<typeof useGroupSummaries>;

function DiaryContent({
  groupId,
  copiedPlainId,
  copiedRawId,
  dateRange,
  daysLimit,
  filteredConversationsView,
  kpis,
  keywordDayCounts,
  onClearKeyword,
  onCopyPlain,
  onCopyRaw,
  onLoadMore,
  onSelectDay,
  onToggleShowAllKeywords,
  onToggleShowAllTopics,
  onToggleKeyword,
  openSummaryId,
  selectedKeyword,
  selectedExecutive,
  selectedSummary,
  showAllKeywords,
  showAllTopicsByDay: _showAllTopicsByDay,
  summariesAll,
  visibleTopics,
}: {
  groupId: string;
  copiedPlainId: string | null;
  copiedRawId: string | null;
  dateRange: UseGroupSummariesReturn["dateRange"];
  daysLimit: UseGroupSummariesReturn["daysLimit"];
  filteredConversationsView: UseGroupSummariesReturn["filteredConversationsView"];
  kpis: UseGroupSummariesReturn["kpis"];
  keywordDayCounts: UseGroupSummariesReturn["keywordDayCounts"];
  onClearKeyword: () => void;
  onCopyPlain: () => Promise<void>;
  onCopyRaw: () => Promise<void>;
  onLoadMore: () => void;
  onSelectDay: (summaryId: string) => void;
  onToggleShowAllKeywords: () => void;
  onToggleShowAllTopics: () => void;
  onToggleKeyword: (keyword: string) => void;
  openSummaryId: UseGroupSummariesReturn["openSummaryId"];
  selectedKeyword: UseGroupSummariesReturn["selectedKeyword"];
  selectedExecutive: UseGroupSummariesReturn["selectedExecutive"];
  selectedSummary: UseGroupSummariesReturn["selectedSummary"];
  showAllKeywords: boolean;
  showAllTopicsByDay: UseGroupSummariesReturn["showAllTopicsByDay"];
  summariesAll: UseGroupSummariesReturn["conversationsView"];
  visibleTopics: UseGroupSummariesReturn["visibleTopics"];
}) {
  const keywordList = useMemo(() => {
    const entries = Array.from(keywordDayCounts.entries());
    entries.sort((a, b) => b[1] - a[1]);
    return entries;
  }, [keywordDayCounts]);

  const visibleKeywords = useMemo(() => {
    const max = 24;
    return showAllKeywords ? keywordList : keywordList.slice(0, max);
  }, [keywordList, showAllKeywords]);

  const selectedSummaryDateKey = selectedSummary?.dateKey || "";

  const { data: selectedDayMessagesCount } = useQuery({
    queryKey: ["group-summary-day-messages-count", groupId, selectedSummaryDateKey],
    queryFn: async () => {
      if (!groupId || !selectedSummaryDateKey) return 0;

      const startIso = `${selectedSummaryDateKey}T00:00:00.000Z`;
      const endIso = `${selectedSummaryDateKey}T23:59:59.999Z`;

      const { count, error } = await supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .eq("group_id", groupId)
        .is("deleted_at", null)
        .gte("created_at", startIso)
        .lte("created_at", endIso);

      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!groupId && !!selectedSummaryDateKey,
  });

  const selectedDateLabel = selectedSummary ? formatDateDescriptiveBR(selectedSummary.dateLabel) : "—";
  const selectedDayBlurb = selectedSummary
    ? pickHumanDaySummary(selectedSummary.topics, selectedSummary.keywords)
    : "";

  const totalDays = summariesAll.length;
  const rangeLabel = dateRange
    ? `${formatDateDescriptiveBR(asNoonUTCFromDateOnly(dateRange.oldest))} → ${formatDateDescriptiveBR(
        asNoonUTCFromDateOnly(dateRange.newest),
      )}`
    : "";

  const plainCopied = selectedSummary?.id && copiedPlainId === selectedSummary.id;
  const rawCopied = selectedSummary?.id && copiedRawId === selectedSummary.id;
  const selectedPrimaryTopic = selectedSummary?.topicsWithKind?.[0];
  const selectedTopicCount = selectedSummary?.topics.length ?? 0;
  const periodMetrics = [
    { label: "Dias lidos", value: kpis.daysLoaded || totalDays },
    { label: "Dores mapeadas", value: kpis.pains },
    { label: "Oportunidades", value: kpis.desires },
    { label: "Termos únicos", value: kpis.uniqueKeywords },
  ] as const;
  const selectedDayMetrics = [
    { label: "Intensidade", value: selectedSummary?.intensity?.label || "—" },
    { label: "Tópicos", value: selectedTopicCount },
    { label: "Objeções", value: selectedSummary?.objectionsCount ?? 0 },
    { label: "Links", value: selectedSummary?.linksCount ?? 0 },
  ] as const;
  const executiveHighlights = [
    {
      label: "Dor dominante",
      value: selectedExecutive.pains[0]?.topic.title || "Nenhuma dor dominante no dia",
      tone: "border-destructive/20 bg-destructive/5",
    },
    {
      label: "Oportunidade mais clara",
      value: selectedExecutive.desires[0]?.topic.title || "Sem oportunidade destacada",
      tone: "border-success/20 bg-success/5",
    },
    {
      label: "Objeção em evidência",
      value: selectedExecutive.objections[0]?.topic.title || "Sem objeção relevante",
      tone: "border-warning/20 bg-warning/10",
    },
  ] as const;

  return (
    <div className="space-y-6">
      <Card className="rounded-[28px] border border-slate-200/90 bg-white p-5 shadow-[0_22px_55px_-42px_rgba(15,23,42,0.35)] sm:p-6">
        <div className="flex flex-col gap-5">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="rounded-full border border-primary/15 bg-primary/[0.08] px-3 text-primary hover:bg-primary/[0.08]">
                Visão do período
              </Badge>
              {selectedKeyword ? (
                <Badge variant="secondary" className="rounded-full border border-border/70 bg-background/80 px-3">
                  Filtro ativo: {cleanInlineLabel(selectedKeyword)}
                </Badge>
              ) : null}
            </div>
            <div className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
              {rangeLabel || "Período carregado"}
            </div>
            <div className="max-w-[78ch] text-sm leading-relaxed text-muted-foreground">
              {totalDays > 0
                ? `Leitura contínua de ${formatCount(totalDays, "dia", "dias")} com foco em recorrência, sinais de dor e oportunidades reais do grupo.`
                : "Sem dias carregados no período."}
            </div>
          </div>

          <div className="grid gap-3 border-t border-border/70 pt-4 sm:grid-cols-2 xl:grid-cols-4">
            {periodMetrics.map((item) => (
              <div key={item.label} className="space-y-1">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  {item.label}
                </div>
                <div className="text-2xl font-semibold tracking-tight text-foreground">{item.value}</div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-7 md:grid-cols-[280px_minmax(0,1fr)]">
        <div className="hidden self-start md:sticky md:top-24 md:block">
          <Card className="rounded-[28px] border border-slate-200/90 bg-white p-4 shadow-[0_18px_45px_-36px_rgba(15,23,42,0.32)] sm:p-5">
            <div className="space-y-1">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Linha do tempo</div>
              <div className="text-xs text-muted-foreground/80">
                {formatCount(filteredConversationsView.length, "dia", "dias")} filtrados
              </div>
            </div>

            <div className="mt-4">
              <ScrollArea className="h-[520px]">
                <div className="space-y-0 pr-3 overflow-x-hidden">
                  {filteredConversationsView.map((day) => {
                    const isActive = day.id === openSummaryId;
                    const subtitle = pickHumanDaySummary(day.topics, day.keywords);
                    return (
                      <div key={day.id} className="relative pl-5">
                        <div className="absolute left-[7px] top-0 bottom-0 w-px bg-border/60" />
                        <div
                          className={cn(
                            "absolute left-0 top-4 h-4 w-4 rounded-full border-2 bg-background",
                            isActive ? "border-primary bg-primary/15" : "border-border/80",
                          )}
                        />
                        <button
                          type="button"
                          onClick={() => onSelectDay(day.id)}
                          className={cn(
                            "mb-3 w-full min-w-0 max-w-full rounded-[var(--radius-lg)] border px-3 py-3 text-left shadow-subtle transition-colors",
                            "border-border/40 bg-background/70 hover:bg-secondary/25",
                            isActive && "border-primary/25 bg-primary/[0.05]",
                          )}
                        >
                          <div className="min-w-0 text-sm font-medium text-card-foreground whitespace-normal break-words">
                            {formatDateDescriptiveBR(day.dateLabel)}
                          </div>
                          <div className="mt-1 max-w-full whitespace-normal break-words text-xs leading-relaxed text-muted-foreground">
                            {subtitle || day.preview}
                          </div>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>

            <div className="mt-4">
              <Button variant="secondary" className="w-full" onClick={onLoadMore}>
                Carregar mais (+30)
              </Button>
              <div className="mt-2 text-[11px] text-muted-foreground">
                Limite atual: {daysLimit} dias
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-7">
          <div className="md:hidden">
            <Select value={openSummaryId || ""} onValueChange={onSelectDay}>
              <SelectTrigger className="w-full rounded-[var(--radius-lg)] border-border/80 bg-card/95 shadow-subtle">
                <SelectValue placeholder="Selecione um dia" />
              </SelectTrigger>
              <SelectContent>
                {filteredConversationsView.map((day) => (
                  <SelectItem key={day.id} value={day.id}>
                    {formatDateDescriptiveBR(day.dateLabel)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Card className="rounded-[30px] border border-primary/15 bg-[radial-gradient(circle_at_top_left,rgba(251,146,60,0.14),transparent_38%),linear-gradient(180deg,rgba(255,255,255,1),rgba(255,247,237,0.8))] px-6 py-6 shadow-[0_26px_70px_-48px_rgba(251,146,60,0.5)] sm:px-8 sm:py-8">
            <div className="space-y-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 space-y-3">
                  <div className="space-y-1 min-w-0">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Dia selecionado</div>
                    <div className="text-xl font-semibold text-foreground sm:text-2xl">{selectedDateLabel}</div>
                  </div>
                  {selectedDayBlurb ? (
                    <div className="max-w-[78ch] text-sm leading-relaxed text-foreground/80">{selectedDayBlurb}</div>
                  ) : null}
                </div>

                <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:min-w-[360px]">
                  {selectedDayMetrics.map((item) => (
                    <div key={item.label} className="rounded-[var(--radius-md)] border border-border/60 bg-background/70 px-3 py-3 shadow-subtle">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        {item.label}
                      </div>
                      <div className="mt-1 text-sm font-semibold text-foreground">{item.value}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {selectedPrimaryTopic ? (
                  <Badge variant="secondary" className="rounded-full border border-border/70 bg-background/90 px-3 py-1 text-foreground hover:bg-background/90">
                    Tema principal: {cleanInlineLabel(selectedPrimaryTopic.topic.title || "")}
                  </Badge>
                ) : null}
                {selectedSummary?.painsCount ? (
                  <Badge variant="secondary" className="rounded-full border border-border/70 bg-background/90 px-3 py-1 hover:bg-background/90">
                    {selectedSummary.painsCount} dores
                  </Badge>
                ) : null}
                {selectedSummary?.desiresCount ? (
                  <Badge variant="secondary" className="rounded-full border border-border/70 bg-background/90 px-3 py-1 hover:bg-background/90">
                    {selectedSummary.desiresCount} oportunidades
                  </Badge>
                ) : null}
                {selectedSummary?.keywords.length ? (
                  <Badge variant="secondary" className="rounded-full border border-border/70 bg-background/90 px-3 py-1 hover:bg-background/90">
                    {selectedSummary.keywords.length} termos capturados
                  </Badge>
                ) : null}
              </div>
            </div>
          </Card>

          <div className="space-y-2.5">
            <SectionDivider
              title="Leitura rápida"
              subtitle={selectedSummary ? "Atalhos para o que mais importa neste dia" : undefined}
            />

            <div className="grid gap-3 lg:grid-cols-3">
              {executiveHighlights.map((item) => (
                <Card key={item.label} className={cn("rounded-[var(--radius-lg)] border p-4 shadow-subtle", item.tone)}>
                  <div className="space-y-2">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{item.label}</div>
                    <div className="text-sm font-medium leading-relaxed text-foreground">{cleanInlineLabel(item.value)}</div>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          <div className="space-y-2.5">
            <SectionDivider
              title="Tópicos"
              subtitle={
                selectedSummary
                  ? `${formatCount(selectedSummary.topics.length, "tópico", "tópicos")} no dia selecionado`
                  : undefined
              }
            />

            <div className="space-y-3">
              {visibleTopics.visible.length > 0 ? (
                visibleTopics.visible.map((item) => (
                  <TopicCard
                    key={item.topic.id}
                    topic={item.topic}
                    kind={item.kind}
                    emphasis={item.topic.rank === 1 ? "top" : "default"}
                  />
                ))
              ) : (
                <Card className="rounded-[var(--radius-lg)] border border-dashed border-border/80 bg-muted/20 p-5 shadow-subtle">
                  <div className="space-y-2">
                    <div className="text-sm font-medium text-foreground">Nenhum tópico identificado neste dia</div>
                    <div className="text-sm leading-relaxed text-muted-foreground">
                      Houve poucas mensagens, por isso não foi possível identificar tópicos neste dia. Foram{" "}
                      <span className="font-semibold text-foreground">
                        {formatCount(selectedDayMessagesCount ?? 0, "mensagem", "mensagens")}
                      </span>{" "}
                      no dia.
                    </div>
                  </div>
                </Card>
              )}

              {visibleTopics.hiddenCount > 0 ? (
                <div className="flex items-center gap-3">
                  <Button variant="secondary" onClick={onToggleShowAllTopics}>
                    {visibleTopics.showAll
                      ? "Mostrar menos"
                      : `Mostrar mais (${visibleTopics.hiddenCount})`}
                  </Button>
                  <div className="text-xs text-muted-foreground">Ordenado por rank</div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="space-y-2.5">
            <SectionDivider title="Resumo" subtitle={selectedSummary ? "Texto completo do dia" : undefined} />

            <Card className="rounded-[28px] border border-slate-200/90 bg-white p-6 shadow-[0_22px_55px_-42px_rgba(15,23,42,0.35)] sm:p-8">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Documento do dia
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Leitura completa consolidada em formato corrido.
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="secondary" onClick={onCopyPlain} className="gap-2">
                          {plainCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                          Texto limpo
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{plainCopied ? "Copiado" : "Copiar resumo sem marcação"}</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="secondary" onClick={onCopyRaw} className="gap-2">
                          {rawCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                          Texto original
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{rawCopied ? "Copiado" : "Copiar resumo completo"}</TooltipContent>
                    </Tooltip>
                  </div>
                </div>

                <div className="rounded-[var(--radius-lg)] border border-border/70 bg-background px-6 py-6 shadow-subtle sm:px-8 sm:py-8">
                  <div className="mx-auto max-w-[78ch] border-l border-border/60 pl-5 sm:pl-7">
                    <div className="mb-6 space-y-2">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        {selectedDateLabel}
                      </div>
                      {selectedDayBlurb ? (
                        <div className="text-sm leading-relaxed text-foreground/75">{selectedDayBlurb}</div>
                      ) : null}
                    </div>
                    <div className="prose prose-sm max-w-none dark:prose-invert prose-headings:font-semibold prose-p:leading-7 prose-li:leading-7">
                      {renderWhatsappToReact(selectedSummary?.summary_text || "")}
                    </div>
                  </div>
                </div>

                {selectedPrimaryTopic ? (
                  <div className="rounded-[var(--radius-lg)] border border-border/70 bg-muted/15 px-5 py-4 shadow-subtle">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Tese central do dia
                    </div>
                    <div className="mt-2 text-sm font-medium leading-relaxed text-foreground">
                      {cleanInlineLabel(selectedPrimaryTopic.topic.title || "")}
                    </div>
                  </div>
                ) : null}
              </div>
            </Card>
          </div>

          <div className="space-y-2.5">
            <SectionDivider
              title="Palavras-chave"
              subtitle={
                keywordList.length > 0
                  ? `${formatCount(keywordList.length, "termo", "termos")} encontrados`
                  : "Nenhum termo relevante neste período"
              }
            />

            <Collapsible defaultOpen={!!selectedKeyword}>
              <Card className="rounded-[28px] border border-slate-200/90 bg-white shadow-[0_18px_45px_-36px_rgba(15,23,42,0.32)]">
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
                  >
                    <div className="space-y-1">
                      <div className="text-sm font-medium text-card-foreground">Filtrar por palavra-chave</div>
                      <div className="text-xs text-muted-foreground">
                        Abra este painel só quando precisar refinar a leitura por termos recorrentes.
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {selectedKeyword ? (
                        <Badge variant="secondary" className="rounded-full border border-border/70 bg-background/80 px-3">
                          {cleanInlineLabel(selectedKeyword)}
                        </Badge>
                      ) : null}
                      <ChevronDown className="h-4 w-4" />
                    </div>
                  </button>
                </CollapsibleTrigger>

                <CollapsibleContent className="border-t border-border/70 px-5 py-5">
                  {keywordList.length === 0 ? (
                    <div className="text-sm text-muted-foreground">Sem palavras-chave neste período.</div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="text-sm font-medium text-card-foreground">Termos encontrados no período</div>
                        <div className="flex items-center gap-2">
                          {selectedKeyword ? (
                            <Button variant="ghost" onClick={onClearKeyword}>
                              Limpar filtro
                            </Button>
                          ) : null}
                          {keywordList.length > 24 ? (
                            <Button variant="ghost" onClick={onToggleShowAllKeywords}>
                              {showAllKeywords ? "Mostrar menos" : "Mostrar todas"}
                            </Button>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {visibleKeywords.map(([keyword, daysCount]) => {
                          const clean = cleanInlineLabel(keyword);
                          const isActive =
                            normalizeWhitespace(selectedKeyword || "").toLowerCase() ===
                            normalizeWhitespace(keyword).toLowerCase();

                          return (
                            <Button
                              key={keyword}
                              type="button"
                              variant={isActive ? "default" : "secondary"}
                              onClick={() => onToggleKeyword(keyword)}
                              className="h-8 rounded-full px-3"
                            >
                              <span className="truncate max-w-[22ch]">{clean || "(vazio)"}</span>
                              <span
                                className={cn(
                                  "ml-2 text-[11px]",
                                  isActive ? "text-primary-foreground/80" : "text-muted-foreground",
                                )}
                              >
                                {daysCount}
                              </span>
                            </Button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </CollapsibleContent>
              </Card>
            </Collapsible>
          </div>
        </div>
      </div>
    </div>
  );
}

const GroupSummaries = () => {
  const { groupId } = useParams();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const normalizedGroupId = typeof groupId === "string" ? groupId.trim() : "";
  const [copiedRawId, setCopiedRawId] = useState<string | null>(null);
  const [copiedPlainId, setCopiedPlainId] = useState<string | null>(null);

  const [showAllKeywords, setShowAllKeywords] = useState(false);

  const {
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
    visibleTopics,
    selectedExecutive,
    isLoading,
    error,
    refetch,
  } = useGroupSummaries({ groupId: normalizedGroupId, enabled: isAuthenticated });

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

  if (authLoading) {
    return (
      <AdminLayout title="Diário" subtitle="Verificando acesso...">
        <DiaryPageSkeleton className="animate-fade-in" />
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
      subtitle="Tópicos e palavras-chave por dia"
    >
      <div className="mx-auto max-w-[1480px] animate-fade-in space-y-6 bg-gradient-to-b from-background via-background to-warning/[0.06] pb-8 sm:pb-10">
        <GroupPageTop
          breadcrumbItems={[
            { label: "Central de Comando", href: "/" },
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
          <DiaryPageSkeleton />
        ) : error ? (
          <ErrorState title={errorCopy?.title} message={errorCopy?.message} retry={refetch} />
        ) : conversationsView.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="Nenhuma conversa registrada ainda"
            message="Nenhuma conversa registrada ainda. Quando o Bóris gerar resumos, eles aparecerão aqui."
          />
        ) : (
          <DiaryContent
            groupId={normalizedGroupId}
            copiedPlainId={copiedPlainId}
            copiedRawId={copiedRawId}
            dateRange={dateRange}
            daysLimit={daysLimit}
            filteredConversationsView={filteredConversationsView}
            kpis={kpis}
            keywordDayCounts={keywordDayCounts}
            onClearKeyword={() => setSelectedKeyword(null)}
            onCopyPlain={async () => {
              await copyToClipboard(toPlainText(selectedSummary?.summary_text || ""));
              setCopiedPlainId(selectedSummary?.id || null);
              window.setTimeout(() =>
                setCopiedPlainId((curr) => (curr === selectedSummary?.id ? null : curr)),
              1400);
            }}
            onCopyRaw={async () => {
              await copyToClipboard(selectedSummary?.summary_text || "");
              setCopiedRawId(selectedSummary?.id || null);
              window.setTimeout(() =>
                setCopiedRawId((curr) => (curr === selectedSummary?.id ? null : curr)),
              1400);
            }}
            onLoadMore={() => setDaysLimit((curr) => curr + 30)}
            onSelectDay={setOpenSummaryId}
            onToggleShowAllTopics={() =>
              setShowAllTopicsByDay((curr) => ({
                ...curr,
                [selectedSummary?.id || ""]: !visibleTopics.showAll,
              }))
            }
            onToggleShowAllKeywords={() => setShowAllKeywords((curr) => !curr)}
            onToggleKeyword={(keyword) =>
              setSelectedKeyword((curr) => {
                const next = normalizeWhitespace(keyword);
                if (!next) return curr;
                if (normalizeWhitespace(curr || "").toLowerCase() === next.toLowerCase()) return null;
                return next;
              })
            }
            openSummaryId={openSummaryId}
            selectedKeyword={selectedKeyword}
            selectedExecutive={selectedExecutive}
            selectedSummary={selectedSummary}
            showAllKeywords={showAllKeywords}
            showAllTopicsByDay={showAllTopicsByDay}
            summariesAll={conversationsView}
            visibleTopics={visibleTopics}
          />
        )}
      </div>
    </AdminLayout>
  );
};

export default GroupSummaries;
