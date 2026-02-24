import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CalendarDays, Check, Copy, FileText, Hash, Sparkles } from "lucide-react";

import { AdminLayout } from "@/components/layout/AdminLayout";
import { GroupPageTop } from "@/components/group-navigation/GroupPageTop";
import { KpiCard } from "@/components/group-dashboard";
import { DiaryPageSkeleton } from "@/components/group-summaries/DiaryPageSkeleton";
import { SectionDivider } from "@/components/group-summaries/SectionDivider";
import { TopicCard } from "@/components/group-summaries/TopicCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
  selectedSummary,
  showAllKeywords,
  showAllTopicsByDay: _showAllTopicsByDay,
  summariesAll,
  visibleTopics,
}: {
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

  const daysSubtitle = rangeLabel
    ? `${rangeLabel} · ${kpis.uniqueKeywords} palavras-chave únicas`
    : `${kpis.uniqueKeywords} palavras-chave únicas`;

  const plainCopied = selectedSummary?.id && copiedPlainId === selectedSummary.id;
  const rawCopied = selectedSummary?.id && copiedRawId === selectedSummary.id;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          title="Dias carregados"
          value={kpis.daysLoaded || totalDays}
          subtitle={daysSubtitle}
          icon={CalendarDays}
          help={{
            whatIs: "Quantidade de dias de resumo carregados após aplicar os filtros atuais.",
            howToInterpret: "Define o tamanho da amostra visível para a leitura de dores, oportunidades e objeções.",
            whatToObserve: "Compare com palavras-chave únicas e contagens por categoria para avaliar densidade do período.",
          }}
          className="shadow-none bg-card/90 border-border/80"
        />
        <KpiCard
          title="Dores"
          value={kpis.pains}
          subtitle="nos dias carregados"
          icon={AlertTriangle}
          help={{
            whatIs: "Total de pontos de dor/problemas identificados nos resumos dos dias carregados.",
            howToInterpret: "Mostra recorrência de fricções percebidas nas conversas analisadas.",
            whatToObserve: "Observe repetição de temas e tendência ao longo dos dias para priorizar ações.",
          }}
          className="shadow-none bg-card/90 border-border/80"
        />
        <KpiCard
          title="Oportunidades"
          value={kpis.desires}
          subtitle="nos dias carregados"
          icon={Sparkles}
          help={{
            whatIs: "Total de oportunidades/melhorias identificadas nos resumos dos dias carregados.",
            howToInterpret: "Ajuda a mapear demandas latentes e sugestões com potencial de ação.",
            whatToObserve: "Priorize oportunidades recorrentes e com relação direta a dores frequentes.",
          }}
          className="shadow-none bg-card/90 border-border/80"
        />
        <KpiCard
          title="Objeções"
          value={kpis.objections}
          subtitle="nos dias carregados"
          icon={Hash}
          help={{
            whatIs: "Total de objeções, resistências ou barreiras registradas nos resumos do período carregado.",
            howToInterpret: "Indica pontos de travamento, dúvida ou discordância que aparecem nas conversas.",
            whatToObserve: "Cruze com dores e oportunidades para separar problema estrutural de dúvida pontual.",
          }}
          className="shadow-none bg-card/90 border-border/80"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[260px_minmax(0,1fr)] gap-7">
        <div className="hidden md:block">
          <Card className="rounded-2xl border border-border/80 bg-card/90 p-4 sm:p-5 shadow-sm">
            <div className="space-y-1">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Dias</div>
              <div className="text-xs text-muted-foreground/80">
                {formatCount(filteredConversationsView.length, "dia", "dias")} filtrados
              </div>
            </div>

            <div className="mt-4">
              <ScrollArea className="h-[520px]">
                <div className="space-y-2 pr-3 overflow-x-hidden">
                  {filteredConversationsView.map((day) => {
                    const isActive = day.id === openSummaryId;
                    const topicLabels = (day.topics || [])
                      .map((t) => cleanInlineLabel(t.title || ""))
                      .filter(Boolean)
                      .slice(0, 2);
                    const keywordLabels = (day.keywords || [])
                      .map((kw) => cleanInlineLabel(kw.keyword || ""))
                      .filter(Boolean)
                      .slice(0, 2);
                    const hasHighlights = topicLabels.length > 0 || keywordLabels.length > 0;
                    const subtitle = hasHighlights ? "" : pickHumanDaySummary(day.topics, day.keywords);
                    return (
                      <button
                        key={day.id}
                        type="button"
                        onClick={() => onSelectDay(day.id)}
                        className={cn(
                          "w-full min-w-0 max-w-full text-left rounded-xl border px-3 py-3 transition-colors",
                          "bg-card/80 border-border/70 hover:bg-secondary/35",
                          isActive && "border-primary/40 bg-primary/10",
                        )}
                      >
                        <div className="flex items-center justify-between gap-3 min-w-0">
                          <div className="min-w-0 text-sm font-medium text-card-foreground whitespace-normal break-words">
                            {formatDateDescriptiveBR(day.dateLabel)}
                          </div>
                          <div className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
                            {day.intensity.label}
                          </div>
                        </div>
                        {hasHighlights ? (
                          <div className="mt-2 flex flex-wrap gap-1.5 min-w-0 max-w-full">
                            {topicLabels.map((label) => (
                              <Badge
                                key={`topic:${label}`}
                                variant="secondary"
                                className="h-5 px-2 text-[11px] font-medium text-foreground/80 bg-muted/40 hover:bg-muted/40"
                              >
                                <span className="truncate max-w-[22ch]">{label}</span>
                              </Badge>
                            ))}
                            {keywordLabels.map((label) => (
                              <Badge
                                key={`kw:${label}`}
                                variant="secondary"
                                className="h-5 px-2 text-[11px] font-medium text-muted-foreground bg-secondary/40 hover:bg-secondary/40"
                              >
                                <span className="truncate max-w-[22ch]">{label}</span>
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <div className="mt-1 text-xs text-muted-foreground whitespace-normal break-words max-w-full">
                            {subtitle}
                          </div>
                        )}
                        <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-muted-foreground min-w-0 max-w-full">
                          <span>
                            {day.painsCount} d · {day.desiresCount} o · {day.objectionsCount} obj
                          </span>
                          {day.linksCount > 0 ? <span>· {day.linksCount} links</span> : null}
                        </div>
                      </button>
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
              <SelectTrigger className="w-full">
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

          <Card className="rounded-3xl border border-primary/30 bg-primary/10 px-7 py-8 sm:px-10 sm:py-10">
            <div className="space-y-2">
              <div className="space-y-1 min-w-0">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Dia selecionado</div>
                <div className="text-lg sm:text-xl font-semibold text-foreground truncate">{selectedDateLabel}</div>
              </div>
              {selectedSummary ? (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground tabular-nums">
                  {selectedSummary.intensity?.label ? <span>{selectedSummary.intensity.label}</span> : null}
                  <span>
                    {selectedSummary.painsCount} d · {selectedSummary.desiresCount} o · {selectedSummary.objectionsCount} obj
                  </span>
                  {selectedSummary.linksCount > 0 ? <span>· {selectedSummary.linksCount} links</span> : null}
                </div>
              ) : null}
            </div>
          </Card>

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
              {visibleTopics.visible.map((item) => (
                <TopicCard
                  key={item.topic.id}
                  topic={item.topic}
                  kind={item.kind}
                  emphasis={item.topic.rank === 1 ? "top" : "default"}
                />
              ))}

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
            <SectionDivider
              title="Palavras-chave"
              subtitle={
                keywordList.length > 0
                  ? `${formatCount(keywordList.length, "termo", "termos")} encontrados`
                  : ""
              }
            />

            {keywordList.length === 0 ? (
              <Card className="rounded-2xl border border-border/80 bg-card/90 p-5">
                <div className="text-sm text-muted-foreground">Sem palavras-chave neste período.</div>
              </Card>
            ) : (
              <Card className="rounded-2xl border border-border/80 bg-card/90 p-5">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="text-sm font-medium text-card-foreground">Filtrar por palavra-chave</div>
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

                {selectedKeyword ? (
                  <div className="mt-2 text-xs text-muted-foreground">
                    Filtrando por: <span className="font-medium text-foreground">{cleanInlineLabel(selectedKeyword)}</span>
                  </div>
                ) : null}

                <div className="mt-4 flex flex-wrap gap-2">
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
                        className="h-8 px-3 rounded-full"
                      >
                        <span className="truncate max-w-[22ch]">{clean || "(vazio)"}</span>
                        <span className={cn("ml-2 text-[11px]", isActive ? "text-primary-foreground/80" : "text-muted-foreground")}>
                          {daysCount}
                        </span>
                      </Button>
                    );
                  })}
                </div>
              </Card>
            )}
          </div>

          <div className="space-y-2.5">
            <SectionDivider title="Resumo" subtitle={selectedSummary ? "Texto completo do dia" : undefined} />

            <Card className="rounded-2xl border border-border/80 bg-card/90 p-5 sm:p-6">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm font-medium text-card-foreground">Copiar</div>
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

                {selectedDayBlurb ? <div className="text-xs text-muted-foreground max-w-[90ch]">{selectedDayBlurb}</div> : null}

                <div className="rounded-2xl bg-muted/15 border border-border/70 px-5 py-5">
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    {renderWhatsappToReact(selectedSummary?.summary_text || "")}
                  </div>
                </div>
              </div>
            </Card>
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
      <div className="animate-fade-in -mx-4 sm:-mx-6 -mt-4 sm:-mt-6 px-4 sm:px-6 pt-4 sm:pt-6 pb-8 sm:pb-10 bg-gradient-to-b from-background via-background to-accent/10 space-y-6">
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
