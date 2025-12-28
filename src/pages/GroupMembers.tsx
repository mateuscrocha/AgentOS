import { AdminLayout } from "@/components/layout/AdminLayout";
import { BorisTable, RowActions } from "@/components/ui/boris-table";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { useParams } from "react-router-dom";
import { Users, Search, X, Eye } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useUserRoles } from "@/hooks/use-user-roles";
import AccessDenied from "./AccessDenied";
import { MemberDetailsDrawer } from "@/components/members/MemberDetailsDrawer";
import { MemberInlineTrigger } from "@/components/members/MemberInlineTrigger";
import { GroupTabs } from "@/components/group-navigation/GroupTabs";

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
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { isSystemAdmin } = useUserRoles();


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
    { key: 'name', header: 'Nome', render: (m: Member) => (
      <MemberInlineTrigger memberId={m.id} groupId={groupId} name={m.name} avatarUrl={m.profile_pic_url} />
    ) },
    { key: 'phone_e164', header: 'Telefone', render: (m: Member) => m.phone_e164 || '-', hideOn: 'sm' },
    {
      key: 'role',
      header: 'Papel',
      hideOn: 'md',
      render: (m: Member) => (
        <div className="flex gap-1 flex-wrap">
          {m.is_owner && (
            <span className="inline-flex items-center h-5 px-2 rounded-full text-[11px] font-medium bg-muted text-muted-foreground">
              Owner
            </span>
          )}
          {m.is_super_admin && (
            <span className="inline-flex items-center h-5 px-2 rounded-full text-[11px] font-medium bg-muted text-muted-foreground">
              Super Admin
            </span>
          )}
          {m.is_admin && !m.is_super_admin && (
            <span className="inline-flex items-center h-5 px-2 rounded-full text-[11px] font-medium bg-muted text-muted-foreground">
              Admin
            </span>
          )}
          {!m.is_admin && !m.is_super_admin && !m.is_owner && (
            <span className="inline-flex items-center h-5 px-2 rounded-full text-[11px] font-medium bg-muted text-muted-foreground">
              Membro
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      hideOn: 'md',
      render: (m: Member) => (
        <span className={cn(
          'inline-flex items-center h-5 px-2 rounded-full text-[11px] font-medium',
          m.left_at ? 'bg-destructive/10 text-destructive' : m.status === 'active' ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'
        )}>
          {m.left_at ? 'Saiu' : m.status === 'active' ? 'Ativo' : (m.status || '—')}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'w-10 text-right',
      render: (m: Member) => (
        <RowActions>
          <button
            onClick={(e) => { e.stopPropagation(); setSelectedMemberId(m.id); }}
            className="w-full text-left px-2 py-1.5 text-sm"
          >
            Ver detalhes
          </button>
        </RowActions>
      ),
    },
  ];

  return (
    <AdminLayout 
      title="Membros" 
      subtitle={`Membros do grupo`}
    >
      <div className="space-y-6 animate-fade-in">
        {/* Breadcrumbs */}
        <Breadcrumbs
          items={[
            { label: "Central do Bóris", href: "/" },
            { label: groupInfo?.orgName || "Organização", href: `/organization/${groupInfo?.orgId}` },
            { label: groupInfo?.groupName || "Grupo", href: `/groups/${groupId}` },
            { label: "Membros" },
          ]}
        />

        {/* Header with tabs */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex items-center gap-3 p-4 border-b border-border">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-card-foreground">Membros</h2>
              <p className="text-sm text-muted-foreground">
                {membersData?.count ?? 0} membros neste grupo
              </p>
            </div>
          </div>
          
          <GroupTabs groupId={groupId as string} activeTab="membros" />
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

        <BorisTable
          columns={columns as any}
          data={membersData?.items ?? []}
          keyExtractor={(m) => m.id}
          onRowClick={(m) => setSelectedMemberId(m.id)}
          page={page}
          pageSize={PAGE_SIZE}
          totalCount={membersData?.count}
          onPageChange={setPage}
          loading={isLoading}
          error={!!error}
          onRetry={() => refetch()}
          emptyIcon={Users}
          emptyMessage={search ? "Nenhum resultado encontrado." : "Este grupo ainda não possui membros."}
        />

        <MemberDetailsDrawer open={!!selectedMemberId} onOpenChange={() => setSelectedMemberId(null)} memberId={selectedMemberId || ""} groupId={groupId} />
      </div>
    </AdminLayout>
  );
};

export default GroupMembers;
