import { AdminLayout } from "@/components/layout/AdminLayout";
import { BorisTable, RowActions } from "@/components/ui/boris-table";
import { LoadingState } from "@/components/ui/loading-state";
import { GroupPageTop } from "@/components/group-navigation/GroupPageTop";
import { useParams } from "react-router-dom";
import { Users, Search, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
 
import AccessDenied from "./AccessDenied";
import { MemberDetailsDrawer } from "@/components/members/MemberDetailsDrawer";

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
  whatsapp_provider_id: string | null;
  profile_pic_url: string | null;
  joined_at: string | null;
  left_at: string | null;
  last_seen_message_at: string | null;
  status: string;
  deleted_at: string | null;
  metadata: Record<string, any> | null;
  raw_provider: Record<string, any> | null;
}

type MemberRoleKey = "OWNER" | "SUPERADMIN" | "ADMIN" | "MEMBRO";

const getMemberRoleKey = (m: Pick<Member, "is_owner" | "is_super_admin" | "is_admin">): MemberRoleKey => {
  if (m.is_owner) return "OWNER";
  if (m.is_super_admin) return "SUPERADMIN";
  if (m.is_admin) return "ADMIN";
  return "MEMBRO";
};

const ROLE_BADGE: Record<MemberRoleKey, { label: string; className: string }> = {
  OWNER: {
    label: "Dono",
    className: "border-orange-200/70 bg-orange-100/55 text-orange-950",
  },
  SUPERADMIN: {
    label: "Super Admin",
    className: "border-violet-200/70 bg-violet-100/55 text-violet-950",
  },
  ADMIN: {
    label: "Admin",
    className: "border-sky-200/70 bg-sky-100/55 text-sky-950",
  },
  MEMBRO: {
    label: "Membro",
    className: "border-border bg-muted/50 text-muted-foreground",
  },
};

const MemberRoleBadge = ({ role }: { role: MemberRoleKey }) => {
  const cfg = ROLE_BADGE[role];
  return (
    <span
      className={cn(
        "inline-flex items-center h-5 px-2 rounded-full border text-[10px] font-semibold leading-none",
        cfg.className
      )}
    >
      {cfg.label}
    </span>
  );
};

const GroupMembers = () => {
  const { groupId } = useParams();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "superadmin" | "admin" | "member">("all");
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const { isAuthenticated, loading: authLoading } = useAuth();
  


  // Fetch group info for breadcrumbs
  const { data: groupInfo } = useQuery({
    queryKey: ['group-info', groupId],
    queryFn: async () => {
      const { data: group } = await supabase
        .from('groups')
        .select('name, organization_id, provider, sync_status')
        .eq('id', groupId)
        .maybeSingle();
      
      if (!group) return null;

      const { data: org } = await supabase
        .from('organizations')
        .select('name')
        .eq('id', group.organization_id)
        .maybeSingle();

      return { groupName: group.name, orgName: org?.name, orgId: group.organization_id, provider: group.provider, syncStatus: group.sync_status };
    },
    enabled: !!groupId && isAuthenticated,
  });

  // Fetch members
  const { data: membersData, isLoading, error, refetch } = useQuery({
    queryKey: ['group-members', groupId, page, search, roleFilter],
    queryFn: async () => {
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      
      let query = supabase
        .from('members')
        .select('*', { count: 'exact' })
        .eq('group_id', groupId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (roleFilter === 'superadmin') {
        query = query.or('is_owner.eq.true,is_super_admin.eq.true');
      }

      if (roleFilter === 'admin') {
        query = query.eq('is_admin', true).eq('is_super_admin', false).eq('is_owner', false);
      }

      if (roleFilter === 'member') {
        query = query.eq('is_admin', false).eq('is_super_admin', false).eq('is_owner', false);
      }
      
      if (search) {
        query = query.or(`name.ilike.%${search}%,phone_e164.ilike.%${search}%,display_name.ilike.%${search}%`);
      }
      
      const { data, error, count } = await query.range(from, to);
      
      if (error) throw error;
      return { items: (data ?? []) as Member[], count: count ?? 0 };
    },
    enabled: !!groupId && isAuthenticated,
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
    enabled: !!groupId && isAuthenticated,
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
    {
      key: 'name',
      header: 'Nome',
      render: (m: Member) => {
        const role = getMemberRoleKey(m);
        const displayName = m.display_name || m.name;
        return (
          <div className="min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <button
                type="button"
                className="flex items-center gap-2 min-w-0 text-left"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedMemberId(m.id);
                }}
              >
                <Avatar className="h-6 w-6">
                  {m.profile_pic_url ? (
                    <AvatarImage src={m.profile_pic_url} alt="" referrerPolicy="no-referrer" />
                  ) : (
                    <AvatarFallback>{displayName?.[0]?.toUpperCase() || ""}</AvatarFallback>
                  )}
                </Avatar>
                <span className="min-w-0 truncate text-sm font-medium text-card-foreground">{displayName}</span>
              </button>
              <MemberRoleBadge role={role} />
            </div>
            {m.phone_e164 ? (
              <div className="mt-0.5 text-xs text-muted-foreground tabular-nums truncate">{m.phone_e164}</div>
            ) : null}
          </div>
        );
      },
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
      subtitle={`${(totalMembersCount ?? 0)} cadastrados${search ? ` • ${(membersData?.count ?? 0)} resultados da busca` : ""}`}
    >
      <div className="space-y-6 animate-fade-in">
        <GroupPageTop
          breadcrumbItems={[
            { label: "Central do Bóris", href: "/" },
            { label: groupInfo?.orgName || "Organização", href: `/organization/${groupInfo?.orgId}` },
            { label: groupInfo?.groupName || "Grupo", href: `/groups/${groupId}` },
            { label: "Membros" },
          ]}
          group={{
            groupId: groupId as string,
            organizationId: groupInfo?.orgId || undefined,
            name: groupInfo?.groupName || "",
            provider: groupInfo?.provider || "",
            totalMembers: (totalMembersCount ?? 0) as number,
            lastMessageAt: lastMessageAt ?? null,
            syncStatus: groupInfo?.syncStatus || null,
          }}
          filters={(
            <div className="flex flex-col sm:flex-row gap-2 w-full max-w-2xl">
              <div className="relative w-full">
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

              <Select
                value={roleFilter}
                onValueChange={(v) => {
                  if (v === 'all' || v === 'superadmin' || v === 'admin' || v === 'member') {
                    setRoleFilter(v);
                    setPage(1);
                  }
                }}
              >
                <SelectTrigger className="h-10 sm:w-[200px]">
                  <SelectValue placeholder="Função" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="superadmin">Superadmins</SelectItem>
                  <SelectItem value="admin">Admins</SelectItem>
                  <SelectItem value="member">Membros</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          showClearFilters={!!search || roleFilter !== 'all'}
          onClearFilters={() => { setSearch(""); setRoleFilter('all'); setPage(1); }}
        />

        {/* KPIs removidos: mantemos apenas descrição textual no header */}

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
