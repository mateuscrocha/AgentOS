import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { useAuth } from "@/hooks/use-auth";
import { useUserRoles, AppRole } from "@/hooks/use-user-roles";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { toast } from "sonner";
import { 
  Users as UsersIcon, 
  Building2, 
  UserCog, 
  Plus,
  Trash2,
  Crown,
  UserCheck
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import AccessDenied from "./AccessDenied";

interface Profile {
  id: string;
  name: string | null;
  phone_e164: string | null;
  status: string | null;
  created_at: string;
}

interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  organization_id: string | null;
  group_id: string | null;
  created_at: string;
  organization?: { name: string } | null;
  group?: { name: string } | null;
}

interface Organization {
  id: string;
  name: string;
}

interface Group {
  id: string;
  name: string;
  organization_id: string;
}

const ROLE_LABELS: Record<AppRole, string> = {
  'SYSTEM_ADMIN': 'Administrador do Sistema',
  'ORG_ADMIN': 'Gestor de Organização',
  'GROUP_MANAGER': 'Gestor de Grupo',
  'USER': 'Usuário',
};

const ROLE_ICONS: Record<AppRole, React.ElementType> = {
  'SYSTEM_ADMIN': Crown,
  'ORG_ADMIN': Building2,
  'GROUP_MANAGER': UserCog,
  'USER': UserCheck,
};

const ROLE_COLORS: Record<AppRole, string> = {
  'SYSTEM_ADMIN': 'bg-destructive text-destructive-foreground',
  'ORG_ADMIN': 'bg-warning text-warning-foreground',
  'GROUP_MANAGER': 'bg-primary text-primary-foreground',
  'USER': 'bg-secondary text-secondary-foreground',
};

export default function Users() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { isSystemAdmin, isLoading: rolesLoading } = useUserRoles();
  const queryClient = useQueryClient();
  
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [isAddRoleOpen, setIsAddRoleOpen] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<UserRole | null>(null);
  
  // Form state for adding role
  const [newRole, setNewRole] = useState<AppRole>('USER');
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');

  // Fetch all profiles
  const { data: profiles, isLoading: profilesLoading, error: profilesError } = useQuery({
    queryKey: ['all-profiles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, phone_e164, status, created_at')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Profile[];
    },
    enabled: isAuthenticated && isSystemAdmin,
  });

  // Fetch all user roles
  const { data: allRoles, isLoading: rolesDataLoading } = useQuery({
    queryKey: ['all-user-roles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select(`
          id,
          user_id,
          role,
          organization_id,
          group_id,
          created_at
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as UserRole[];
    },
    enabled: isAuthenticated && isSystemAdmin,
  });

  // Fetch organizations for the role assignment form
  const { data: organizations } = useQuery({
    queryKey: ['all-organizations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organizations')
        .select('id, name')
        .order('name');
      
      if (error) throw error;
      return data as Organization[];
    },
    enabled: isAuthenticated && isSystemAdmin,
  });

  // Fetch groups for the role assignment form
  const { data: groups } = useQuery({
    queryKey: ['all-groups'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('groups')
        .select('id, name, organization_id')
        .order('name');
      
      if (error) throw error;
      return data as Group[];
    },
    enabled: isAuthenticated && isSystemAdmin,
  });

  // Add role mutation
  const addRoleMutation = useMutation({
    mutationFn: async ({ userId, role, organizationId, groupId }: {
      userId: string;
      role: AppRole;
      organizationId: string | null;
      groupId: string | null;
    }) => {
      const { error } = await supabase
        .from('user_roles')
        .insert({
          user_id: userId,
          role,
          organization_id: organizationId,
          group_id: groupId,
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-user-roles'] });
      toast.success('Papel atribuído com sucesso');
      setIsAddRoleOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast.error('Erro ao atribuir papel: ' + error.message);
    },
  });

  // Delete role mutation
  const deleteRoleMutation = useMutation({
    mutationFn: async (roleId: string) => {
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('id', roleId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-user-roles'] });
      toast.success('Papel removido com sucesso');
      setRoleToDelete(null);
    },
    onError: (error: Error) => {
      toast.error('Erro ao remover papel: ' + error.message);
    },
  });

  const resetForm = () => {
    setNewRole('USER');
    setSelectedOrgId('');
    setSelectedGroupId('');
  };

  const handleAddRole = () => {
    if (!selectedUser) return;
    
    let organizationId: string | null = null;
    let groupId: string | null = null;
    
    if (newRole === 'ORG_ADMIN' || newRole === 'USER') {
      if (!selectedOrgId) {
        toast.error('Selecione uma organização');
        return;
      }
      organizationId = selectedOrgId;
    }
    
    if (newRole === 'GROUP_MANAGER') {
      if (!selectedGroupId) {
        toast.error('Selecione um grupo');
        return;
      }
      groupId = selectedGroupId;
      // Also set the organization from the group
      const group = groups?.find(g => g.id === selectedGroupId);
      if (group) {
        organizationId = group.organization_id;
      }
    }
    
    addRoleMutation.mutate({
      userId: selectedUser.id,
      role: newRole,
      organizationId,
      groupId,
    });
  };

  const getUserRoles = (userId: string): UserRole[] => {
    return allRoles?.filter(r => r.user_id === userId) || [];
  };

  const getOrgName = (orgId: string | null): string => {
    if (!orgId) return '';
    const org = organizations?.find(o => o.id === orgId);
    return org?.name || 'Organização';
  };

  const getGroupName = (groupId: string | null): string => {
    if (!groupId) return '';
    const group = groups?.find(g => g.id === groupId);
    return group?.name || 'Grupo';
  };

  // Loading states
  if (authLoading || rolesLoading) {
    return (
      <AdminLayout title="Usuários" subtitle="Gerenciamento de usuários e papéis">
        <LoadingState message="Carregando..." />
      </AdminLayout>
    );
  }

  // Access control
  if (!isSystemAdmin) {
    return <AccessDenied />;
  }

  const renderUserRow = (profile: Profile) => {
    const userRoles = getUserRoles(profile.id);
    return (
      <tr key={profile.id} className="border-b border-border hover:bg-secondary/30 transition-colors">
        <td className="px-4 py-3">
          <div className="font-medium text-card-foreground">
            {profile.name || 'Sem nome'}
          </div>
        </td>
        <td className="px-4 py-3">
          <span className="text-muted-foreground">
            {profile.phone_e164 || '-'}
          </span>
        </td>
        <td className="px-4 py-3">
          {userRoles.length === 0 ? (
            <span className="text-muted-foreground text-sm">Sem papéis</span>
          ) : (
            <div className="flex flex-wrap gap-1">
              {userRoles.map((role) => {
                const Icon = ROLE_ICONS[role.role];
                return (
                  <Badge 
                    key={role.id} 
                    className={`${ROLE_COLORS[role.role]} flex items-center gap-1`}
                  >
                    <Icon className="h-3 w-3" />
                    <span className="text-xs">
                      {role.role === 'SYSTEM_ADMIN' && 'Admin'}
                      {role.role === 'ORG_ADMIN' && getOrgName(role.organization_id)}
                      {role.role === 'GROUP_MANAGER' && getGroupName(role.group_id)}
                      {role.role === 'USER' && getOrgName(role.organization_id)}
                    </span>
                  </Badge>
                );
              })}
            </div>
          )}
        </td>
        <td className="px-4 py-3">
          <Badge variant={profile.status === 'active' ? 'default' : 'secondary'}>
            {profile.status === 'active' ? 'Ativo' : profile.status || 'Desconhecido'}
          </Badge>
        </td>
        <td className="px-4 py-3">
          <span className="text-muted-foreground text-sm">
            {format(new Date(profile.created_at), "dd/MM/yyyy", { locale: ptBR })}
          </span>
        </td>
        <td className="px-4 py-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSelectedUser(profile);
              setIsAddRoleOpen(true);
            }}
          >
            <UserCog className="h-4 w-4 mr-1" />
            Gerenciar
          </Button>
        </td>
      </tr>
    );
  };

  return (
    <AdminLayout 
      title="Usuários" 
      subtitle="Gerenciamento de usuários e papéis do sistema"
    >
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <UsersIcon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-card-foreground">{profiles?.length || 0}</p>
                <p className="text-sm text-muted-foreground">Total de Usuários</p>
              </div>
            </div>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10">
                <Crown className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold text-card-foreground">
                  {allRoles?.filter(r => r.role === 'SYSTEM_ADMIN').length || 0}
                </p>
                <p className="text-sm text-muted-foreground">Admins do Sistema</p>
              </div>
            </div>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-warning/10">
                <Building2 className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold text-card-foreground">
                  {allRoles?.filter(r => r.role === 'ORG_ADMIN').length || 0}
                </p>
                <p className="text-sm text-muted-foreground">Gestores de Org</p>
              </div>
            </div>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <UserCog className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-card-foreground">
                  {allRoles?.filter(r => r.role === 'GROUP_MANAGER').length || 0}
                </p>
                <p className="text-sm text-muted-foreground">Gestores de Grupo</p>
              </div>
            </div>
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="p-4 border-b border-border">
            <h2 className="text-lg font-semibold text-card-foreground">Todos os Usuários</h2>
          </div>
          {profilesLoading || rolesDataLoading ? (
            <div className="p-8">
              <LoadingState message="Carregando usuários..." />
            </div>
          ) : profilesError ? (
            <div className="p-8">
              <ErrorState message="Erro ao carregar usuários" />
            </div>
          ) : !profiles || profiles.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={UsersIcon}
                title="Nenhum usuário encontrado"
                message="Não há usuários cadastrados no sistema."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-secondary/30">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Nome</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Telefone</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Papéis</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Criado em</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {profiles.map(renderUserRow)}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Manage User Roles Dialog */}
      <Dialog open={isAddRoleOpen} onOpenChange={setIsAddRoleOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Gerenciar Papéis</DialogTitle>
            <DialogDescription>
              {selectedUser?.name || 'Usuário'} - {selectedUser?.phone_e164 || 'Sem telefone'}
            </DialogDescription>
          </DialogHeader>

          {/* Current Roles */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-card-foreground">Papéis Atuais</h4>
            {selectedUser && getUserRoles(selectedUser.id).length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum papel atribuído</p>
            ) : (
              <div className="space-y-2">
                {selectedUser && getUserRoles(selectedUser.id).map((role) => {
                  const Icon = ROLE_ICONS[role.role];
                  return (
                    <div 
                      key={role.id} 
                      className="flex items-center justify-between p-2 rounded-lg bg-secondary/50"
                    >
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{ROLE_LABELS[role.role]}</span>
                        {role.organization_id && (
                          <span className="text-xs text-muted-foreground">
                            ({getOrgName(role.organization_id)})
                          </span>
                        )}
                        {role.group_id && (
                          <span className="text-xs text-muted-foreground">
                            ({getGroupName(role.group_id)})
                          </span>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setRoleToDelete(role)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Add New Role */}
          <div className="space-y-3 pt-4 border-t border-border">
            <h4 className="text-sm font-medium text-card-foreground">Adicionar Novo Papel</h4>
            
            <div className="space-y-3">
              <Select value={newRole} onValueChange={(v) => setNewRole(v as AppRole)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o papel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SYSTEM_ADMIN">Administrador do Sistema</SelectItem>
                  <SelectItem value="ORG_ADMIN">Gestor de Organização</SelectItem>
                  <SelectItem value="GROUP_MANAGER">Gestor de Grupo</SelectItem>
                  <SelectItem value="USER">Usuário</SelectItem>
                </SelectContent>
              </Select>

              {(newRole === 'ORG_ADMIN' || newRole === 'USER') && (
                <Select value={selectedOrgId} onValueChange={setSelectedOrgId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a organização" />
                  </SelectTrigger>
                  <SelectContent>
                    {organizations?.map((org) => (
                      <SelectItem key={org.id} value={org.id}>
                        {org.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {newRole === 'GROUP_MANAGER' && (
                <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o grupo" />
                  </SelectTrigger>
                  <SelectContent>
                    {groups?.map((group) => (
                      <SelectItem key={group.id} value={group.id}>
                        {group.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddRoleOpen(false)}>
              Fechar
            </Button>
            <Button onClick={handleAddRole} disabled={addRoleMutation.isPending}>
              <Plus className="h-4 w-4 mr-1" />
              Adicionar Papel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Role Confirmation */}
      <AlertDialog open={!!roleToDelete} onOpenChange={() => setRoleToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Papel</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover o papel "{roleToDelete && ROLE_LABELS[roleToDelete.role]}"? 
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => roleToDelete && deleteRoleMutation.mutate(roleToDelete.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
