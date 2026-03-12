import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useUserRoles } from "@/hooks/use-user-roles";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { BorisTable, type BorisColumn } from "@/components/ui/boris-table";
import { GroupPageTop } from "@/components/group-navigation/GroupPageTop";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
 
import { LoadingState } from "@/components/ui/loading-state";
import AccessDenied from "./AccessDenied";
import { Calendar, FileText } from "lucide-react";
 
import { PeriodFilter } from "@/components/group-dashboard/PeriodFilter";
import { getDateRange, PeriodType, DateRange } from "@/components/group-dashboard/period-utils";
import { formatDateTimeBR, formatDateTimeSecondsBR } from "@/lib/date";

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

export default function GroupEvents() {
  const { groupId } = useParams<{ groupId: string }>();
  const { loading: authLoading } = useAuth();
  const { isSystemAdmin, isLoading: rolesLoading } = useUserRoles();
  
  const [page, setPage] = useState(1);
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>('7d');
  const [customRange, setCustomRange] = useState<DateRange | undefined>();
  const [eventType, setEventType] = useState("all");
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);

  const currentRange = getDateRange(selectedPeriod, customRange);
  const currentStartISO = currentRange.from.toISOString();
  const currentEndISO = currentRange.to.toISOString();

  // Fetch group info for breadcrumbs
  const { data: group } = useQuery({
    queryKey: ["group", groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("groups")
        .select("id, name, organization_id, provider, sync_status")
        .eq("id", groupId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!groupId && !authLoading && isSystemAdmin,
  });

  const hasAccess = isSystemAdmin;

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
    enabled: !!group?.organization_id && isSystemAdmin,
  });

  // Fetch distinct event types for this group
  const { data: eventTypes } = useQuery<string[]>({
    queryKey: ["group-event-types", groupId, currentStartISO, currentEndISO],
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from("events")
        .select("event_type")
        .eq("entity_type", "group")
        .eq("entity_id", groupId!)
        .gte("created_at", currentStartISO)
        .lte("created_at", currentEndISO)
        .order("event_type");
      
      if (error) throw error;
      const rows = (data ?? []) as Array<{ event_type: string | null }>;
      return [...new Set(rows.map((e) => e.event_type).filter((v): v is string => !!v))];
    },
    enabled: !!groupId && hasAccess,
  });

  const { data: totalMembersCount } = useQuery({
    queryKey: ['group-members-total', groupId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('members')
        .select('*', { count: 'exact', head: true })
        .eq('group_id', groupId)
        .is('deleted_at', null);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!groupId && hasAccess,
  });

  const { data: lastMessageAt } = useQuery({
    queryKey: ['group-last-message', groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('created_at')
        .eq('group_id', groupId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(1);
      if (error) throw error;
      const first = (data ?? [])[0] as { created_at: string } | undefined;
      return first?.created_at ?? null;
    },
    enabled: !!groupId && hasAccess,
  });

  // Fetch events for this group
  const { data: eventsData, isLoading: eventsLoading } = useQuery({
    queryKey: ["group-events", groupId, page, selectedPeriod, customRange?.from?.toISOString(), customRange?.to?.toISOString(), eventType],
    queryFn: async () => {
      let query = supabase
        .from("events")
        .select("*", { count: "exact" })
        .eq("entity_type", "group")
        .eq("entity_id", groupId!)
        .gte("created_at", currentStartISO)
        .lte("created_at", currentEndISO)
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

  if (!hasAccess) {
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
      key: "metadata",
      header: "Resumo",
      hideOn: "sm",
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


  return (
    <AdminLayout title="Eventos do Grupo" subtitle={`${group?.name ? `${group.name} — ` : ""}${eventsData?.total ?? 0} eventos no período selecionado`}>
      <div className="space-y-6 animate-fade-in">
        <GroupPageTop
          breadcrumbItems={[
            { label: "Central de Comando", href: "/" },
            ...(org ? [{ label: org.name, href: `/organization/${org.id}` }] : []),
            ...(group ? [{ label: group.name, href: `/groups/${group.id}` }] : []),
            { label: "Eventos" },
          ]}
          group={{
            groupId: groupId as string,
            organizationId: group?.organization_id || undefined,
            name: group?.name || "",
            provider: group?.provider || "",
            totalMembers: (totalMembersCount ?? 0) as number,
            lastMessageAt: lastMessageAt ?? null,
            syncStatus: group?.sync_status || null,
          }}
          filters={(
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <PeriodFilter
                  value={selectedPeriod}
                  customRange={customRange}
                  onChange={(p, r) => { setSelectedPeriod(p); setCustomRange(p === 'custom' ? r : undefined); setPage(1); }}
                />
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
          showClearFilters={selectedPeriod !== '7d' || !!customRange || eventType !== 'all'}
          onClearFilters={() => { setSelectedPeriod('7d'); setCustomRange(undefined); setEventType('all'); setPage(1); }}
        />

        {/* KPIs removidos: mantemos apenas descrição textual no header */}

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
