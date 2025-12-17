import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { ConnectionStatus } from "@/components/dashboard/ConnectionStatus";
import { RulesCard } from "@/components/dashboard/RulesCard";
import { LoadingState } from "@/components/ui/loading-state";
import { Users, MessageSquare, Building2, Layers, Shield, Activity } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useUserRoles } from "@/hooks/use-user-roles";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const Index = () => {
  const navigate = useNavigate();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { 
    roles, 
    isLoading: rolesLoading, 
    isSystemAdmin, 
    isOrgAdmin, 
    isGroupManager,
    getRoleLabel,
    getAccessibleOrgIds,
    getAccessibleGroupIds,
  } = useUserRoles();

  // Check if user has any access
  const hasAccess = isSystemAdmin || (roles && roles.length > 0);

  const accessibleOrgIds = getAccessibleOrgIds();
  const accessibleGroupIds = getAccessibleGroupIds();

  // Fetch stats based on user role
  const { data: stats } = useQuery({
    queryKey: ['dashboard-stats', isSystemAdmin, accessibleOrgIds, accessibleGroupIds],
    queryFn: async () => {
      // System admin sees all stats
      if (isSystemAdmin) {
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
      }
      
      // Other roles see filtered stats (RLS handles the filtering)
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

  const roleLabel = getRoleLabel();

  // Different welcome messages based on role
  const getWelcomeMessage = () => {
    if (isSystemAdmin) return "Visão completa do sistema";
    if (isOrgAdmin) return "Gerencie sua organização";
    if (isGroupManager) return "Gerencie seus grupos";
    return "Acesse seus recursos";
  };

  return (
    <AdminLayout 
      title="Dashboard" 
      subtitle={getWelcomeMessage()}
    >
      {/* Role indicator card */}
      <Card className="mb-6 bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
        <CardContent className="flex items-center gap-4 py-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/20">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="font-medium text-foreground">{roleLabel || 'Carregando...'}</p>
            <p className="text-sm text-muted-foreground">
              {isSystemAdmin && "Acesso total ao sistema"}
              {isOrgAdmin && !isSystemAdmin && "Gerenciamento de organização"}
              {isGroupManager && !isOrgAdmin && !isSystemAdmin && "Gerenciamento de grupo"}
              {!isSystemAdmin && !isOrgAdmin && !isGroupManager && "Acesso de visualização"}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid - different for each role */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-6">
        {/* System Admin sees all stats */}
        {isSystemAdmin && (
          <>
            <StatsCard
              title="Organizações"
              value={stats?.organizations.toString() ?? "—"}
              description="Total no sistema"
              icon={Building2}
              onClick={() => navigate('/system')}
            />
            <StatsCard
              title="Grupos"
              value={stats?.groups.toString() ?? "—"}
              description="Total no sistema"
              icon={Layers}
            />
            <StatsCard
              title="Membros"
              value={stats?.members.toString() ?? "—"}
              description="Total no sistema"
              icon={Users}
            />
            <StatsCard
              title="Mensagens"
              value={stats?.messages.toString() ?? "—"}
              description="Total no sistema"
              icon={MessageSquare}
            />
          </>
        )}

        {/* Org Admin or Group Manager sees filtered stats */}
        {!isSystemAdmin && (
          <>
            <StatsCard
              title="Minhas Organizações"
              value={stats?.organizations.toString() ?? "—"}
              description="Com acesso"
              icon={Building2}
            />
            <StatsCard
              title="Meus Grupos"
              value={stats?.groups.toString() ?? "—"}
              description="Com acesso"
              icon={Layers}
            />
            <StatsCard
              title="Membros"
              value={stats?.members.toString() ?? "—"}
              description="Nos meus grupos"
              icon={Users}
            />
            <StatsCard
              title="Mensagens"
              value={stats?.messages.toString() ?? "—"}
              description="Nos meus grupos"
              icon={MessageSquare}
            />
          </>
        )}
      </div>

      {/* Main Content - different for each role */}
      <div className="grid gap-6 lg:grid-cols-2">
        {isSystemAdmin ? (
          <>
            <ConnectionStatus />
            <RulesCard />
          </>
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-primary" />
                  Atividade Recente
                </CardTitle>
                <CardDescription>
                  Últimas atividades nos seus recursos
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Em breve: histórico de atividades nos seus grupos e organizações.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  Acesso Rápido
                </CardTitle>
                <CardDescription>
                  Navegue para seus recursos
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {stats?.organizations && stats.organizations > 0 && (
                  <p className="text-sm">
                    Você tem acesso a <strong>{stats.organizations}</strong> organização(ões)
                  </p>
                )}
                {stats?.groups && stats.groups > 0 && (
                  <p className="text-sm">
                    Você tem acesso a <strong>{stats.groups}</strong> grupo(s)
                  </p>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Quick actions - role-specific */}
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {isSystemAdmin && (
          <>
            <button
              onClick={() => navigate('/system')}
              className="flex items-center gap-3 p-4 rounded-xl border border-border bg-card hover:bg-secondary/50 transition-colors text-left"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium text-card-foreground">Gerenciar Sistema</p>
                <p className="text-xs text-muted-foreground">Organizações e configurações</p>
              </div>
            </button>
            <button
              onClick={() => navigate('/system/events')}
              className="flex items-center gap-3 p-4 rounded-xl border border-border bg-card hover:bg-secondary/50 transition-colors text-left"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <Activity className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium text-card-foreground">Ver Eventos</p>
                <p className="text-xs text-muted-foreground">Logs de auditoria do sistema</p>
              </div>
            </button>
          </>
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
            <p className="text-xs text-muted-foreground">Perfil e configurações</p>
          </div>
        </button>
      </div>
    </AdminLayout>
  );
};

export default Index;
