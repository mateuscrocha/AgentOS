import { Fragment, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CircleHelp,
  Lightbulb,
  Search,
  UsersRound
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "./components/ui/alert";
import { Badge } from "./components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator
} from "./components/ui/breadcrumb";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./components/ui/select";
import { Separator } from "./components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs";
import OpportunityDataTable, {
  createOpportunityColumns,
  createProductAccountColumns
} from "./components/opportunity-data-table";
import { intelligenceRecords } from "./lib/generated-intelligence-data";
import { cn } from "./lib/utils";

function formatDate(date) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(new Date(`${date}T12:00:00`));
}

function normalize(text) {
  return text.toLowerCase();
}

function aggregate(records, selector) {
  const counts = new Map();

  records.forEach((record) => {
    selector(record).forEach((item) => {
      const label = item.trim();
      if (!label) return;
      const current = counts.get(label);
      counts.set(label, {
        label,
        count: current ? current.count + 1 : 1,
        accounts: current ? new Set([...current.accounts, record.account]) : new Set([record.account])
      });
    });
  });

  return Array.from(counts.values())
    .map((item) => ({
      label: item.label,
      count: item.count,
      accounts: item.accounts.size
    }))
    .sort((a, b) => b.count - a.count || b.accounts - a.accounts || a.label.localeCompare(b.label, "pt-BR"));
}

function groupCountBy(records, key) {
  const map = new Map();
  records.forEach((record) => {
    map.set(record[key], (map.get(record[key]) ?? 0) + 1);
  });
  return Array.from(map.entries()).map(([label, count]) => ({ label, count }));
}

function hasSourceMatch(record, sourceFilter) {
  if (sourceFilter === "Todas") return true;
  if (sourceFilter === "Com reunião") return (record.meetings?.length ?? 0) > 0;
  if (sourceFilter === "Com síntese") return (record.syntheses?.length ?? 0) > 0;
  if (sourceFilter === "Completa") return (record.meetings?.length ?? 0) > 0 && (record.syntheses?.length ?? 0) > 0;
  if (sourceFilter === "Só dossiê") return (record.meetings?.length ?? 0) === 0 && (record.syntheses?.length ?? 0) === 0;
  return true;
}

function hasSignalMatch(record, signalFilter) {
  if (signalFilter === "Todos") return true;
  if (signalFilter === "Dor") return record.pains.length > 0;
  if (signalFilter === "Objeção") return record.objections.length > 0;
  if (signalFilter === "Solução") return record.proposedSolutions.length > 0;
  if (signalFilter === "Oportunidade") return record.opportunities.length > 0;
  if (signalFilter === "Piloto") {
    return (
      record.stage === "Piloto" ||
      record.proposedSolutions.some((item) => normalize(item).includes("piloto")) ||
      normalize(record.nextStep).includes("piloto")
    );
  }
  return true;
}

function scoreRecord(record) {
  let score = 0;
  const reasons = [];

  if (record.pains.length >= 3) {
    score += 2;
    reasons.push("dor bem definida");
  }

  if (record.opportunities.length >= 2) {
    score += 2;
    reasons.push("oportunidade clara");
  }

  if (record.proposedSolutions.length >= 2) {
    score += 2;
    reasons.push("hipótese madura");
  }

  if ((record.meetings?.length ?? 0) > 0) {
    score += 1;
    reasons.push("reunião consolidada");
  }

  if ((record.syntheses?.length ?? 0) > 0) {
    score += 1;
    reasons.push("síntese pronta");
  }

  if (record.stakeholders.some((item) => item && item !== "A confirmar")) {
    score += 1;
    reasons.push("stakeholders mapeados");
  }

  if (
    record.stage === "Piloto" ||
    record.proposedSolutions.some((item) => normalize(item).includes("piloto")) ||
    normalize(record.nextStep).includes("piloto")
  ) {
    score += 3;
    reasons.push("sinal de piloto");
  }

  if (record.objections.length >= 4) {
    score -= 1;
    reasons.push("travas relevantes");
  }

  const label = score >= 8 ? "Alta" : score >= 5 ? "Média" : "Baixa";
  return { score: Math.max(score, 0), label, reasons };
}

function buildTimeline(record) {
  return [
    ...(record.meetings ?? []).map((meeting) => ({
      id: `meeting-${meeting.id}`,
      kind: "Reunião",
      date: meeting.date,
      title: meeting.title,
      summary: meeting.context,
      bullets: [...meeting.facts.slice(0, 2), ...meeting.nextSteps.slice(0, 1)].slice(0, 3),
      source: meeting.source
    })),
    ...(record.syntheses ?? []).map((synthesis) => ({
      id: `synthesis-${synthesis.id}`,
      kind: "Síntese",
      date: synthesis.date,
      title: synthesis.title,
      summary: synthesis.summary,
      bullets: [...synthesis.hypotheses.slice(0, 2), ...synthesis.nextSteps.slice(0, 1)].slice(0, 3),
      source: synthesis.source
    }))
  ].sort((a, b) => b.date.localeCompare(a.date));
}

function CompactPriorityBadge({ priority }) {
  const tone =
    priority.label === "Alta"
      ? "bg-emerald-500"
      : priority.label === "Média"
        ? "bg-amber-400"
        : "bg-zinc-300";

  return (
    <div className="flex items-center gap-2" aria-label={`Prioridade ${priority.label}, score ${priority.score}`}>
      <span className={`size-2 rounded-full ${tone}`} aria-hidden="true" />
      <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {priority.score}
      </span>
    </div>
  );
}

function ViewMetric({ label, value, helper }) {
  return (
    <div className="flex min-w-[10rem] flex-col gap-1 rounded-[1.4rem] border border-white/70 bg-white px-4 py-4 shadow-sm">
      <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{label}</span>
      <span className="text-2xl font-bold tracking-tight text-foreground">{value}</span>
      {helper ? <span className="text-xs text-muted-foreground">{helper}</span> : null}
    </div>
  );
}

function FilterSelect({ label, value, options, onChange }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label={label}>
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option} value={option}>
            {option}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function Surface({ children, className = "" }) {
  return (
    <section
      className={cn(
        "rounded-[1.9rem] border border-white/75 bg-white/92 p-5 shadow-lg shadow-primary/5 backdrop-blur-sm",
        className
      )}
    >
      {children}
    </section>
  );
}

function SurfaceHeader({ title, description, action, eyebrow = "Painel" }) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="space-y-1">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">{eyebrow}</p>
        <h2 className="text-[1.85rem] font-bold tracking-tight text-foreground">{title}</h2>
        {description ? <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p> : null}
      </div>
      {action ? <div className="flex items-center gap-2">{action}</div> : null}
    </div>
  );
}

function DetailSection({ label = "Contexto", title, description, children, emphasis = false }) {
  const tone = emphasis
    ? "border-border/70 bg-background/90 ring-1 ring-primary/10"
    : "border-border/70 bg-background/75";

  return (
    <section className={cn("rounded-2xl border px-4 py-4", tone)}>
      <div className="space-y-1">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary/80">{label}</p>
        <h3 className={emphasis ? "text-lg font-bold text-foreground" : "text-base font-semibold text-foreground"}>
          {title}
        </h3>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function SignalPanel({ title, description, icon: Icon, items }) {
  return (
    <section className="rounded-3xl border border-border/70 bg-background/80 px-5 py-5 shadow-xs">
      <div className="space-y-1">
        <h3 className="flex items-center gap-2 text-base font-semibold text-foreground">
          <Icon className="size-4" />
          {title}
        </h3>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      <div className="mt-4 flex flex-col gap-3">
        {items.length ? (
          items.map((item, index) => (
            <div key={item.label} className="rounded-2xl border border-border/70 bg-muted/10 px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="font-medium text-foreground">{item.label}</p>
                  <p className="text-sm text-muted-foreground">
                    {item.count} registros • {item.accounts} contas
                  </p>
                </div>
                <Badge variant="outline">#{index + 1}</Badge>
              </div>
            </div>
          ))
        ) : (
          <Alert>
            <AlertTriangle />
            <AlertTitle>Sem recorrência relevante</AlertTitle>
            <AlertDescription>Não há sinais suficientes para este recorte.</AlertDescription>
          </Alert>
        )}
      </div>
    </section>
  );
}

function TimelineItem({ item }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-background/80 px-4 py-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{item.kind}</Badge>
        <span className="text-sm text-muted-foreground">{formatDate(item.date)}</span>
      </div>
      <div className="mt-3 space-y-2">
        <h4 className="font-medium text-foreground">{item.title}</h4>
        <p className="text-sm leading-6 text-muted-foreground">{item.summary}</p>
      </div>
      {item.bullets.length ? (
        <div className="mt-3 flex flex-col gap-2">
          {item.bullets.map((bullet) => (
            <div key={bullet} className="rounded-xl bg-muted/15 px-3 py-2 text-sm text-foreground">
              {bullet}
            </div>
          ))}
        </div>
      ) : null}
      <p className="mt-3 break-all text-xs text-muted-foreground">{item.source}</p>
    </div>
  );
}

function renderInlineText(text) {
  const tokens = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g).filter(Boolean);

  return tokens.map((token, index) => {
    if (token.startsWith("**") && token.endsWith("**")) {
      return (
        <strong key={`${token}-${index}`} className="font-semibold text-foreground">
          {token.slice(2, -2)}
        </strong>
      );
    }

    if (token.startsWith("*") && token.endsWith("*")) {
      return (
        <em key={`${token}-${index}`} className="italic text-foreground/90">
          {token.slice(1, -1)}
        </em>
      );
    }

    if (token.startsWith("`") && token.endsWith("`")) {
      return (
        <code key={`${token}-${index}`} className="rounded bg-muted px-1.5 py-0.5 text-[0.92em] text-foreground">
          {token.slice(1, -1)}
        </code>
      );
    }

    return <Fragment key={`${token}-${index}`}>{token}</Fragment>;
  });
}

function FormattedText({ value, compact = false, listEmoji = "•", leadEmoji = null }) {
  const text = String(value || "").trim();
  if (!text) return null;

  const lineBlocks = text
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);

  if (lineBlocks.length > 1) {
    return (
      <ul className={`flex flex-col ${compact ? "gap-2" : "gap-3"}`}>
        {lineBlocks.map((line) => (
          <li key={line} className="flex items-start gap-3">
            <span className="pt-0.5 text-sm" aria-hidden="true">
              {listEmoji}
            </span>
            <span className={compact ? "text-sm leading-6 text-muted-foreground" : "text-sm leading-7 text-muted-foreground"}>
              {renderInlineText(line)}
            </span>
          </li>
        ))}
      </ul>
    );
  }

  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);

  if (sentences.length >= 3) {
    return (
      <div className={`flex flex-col ${compact ? "gap-2" : "gap-3"}`}>
        <p className={compact ? "text-sm font-medium leading-6 text-foreground" : "text-sm font-medium leading-7 text-foreground"}>
          {leadEmoji ? <span className="mr-2">{leadEmoji}</span> : null}
          {renderInlineText(sentences[0])}
        </p>
        {sentences.slice(1).map((sentence) => (
          <p
            key={sentence}
            className={compact ? "text-sm leading-6 text-muted-foreground" : "text-sm leading-7 text-muted-foreground"}
          >
            {renderInlineText(sentence)}
          </p>
        ))}
      </div>
    );
  }

  return (
    <p className={compact ? "text-sm leading-6 text-muted-foreground" : "text-sm leading-7 text-muted-foreground"}>
      {leadEmoji ? <span className="mr-2">{leadEmoji}</span> : null}
      {renderInlineText(text)}
    </p>
  );
}

function App() {
  const [workspaceView, setWorkspaceView] = useState("commercial");
  const [activeTab, setActiveTab] = useState("pipeline");
  const [detailTab, setDetailTab] = useState("overview");
  const [query, setQuery] = useState("");
  const [trackFilter, setTrackFilter] = useState("Todos");
  const [stageFilter, setStageFilter] = useState("Todos");
  const [signalFilter, setSignalFilter] = useState("Todos");
  const [sourceFilter, setSourceFilter] = useState("Todas");
  const [selectedId, setSelectedId] = useState(intelligenceRecords[0]?.id ?? "");

  const trackOptions = ["Todos", ...Array.from(new Set(intelligenceRecords.map((record) => record.track)))];
  const stageOptions = ["Todos", ...Array.from(new Set(intelligenceRecords.map((record) => record.stage)))];
  const signalOptions = ["Todos", "Dor", "Objeção", "Solução", "Oportunidade", "Piloto"];

  const filteredRecords = useMemo(() => {
    return intelligenceRecords
      .map((record) => ({
        ...record,
        priority: scoreRecord(record),
        formattedDate: formatDate(record.date)
      }))
      .filter((record) => {
        const matchTrack = trackFilter === "Todos" || record.track === trackFilter;
        const matchStage = stageFilter === "Todos" || record.stage === stageFilter;
        const matchSignal = hasSignalMatch(record, signalFilter);
        const matchSource = hasSourceMatch(record, sourceFilter);
        const haystack = normalize(
          [
            record.account,
            record.contact,
            record.summary,
            record.lastMovement,
            record.nextStep,
            ...record.pains,
            ...record.objections,
            ...record.proposedSolutions,
            ...record.opportunities
          ].join(" ")
        );
        const matchQuery = !query.trim() || haystack.includes(normalize(query.trim()));
        return matchTrack && matchStage && matchSignal && matchSource && matchQuery;
      })
      .sort((a, b) => b.priority.score - a.priority.score || a.account.localeCompare(b.account, "pt-BR"));
  }, [query, signalFilter, sourceFilter, stageFilter, trackFilter]);

  const selectedRecord =
    filteredRecords.length > 0
      ? filteredRecords.find((record) => record.id === selectedId) ?? filteredRecords[0]
      : null;

  const topPains = aggregate(filteredRecords, (record) => record.pains).slice(0, 5);
  const topObjections = aggregate(filteredRecords, (record) => record.objections).slice(0, 5);
  const topSolutions = aggregate(filteredRecords, (record) => record.proposedSolutions).slice(0, 5);
  const stageBreakdown = groupCountBy(filteredRecords, "stage");

  const accountCount = new Set(filteredRecords.map((record) => record.account)).size;
  const selectedTimeline = selectedRecord ? buildTimeline(selectedRecord) : [];
  const selectedSynthesis = selectedRecord?.syntheses?.[0] ?? null;
  const isDetailOpen = workspaceView === "commercial" && activeTab === "detail";

  function resetFilters() {
    setQuery("");
    setTrackFilter("Todos");
    setStageFilter("Todos");
    setSignalFilter("Todos");
    setSourceFilter("Todas");
  }

  function handleWorkspaceChange(nextView) {
    setWorkspaceView(nextView);
    setActiveTab(nextView === "commercial" ? "pipeline" : "radar");
  }

  function openOpportunity(recordId) {
    setSelectedId(recordId);
    setWorkspaceView("commercial");
    setActiveTab("detail");
    setDetailTab("overview");
  }

  const opportunityColumns = useMemo(
    () => createOpportunityColumns((priority) => <CompactPriorityBadge priority={priority} />),
    []
  );

  const productAccountColumns = useMemo(
    () =>
      createProductAccountColumns((record) => (
        <Button
          size="sm"
          variant="outline"
          onClick={(event) => {
            event.stopPropagation();
            openOpportunity(record.id);
          }}
        >
          Ver conta
          <ArrowRight data-icon="inline-end" />
        </Button>
      )),
    []
  );

  const commercialNav = [
    { value: "pipeline", label: "Oportunidades" },
    ...(isDetailOpen && selectedRecord ? [{ value: "detail", label: "Detalhe" }] : [])
  ];

  const productNav = [
    { value: "radar", label: "Radar" },
    { value: "accounts", label: "Por conta" }
  ];

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto flex min-h-screen max-w-[1280px] flex-col gap-6 p-4 lg:p-6">
        <Surface className="p-4">
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-4 rounded-[1.5rem] border border-border/60 bg-white px-4 py-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <span className="text-sm font-bold tracking-[0.01em] text-foreground">Bóris</span>
                  <p className="text-sm text-muted-foreground">
                    {workspaceView === "commercial"
                      ? "Radar operacional de oportunidades, com foco no que fazer agora."
                      : "Mapa de recorrências para produto, objeções e padrões de uso."}
                  </p>
                </div>
                <Tabs value={workspaceView} onValueChange={handleWorkspaceChange} className="w-fit">
                  <TabsList className="h-11 rounded-full bg-muted/90 p-1 shadow-inner">
                    <TabsTrigger value="commercial" className="rounded-full px-4">
                      Comercial
                    </TabsTrigger>
                    <TabsTrigger value="product" className="rounded-full px-4">
                      Produto
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-fit">
                <TabsList className="h-11 rounded-full bg-muted/80 p-1 shadow-inner">
                  {(workspaceView === "commercial" ? commercialNav : productNav).map((item) => (
                    <TabsTrigger key={item.value} value={item.value} className="rounded-full px-4">
                      {item.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>

            {workspaceView === "product" ? (
              <>
                <Separator />

                <div className="flex flex-wrap gap-3">
                  <ViewMetric label="Dores dominantes" value={topPains.length} helper="no recorte" />
                  <ViewMetric label="Objeções" value={topObjections.length} helper="pedem resposta" />
                  <ViewMetric label="Soluções" value={topSolutions.length} helper="hipóteses citadas" />
                  <ViewMetric label="Contas" value={accountCount} helper="com sinais válidos" />
                </div>
              </>
            ) : null}

          </div>
        </Surface>

        <div className="flex flex-col gap-6">
                {workspaceView === "commercial" && activeTab === "pipeline" ? (
                    <Surface>
                      <SurfaceHeader
                        eyebrow="Comercial"
                        title="Oportunidades"
                        description="Leitura rápida de contexto, trava e próximo passo para cada conta ativa."
                        action={<Badge variant="outline">{filteredRecords.length} itens</Badge>}
                      />
                    <div className="mt-5 flex flex-col gap-4">
                      <div className="rounded-[1.4rem] border border-border/60 bg-white p-3 shadow-sm">
                        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_11rem_11rem_auto]">
                          <div className="relative">
                            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                              value={query}
                              onChange={(event) => setQuery(event.target.value)}
                              placeholder="Buscar conta, dor, última movimentação ou próximo passo..."
                              className="border-border/70 bg-background/90 pl-10"
                            />
                          </div>
                          <FilterSelect label="Trilho" value={trackFilter} options={trackOptions} onChange={setTrackFilter} />
                          <FilterSelect label="Estágio" value={stageFilter} options={stageOptions} onChange={setStageFilter} />
                          <Button variant="ghost" onClick={resetFilters} className="justify-self-start lg:justify-self-end">
                            Limpar
                          </Button>
                        </div>

                        {[query.trim() ? `Busca: ${query.trim()}` : null, trackFilter !== "Todos" ? trackFilter : null, stageFilter !== "Todos" ? stageFilter : null].filter(Boolean).length ? (
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            {[query.trim() ? `Busca: ${query.trim()}` : null, trackFilter !== "Todos" ? trackFilter : null, stageFilter !== "Todos" ? stageFilter : null]
                              .filter(Boolean)
                              .map((item) => (
                                <Badge key={item} variant="outline" className="bg-muted/40">
                                  {item}
                                </Badge>
                              ))}
                          </div>
                        ) : null}
                      </div>

                      <OpportunityDataTable
                        data={filteredRecords}
                        columns={opportunityColumns}
                        selectedId={selectedRecord?.id}
                        onRowClick={openOpportunity}
                        emptyState={
                          <Alert>
                            <AlertTriangle />
                            <AlertTitle>Nenhuma oportunidade no recorte</AlertTitle>
                            <AlertDescription>Ajuste a busca ou os filtros para voltar a uma conta válida.</AlertDescription>
                          </Alert>
                        }
                      />
                    </div>
                  </Surface>
                ) : null}

                {workspaceView === "commercial" && activeTab === "detail" ? (
                  selectedRecord ? (
                    <Surface className="p-6">
                      <div className="flex flex-col gap-6">
                        <div className="space-y-4">
                          <Breadcrumb>
                            <BreadcrumbList>
                              <BreadcrumbItem>
                                <BreadcrumbPage>Pipeline</BreadcrumbPage>
                              </BreadcrumbItem>
                              <BreadcrumbSeparator />
                              <BreadcrumbItem>
                                <BreadcrumbPage>{selectedRecord.account}</BreadcrumbPage>
                              </BreadcrumbItem>
                            </BreadcrumbList>
                          </Breadcrumb>

                          <div className="rounded-[1.7rem] border border-border/60 bg-white px-5 py-5 shadow-sm">
                            <div className="flex flex-wrap items-start justify-between gap-4">
                              <div className="space-y-2">
                                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary/80">Conta</p>
                                <h2 className="text-[2.2rem] font-bold tracking-tight text-foreground">{selectedRecord.account}</h2>
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge variant="secondary">{selectedRecord.stage}</Badge>
                                  <CompactPriorityBadge priority={selectedRecord.priority} />
                                  <span className="text-xs text-muted-foreground">{formatDate(selectedRecord.date)}</span>
                                </div>
                                <p className="text-sm text-muted-foreground">{selectedRecord.contact}</p>
                              </div>
                              <Button variant="outline" onClick={() => setActiveTab("pipeline")}>
                                <ArrowLeft data-icon="inline-start" />
                                Voltar ao pipeline
                              </Button>
                            </div>
                          </div>
                        </div>

                        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(20rem,0.85fr)]">
                          <div className="flex flex-col gap-4">
                            <DetailSection label="Agora" title="Próximo passo" emphasis>
                              <FormattedText value={selectedRecord.nextStep} compact listEmoji="•" leadEmoji={null} />
                            </DetailSection>

                            <DetailSection
                              label="Painel"
                              title="Resumo da conta"
                              description="Leitura contínua da oportunidade para tomada de decisão."
                            >
                              <FormattedText value={selectedRecord.summary} leadEmoji={null} />
                            </DetailSection>

                            <DetailSection
                              label="Contexto"
                              title="Síntese"
                              description="Consolidação da conversa, hipótese e momento da conta."
                            >
                              <FormattedText
                                value={selectedSynthesis?.summary ?? "Ainda não há síntese consolidada para esta conta."}
                                leadEmoji={null}
                              />
                            </DetailSection>
                          </div>

                          <div className="flex flex-col gap-4">
                            <DetailSection label="Leitura" title="Última movimentação">
                              <FormattedText value={selectedRecord.lastMovement} compact listEmoji="•" leadEmoji={null} />
                            </DetailSection>
                            <DetailSection label="Risco" title="Principal trava">
                              <FormattedText
                                value={selectedRecord.objections[0] ?? "Sem trava crítica registrada."}
                                compact
                                listEmoji="•"
                                leadEmoji={null}
                              />
                            </DetailSection>
                            <DetailSection
                              label="Pessoas"
                              title="Stakeholders"
                              description="Quem apareceu ou precisa entrar na conversa."
                            >
                              <div className="flex flex-wrap gap-2">
                                {selectedRecord.stakeholders.map((stakeholder) => (
                                  <Badge key={stakeholder} variant="outline" className="bg-muted/30">
                                    {stakeholder}
                                  </Badge>
                                ))}
                              </div>
                            </DetailSection>
                          </div>
                        </div>

                        <Tabs value={detailTab} onValueChange={setDetailTab} className="gap-4">
                          <TabsList className="h-11 rounded-full bg-muted/70 p-1">
                            <TabsTrigger value="overview" className="rounded-full px-4">Contexto</TabsTrigger>
                            <TabsTrigger value="signals" className="rounded-full px-4">Sinais</TabsTrigger>
                            <TabsTrigger value="timeline" className="rounded-full px-4">Linha do tempo</TabsTrigger>
                          </TabsList>

                          <TabsContent value="overview" className="mt-0">
                            <div className="grid gap-4 lg:grid-cols-2">
                              <DetailSection label="Conta" title="Leitura estratégica" description="O que essa oportunidade representa agora.">
                                <FormattedText value={selectedRecord.summary} leadEmoji={null} />
                              </DetailSection>
                              <DetailSection label="Movimento" title="Leitura mais recente" description="O último avanço consolidado da conversa.">
                                <FormattedText value={selectedRecord.lastMovement} leadEmoji={null} />
                              </DetailSection>
                            </div>
                          </TabsContent>

                          <TabsContent value="signals" className="mt-0">
                            <div className="grid gap-4 lg:grid-cols-2">
                              <DetailSection label="Sinais" title="Dores">
                                <div className="flex flex-col gap-3">
                                  {(selectedRecord.pains.length ? selectedRecord.pains : ["Sem dor principal registrada."]).map((pain) => (
                                      <div key={pain} className="rounded-2xl border border-border/60 bg-white px-4 py-3 text-sm text-foreground shadow-xs">
                                      {pain}
                                    </div>
                                  ))}
                                </div>
                              </DetailSection>
                              <DetailSection label="Resposta" title="Soluções e hipóteses">
                                <div className="flex flex-col gap-3">
                                  {(selectedRecord.proposedSolutions.length
                                    ? selectedRecord.proposedSolutions
                                    : ["Sem solução proposta registrada ainda."]).map((solution) => (
                                      <div key={solution} className="rounded-2xl border border-border/60 bg-white px-4 py-3 text-sm text-foreground shadow-xs">
                                        {solution}
                                      </div>
                                    ))}
                                </div>
                              </DetailSection>
                            </div>
                          </TabsContent>

                          <TabsContent value="timeline" className="mt-0">
                            <div className="flex flex-col gap-3">
                              {selectedTimeline.length ? (
                                selectedTimeline.map((item) => <TimelineItem key={item.id} item={item} />)
                              ) : (
                                <Alert>
                                  <AlertTriangle />
                                  <AlertTitle>Ainda sem histórico suficiente</AlertTitle>
                                  <AlertDescription>
                                    Ainda não há reuniões ou sínteses suficientes para montar a linha do tempo.
                                  </AlertDescription>
                                </Alert>
                              )}
                            </div>
                          </TabsContent>
                        </Tabs>
                      </div>
                    </Surface>
                  ) : (
                    <Alert>
                      <AlertTriangle />
                      <AlertTitle>Sem conta selecionável</AlertTitle>
                      <AlertDescription>Escolha uma oportunidade no pipeline para abrir o detalhe.</AlertDescription>
                    </Alert>
                  )
                ) : null}

                {workspaceView === "product" && activeTab === "radar" ? (
                  <Surface>
                    <SurfaceHeader
                      eyebrow="Produto"
                      title="Radar de produto"
                      description="Recorrências que ajudam a enxergar padrões de dor, objeção e aderência sem poluir a operação comercial."
                    />
                    <div className="mt-5 flex flex-col gap-4">
                      <div className="rounded-[1.4rem] border border-border/60 bg-white p-3 shadow-sm">
                        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_11rem_11rem_auto]">
                          <div className="relative">
                            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                              value={query}
                              onChange={(event) => setQuery(event.target.value)}
                              placeholder="Buscar dor, objeção, solução ou conta..."
                              className="border-border/70 bg-background/90 pl-10"
                            />
                          </div>
                          <FilterSelect label="Trilho" value={trackFilter} options={trackOptions} onChange={setTrackFilter} />
                          <FilterSelect label="Sinal" value={signalFilter} options={signalOptions} onChange={setSignalFilter} />
                          <Button variant="ghost" onClick={resetFilters} className="justify-self-start lg:justify-self-end">
                            Limpar
                          </Button>
                        </div>
                      </div>

                      <div className="grid gap-4 xl:grid-cols-2">
                        <SignalPanel
                          title="O que mais trava avanço"
                          description="Dores que aparecem repetidamente e puxam atraso ou ruído."
                          icon={AlertTriangle}
                          items={topPains}
                        />
                        <SignalPanel
                          title="O que mais pede resposta"
                          description="Objeções que ainda exigem posicionamento melhor de produto ou oferta."
                          icon={CircleHelp}
                          items={topObjections}
                        />
                        <SignalPanel
                          title="O que mais sinaliza fit"
                          description="Hipóteses e soluções que aparecem como caminho promissor."
                          icon={Lightbulb}
                          items={topSolutions}
                        />
                      </div>

                      <div className="rounded-3xl border border-border/60 bg-white px-5 py-5 shadow-sm">
                        <div className="space-y-1">
                          <h3 className="flex items-center gap-2 text-base font-semibold text-foreground">
                            <UsersRound className="size-4" />
                            Distribuição por estágio
                          </h3>
                          <p className="text-sm text-muted-foreground">Leitura simples de onde os sinais estão se acumulando.</p>
                        </div>
                        <div className="mt-4 flex flex-col gap-4">
                          {stageBreakdown.map((item) => (
                            <div key={item.label} className="space-y-2">
                              <div className="flex items-center justify-between text-sm">
                                <span className="font-medium text-foreground">{item.label}</span>
                                <span className="text-muted-foreground">{item.count}</span>
                              </div>
                              <div className="h-2 rounded-full bg-muted/90">
                                <div
                                  className="h-2 rounded-full bg-primary"
                                  style={{ width: `${Math.max((item.count / Math.max(filteredRecords.length, 1)) * 100, 8)}%` }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </Surface>
                ) : null}

                {workspaceView === "product" && activeTab === "accounts" ? (
                  <Surface>
                    <SurfaceHeader
                      eyebrow="Produto"
                      title="Contas com sinais"
                      description="Conta por conta, para aprofundar onde o radar está ficando mais rico."
                      action={<Badge variant="outline">{accountCount} contas</Badge>}
                    />
                    <div className="mt-5 flex flex-col gap-4">
                      <div className="rounded-[1.4rem] border border-border/60 bg-white p-3 shadow-sm">
                        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_11rem_11rem_auto]">
                          <div className="relative">
                            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                              value={query}
                              onChange={(event) => setQuery(event.target.value)}
                              placeholder="Buscar conta, dor, resumo ou solução..."
                              className="border-border/70 bg-background/90 pl-10"
                            />
                          </div>
                          <FilterSelect label="Trilho" value={trackFilter} options={trackOptions} onChange={setTrackFilter} />
                          <FilterSelect label="Sinal" value={signalFilter} options={signalOptions} onChange={setSignalFilter} />
                          <Button variant="ghost" onClick={resetFilters} className="justify-self-start lg:justify-self-end">
                            Limpar
                          </Button>
                        </div>
                      </div>

                      <OpportunityDataTable
                        data={filteredRecords}
                        columns={productAccountColumns}
                        selectedId={selectedRecord?.id}
                        onRowClick={openOpportunity}
                        emptyState={
                          <Alert>
                            <AlertTriangle />
                            <AlertTitle>Nenhuma conta no recorte</AlertTitle>
                            <AlertDescription>Ajuste a busca ou os filtros para voltar a uma conta válida.</AlertDescription>
                          </Alert>
                        }
                      />
                    </div>
                  </Surface>
                ) : null}
        </div>
      </main>
    </div>
  );
}

export default App;
