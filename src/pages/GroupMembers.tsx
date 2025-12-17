import { AdminLayout } from "@/components/layout/AdminLayout";
import { DataTable } from "@/components/ui/data-table";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { useParams, NavLink } from "react-router-dom";
import { Users, MessageSquare, Search, X, Eye, Activity } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import AccessDenied from "./AccessDenied";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";

const PAGE_SIZE = 10;

interface Member {
  id: string;
  name: string;
  phone_e164: string | null;
  display_name: string | null;
  lid: string | null;
  is_admin: boolean;
  is_super_admin: boolean;
  is_owner: boolean;
  created_at: string;
  updated_at: string;
  provider: string;
  provider_member_id: string | null;
  profile_pic_url: string | null;
  joined_at: string | null;
  left_at: string | null;
  last_seen_message_at: string | null;
  status: string;
  deleted_at: string | null;
  metadata: Record<string, any> | null;
  raw_provider: Record<string, any> | null;
}

const GroupMembers = () => {
  const { groupId } = useParams();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const { isAuthenticated, loading: authLoading } = useAuth();

  const tabs = [
    { label: "Visão Geral", href: `/group/${groupId}`, end: true },
    { label: "Members", href: `/group/${groupId}/members`, icon: Users },
    { label: "Messages", href: `/group/${groupId}/messages`, icon: MessageSquare },
    { label: "Atividade", href: `/group/${groupId}/events`, icon: Activity },
  ];

  // Fetch group info for breadcrumbs
  const { data: groupInfo } = useQuery({
    queryKey: ['group-info', groupId],
    queryFn: async () => {
      const { data: group } = await supabase
        .from('groups')
        .select('name, organization_id')
        .eq('id', groupId)
        .maybeSingle();
      
      if (!group) return null;

      const { data: org } = await supabase
        .from('organizations')
        .select('name')
        .eq('id', group.organization_id)
        .maybeSingle();

      return { groupName: group.name, orgName: org?.name, orgId: group.organization_id };
    },
    enabled: !!groupId && isAuthenticated,
  });

  // Fetch members
  const { data: membersData, isLoading, error, refetch } = useQuery({
    queryKey: ['group-members', groupId, page, search],
    queryFn: async () => {
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      
      let query = supabase
        .from('members')
        .select('*', { count: 'exact' })
        .eq('group_id', groupId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });
      
      if (search) {
        query = query.or(`name.ilike.%${search}%,phone_e164.ilike.%${search}%,display_name.ilike.%${search}%`);
      }
      
      const { data, error, count } = await query.range(from, to);
      
      if (error) throw error;
      return { items: (data ?? []) as Member[], count: count ?? 0 };
    },
    enabled: !!groupId && isAuthenticated,
  });

  // Loading state
  if (authLoading) {
    return (
      <AdminLayout title="Members" subtitle="Verificando acesso...">
        <LoadingState message="Verificando permissões..." />
      </AdminLayout>
    );
  }

  // Check access via error
  const errorCode = (error as any)?.code;
  if (error && (error.message?.includes('permission') || errorCode === 'PGRST301')) {
    return (
      <AccessDenied 
        message="Você não tem permissão para acessar os membros deste grupo."
      />
    );
  }

  const columns = [
    { key: 'name', header: 'Nome' },
    { key: 'phone_e164', header: 'Telefone', render: (m: Member) => m.phone_e164 || '-' },
    { 
      key: 'role', 
      header: 'Papel',
      render: (m: Member) => (
        <div className="flex gap-1 flex-wrap">
          {m.is_owner && (
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-accent/10 text-accent">
              Owner
            </span>
          )}
          {m.is_super_admin && (
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
              Super Admin
            </span>
          )}
          {m.is_admin && !m.is_super_admin && (
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-secondary text-secondary-foreground">
              Admin
            </span>
          )}
          {!m.is_admin && !m.is_super_admin && !m.is_owner && (
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">
              Membro
            </span>
          )}
        </div>
      )
    },
    { 
      key: 'status', 
      header: 'Status',
      render: (m: Member) => (
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
          m.left_at ? 'bg-destructive/10 text-destructive' :
          m.status === 'active' ? 'bg-success/10 text-success' : 
          'bg-muted text-muted-foreground'
        }`}>
          {m.left_at ? 'Saiu' : m.status === 'active' ? 'Ativo' : m.status}
        </span>
      )
    },
    {
      key: 'actions',
      header: '',
      className: 'w-10',
      render: (m: Member) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setSelectedMember(m);
          }}
          className="p-1.5 rounded-lg hover:bg-secondary transition-colors"
        >
          <Eye className="h-4 w-4 text-muted-foreground" />
        </button>
      )
    },
  ];

  return (
    <AdminLayout 
      title="Members" 
      subtitle={`Membros do grupo`}
    >
      <div className="space-y-6 animate-fade-in">
        {/* Breadcrumbs */}
        <Breadcrumbs
          items={[
            { label: "System", href: "/system" },
            { label: groupInfo?.orgName || "Org", href: `/org/${groupInfo?.orgId}` },
            { label: groupInfo?.groupName || "Grupo", href: `/group/${groupId}` },
            { label: "Members" },
          ]}
        />

        {/* Header with tabs */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex items-center gap-3 p-4 border-b border-border">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-card-foreground">Members</h2>
              <p className="text-sm text-muted-foreground">
                {membersData?.count ?? 0} membros neste grupo
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

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar por nome ou telefone..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-10 pr-10 py-2.5 rounded-lg border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {search && (
            <button
              onClick={() => {
                setSearch("");
                setPage(1);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-secondary"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
        </div>

        {/* Table */}
        {isLoading ? (
          <LoadingState message="Carregando membros..." />
        ) : error ? (
          <ErrorState 
            message="Falha ao carregar membros"
            retry={() => refetch()}
          />
        ) : membersData?.items.length === 0 ? (
          <EmptyState
            icon={Users}
            title={search ? "Nenhum resultado" : "Nenhum membro"}
            message={search ? "Tente buscar com outros termos." : "Este grupo ainda não possui membros."}
          />
        ) : (
          <DataTable
            columns={columns}
            data={membersData?.items ?? []}
            keyExtractor={(m) => m.id}
            onRowClick={(m) => setSelectedMember(m)}
            page={page}
            pageSize={PAGE_SIZE}
            totalCount={membersData?.count}
            onPageChange={setPage}
          />
        )}

        {/* Member detail dialog - Organized in sections */}
        <Dialog open={!!selectedMember} onOpenChange={() => setSelectedMember(null)}>
          <DialogContent className="bg-card border-border max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-card-foreground">Detalhes do Membro</DialogTitle>
            </DialogHeader>
            {selectedMember && (
              <div className="space-y-6">
                {/* Header with avatar */}
                <div className="flex items-center gap-4">
                  {selectedMember.profile_pic_url ? (
                    <img 
                      src={selectedMember.profile_pic_url} 
                      alt={selectedMember.name}
                      className="h-16 w-16 rounded-xl object-cover"
                    />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-primary/10">
                      <Users className="h-8 w-8 text-primary" />
                    </div>
                  )}
                  <div>
                    <h3 className="font-semibold text-lg text-card-foreground">{selectedMember.name}</h3>
                    {selectedMember.display_name && selectedMember.display_name !== selectedMember.name && (
                      <p className="text-sm text-muted-foreground">{selectedMember.display_name}</p>
                    )}
                    <div className="flex gap-1 mt-1">
                      {selectedMember.is_owner && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-accent/10 text-accent">Owner</span>
                      )}
                      {selectedMember.is_super_admin && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">Super Admin</span>
                      )}
                      {selectedMember.is_admin && !selectedMember.is_super_admin && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-secondary text-secondary-foreground">Admin</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Section: Identidade/Contato */}
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Identidade / Contato</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm p-4 rounded-lg bg-secondary/30">
                    <div>
                      <span className="text-muted-foreground">Telefone (E.164)</span>
                      <p className="font-medium text-card-foreground">{selectedMember.phone_e164 || '-'}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">LID</span>
                      <p className="font-medium text-card-foreground font-mono text-xs">{selectedMember.lid || '-'}</p>
                    </div>
                  </div>
                </div>

                {/* Section: Status/Sincronização */}
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Status / Sincronização</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm p-4 rounded-lg bg-secondary/30">
                    <div>
                      <span className="text-muted-foreground">Status</span>
                      <p className="font-medium text-card-foreground">{selectedMember.status}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Entrou em</span>
                      <p className="font-medium text-card-foreground">
                        {selectedMember.joined_at ? new Date(selectedMember.joined_at).toLocaleString('pt-BR') : '-'}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Saiu em</span>
                      <p className="font-medium text-card-foreground">
                        {selectedMember.left_at ? new Date(selectedMember.left_at).toLocaleString('pt-BR') : '-'}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Última msg vista</span>
                      <p className="font-medium text-card-foreground">
                        {selectedMember.last_seen_message_at ? new Date(selectedMember.last_seen_message_at).toLocaleString('pt-BR') : '-'}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Criado em</span>
                      <p className="font-medium text-card-foreground">
                        {new Date(selectedMember.created_at).toLocaleString('pt-BR')}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Atualizado em</span>
                      <p className="font-medium text-card-foreground">
                        {new Date(selectedMember.updated_at).toLocaleString('pt-BR')}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Section: Provedor */}
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Provedor</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm p-4 rounded-lg bg-secondary/30">
                    <div>
                      <span className="text-muted-foreground">Provider</span>
                      <p className="font-medium text-card-foreground capitalize">{selectedMember.provider}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Provider Member ID</span>
                      <p className="font-medium text-card-foreground font-mono text-xs break-all">
                        {selectedMember.provider_member_id || '-'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Section: Metadados (collapsible) */}
                {(selectedMember.metadata && Object.keys(selectedMember.metadata).length > 0) && (
                  <Collapsible>
                    <CollapsibleTrigger className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide hover:text-foreground transition-colors">
                      <ChevronDown className="h-4 w-4" />
                      Metadados
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-3">
                      <pre className="p-4 rounded-lg bg-secondary/30 text-xs overflow-auto max-h-48 text-card-foreground">
                        {JSON.stringify(selectedMember.metadata, null, 2)}
                      </pre>
                    </CollapsibleContent>
                  </Collapsible>
                )}

                {/* Section: Raw Provider (collapsible) */}
                {(selectedMember.raw_provider && Object.keys(selectedMember.raw_provider).length > 0) && (
                  <Collapsible>
                    <CollapsibleTrigger className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide hover:text-foreground transition-colors">
                      <ChevronDown className="h-4 w-4" />
                      Raw Provider
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-3">
                      <pre className="p-4 rounded-lg bg-secondary/30 text-xs overflow-auto max-h-48 text-card-foreground">
                        {JSON.stringify(selectedMember.raw_provider, null, 2)}
                      </pre>
                    </CollapsibleContent>
                  </Collapsible>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default GroupMembers;