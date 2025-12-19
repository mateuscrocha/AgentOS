import { useState } from "react";
import { useParams, NavLink } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useUserRoles } from "@/hooks/use-user-roles";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { DataTable } from "@/components/ui/data-table";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import AccessDenied from "./AccessDenied";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar, FileText, Users, MessageSquare, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

interface Event {
  id: string;
  event_type: string;
  entity_type: string;
  entity_id: string;
  user_id: string | null;
  metadata: Record<string, any> | null;
  created_at: string;
}

interface Column<T> {
  key: string;
  header: string;
  render?: (item: T) => React.ReactNode;
  className?: string;
}

const PAGE_SIZE = 20;

const DATE_RANGES = [
  { value: "24h", label: "Últimas 24 horas" },
  { value: "7d", label: "Últimos 7 dias" },
  { value: "30d", label: "Últimos 30 dias" },
];

export default function GroupEvents() {
  const { groupId } = useParams<{ groupId: string }>();
  const { loading: authLoading } = useAuth();
  const { hasGroupAccess, isLoading: rolesLoading } = useUserRoles();
  
  const [page, setPage] = useState(1);
  const [dateRange, setDateRange] = useState("7d");
  const [eventType, setEventType] = useState("all");
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);


  const getDateFilter = () => {
    const now = new Date();
    switch (dateRange) {
      case "24h":
        return new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      case "7d":
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      case "30d":
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      default:
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    }
  };

  // Fetch group info for breadcrumbs
  const { data: group } = useQuery({
    queryKey: ["group", groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("groups")
        .select("id, name, organization_id")
        .eq("id", groupId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!groupId,
  });

  const hasAccess = groupId ? hasGroupAccess(groupId, group?.organization_id) : false;

  // Fetch organization info for breadcrumbs
  const { data: org } = useQuery({
    queryKey: ["org", group?.organization_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organizations")
        .select("id, name")
        .eq("id", group!.organization_id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!group?.organization_id,
  });

  // Fetch distinct event types for this group
  const { data: eventTypes } = useQuery({
    queryKey: ["group-event-types", groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("event_type")
        .eq("entity_type", "group")
        .eq("entity_id", groupId!)
        .gte("created_at", getDateFilter())
        .order("event_type");
      
      if (error) throw error;
      const unique = [...new Set(data?.map(e => e.event_type) || [])];
      return unique;
    },
    enabled: !!groupId && hasAccess,
  });

  // Fetch events for this group
  const { data: eventsData, isLoading: eventsLoading } = useQuery({
    queryKey: ["group-events", groupId, page, dateRange, eventType],
    queryFn: async () => {
      let query = supabase
        .from("events")
        .select("*", { count: "exact" })
        .eq("entity_type", "group")
        .eq("entity_id", groupId!)
        .gte("created_at", getDateFilter())
        .order("created_at", { ascending: false })
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

      if (eventType !== "all") {
        query = query.eq("event_type", eventType);
      }

      const { data, error, count } = await query;
      if (error) throw error;
      return { events: data as Event[], total: count || 0 };
    },
    enabled: !!groupId && hasAccess,
  });

  if (authLoading || rolesLoading) {
    return (
      <AdminLayout title="Eventos do Grupo" subtitle="Carregando...">
        <LoadingState message="Verificando permissões..." />
      </AdminLayout>
    );
  }

  // Access is enforced by RLS; show AccessDenied only after evaluating group access context
  if (!hasAccess && groupId && group === null) {
    return <AccessDenied />;
  }

  const columns: Column<Event>[] = [
    {
      key: "created_at",
      header: "Data",
      render: (event) => format(new Date(event.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR }),
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
      key: "metadata",
      header: "Resumo",
      render: (event) => {
        if (!event.metadata) return <span className="text-muted-foreground">-</span>;
        const preview = JSON.stringify(event.metadata).slice(0, 60);
        return (
          <span className="text-xs text-muted-foreground">
            {preview}{preview.length >= 60 ? "..." : ""}
          </span>
        );
      },
    },
  ];

  const tabs = [
    { label: "Visão Geral", href: `/group/${groupId}`, end: true },
    { label: "Members", href: `/group/${groupId}/members`, icon: Users },
    { label: "Messages", href: `/group/${groupId}/messages`, icon: MessageSquare },
    { label: "Atividade", href: `/group/${groupId}/events`, icon: Activity },
  ];

  return (
    <AdminLayout title="Eventos do Grupo" subtitle={group?.name || "Carregando..."}>
      <div className="space-y-6 animate-fade-in">
        <Breadcrumbs
          items={[
            { label: "Sistema", href: "/system" },
            ...(org ? [{ label: org.name, href: `/org/${org.id}` }] : []),
            ...(group ? [{ label: group.name, href: `/group/${group.id}` }] : []),
            { label: "Atividade" },
          ]}
        />

        {/* Header with tabs */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex items-center gap-3 p-4 border-b border-border">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <Activity className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-card-foreground">Atividade</h2>
              <p className="text-sm text-muted-foreground">
                Eventos de auditoria do grupo
              </p>
            </div>
          </div>
          
          <div className="flex gap-1 p-2 bg-secondary/30">
            {tabs.map((tab) => (
              <NavLink
                key={tab.href}
                to={tab.href}
                end={tab.end}
                className={({ isActive }) => cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                  isActive 
                    ? "bg-card text-foreground shadow-sm" 
                    : "text-muted-foreground hover:text-foreground hover:bg-card/50"
                )}
              >
                {tab.icon && <tab.icon className="h-4 w-4" />}
                {tab.label}
              </NavLink>
            ))}
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DATE_RANGES.map((range) => (
                  <SelectItem key={range.value} value={range.value}>
                    {range.label}
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

        {/* Events Table */}
        {eventsLoading ? (
          <LoadingState message="Carregando eventos..." />
        ) : !eventsData?.events?.length ? (
          <EmptyState
            icon={FileText}
            title="Nenhum evento encontrado"
            message="Nenhum evento encontrado no período selecionado."
          />
        ) : (
          <DataTable
            columns={columns}
            data={eventsData.events}
            keyExtractor={(event) => event.id}
            onRowClick={(event) => setSelectedEvent(event)}
            page={page}
            pageSize={PAGE_SIZE}
            totalCount={eventsData.total}
            onPageChange={setPage}
          />
        )}

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
                  <p>{format(new Date(selectedEvent.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}</p>
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
