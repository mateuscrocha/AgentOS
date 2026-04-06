import { startTransition, useDeferredValue, useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Activity, AlertTriangle, Calendar, FileText, Filter, Search, Shield, UserCog, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useUserRoles } from "@/hooks/use-user-roles";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { AdminPageHeader } from "@/components/layout/AdminPageHeader";
import { ListSectionHeader } from "@/components/dashboard/ListSectionHeader";
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
    queryKey: ["system-events", currentStartISO, currentEndISO, entityType, eventType, page],
    queryFn: async () => {
      let query = supabase
        .from("events")
        .select("*", { count: "exact" })
        .gte("created_at", currentStartISO)
        .lte("created_at", currentEndISO)
        .order("created_at", { ascending: false });

      if (entityType !== "all") query = query.eq("entity_type", entityType);
      if (eventType !== "all") query = query.eq("event_type", eventType);

      const { data, error, count } = await query.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

      if (error) throw error;
      return {
        events: (data ?? []) as AuditEvent[],
        total: count ?? 0,
      };
    },
    enabled: isSystemAdmin,
    placeholderData: keepPreviousData,
  });

  const allEvents = eventsQuery.data?.events ?? [];
  const totalEventsInPeriod = eventsQuery.data?.total ?? 0;
  const hasLocalOnlyFilters = quickFilter !== "all" || !!deferredSearch.trim();

  const eventTypes = useMemo(() => {
    return [...new Set(allEvents.map((event) => event.event_type).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  }, [allEvents]);

  const filteredEvents = useMemo(() => {
    const search = deferredSearch.trim().toLowerCase();

    return allEvents.filter((event) => {
      if (!matchesAuditQuickFilter(event, quickFilter)) return false;
      if (search && !buildSystemEventSearchText(event).includes(search)) return false;
      return true;
    });
  }, [allEvents, quickFilter, deferredSearch]);

  const overview = useMemo(() => buildAuditOverview(filteredEvents), [filteredEvents]);
  const dailySeries = useMemo(() => buildDailyAuditSeries(filteredEvents, currentRange.from, currentRange.to), [filteredEvents, currentRange.from, currentRange.to]);
  const activeBarMax = Math.max(1, ...dailySeries.map((item) => item.count));

  const totalPages = Math.max(
    1,
    Math.ceil((hasLocalOnlyFilters ? filteredEvents.length : totalEventsInPeriod) / PAGE_SIZE),
  );
  const pagedEvents = hasLocalOnlyFilters ? filteredEvents : allEvents;

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
      sortable: true,
      sortValue: (event) => event.created_at,
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
      sortable: true,
      sortValue: (event) => getEventSummary(event),
      render: (event) => {
        const severity = getAuditSeverity(event);
        const outcome = getAuditOutcome(event);
        return (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={severityBadgeClass(severity)}>{labelSeverity(severity)}</Badge>
              <Badge variant="outline" className={outcomeBadgeClass(outcome)}>{labelOutcome(outcome)}</Badge>
              <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">{humanizeEventType(event.event_type)}</Badge>
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
      sortable: true,
      sortValue: (event) => getEventActorLabel(event),
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
      sortable: true,
      sortValue: (event) => getEventTargetLabel(event),
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
      sortable: true,
      sortValue: (event) => getEventOriginLabel(event),
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
      <div className="space-y-6 lg:space-y-7">
        <AdminPageHeader
          breadcrumbItems={[{ label: "Central de Comando", href: "/" }, { label: "Eventos" }]}
          title="Auditoria do Sistema"
          description="Monitore acessos, falhas e ações sensíveis com leitura direta para investigação operacional."
        />

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {[
            {
              label: "Eventos no recorte",
              value: overview.total.toLocaleString("pt-BR"),
              note: "Volume de auditoria após os filtros ativos.",
              icon: Activity,
            },
            {
              label: "Falhas detectadas",
              value: overview.failures.toLocaleString("pt-BR"),
              note: "Erros, bloqueios ou negações registradas.",
              icon: AlertTriangle,
            },
            {
              label: "Ações sensíveis",
              value: overview.sensitive.toLocaleString("pt-BR"),
              note: "Mudanças administrativas e operações críticas.",
              icon: Shield,
            },
            {
              label: "Atores únicos",
              value: overview.uniqueActors.toLocaleString("pt-BR"),
              note: "Usuários ou processos distintos no período.",
              icon: Users,
            },
            {
              label: "Ações admin",
              value: overview.adminActions.toLocaleString("pt-BR"),
              note: "Alterações ligadas a papéis e gestão.",
              icon: UserCog,
            },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="rounded-[24px] border border-amber-200/70 bg-gradient-to-b from-white to-amber-50/60 p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-amber-800">{item.label}</p>
                  <div className="rounded-full bg-amber-100 p-2 text-amber-700">
                    <Icon className="h-4 w-4" />
                  </div>
                </div>
                <div className={cn(
                  "mt-3 text-3xl font-semibold tracking-[-0.03em] text-slate-950",
                  item.label === "Falhas detectadas" && overview.failures > 0 && "text-rose-700",
                )}>
                  {item.value}
                </div>
                <p className="mt-2 text-sm text-slate-600">{item.note}</p>
              </div>
            );
          })}
        </section>

        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-950">Filtros</p>
              <p className="text-sm text-slate-600">Refine o recorte por período, entidade, tipo e sinais prioritários.</p>
            </div>
            {activeFilters.length > 0 ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={clearAllFilters}
                className="border-amber-200 bg-white text-amber-950 hover:border-amber-400 hover:bg-amber-50"
              >
                Limpar filtros
              </Button>
            ) : null}
          </div>

          <div className="grid gap-3 lg:grid-cols-[1.1fr_1fr_220px_260px]">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.08em] text-slate-500">
                <Calendar className="h-3.5 w-3.5" />
                Período
              </div>
              <div className="flex min-h-10 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3">
                <PeriodFilter
                  value={selectedPeriod}
                  customRange={customRange}
                  onChange={(period, range) => {
                    setSelectedPeriod(period);
                    setCustomRange(period === "custom" ? range : undefined);
                  }}
                />
                <span className="text-xs text-slate-500">{ADMIN_MICROCOPY.labels.selectedPeriod}: {periodLabel}</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.08em] text-slate-500">
                <Search className="h-3.5 w-3.5" />
                Busca
              </div>
              <div className="flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3">
                <Search className="h-4 w-4 text-slate-400" />
                <Input
                  value={searchTerm}
                  onChange={(event) => startTransition(() => setSearchTerm(event.target.value))}
                  placeholder="Usuário, alvo, IP, código ou resumo"
                  className="border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.08em] text-slate-500">
                <Filter className="h-3.5 w-3.5" />
                Entidade
              </div>
              <Select value={entityType} onValueChange={setEntityType}>
                <SelectTrigger className="h-10 border-slate-200 bg-slate-50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ENTITY_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.08em] text-slate-500">
                <FileText className="h-3.5 w-3.5" />
                Tipo de evento
              </div>
              <Select value={eventType} onValueChange={setEventType}>
                <SelectTrigger className="h-10 border-slate-200 bg-slate-50">
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

          <div className="mt-4 space-y-3">
            <div className="flex flex-wrap gap-2">
              {QUICK_FILTERS.map((option) => {
                const active = quickFilter === option.value;
                return (
                  <Button
                    key={option.value}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setQuickFilter(option.value)}
                    className={cn(
                      "rounded-full border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-white",
                      active && "border-amber-600 bg-amber-600 text-white hover:border-amber-700 hover:bg-amber-700",
                    )}
                  >
                    {option.label}
                  </Button>
                );
              })}
            </div>
            <FilterChips items={activeFilters} onClearAll={clearAllFilters} clearLabel="Limpar tudo" />
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
          <Card className="rounded-[24px] border-slate-200 bg-white shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Alertas recentes</CardTitle>
              <CardDescription>Priorize eventos sensíveis e falhas antes de entrar no log completo.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {overview.recentAlerts.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-muted-foreground">
                  Nenhum alerta relevante no recorte atual.
                </div>
              ) : (
                overview.recentAlerts.map((alert) => (
                  <button
                    key={alert.id}
                    type="button"
                    onClick={() => setSelectedEvent(filteredEvents.find((event) => event.id === alert.id) ?? null)}
                    className="flex w-full items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left transition-colors hover:bg-amber-50/50"
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

          <Card className="rounded-[24px] border-slate-200 bg-white shadow-sm">
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
                          item.count > 0 ? "bg-amber-500/80" : "bg-slate-200",
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
              <p className="mt-4 text-xs text-slate-500">
                A linha do tempo usa paginação no banco para manter a investigação mais rápida em períodos longos.
              </p>
            </CardContent>
          </Card>
        </div>

        <ListSectionHeader
          title="Linha do tempo de auditoria"
          count={(hasLocalOnlyFilters ? filteredEvents.length : totalEventsInPeriod).toLocaleString("pt-BR")}
          statusLabel={
            hasLocalOnlyFilters
              ? "busca rápida aplicada sobre a página carregada"
              : activeFilters.length > 0
                ? ADMIN_MICROCOPY.listStatus.filtered
                : ADMIN_MICROCOPY.listStatus.periodRecords
          }
          isLoading={eventsQuery.isLoading}
        />

        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <BorisTable
            columns={columns as BorisColumn<AuditEvent>[]}
            data={pagedEvents}
            keyExtractor={(event) => event.id}
            onRowClick={(event) => setSelectedEvent(event)}
            page={page}
            pageSize={PAGE_SIZE}
            totalCount={hasLocalOnlyFilters ? filteredEvents.length : totalEventsInPeriod}
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
        </div>

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
                    <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">
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
