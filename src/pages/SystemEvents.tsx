import { startTransition, useDeferredValue, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, AlertTriangle, Calendar, FileText, Filter, Search, Shield, UserCog, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useUserRoles } from "@/hooks/use-user-roles";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { AdminPageHeader } from "@/components/layout/AdminPageHeader";
import { ListSectionHeader } from "@/components/dashboard/ListSectionHeader";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { ADMIN_MICROCOPY } from "@/components/dashboard/admin-microcopy";
import { BorisTable, type BorisColumn } from "@/components/ui/boris-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FilterChips, type FilterChipItem } from "@/components/ui/filter-chips";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/ui/loading-state";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { PeriodFilter } from "@/components/group-dashboard/PeriodFilter";
import { getDateRange, type DateRange, type PeriodType } from "@/components/group-dashboard/period-utils";
import AccessDenied from "./AccessDenied";
import { cn } from "@/lib/utils";
import { formatDateSimpleBR, formatDateTimeBR, formatDateTimeSecondsBR } from "@/lib/date";
import {
  buildAuditOverview,
  buildDailyAuditSeries,
  buildSystemEventSearchText,
  getAuditOutcome,
  getAuditSeverity,
  getEventActorLabel,
  getEventOriginLabel,
  getEventSummary,
  getEventTargetLabel,
  humanizeEventType,
  matchesAuditQuickFilter,
  type AuditEvent,
  type AuditQuickFilter,
} from "@/lib/system-events";

const PAGE_SIZE = 100;
const MAX_EVENTS = 2000;

const ENTITY_TYPES = [
  { value: "all", label: "Todas as entidades" },
  { value: "organization", label: "Organização" },
  { value: "group", label: "Grupo" },
  { value: "member", label: "Membro" },
  { value: "message", label: "Mensagem" },
  { value: "user", label: "Usuário" },
];

const QUICK_FILTERS: Array<{ value: AuditQuickFilter; label: string }> = [
  { value: "all", label: "Tudo" },
  { value: "failures", label: "Falhas" },
  { value: "sensitive", label: "Sensíveis" },
  { value: "admins", label: "Admins" },
  { value: "groups", label: "Grupos" },
];

function severityBadgeClass(severity: ReturnType<typeof getAuditSeverity>) {
  if (severity === "high") return "border-destructive/20 bg-destructive/10 text-destructive";
  if (severity === "medium") return "border-warning/20 bg-warning/10 text-warning";
  return "border-border bg-muted/50 text-muted-foreground";
}

function outcomeBadgeClass(outcome: ReturnType<typeof getAuditOutcome>) {
  if (outcome === "failure") return "border-destructive/20 bg-destructive/10 text-destructive";
  if (outcome === "success") return "border-success/20 bg-success/10 text-success";
  return "border-border bg-muted/50 text-muted-foreground";
}

function labelOutcome(outcome: ReturnType<typeof getAuditOutcome>) {
  if (outcome === "failure") return "Falha";
  if (outcome === "success") return "Sucesso";
  return "Neutro";
}

function labelSeverity(severity: ReturnType<typeof getAuditSeverity>) {
  if (severity === "high") return "Alta";
  if (severity === "medium") return "Média";
  return "Baixa";
}

export default function SystemEvents() {
  const { loading: authLoading } = useAuth();
  const { isSystemAdmin, isLoading: rolesLoading } = useUserRoles();

  const [page, setPage] = useState(1);
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>("7d");
  const [customRange, setCustomRange] = useState<DateRange | undefined>();
  const [entityType, setEntityType] = useState("all");
  const [eventType, setEventType] = useState("all");
  const [quickFilter, setQuickFilter] = useState<AuditQuickFilter>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null);

  const deferredSearch = useDeferredValue(searchTerm);
  const currentRange = getDateRange(selectedPeriod, customRange);
  const currentStartISO = currentRange.from.toISOString();
  const currentEndISO = currentRange.to.toISOString();
  const periodLabel = `${formatDateSimpleBR(currentRange.from)} — ${formatDateSimpleBR(currentRange.to)}`;

  const eventsQuery = useQuery({
    queryKey: ["system-events", currentStartISO, currentEndISO],
    queryFn: async () => {
      const { data, error, count } = await supabase
        .from("events")
        .select("*", { count: "exact" })
        .gte("created_at", currentStartISO)
        .lte("created_at", currentEndISO)
        .order("created_at", { ascending: false })
        .range(0, MAX_EVENTS - 1);

      if (error) throw error;
      return {
        events: (data ?? []) as AuditEvent[],
        total: count ?? 0,
      };
    },
    enabled: isSystemAdmin,
  });

  const allEvents = eventsQuery.data?.events ?? [];
  const totalEventsInPeriod = eventsQuery.data?.total ?? 0;
  const hasTruncation = totalEventsInPeriod > allEvents.length;

  const eventTypes = useMemo(() => {
    return [...new Set(allEvents.map((event) => event.event_type).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  }, [allEvents]);

  const filteredEvents = useMemo(() => {
    const search = deferredSearch.trim().toLowerCase();

    return allEvents.filter((event) => {
      if (entityType !== "all" && event.entity_type !== entityType) return false;
      if (eventType !== "all" && event.event_type !== eventType) return false;
      if (!matchesAuditQuickFilter(event, quickFilter)) return false;
      if (search && !buildSystemEventSearchText(event).includes(search)) return false;
      return true;
    });
  }, [allEvents, entityType, eventType, quickFilter, deferredSearch]);

  const overview = useMemo(() => buildAuditOverview(filteredEvents), [filteredEvents]);
  const dailySeries = useMemo(() => buildDailyAuditSeries(filteredEvents, currentRange.from, currentRange.to), [filteredEvents, currentRange.from, currentRange.to]);
  const activeBarMax = Math.max(1, ...dailySeries.map((item) => item.count));

  const totalPages = Math.max(1, Math.ceil(filteredEvents.length / PAGE_SIZE));
  const pagedEvents = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredEvents.slice(start, start + PAGE_SIZE);
  }, [filteredEvents, page]);

  useEffect(() => {
    setPage(1);
  }, [selectedPeriod, customRange, entityType, eventType, quickFilter, deferredSearch]);

  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [page, totalPages]);

  if (authLoading || rolesLoading) {
    return (
      <AdminLayout title="Eventos do Sistema" subtitle="Carregando...">
        <LoadingState message="Verificando permissões..." />
      </AdminLayout>
    );
  }

  if (!isSystemAdmin) return <AccessDenied />;

  const activeFilters: FilterChipItem[] = [];
  if (selectedPeriod !== "7d") activeFilters.push({ key: "period", label: `Período: ${periodLabel}`, onRemove: () => { setSelectedPeriod("7d"); setCustomRange(undefined); } });
  if (entityType !== "all") activeFilters.push({ key: "entity", label: `Entidade: ${ENTITY_TYPES.find((item) => item.value === entityType)?.label || entityType}`, onRemove: () => setEntityType("all") });
  if (eventType !== "all") activeFilters.push({ key: "type", label: `Tipo: ${eventType}`, onRemove: () => setEventType("all") });
  if (quickFilter !== "all") activeFilters.push({ key: "quick", label: `Atalho: ${QUICK_FILTERS.find((item) => item.value === quickFilter)?.label || quickFilter}`, onRemove: () => setQuickFilter("all") });
  if (searchTerm.trim()) activeFilters.push({ key: "search", label: `Busca: ${searchTerm.trim()}`, onRemove: () => setSearchTerm("") });

  const columns: BorisColumn<AuditEvent>[] = [
    {
      key: "created_at",
      header: "Momento",
      className: "w-[160px]",
      render: (event) => (
        <div className="space-y-1">
          <p className="text-sm font-medium text-card-foreground">{formatDateTimeBR(event.created_at)}</p>
          <p className="font-mono text-[11px] text-muted-foreground">{event.id.slice(0, 8)}...</p>
        </div>
      ),
    },
    {
      key: "signal",
      header: "Sinal",
      className: "min-w-[360px]",
      render: (event) => {
        const severity = getAuditSeverity(event);
        const outcome = getAuditOutcome(event);
        return (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={severityBadgeClass(severity)}>{labelSeverity(severity)}</Badge>
              <Badge variant="outline" className={outcomeBadgeClass(outcome)}>{labelOutcome(outcome)}</Badge>
              <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">{humanizeEventType(event.event_type)}</Badge>
            </div>
            <div>
              <p className="text-sm font-medium text-card-foreground">{getEventSummary(event)}</p>
              <p className="text-xs text-muted-foreground">Tipo bruto: {event.event_type}</p>
            </div>
          </div>
        );
      },
    },
    {
      key: "actor",
      header: "Ator",
      hideOn: "md",
      render: (event) => (
        <div>
          <p className="text-sm text-card-foreground">{getEventActorLabel(event)}</p>
          <p className="text-xs text-muted-foreground capitalize">{event.entity_type}</p>
        </div>
      ),
    },
    {
      key: "target",
      header: "Alvo",
      hideOn: "lg",
      render: (event) => (
        <div>
          <p className="text-sm text-card-foreground">{getEventTargetLabel(event)}</p>
          <p className="font-mono text-xs text-muted-foreground">{event.entity_id}</p>
        </div>
      ),
    },
    {
      key: "origin",
      header: "Origem",
      hideOn: "lg",
      render: (event) => <span className="text-sm text-muted-foreground">{getEventOriginLabel(event)}</span>,
    },
  ];

  const clearAllFilters = () => {
    setSelectedPeriod("7d");
    setCustomRange(undefined);
    setEntityType("all");
    setEventType("all");
    setQuickFilter("all");
    setSearchTerm("");
    setPage(1);
  };

  const investigateByValue = (value: string) => {
    startTransition(() => {
      setSearchTerm(value);
      setSelectedEvent(null);
    });
  };

  return (
    <AdminLayout title="Eventos do Sistema" subtitle="Auditoria e observabilidade">
      <div className="space-y-8">
        <AdminPageHeader
          breadcrumbItems={[{ label: "Central de Comando", href: "/" }, { label: "Eventos" }]}
          title="Auditoria do Sistema"
          description="Monitore acessos, falhas e ações sensíveis em uma superfície de investigação operacional."
          filters={(
            <div className="flex w-full flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <PeriodFilter
                  value={selectedPeriod}
                  customRange={customRange}
                  onChange={(period, range) => {
                    setSelectedPeriod(period);
                    setCustomRange(period === "custom" ? range : undefined);
                  }}
                />
                <span className="text-xs text-muted-foreground">{ADMIN_MICROCOPY.labels.selectedPeriod}: {periodLabel}</span>
              </div>

              <div className="flex min-w-[240px] flex-1 items-center gap-2 rounded-md border border-input bg-background px-3">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                  value={searchTerm}
                  onChange={(event) => startTransition(() => setSearchTerm(event.target.value))}
                  placeholder="Buscar por usuário, alvo, IP, código ou resumo"
                  className="border-0 px-0 shadow-none focus-visible:ring-0"
                />
              </div>

              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Select value={entityType} onValueChange={setEntityType}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ENTITY_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <Select value={eventType} onValueChange={setEventType}>
                  <SelectTrigger className="w-[220px]">
                    <SelectValue placeholder="Tipo de evento" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os tipos</SelectItem>
                    {eventTypes.map((type) => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          showClearFilters={activeFilters.length > 0}
          onClearFilters={clearAllFilters}
          filteredKpis={(
            <>
              <StatsCard
                title="Eventos no recorte"
                value={overview.total.toLocaleString("pt-BR")}
                icon={Activity}
                variant="kpi"
                numericValue
                description="Volume de auditoria após os filtros ativos."
              />
              <StatsCard
                title="Falhas detectadas"
                value={overview.failures.toLocaleString("pt-BR")}
                icon={AlertTriangle}
                variant="kpi"
                numericValue
                valueClassName={overview.failures > 0 ? "text-destructive" : undefined}
                description="Eventos com padrão de erro, bloqueio ou negação."
              />
              <StatsCard
                title="Ações sensíveis"
                value={overview.sensitive.toLocaleString("pt-BR")}
                icon={Shield}
                variant="kpi"
                numericValue
                description="Operações administrativas, autenticação e alteração de papéis."
              />
              <StatsCard
                title="Atores únicos"
                value={overview.uniqueActors.toLocaleString("pt-BR")}
                icon={Users}
                variant="kpi"
                numericValue
                description="Usuários ou processos distintos no recorte atual."
              />
              <StatsCard
                title="Ações admin"
                value={overview.adminActions.toLocaleString("pt-BR")}
                icon={UserCog}
                variant="kpi"
                numericValue
                description="Mudanças ligadas a papéis e contexto administrativo."
              />
            </>
          )}
        />

        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {QUICK_FILTERS.map((option) => {
              const active = quickFilter === option.value;
              return (
                <Button
                  key={option.value}
                  type="button"
                  variant={active ? "default" : "outline"}
                  size="sm"
                  onClick={() => setQuickFilter(option.value)}
                  className={cn("rounded-full", active && "shadow-none")}
                >
                  {option.label}
                </Button>
              );
            })}
          </div>
          <FilterChips items={activeFilters} onClearAll={clearAllFilters} clearLabel="Limpar tudo" />
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
          <Card className="border-border/80 bg-card/95">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Alertas recentes</CardTitle>
              <CardDescription>Priorize eventos sensíveis e falhas antes de entrar no log completo.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {overview.recentAlerts.length === 0 ? (
                <div className="rounded-xl border border-border/70 bg-secondary/20 p-4 text-sm text-muted-foreground">
                  Nenhum alerta relevante no recorte atual.
                </div>
              ) : (
                overview.recentAlerts.map((alert) => (
                  <button
                    key={alert.id}
                    type="button"
                    onClick={() => setSelectedEvent(filteredEvents.find((event) => event.id === alert.id) ?? null)}
                    className="flex w-full items-start justify-between gap-3 rounded-xl border border-border/70 bg-background px-4 py-3 text-left transition-colors hover:bg-secondary/30"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className={severityBadgeClass(alert.severity)}>{labelSeverity(alert.severity)}</Badge>
                        <Badge variant="outline" className={outcomeBadgeClass(alert.outcome)}>{labelOutcome(alert.outcome)}</Badge>
                      </div>
                      <p className="text-sm font-medium text-card-foreground">{alert.summary}</p>
                      <p className="text-xs text-muted-foreground">{alert.typeLabel}</p>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">{formatDateTimeBR(alert.createdAt)}</span>
                  </button>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="border-border/80 bg-card/95">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Ritmo do período</CardTitle>
              <CardDescription>Picos de volume ajudam a contextualizar incidentes e campanhas.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-2 overflow-x-auto pb-1">
                {dailySeries.map((item) => (
                  <div key={item.date} className="flex min-w-[32px] flex-col items-center gap-2">
                    <div className="flex h-32 items-end">
                      <div
                        className={cn(
                          "w-6 rounded-t-md",
                          item.count > 0 ? "bg-primary/80" : "bg-secondary",
                        )}
                        style={{ height: `${Math.max(8, (item.count / activeBarMax) * 100)}%` }}
                        title={`${item.label}: ${item.count}`}
                      />
                    </div>
                    <span className="text-[11px] text-muted-foreground">{item.label}</span>
                    <span className="text-[11px] font-medium text-card-foreground">{item.count}</span>
                  </div>
                ))}
              </div>
              {hasTruncation ? (
                <p className="mt-4 text-xs text-warning">
                  O painel resumiu os primeiros {MAX_EVENTS.toLocaleString("pt-BR")} eventos do período. Refine os filtros para investigar com precisão.
                </p>
              ) : null}
            </CardContent>
          </Card>
        </div>

        <ListSectionHeader
          title="Linha do tempo de auditoria"
          count={filteredEvents.length.toLocaleString("pt-BR")}
          statusLabel={
            hasTruncation
              ? "recorte carregado parcialmente para manter a investigação responsiva"
              : activeFilters.length > 0
                ? ADMIN_MICROCOPY.listStatus.filtered
                : ADMIN_MICROCOPY.listStatus.periodRecords
          }
          isLoading={eventsQuery.isLoading}
        />

        <BorisTable
          columns={columns as BorisColumn<AuditEvent>[]}
          data={pagedEvents}
          keyExtractor={(event) => event.id}
          onRowClick={(event) => setSelectedEvent(event)}
          page={page}
          pageSize={PAGE_SIZE}
          totalCount={filteredEvents.length}
          onPageChange={setPage}
          loading={eventsQuery.isLoading}
          error={eventsQuery.error ? true : false}
          emptyIcon={FileText}
          emptyMessage="Nenhum evento corresponde aos filtros atuais."
          density="comfortable"
          rowClassName={(event) => {
            const severity = getAuditSeverity(event);
            if (severity === "high") return "bg-destructive/[0.03]";
            if (severity === "medium") return "bg-warning/[0.03]";
            return undefined;
          }}
        />

        <Sheet open={!!selectedEvent} onOpenChange={() => setSelectedEvent(null)}>
          <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
            <SheetHeader>
              <SheetTitle>Investigação do evento</SheetTitle>
            </SheetHeader>
            {selectedEvent ? (
              <div className="mt-6 space-y-6">
                <div className="rounded-2xl border border-border/80 bg-card p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className={severityBadgeClass(getAuditSeverity(selectedEvent))}>
                      Severidade {labelSeverity(getAuditSeverity(selectedEvent))}
                    </Badge>
                    <Badge variant="outline" className={outcomeBadgeClass(getAuditOutcome(selectedEvent))}>
                      {labelOutcome(getAuditOutcome(selectedEvent))}
                    </Badge>
                    <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">
                      {humanizeEventType(selectedEvent.event_type)}
                    </Badge>
                  </div>
                  <p className="mt-3 text-base font-medium text-card-foreground">{getEventSummary(selectedEvent)}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Registrado em {formatDateTimeSecondsBR(selectedEvent.created_at)}
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Quem fez</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <p className="font-medium text-card-foreground">{getEventActorLabel(selectedEvent)}</p>
                      <Button type="button" variant="outline" size="sm" onClick={() => investigateByValue(getEventActorLabel(selectedEvent))}>
                        Ver mesmo ator
                      </Button>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Alvo afetado</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-1 text-sm">
                      <p className="font-medium text-card-foreground">{getEventTargetLabel(selectedEvent)}</p>
                      <p className="font-mono text-xs text-muted-foreground">{selectedEvent.entity_id}</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Origem</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <p className="font-medium text-card-foreground">{getEventOriginLabel(selectedEvent)}</p>
                      <Button type="button" variant="outline" size="sm" onClick={() => investigateByValue(getEventOriginLabel(selectedEvent))}>
                        Ver mesma origem
                      </Button>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Classificação</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-1 text-sm">
                      <p className="text-card-foreground">Tipo bruto: <span className="font-mono">{selectedEvent.event_type}</span></p>
                      <p className="text-card-foreground">Entidade: <span className="capitalize">{selectedEvent.entity_type}</span></p>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Payload técnico</CardTitle>
                    <CardDescription>JSON completo para auditoria e correlação.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <pre className="overflow-x-auto rounded-xl bg-muted p-4 text-xs">
                      {selectedEvent.metadata ? JSON.stringify(selectedEvent.metadata, null, 2) : "Sem metadata"}
                    </pre>
                  </CardContent>
                </Card>
              </div>
            ) : null}
          </SheetContent>
        </Sheet>
      </div>
    </AdminLayout>
  );
}
