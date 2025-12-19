import { AdminLayout } from "@/components/layout/AdminLayout";
import { LoadingState } from "@/components/ui/loading-state";
import { useNavigate } from "react-router-dom";
import { Layers, Building2, Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserRoles } from "@/hooks/use-user-roles";
import { useAuth } from "@/hooks/use-auth";
import AccessDenied from "./AccessDenied";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
const System = () => {
  const navigate = useNavigate();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { isSystemAdmin, isLoading: rolesLoading } = useUserRoles();

  const { data: counts, isLoading: countsLoading } = useQuery({
    queryKey: ['system-counts'],
    queryFn: async () => {
      const [orgTotal, orgActive, orgInactive, groupTotal, groupActive, groupInactive] = await Promise.all([
        supabase.from('organizations').select('*', { count: 'exact', head: true }),
        supabase.from('organizations').select('*', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('organizations').select('*', { count: 'exact', head: true }).eq('status', 'inactive'),
        supabase.from('groups').select('*', { count: 'exact', head: true }),
        supabase.from('groups').select('*', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('groups').select('*', { count: 'exact', head: true }).eq('status', 'inactive'),
      ]);
      return {
        org: {
          total: orgTotal.count ?? 0,
          active: orgActive.count ?? 0,
          inactive: orgInactive.count ?? 0,
        },
        group: {
          total: groupTotal.count ?? 0,
          active: groupActive.count ?? 0,
          inactive: groupInactive.count ?? 0,
        },
      } as {
        org: { total: number; active: number; inactive: number };
        group: { total: number; active: number; inactive: number };
      };
    },
    enabled: isAuthenticated,
  });

  if (authLoading || rolesLoading) {
    return (
      <AdminLayout title="Visão geral do sistema" subtitle="Verificando acesso...">
        <LoadingState message="Verificando permissões..." />
      </AdminLayout>
    );
  }

  if (!isSystemAdmin) {
    return (
      <AccessDenied 
        message="A página /system é restrita a administradores do sistema (SYSTEM_ADMIN)."
      />
    );
  }

  return (
    <AdminLayout 
      title="Visão geral do sistema" 
      subtitle="Área exclusiva para administração global do Bóris."
    >
      <div className="space-y-6">
        <div className="flex items-center gap-3 p-4 rounded-xl border border-border bg-card">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <Layers className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-card-foreground">Visão geral do sistema</h2>
            <p className="text-sm text-muted-foreground">Área exclusiva para administração global do Bóris.</p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                Organizações
              </CardTitle>
              <CardDescription>Contagem total e por status</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {countsLoading ? (
                <LoadingState message="Carregando..." />
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-lg border border-border p-3 text-center">
                    <p className="text-xs text-muted-foreground">Total</p>
                    <p className="text-xl font-semibold">{counts?.org.total ?? 0}</p>
                  </div>
                  <div className="rounded-lg border border-border p-3 text-center">
                    <p className="text-xs text-muted-foreground">Ativas</p>
                    <p className="text-xl font-semibold text-success">{counts?.org.active ?? 0}</p>
                  </div>
                  <div className="rounded-lg border border-border p-3 text-center">
                    <p className="text-xs text-muted-foreground">Inativas</p>
                    <p className="text-xl font-semibold">{counts?.org.inactive ?? 0}</p>
                  </div>
                </div>
              )}
              <Button onClick={() => navigate('/system/organizations')} className="w-full">Gerenciar organizações</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Grupos
              </CardTitle>
              <CardDescription>Contagem total e por status</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {countsLoading ? (
                <LoadingState message="Carregando..." />
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-lg border border-border p-3 text-center">
                    <p className="text-xs text-muted-foreground">Total</p>
                    <p className="text-xl font-semibold">{counts?.group.total ?? 0}</p>
                  </div>
                  <div className="rounded-lg border border-border p-3 text-center">
                    <p className="text-xs text-muted-foreground">Ativos</p>
                    <p className="text-xl font-semibold text-success">{counts?.group.active ?? 0}</p>
                  </div>
                  <div className="rounded-lg border border-border p-3 text-center">
                    <p className="text-xs text-muted-foreground">Inativos</p>
                    <p className="text-xl font-semibold">{counts?.group.inactive ?? 0}</p>
                  </div>
                </div>
              )}
              <Button onClick={() => navigate('/system/groups')} className="w-full">Gerenciar grupos</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
};

export default System;
