import { AdminLayout } from "@/components/layout/AdminLayout";
import { BorisTable } from "@/components/ui/boris-table";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { AdminPageHeader } from "@/components/layout/AdminPageHeader";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Users, Edit, ChevronDown, CreditCard, Mail, Plus, Trash2, Activity, Tag } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";
import { useUserRoles } from "@/hooks/use-user-roles";
import { useAuth } from "@/hooks/use-auth";
import AccessDenied from "./AccessDenied";
import { formatDateSimpleBR } from "@/lib/date";
import { EditOrganizationModal } from "@/components/modals/EditOrganizationModal";
import { EditOrganizationContactModal } from "@/components/modals/EditOrganizationContactModal";
import { EditGroupModal } from "@/components/modals/EditGroupModal";
import { AddGroupModal } from "@/components/modals/AddGroupModal";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/group-dashboard/KpiCard";
import { notify } from "@/components/ui/sonner";
import { PeriodFilter } from "@/components/group-dashboard/PeriodFilter";
import {
  getDateRange,
  type PeriodType,
  type DateRange,
  parseStoredPeriod,
  buildStoredPeriod,
} from "@/components/group-dashboard/period-utils";
import { countWordsFromRows, extractBigramsFromRows } from "@/utils/keywords";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const PAGE_SIZE = 10;

interface OrganizationDetail {
  id: string;
  name: string;
  slug: string | null;
  status: string;
  owner_user_id: string | null;
  plan: string | null;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  billing_status: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  settings: Record<string, any> | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  metadata: Record<string, any> | null;
}

interface GroupItem {
  id: string;
  name: string;
  provider: string;
  created_at: string;
  organization_id: string;
  whatsapp_provider_id: string | null;
  is_active: boolean | null;
  sync_status: string | null;
}

const Org = () => {
  const { orgId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { canEditOrg, canEditGroup, isLoading: rolesLoading, isSystemAdmin } = useUserRoles();
  const [editOrgOpen, setEditOrgOpen] = useState(false);
  const [editGroup, setEditGroup] = useState<GroupItem | null>(null);
  const [addGroupOpen, setAddGroupOpen] = useState(false);
  const [removeGroup, setRemoveGroup] = useState<GroupItem | null>(null);
  const [removing, setRemoving] = useState(false);
  const [editContactOpen, setEditContactOpen] = useState(false);
  

  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>('7d');
  const [customRange, setCustomRange] = useState<DateRange | undefined>();

  useEffect(() => {
    try {
      const raw = localStorage.getItem(`org-period:${orgId}`);
      if (raw) {
        const saved = JSON.parse(raw);
        const { period, range, isValid } = parseStoredPeriod(saved, "7d");
        if (!isValid) {
          localStorage.removeItem(`org-period:${orgId}`);
        }
        setSelectedPeriod(period);
        setCustomRange(range);
      }
    } catch { void 0; }
  }, [orgId]);

  useEffect(() => {
    if (!orgId) return;

    const payload = buildStoredPeriod(selectedPeriod, customRange);
    try {
      localStorage.setItem(`org-period:${orgId}`, JSON.stringify(payload));
    } catch { void 0; }
  }, [orgId, selectedPeriod, customRange]);

  const handlePeriodChange = (period: PeriodType, range: DateRange) => {
    setSelectedPeriod(period);
    setCustomRange(period === 'custom' ? range : undefined);
  };

  // Fetch organization details
  const { data: org, isLoading: orgLoading, error: orgError, refetch: refetchOrg } = useQuery({
    queryKey: ['organization-detail', orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', orgId)
        .maybeSingle();
      
      if (error) throw error;
      return data as OrganizationDetail;
    },
    enabled: !!orgId && isAuthenticated,
  });

  // Fetch owner profile if exists
  const { data: ownerProfile } = useQuery({
    queryKey: ['owner-profile', org?.owner_user_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('name')
        .eq('id', org!.owner_user_id!)
        .maybeSingle();
      return data;
    },
    enabled: !!org?.owner_user_id,
  });

  const { data: primaryContact, isLoading: contactLoading, error: contactError, refetch: refetchPrimaryContact } = useQuery({
    queryKey: ['org-primary-contact', orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organization_contacts')
        .select('*')
        .eq('organization_id', orgId)
        .eq('is_primary', true)
        .maybeSingle();
      if (error) throw error;
      return data as {
        id: string;
        organization_id: string;
        name: string;
        email: string | null;
        phone: string | null;
        role_title: string | null;
        is_primary: boolean;
        created_at: string;
        updated_at: string;
      };
    },
    enabled: !!orgId && isAuthenticated,
  });

  const contactName = primaryContact?.name || org?.contact_name || undefined;
  const contactEmail = primaryContact?.email || org?.contact_email || undefined;
  const contactPhone = primaryContact?.phone || org?.contact_phone || undefined;
  const contactRole = primaryContact?.role_title || undefined;

  const { data: orgGroupIds } = useQuery({
    queryKey: ['org-group-ids', orgId],
    queryFn: async () => {
      const { data } = await supabase
        .from('groups')
        .select('id')
        .eq('organization_id', orgId!)
        .is('deleted_at', null)
        .neq('is_archived', true);
      return (data ?? []).map((g: { id: string }) => g.id);
    },
    enabled: !!orgId && isAuthenticated,
  });

  const { data: totalMembersCount, isLoading: membersCountLoading } = useQuery({
    queryKey: ['org-total-members', orgId, orgGroupIds?.join(',')],
    queryFn: async () => {
      if (!orgGroupIds || orgGroupIds.length === 0) return 0;
      const { count } = await supabase
        .from('members')
        .select('*', { count: 'exact', head: true })
        .in('group_id', orgGroupIds)
        .is('deleted_at', null);
      return count ?? 0;
    },
    enabled: !!orgId && isAuthenticated && Array.isArray(orgGroupIds),
  });

  const { data: messagesLast7dCount, isLoading: messagesCountLoading } = useQuery({
    queryKey: ['org-messages-7d', orgId, orgGroupIds?.join(',')],
    queryFn: async () => {
      if (!orgGroupIds || orgGroupIds.length === 0) return 0;
      const fromISO = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const toISO = new Date().toISOString();
      const { count } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .in('group_id', orgGroupIds)
        .is('deleted_at', null)
        .gte('created_at', fromISO)
        .lte('created_at', toISO);
      return count ?? 0;
    },
    enabled: !!orgId && isAuthenticated && Array.isArray(orgGroupIds),
  });

  const { data: activeGroupsCount, isLoading: activeGroupsLoading } = useQuery({
    queryKey: ['org-active-groups-count', orgId],
    queryFn: async () => {
      const { count } = await supabase
        .from('groups')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', orgId!)
        .is('deleted_at', null)
        .neq('is_archived', true)
        .eq('is_active', true);
      return count ?? 0;
    },
    enabled: !!orgId && isAuthenticated,
  });

  

  

  const path = location.pathname;
  const isGroupsRoute = /^\/(?:org|organization)\/[^/]+\/groups$/.test(path);
  const isSettingsRoute = /^\/(?:org|organization)\/[^/]+\/settings$/.test(path);
  const isDashboardRoute = /^\/(?:org|organization)\/[^/]+\/dashboard$/.test(path);
  const isKeywordsRoute = /^\/(?:org|organization)\/[^/]+\/keywords$/.test(path);
  const isBaseOrg = /^\/(?:org|organization)\/[^/]+\/?$/.test(path);
  const isDefaultOrgHome = isBaseOrg && !isGroupsRoute && !isSettingsRoute && !isDashboardRoute && !isKeywordsRoute;

  const breadcrumbItems = (() => {
    const items = [
      { label: "Central de Comando", href: "/" },
      { label: org?.name || "Organização" },
    ];
    if (isGroupsRoute) items.push({ label: "Grupos" });
    if (isDashboardRoute) items.push({ label: "Painéis e métricas" });
    if (isKeywordsRoute) items.push({ label: "Palavras-chave" });
    return items;
  })();

  const currentRange = getDateRange(selectedPeriod, customRange);
  const lengthMs = Math.max(0, currentRange.to.getTime() - currentRange.from.getTime());
  const previousPeriodEnd = new Date(currentRange.from.getTime() - 1);
  const previousPeriodStart = new Date(previousPeriodEnd.getTime() - lengthMs);
  const currentStartISO = currentRange.from.toISOString();
  const currentEndISO = currentRange.to.toISOString();
  const previousStartISO = previousPeriodStart.toISOString();
  const previousEndISO = previousPeriodEnd.toISOString();

  // Fetch groups for this organization
  const { data: groupsData, isLoading: groupsLoading, error: groupsError, refetch: refetchGroups } = useQuery({
    queryKey: ['org-groups', orgId, page],
    queryFn: async () => {
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      
      const { data, error, count } = await supabase
        .from('groups')
        .select('*', { count: 'exact' })
        .eq('organization_id', orgId)
        .is('deleted_at', null)
        .neq('is_archived', true)
        .order('created_at', { ascending: false })
        .range(from, to);
      
      if (error) throw error;
      return { items: (data ?? []) as GroupItem[], count: count ?? 0 };
    },
    enabled: !!orgId && isAuthenticated,
  });

  

  const { data: orgKeywords, isLoading: keywordsLoading, error: keywordsError, refetch: refetchKeywords } = useQuery({
    queryKey: ['org-keywords', orgId, orgGroupIds?.join(','), currentStartISO, currentEndISO, previousStartISO, previousEndISO],
    queryFn: async () => {
      if (!orgGroupIds || orgGroupIds.length === 0) return { words: [], bigrams: [] } as any;

      const buildRows = async (startISO: string, endISO: string): Promise<string[]> => {
        const q1 = await supabase
          .from('v_messages_feed')
          .select('content_preview,message_type,created_at,group_id')
          .in('group_id', orgGroupIds)
          .eq('message_type', 'text')
          .is('deleted_at', null)
          .gte('created_at', startISO)
          .lte('created_at', endISO)
          .limit(2000);
        let rows: string[] = [];
        if (!q1.error) {
          rows = (q1.data || []).map((d: any) => d.content_preview || "");
        } else {
          const q2 = await supabase
            .from('messages')
            .select('content,message_type,created_at,group_id')
            .in('group_id', orgGroupIds)
            .eq('message_type', 'text')
            .is('deleted_at', null)
            .gte('created_at', startISO)
            .lte('created_at', endISO)
            .limit(2000);
          if (q2.error) throw q2.error;
          rows = (q2.data || []).map((d: any) => d.content || "");
        }
        return rows;
      };

      const currRows = await buildRows(currentStartISO, currentEndISO);
      const prevRows = await buildRows(previousStartISO, previousEndISO);

      const currCounts = countWordsFromRows(currRows);
      const prevCounts = countWordsFromRows(prevRows);
      const prevMap: Record<string, number> = {};
      (prevCounts || []).forEach((w) => { prevMap[w.word] = Number(w.count || 0); });
      const words = (currCounts || [])
        .map((w) => {
          const prev = prevMap[w.word] || 0;
          const delta = prev ? Math.round(((Number(w.count || 0) - prev) / prev) * 100) : (w.count ? 100 : 0);
          return { word: w.word, count: Number(w.count || 0), delta };
        })
        .sort((a, b) => b.count - a.count)
        .slice(0, 12);

      const currBigrams = extractBigramsFromRows(currRows);
      const prevBigrams = extractBigramsFromRows(prevRows);
      const prevBigramMap: Record<string, number> = {};
      (prevBigrams || []).forEach((b) => { prevBigramMap[b.phrase] = Number(b.count || 0); });
      const bigrams = (currBigrams || [])
        .map((b) => {
          const prev = prevBigramMap[b.phrase] || 0;
          const delta = prev ? Math.round(((Number(b.count || 0) - prev) / prev) * 100) : (b.count ? 100 : 0);
          return { phrase: b.phrase, count: Number(b.count || 0), delta };
        })
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      return { words, bigrams } as any;
    },
    enabled: !!orgId && isAuthenticated && Array.isArray(orgGroupIds),
  });

  // Loading state while checking auth/roles
  if (authLoading || rolesLoading) {
    return (
      <AdminLayout title="Organização" subtitle="Verificando acesso...">
        <LoadingState message="Verificando permissões..." />
      </AdminLayout>
    );
  }

  if (orgLoading) {
    return (
      <AdminLayout title="Organização" subtitle="Carregando...">
        <LoadingState message="Carregando detalhes da organização..." />
      </AdminLayout>
    );
  }

  // Check access - RLS will return null if no access
  if (orgError || !org) {
    // Distinguish between "not found" and "no access"
    const errorCode = (orgError as any)?.code;
    if (orgError?.message?.includes('permission') || errorCode === 'PGRST301') {
      return (
        <AccessDenied 
          message="Você não tem permissão para acessar esta organização."
        />
      );
    }
    return (
      <AdminLayout title="Organização" subtitle="Erro">
          <ErrorState 
          title="Organização não encontrada"
          message="Não foi possível carregar os detalhes desta organização. Você pode não ter acesso."
          retry={() => navigate('/')}
        />
      </AdminLayout>
    );
  }

  const userCanEditOrg = canEditOrg(orgId!);
  const userCanCreateGroup = isSystemAdmin;

  const groupColumns = [
    { key: 'name', header: 'Nome' },
    ...(isSystemAdmin ? [
      { 
        key: 'provider', 
        header: 'Provider',
        render: (group: GroupItem) => (
          <span className="px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground text-xs font-medium capitalize">
            {group.provider}
          </span>
        )
      },
    ] : []),
    ...(isSystemAdmin ? [
      { 
        key: 'sync_status', 
        header: 'Sync',
        render: (group: GroupItem) => (
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
            group.sync_status === 'synced' ? 'bg-success/10 text-success' :
            group.sync_status === 'error' ? 'bg-destructive/10 text-destructive' :
            'bg-muted text-muted-foreground'
          }`}>
            {group.sync_status || '-'}
          </span>
        )
      },
    ] : []),
    { 
      key: 'is_active', 
      header: 'Status',
      render: (group: GroupItem) => (
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
          group.is_active === true ? 'bg-success/10 text-success' :
          group.is_active === false ? 'bg-muted text-muted-foreground' :
          'bg-muted text-muted-foreground'
        }`}>
          {group.is_active === true ? 'Ativo' : group.is_active === false ? 'Inativo' : '—'}
        </span>
      )
    },
    { 
      key: 'created_at', 
      header: 'Criado em',
      render: (group: GroupItem) => formatDateSimpleBR(group.created_at)
    },
    {
      key: 'actions',
      header: '',
      className: 'w-10',
      render: (group: GroupItem) => {
        const canEdit = canEditGroup(group.id, orgId);
        const canRemove = userCanEditOrg;
        if (!canEdit && !canRemove) return null;
        return (
          <div className="flex items-center gap-1">
            {canEdit && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setEditGroup(group);
                }}
                className="h-8 w-8 p-0"
              >
                <Edit className="h-4 w-4" />
              </Button>
            )}
            {canRemove && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setRemoveGroup(group);
                }}
                className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                title="Remover grupo da organização"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        );
      }
    },
  ];

  return (
    <AdminLayout 
      title="Organização" 
      subtitle={org?.name || "Organização"}
    >
      <div className="space-y-6 animate-fade-in">
        <AdminPageHeader
          breadcrumbItems={breadcrumbItems}
          title={org?.name || "Organização"}
          description={`Criada em ${formatDateSimpleBR(org.created_at)}`}
          actions={(
            <div className="flex items-center gap-3">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                org.status === 'active' ? 'bg-success/10 text-success' :
                org.status === 'inactive' ? 'bg-muted text-muted-foreground' :
                'bg-destructive/10 text-destructive'
              }`}>
                {org.status === 'active' ? 'Ativo' : org.status === 'inactive' ? 'Inativo' : 'Suspenso'}
              </span>
              {userCanEditOrg && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditOrgOpen(true)}
                  className="flex items-center gap-2"
                >
                  <Edit className="h-4 w-4" />
                  Editar
                </Button>
              )}
            </div>
          )}
          filters={(
            isKeywordsRoute ? (
              <div className="flex flex-wrap items-center gap-2">
                <PeriodFilter
                  value={selectedPeriod}
                  customRange={customRange}
                  onChange={handlePeriodChange}
                />
              </div>
            ) : null
          )}
          showClearFilters={isKeywordsRoute && (selectedPeriod !== '7d' || !!customRange)}
          onClearFilters={() => { setSelectedPeriod('7d'); setCustomRange(undefined); }}
        />

        

        {(isDashboardRoute || isDefaultOrgHome) && (
          <div id="org-dashboard" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              title="Grupos"
              value={groupsData?.count ?? 0}
              subtitle="Total na organização"
              icon={Users}
              helpText="Quantidade de grupos vinculados"
              isLoading={groupsLoading}
            />
            <KpiCard
              title="Membros"
              value={totalMembersCount ?? 0}
              subtitle="Total em todos os grupos"
              icon={Users}
              helpText="Soma de membros em grupos"
              isLoading={membersCountLoading}
            />
            <KpiCard
              title="Mensagens (7d)"
              value={messagesLast7dCount ?? 0}
              subtitle="Últimos 7 dias"
              icon={Mail}
              helpText="Volume recente de mensagens"
              isLoading={messagesCountLoading}
            />
            <KpiCard
              title="Grupos ativos"
              value={activeGroupsCount ?? 0}
              subtitle="Com status ativo"
              icon={Activity}
              helpText="Grupos marcados como ativos"
              isLoading={activeGroupsLoading}
            />
          </div>
        )}


        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {(isDashboardRoute || isDefaultOrgHome) && (
          <div id="org-settings" className="rounded-xl border border-border bg-card p-6 space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Configurações da Organização</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Nome</span>
                <p className="font-medium text-card-foreground">{org?.name || '-'}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Slug</span>
                <p className="font-medium text-card-foreground font-mono">{org.slug || '-'}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Status</span>
                <p className="font-medium text-card-foreground capitalize">{org.status}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Owner</span>
                <p className="font-medium text-card-foreground">{ownerProfile?.name || org.owner_user_id || '-'}</p>
              </div>
              <div className="col-span-2">
                <span className="text-muted-foreground">Descrição / propósito</span>
                {(org.settings && (org.settings as any).description) ? (
                  <p className="font-medium text-card-foreground whitespace-pre-wrap break-words">
                    {(org.settings as any).description}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">Adicione uma descrição da organização</p>
                )}
              </div>
              <div>
                <span className="text-muted-foreground">Criada em</span>
                <p className="font-medium text-card-foreground">
                  {new Date(org.created_at).toLocaleString('pt-BR')}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Atualizada em</span>
                <p className="font-medium text-card-foreground">
                  {new Date(org.updated_at).toLocaleString('pt-BR')}
                </p>
              </div>
            </div>
          </div>
          )}

          {/* Section: Contato da Organização */}
          {(isDashboardRoute || isDefaultOrgHome) && (
          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Contato da Organização
              </h3>
              {userCanEditOrg && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditContactOpen(true)}
                  className="flex items-center gap-2"
                >
                  <Edit className="h-4 w-4" />
                  Editar contato
                </Button>
              )}
            </div>
            {contactLoading ? (
              <p className="text-sm text-muted-foreground">Carregando contato...</p>
            ) : contactError ? (
              <p className="text-sm text-destructive">Falha ao carregar contato</p>
            ) : (
              <div className="grid grid-cols-1 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Nome</span>
                  <p className="font-medium text-card-foreground">{contactName || '-'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Email</span>
                  <p className="font-medium text-card-foreground">{contactEmail || '-'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Telefone</span>
                  <p className="font-medium text-card-foreground">{contactPhone || '-'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Cargo</span>
                  <p className="font-medium text-card-foreground">{contactRole || '-'}</p>
                </div>
                {!primaryContact && !org?.contact_name && !org?.contact_email && !org?.contact_phone && (
                  <p className="text-xs text-muted-foreground">Nenhum contato primário cadastrado.</p>
                )}
              </div>
            )}
          </div>
          )}

          {/* Section: Plano / Billing */}
          {(isDashboardRoute || isDefaultOrgHome) && (
          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Plano / Billing
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Plano</span>
                <p className="font-medium text-card-foreground capitalize">{org.plan || '-'}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Status do Billing</span>
                <p className={`font-medium capitalize ${
                  org.billing_status === 'active' ? 'text-success' :
                  org.billing_status === 'overdue' ? 'text-destructive' :
                  'text-muted-foreground'
                }`}>
                  {org.billing_status || '-'}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Início do Trial</span>
                <p className="font-medium text-card-foreground">
                  {org.trial_started_at 
                    ? new Date(org.trial_started_at).toLocaleDateString('pt-BR') 
                    : '-'}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Fim do Trial</span>
                <p className="font-medium text-card-foreground">
                  {org.trial_ends_at 
                    ? new Date(org.trial_ends_at).toLocaleDateString('pt-BR') 
                    : '-'}
                </p>
              </div>
            </div>
          </div>
          )}
        </div>

        {/* Collapsible sections for JSON data */}
        <div className="space-y-4">
          {/* Settings */}
          {org.settings && Object.keys(org.settings).length > 0 && (
            <Collapsible className="rounded-xl border border-border bg-card">
              <CollapsibleTrigger className="flex items-center justify-between w-full p-4 hover:bg-secondary/30 transition-colors">
                <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Settings</span>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </CollapsibleTrigger>
              <CollapsibleContent className="px-4 pb-4">
                <pre className="p-4 rounded-lg bg-secondary/30 text-xs overflow-auto max-h-48 text-card-foreground">
                  {JSON.stringify(org.settings, null, 2)}
                </pre>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Metadata */}
          {org.metadata && Object.keys(org.metadata).length > 0 && (
            <Collapsible className="rounded-xl border border-border bg-card">
              <CollapsibleTrigger className="flex items-center justify-between w-full p-4 hover:bg-secondary/30 transition-colors">
                <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Metadados</span>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </CollapsibleTrigger>
              <CollapsibleContent className="px-4 pb-4">
                <pre className="p-4 rounded-lg bg-secondary/30 text-xs overflow-auto max-h-48 text-card-foreground">
                  {JSON.stringify(org.metadata, null, 2)}
                </pre>
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>

        {isKeywordsRoute && (
          <div id="org-keywords" className="rounded-xl border border-border bg-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Tag className="h-4 w-4" />
                Palavras-chave e temas do período
              </h3>
              <div className="text-xs text-muted-foreground">Amostra até 2000 mensagens de texto</div>
            </div>
            {keywordsLoading ? (
              <LoadingState message="Processando mensagens..." />
            ) : keywordsError ? (
              <ErrorState message="Falha ao extrair palavras-chave" retry={() => refetchKeywords()} />
            ) : !orgKeywords || ((orgKeywords.words || []).length === 0 && (orgKeywords.bigrams || []).length === 0) ? (
              <EmptyState icon={Tag} title="Nada relevante" message="Nenhuma palavra-chave ou tema recorrente neste período." />
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Palavras mais presentes</p>
                  <div className="flex flex-wrap gap-2">
                    {(orgKeywords.words || []).map((w: any) => (
                      <span key={w.word} className="px-2 py-1 rounded-md bg-secondary text-secondary-foreground text-xs">
                        {w.word}
                        <span className="ml-2 text-muted-foreground">{w.count}</span>
                        {typeof w.delta === 'number' && (
                          <span className={`ml-2 ${w.delta > 0 ? 'text-success' : w.delta < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>{w.delta > 0 ? `+${w.delta}%` : w.delta < 0 ? `${w.delta}%` : '0%'}</span>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Temas recorrentes (bigramas)</p>
                  <div className="flex flex-wrap gap-2">
                    {(orgKeywords.bigrams || []).map((b: any) => (
                      <span key={b.phrase} className="px-2 py-1 rounded-md bg-secondary text-secondary-foreground text-xs">
                        {b.phrase}
                        <span className="ml-2 text-muted-foreground">{b.count}</span>
                        {typeof b.delta === 'number' && (
                          <span className={`ml-2 ${b.delta > 0 ? 'text-success' : b.delta < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>{b.delta > 0 ? `+${b.delta}%` : b.delta < 0 ? `${b.delta}%` : '0%'}</span>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        

        {(isGroupsRoute || isDefaultOrgHome) && (
        <div id="org-groups">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />
              Grupos ({groupsData?.count ?? 0})
            </h3>
            {userCanCreateGroup && (
              <Button
                onClick={() => setAddGroupOpen(true)}
                size="sm"
                className="flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Adicionar Grupo
              </Button>
            )}
          </div>
          
          {groupsLoading ? (
            <LoadingState message="Carregando grupos..." />
          ) : groupsError ? (
            <ErrorState 
              message="Falha ao carregar grupos"
              retry={() => refetchGroups()}
            />
          ) : groupsData?.items.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Nenhum grupo"
              message="Esta organização ainda não possui grupos cadastrados."
            />
          ) : (
            <BorisTable
              columns={groupColumns as any}
              data={groupsData?.items ?? []}
              keyExtractor={(group) => group.id}
              onRowClick={(group) => navigate(`/groups/${group.id}`)}
              page={page}
              pageSize={PAGE_SIZE}
              totalCount={groupsData?.count}
              onPageChange={setPage}
            />
          )}
        </div>
        )}

        
      </div>

      {/* Edit organization modal */}
      <EditOrganizationModal
        organization={org}
        open={editOrgOpen}
        onOpenChange={setEditOrgOpen}
        onSuccess={() => refetchOrg()}
      />

      <EditOrganizationContactModal
        organizationId={orgId!}
        contact={primaryContact ?? null}
        open={editContactOpen}
        onOpenChange={setEditContactOpen}
        onSuccess={() => refetchPrimaryContact()}
      />

      {/* Edit group modal */}
      <EditGroupModal
        group={editGroup}
        open={!!editGroup}
        onOpenChange={(open) => !open && setEditGroup(null)}
        onSuccess={() => refetchGroups()}
      />

      {/* Add group modal */}
      <AddGroupModal
        organizationId={orgId!}
        organizationName={org?.name || ''}
        open={addGroupOpen}
        onOpenChange={setAddGroupOpen}
        onSuccess={(groupId) => {
          refetchGroups();
          navigate(`/groups/${groupId}`);
        }}
      />

      {/* Remove group confirmation */}
      <AlertDialog open={!!removeGroup} onOpenChange={(open) => !open && setRemoveGroup(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-card-foreground">Remover grupo da organização</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Esta ação desvincula o grupo da organização e não apaga dados históricos. 
              O grupo deixará de aparecer nesta organização.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="mr-2">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!removeGroup) return;
                setRemoving(true);
                try {
                  const { error } = await supabase
                    .from('groups')
                    .update({ is_archived: true })
                    .eq('id', removeGroup.id);
                  if (error) throw error;
                  notify.success('Grupo removido', 'Dados salvos com sucesso.');
                  setRemoveGroup(null);
                  refetchGroups();
                } catch (err: any) {
                  notify.error('Não foi possível concluir', 'Algo deu errado. Tente novamente.');
                } finally {
                  setRemoving(false);
                }
              }}
              disabled={removing}
            >
              Confirmar remoção
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      
    </AdminLayout>
  );
};

export default Org;
