import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { ConnectionStatus } from "@/components/dashboard/ConnectionStatus";
import { RulesCard } from "@/components/dashboard/RulesCard";
import { LoadingState } from "@/components/ui/loading-state";
import { Users, MessageSquare, Building2, Layers } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useUserRoles } from "@/hooks/use-user-roles";
import { supabase } from "@/integrations/supabase/client";

const Index = () => {
  const navigate = useNavigate();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { roles, isLoading: rolesLoading, isSystemAdmin } = useUserRoles();

  // Check if user has any access
  const hasAccess = isSystemAdmin || (roles && roles.length > 0);

  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const [orgsRes, groupsRes, membersRes, messagesRes] = await Promise.all([
        supabase.from('organizations').select('*', { count: 'exact', head: true }),
        supabase.from('groups').select('*', { count: 'exact', head: true }),
        supabase.from('members').select('*', { count: 'exact', head: true }),
        supabase.from('messages').select('*', { count: 'exact', head: true }),
      ]);
      
      return {
        organizations: orgsRes.count ?? 0,
        groups: groupsRes.count ?? 0,
        members: membersRes.count ?? 0,
        messages: messagesRes.count ?? 0,
      };
    },
    enabled: isAuthenticated && hasAccess,
  });

  // Redirect to no-access if user has no roles
  useEffect(() => {
    if (!authLoading && !rolesLoading && isAuthenticated && !hasAccess) {
      navigate('/no-access', { replace: true });
    }
  }, [authLoading, rolesLoading, isAuthenticated, hasAccess, navigate]);

  // Redirect to auth if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/auth', { replace: true });
    }
  }, [authLoading, isAuthenticated, navigate]);

  if (authLoading || rolesLoading) {
    return (
      <AdminLayout title="Dashboard" subtitle="Carregando...">
        <LoadingState message="Verificando acesso..." />
      </AdminLayout>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  if (!hasAccess) {
    return null; // Will redirect to /no-access
  }

  return (
    <AdminLayout 
      title="Dashboard" 
      subtitle="Bóris Admin V4 - Visão geral do sistema"
    >
      {/* Stats Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-6">
        <StatsCard
          title="Organizações"
          value={stats?.organizations.toString() ?? "—"}
          description={isSystemAdmin ? "Total no sistema" : "Com acesso"}
          icon={Building2}
          onClick={() => navigate('/system')}
        />
        <StatsCard
          title="Grupos"
          value={stats?.groups.toString() ?? "—"}
          description={isSystemAdmin ? "Total no sistema" : "Com acesso"}
          icon={Layers}
        />
        <StatsCard
          title="Membros"
          value={stats?.members.toString() ?? "—"}
          description="Nos grupos acessíveis"
          icon={Users}
        />
        <StatsCard
          title="Mensagens"
          value={stats?.messages.toString() ?? "—"}
          description="Nos grupos acessíveis"
          icon={MessageSquare}
        />
      </div>

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ConnectionStatus />
        <RulesCard />
      </div>

      {/* Quick actions */}
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {isSystemAdmin && (
          <button
            onClick={() => navigate('/system')}
            className="flex items-center gap-3 p-4 rounded-xl border border-border bg-card hover:bg-secondary/50 transition-colors text-left"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-medium text-card-foreground">Gerenciar Organizações</p>
              <p className="text-xs text-muted-foreground">Ver todas as organizações do sistema</p>
            </div>
          </button>
        )}
        
        <button
          onClick={() => navigate('/account')}
          className="flex items-center gap-3 p-4 rounded-xl border border-border bg-card hover:bg-secondary/50 transition-colors text-left"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="font-medium text-card-foreground">Minha Conta</p>
            <p className="text-xs text-muted-foreground">Gerenciar perfil e segurança</p>
          </div>
        </button>
      </div>
    </AdminLayout>
  );
};

export default Index;
