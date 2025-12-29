import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useUserRoles } from "@/hooks/use-user-roles";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { BorisTable, type BorisColumn } from "@/components/ui/boris-table";
import { AdminPageHeader } from "@/components/layout/AdminPageHeader";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import AccessDenied from "./AccessDenied";
import { Calendar, Filter, FileText, Activity } from "lucide-react";
import { PeriodFilter } from "@/components/group-dashboard/PeriodFilter";
import { getDateRange, PeriodType, DateRange } from "@/components/group-dashboard/period-utils";
import { formatDateTimeBR, formatDateTimeSecondsBR, formatDateSimpleBR } from "@/lib/date";

interface Event {
  id: string;
  event_type: string;
  entity_type: string;
  entity_id: string;
  user_id: string | null;
  metadata: Record<string, any> | null;
  created_at: string;
}

 

const PAGE_SIZE = 100;

const ENTITY_TYPES = [
  { value: "all", label: "Todos" },
  { value: "organization", label: "Organization" },
  { value: "group", label: "Group" },
  { value: "member", label: "Member" },
  { value: "message", label: "Message" },
];

export default function SystemEvents() {
  const { loading: authLoading } = useAuth();
  const { isSystemAdmin, isLoading: rolesLoading } = useUserRoles();
  
  const [page, setPage] = useState(1);
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>('7d');
  const [customRange, setCustomRange] = useState<DateRange | undefined>();
  const [entityType, setEntityType] = useState("all");
  const [eventType, setEventType] = useState("all");
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const currentRange = getDateRange(selectedPeriod, customRange);
  const currentStartISO = currentRange.from.toISOString();
  const currentEndISO = currentRange.to.toISOString();
  const periodLabel = `${formatDateSimpleBR(currentRange.from)} — ${formatDateSimpleBR(currentRange.to)}`;

  // Fetch distinct event types for dropdown
  const { data: eventTypes } = useQuery({
    queryKey: ["event-types", currentStartISO, currentEndISO],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("event_type")
        .gte("created_at", currentStartISO)
        .lte("created_at", currentEndISO)
        .order("event_type");
      
      if (error) throw error;
      const unique = [...new Set(data?.map(e => e.event_type) || [])];
      return unique;
    },
    enabled: isSystemAdmin,
  });

  // Fetch events with filters
  const { data: eventsData, isLoading: eventsLoading } = useQuery({
    queryKey: ["system-events", page, selectedPeriod, customRange?.from?.toISOString(), customRange?.to?.toISOString(), entityType, eventType],
    queryFn: async () => {
      let query = supabase
        .from("events")
        .select("*", { count: "exact" })
        .gte("created_at", currentStartISO)
        .lte("created_at", currentEndISO)
        .order("created_at", { ascending: false })
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

      if (entityType !== "all") {
        query = query.eq("entity_type", entityType);
      }
      if (eventType !== "all") {
        query = query.eq("event_type", eventType);
      }

      const { data, error, count } = await query;
      if (error) throw error;
      return { events: data as Event[], total: count || 0 };
    },
    enabled: isSystemAdmin,
  });

  if (authLoading || rolesLoading) {
    return (
      <AdminLayout title="Eventos do Sistema" subtitle="Carregando...">
        <LoadingState message="Verificando permissões..." />
      </AdminLayout>
    );
  }

  if (!isSystemAdmin) {
    return <AccessDenied />;
  }

  const columns: BorisColumn<Event>[] = [
    {
      key: "created_at",
      header: "Data",
      render: (event) => formatDateTimeBR(event.created_at),
    },
    {
      key: "event_type",
      header: "Tipo",
      render: (event) => (
        <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
          {event.event_type}
        </span>
      ),
    },
    {
      key: "entity_type",
      header: "Entidade",
      render: (event) => (
        <span className="text-muted-foreground capitalize">{event.entity_type}</span>
      ),
    },
    {
      key: "entity_id",
      header: "ID",
      hideOn: "md" as any,
      render: (event) => (
        <span className="font-mono text-xs text-muted-foreground">
          {event.entity_id.slice(0, 8)}...
        </span>
      ),
    },
    {
      key: "metadata",
      header: "Resumo",
      hideOn: "sm" as any,
      render: (event) => {
        if (!event.metadata) return <span className="text-muted-foreground">-</span>;
        const preview = JSON.stringify(event.metadata).slice(0, 50);
        return (
          <span className="text-xs text-muted-foreground">
            {preview}{preview.length >= 50 ? "..." : ""}
          </span>
        );
      },
    },
  ];

  return (
    <AdminLayout title="Eventos do Sistema" subtitle="Auditoria e observabilidade">
      <div className="space-y-6">
        <AdminPageHeader
          breadcrumbItems={[{ label: "Central de Comando", href: "/" }, { label: "Eventos" }]}
          title="Eventos do Sistema"
          description="Auditoria e observabilidade"
          filters={(
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <PeriodFilter
                  value={selectedPeriod}
                  customRange={customRange}
                  onChange={(p, r) => { setSelectedPeriod(p); setCustomRange(p === 'custom' ? r : undefined); setPage(1); }}
                />
                <span className="text-xs text-muted-foreground">Período: {periodLabel}</span>
              </div>

              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Select value={entityType} onValueChange={setEntityType}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ENTITY_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <Select value={eventType} onValueChange={setEventType}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Tipo de evento" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os tipos</SelectItem>
                    {eventTypes?.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          showClearFilters={selectedPeriod !== '7d' || !!customRange || entityType !== 'all' || eventType !== 'all'}
          onClearFilters={() => { setSelectedPeriod('7d'); setCustomRange(undefined); setEntityType('all'); setEventType('all'); setPage(1); }}
          filteredKpis={(
            <StatsCard
              title="Eventos no período"
              value={eventsData?.total ?? '—'}
              icon={Activity}
              variant="kpi"
            />
          )}
        />

        {/* Events Table */}
        <BorisTable
          columns={columns as any}
          data={eventsData?.events ?? []}
          keyExtractor={(event) => event.id}
          onRowClick={(event) => setSelectedEvent(event)}
          page={page}
          pageSize={PAGE_SIZE}
          totalCount={eventsData?.total}
          onPageChange={setPage}
          loading={eventsLoading}
          emptyIcon={FileText}
          emptyMessage="Nenhum evento encontrado no período selecionado."
        />

        {/* Event Detail Drawer */}
        <Sheet open={!!selectedEvent} onOpenChange={() => setSelectedEvent(null)}>
          <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Detalhes do Evento</SheetTitle>
            </SheetHeader>
            {selectedEvent && (
              <div className="mt-6 space-y-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">ID</label>
                  <p className="font-mono text-sm">{selectedEvent.id}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Tipo de Evento</label>
                  <p className="font-medium">{selectedEvent.event_type}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Tipo de Entidade</label>
                  <p className="capitalize">{selectedEvent.entity_type}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">ID da Entidade</label>
                  <p className="font-mono text-sm">{selectedEvent.entity_id}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Usuário</label>
                  <p className="font-mono text-sm">{selectedEvent.user_id || "-"}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Data</label>
                  <p>{formatDateTimeSecondsBR(selectedEvent.created_at)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Metadata</label>
                  <pre className="mt-2 rounded-lg bg-muted p-4 text-xs overflow-x-auto">
                    {selectedEvent.metadata 
                      ? JSON.stringify(selectedEvent.metadata, null, 2)
                      : "Sem metadata"}
                  </pre>
                </div>
              </div>
            )}
          </SheetContent>
        </Sheet>
      </div>
    </AdminLayout>
  );
}
