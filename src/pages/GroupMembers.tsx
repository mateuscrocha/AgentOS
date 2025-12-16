import { AdminLayout } from "@/components/layout/AdminLayout";
import { DataTable } from "@/components/ui/data-table";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { useParams, NavLink } from "react-router-dom";
import { Users, MessageSquare, Search, X, Eye } from "lucide-react";
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

const PAGE_SIZE = 10;

interface Member {
  id: string;
  name: string;
  phone: string | null;
  is_admin: boolean;
  created_at: string;
  provider_member_id: string | null;
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
        .order('created_at', { ascending: false });
      
      if (search) {
        query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%`);
      }
      
      const { data, error, count } = await query.range(from, to);
      
      if (error) throw error;
      return { items: data ?? [], count: count ?? 0 };
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
    { key: 'phone', header: 'Telefone', render: (m: Member) => m.phone || '-' },
    { 
      key: 'is_admin', 
      header: 'Admin',
      render: (m: Member) => (
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
          m.is_admin ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
        }`}>
          {m.is_admin ? 'Sim' : 'Não'}
        </span>
      )
    },
    { 
      key: 'created_at', 
      header: 'Criado em',
      render: (m: Member) => new Date(m.created_at).toLocaleDateString('pt-BR')
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

        {/* Member detail dialog */}
        <Dialog open={!!selectedMember} onOpenChange={() => setSelectedMember(null)}>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle className="text-card-foreground">Detalhes do Membro</DialogTitle>
            </DialogHeader>
            {selectedMember && (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
                    <Users className="h-7 w-7 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-card-foreground">{selectedMember.name}</h3>
                    <p className="text-sm text-muted-foreground">{selectedMember.phone || 'Sem telefone'}</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Admin</span>
                    <p className="font-medium text-card-foreground">{selectedMember.is_admin ? 'Sim' : 'Não'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Criado em</span>
                    <p className="font-medium text-card-foreground">
                      {new Date(selectedMember.created_at).toLocaleString('pt-BR')}
                    </p>
                  </div>
                  {selectedMember.provider_member_id && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Provider ID</span>
                      <p className="font-medium text-card-foreground font-mono text-xs">
                        {selectedMember.provider_member_id}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default GroupMembers;
