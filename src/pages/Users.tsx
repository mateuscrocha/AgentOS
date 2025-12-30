import { useState } from "react";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { useAuth } from "@/hooks/use-auth";
import { useUserRoles, AppRole } from "@/hooks/use-user-roles";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { AdminPageHeader } from "@/components/layout/AdminPageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { BorisTable, RowActions } from "@/components/ui/boris-table";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
import { notify } from "@/components/ui/sonner";
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
import { StatsCard } from "@/components/dashboard/StatsCard";
import { PeriodFilter } from "@/components/group-dashboard/PeriodFilter";
import { getDateRange, PeriodType, DateRange } from "@/components/group-dashboard/period-utils";

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

interface UserAccessScope {
  id: string;
  user_id: string;
  scope_type: 'organization' | 'group';
  scope_id: string;
  created_at: string;
}

type CreateUserPayload = {
  name: string;
  email: string;
  whatsapp_phone: string;
  password: string;
  scope_type: 'organization' | 'group';
  scope_id: string;
  assign_org_admin?: boolean;
};

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
  
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>('7d');
  const [customRange, setCustomRange] = useState<DateRange | undefined>();
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [isAddRoleOpen, setIsAddRoleOpen] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<UserRole | null>(null);
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPhone, setNewUserPhone] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserPasswordConfirm, setNewUserPasswordConfirm] = useState("");
  const [scopeType, setScopeType] = useState<'organization' | 'group' | ''>('');
  const [selectedScopeOrgId, setSelectedScopeOrgId] = useState<string>('');
  const [selectedScopeGroupId, setSelectedScopeGroupId] = useState<string>('');
  const [assignOrgAdmin, setAssignOrgAdmin] = useState(false);
  
  // Form state for adding role
  const [newRole, setNewRole] = useState<AppRole>('USER');
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');

  const currentRange = getDateRange(selectedPeriod, customRange);
  const currentStartISO = currentRange.from.toISOString();
  const currentEndISO = currentRange.to.toISOString();

  const { data: profiles, isLoading: profilesLoading, error: profilesError } = useQuery({
    queryKey: ['all-profiles', selectedPeriod, customRange?.from?.toISOString(), customRange?.to?.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, phone_e164, status, created_at')
        .gte('created_at', currentStartISO)
        .lte('created_at', currentEndISO)
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

  const { data: accessScopes, isLoading: scopesLoading } = useQuery({
    queryKey: ['all-user-access-scopes'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('user_access_scope')
        .select('id, user_id, scope_type, scope_id, created_at')
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as UserAccessScope[];
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
      notify.success('Papel atribuído', 'O papel foi adicionado.');
      setIsAddRoleOpen(false);
      resetForm();
    },
    onError: () => {
      notify.error('Não foi possível concluir', 'Algo deu errado. Tente novamente.');
    },
  });

  const normalizePhoneE164 = (phone: string): string => {
    const raw = (phone || "").trim();
    if (!raw) return "";
    if (raw.startsWith("+")) {
      return raw.replace(/\s+/g, "");
    }
    const digits = raw.replace(/\D/g, "");
    if (!digits) return "";
    if (digits.startsWith("55") && digits.length >= 10) {
      return "+" + digits;
    }
    return "+55" + digits;
  };

  const createUserMutation = useMutation({
    mutationFn: async (payload: CreateUserPayload) => {
      let attempt = 0;
      const maxRetries = 3;
      let lastErr: any = null;
      while (attempt <= maxRetries) {
        const { data, error } = await supabase.functions.invoke("admin-create-user", { body: payload });
        if (!error && data?.success) return data;
        let message = error?.message || data?.message || "Falha ao criar usuário";
        let status: number | undefined = undefined;
        if (error instanceof FunctionsHttpError && (error as any).context) {
          try {
            const body = await (error as any).context.json();
            if (body?.message) message = body.message;
            if (typeof body?.status === "number") status = body.status;
            if (!status && body?.code === "EMAIL_EXISTS") status = 409;
          } catch (e) { void 0; }
        }
        lastErr = Object.assign(new Error(message), { status });
        const msg = (message || "").toLowerCase();
        const isNetwork = msg.includes("failed to send a request") || msg.includes("fetch") || msg.includes("network");
        if (!isNetwork || attempt === maxRetries) throw lastErr;
        const delay = Math.round(400 * Math.pow(2, attempt) + Math.random() * 120);
        await new Promise((r) => setTimeout(r, delay));
        attempt += 1;
      }
      if (lastErr) throw lastErr;
    },
    onSuccess: (result: any) => {
      const assigned = !!result?.assigned_org_admin;
      queryClient.invalidateQueries({ queryKey: ["all-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["all-user-roles"] });
      queryClient.invalidateQueries({ queryKey: ["all-user-access-scopes"] });
      if (assigned) {
        notify.success('Usuário criado como Gestor de Organização', 'Privilégios aplicados com sucesso.');
      } else {
        notify.success('Usuário criado com sucesso e com acesso configurado', 'Tudo certo.');
      }
      setIsAddUserOpen(false);
      setNewUserName("");
      setNewUserEmail("");
      setNewUserPhone("");
      setNewUserPassword("");
      setNewUserPasswordConfirm("");
      setScopeType('');
      setSelectedScopeOrgId('');
      setSelectedScopeGroupId('');
      setAssignOrgAdmin(false);
    },
    onError: (err: any) => {
      const raw = (err?.message || '').toLowerCase();
      if (raw.includes('already registered') || raw.includes('email exists') || err?.status === 409) {
        notify.error('Email já existente', 'Escolha outro email.');
        return;
      }
      if (raw.includes('unauthorized')) {
        notify.error('Sem autorização', 'Faça login novamente como administrador do sistema.');
        return;
      }
      if (raw.includes('forbidden')) {
        notify.error('Acesso negado', 'Você não possui permissão para criar usuários.');
        return;
      }
      if (raw.includes('escopo inicial obrigatório') || raw.includes('escopo inválido')) {
        notify.error('Dados inválidos', 'Selecione corretamente o escopo inicial.');
        return;
      }
      if (raw.includes('erro ao criar escopo inicial')) {
        notify.error('Falha na permissão', 'O escopo não pôde ser criado. Tente novamente.');
        return;
      }
      notify.error('Falha na criação ou permissão', err?.message || 'Algo deu errado. Tente novamente.');
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
      notify.success('Papel removido', 'Tudo certo.');
      setRoleToDelete(null);
    },
    onError: () => {
      notify.error('Não foi possível concluir', 'Algo deu errado. Tente novamente.');
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
        notify.warning('Atenção', 'Selecione uma organização.');
        return;
      }
      organizationId = selectedOrgId;
    }
    
    if (newRole === 'GROUP_MANAGER') {
      if (!selectedGroupId) {
        notify.warning('Atenção', 'Selecione um grupo.');
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

  const columns = [
    {
      key: 'name',
      header: 'Nome',
      render: (profile: Profile) => (
        <div className="font-medium text-card-foreground">{profile.name || 'Sem nome'}</div>
      ),
    },
    {
      key: 'phone_e164',
      header: 'Telefone',
      hideOn: 'sm' as const,
      render: (profile: Profile) => (
        <span className="text-muted-foreground">{profile.phone_e164 || '-'}</span>
      ),
    },
    {
      key: 'access_scope',
      header: 'Acesso',
      render: (profile: Profile) => {
        const scopes = (accessScopes || []).filter(s => s.user_id === profile.id);
        if (scopes.length === 0) return <span className="text-muted-foreground text-sm">Sem escopo</span>;
        const s = scopes[0];
        if (s.scope_type === 'organization') {
          return <span className="text-sm">Organização: {getOrgName(s.scope_id)}</span>;
        }
        if (s.scope_type === 'group') {
          return <span className="text-sm">Grupo: {getGroupName(s.scope_id)}</span>;
        }
        return <span className="text-muted-foreground text-sm">-</span>;
      },
    },
    {
      key: 'roles',
      header: 'Papéis',
      render: (profile: Profile) => {
        const userRoles = getUserRoles(profile.id);
        if (userRoles.length === 0) {
          return <span className="text-muted-foreground text-sm">Sem papéis</span>;
        }
        return (
          <div className="flex flex-wrap gap-1">
            {userRoles.map((role) => {
              const Icon = ROLE_ICONS[role.role];
              return (
                <Badge key={role.id} className={`${ROLE_COLORS[role.role]} flex items-center gap-1`}>
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
        );
      },
    },
    {
      key: 'status',
      header: 'Status',
      render: (profile: Profile) => (
        <Badge variant={profile.status === 'active' ? 'default' : 'secondary'}>
          {profile.status === 'active' ? 'Ativo' : profile.status || 'Desconhecido'}
        </Badge>
      ),
    },
    {
      key: 'created_at',
      header: 'Criado em',
      hideOn: 'md' as const,
      render: (profile: Profile) => (
        <span className="text-muted-foreground text-sm">
          {format(new Date(profile.created_at), 'dd/MM/yyyy', { locale: ptBR })}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'w-10',
      render: (profile: Profile) => (
        <RowActions>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSelectedUser(profile);
              setIsAddRoleOpen(true);
            }}
            className="w-full text-left px-2 py-1.5 text-sm"
          >
            Gerenciar papéis
          </button>
        </RowActions>
      ),
    },
  ];

  return (
    <AdminLayout 
      title="Usuários" 
      subtitle="Gerenciamento de usuários e papéis do sistema"
    >
      <div className="space-y-6">
        <AdminPageHeader
          breadcrumbItems={[{ label: "Central de Comando", href: "/" }, { label: "Usuários" }]}
          title="Usuários"
          description="Gerenciamento de usuários e papéis do sistema"
          actions={(
            <Button onClick={() => setIsAddUserOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Novo Usuário
            </Button>
          )}
          filters={(
            <div className="flex flex-wrap items-center gap-2">
              <PeriodFilter
                value={selectedPeriod}
                customRange={customRange}
                onChange={(p, r) => { setSelectedPeriod(p); setCustomRange(p === 'custom' ? r : undefined); }}
              />
            </div>
          )}
          showClearFilters={selectedPeriod !== '7d' || !!customRange}
          onClearFilters={() => { setSelectedPeriod('7d'); setCustomRange(undefined); }}
          filteredKpis={(
            <StatsCard
              title="Usuários no período"
              value={profiles?.length ?? '—'}
              icon={UsersIcon}
              variant="kpi"
            />
          )}
          generalKpis={(
            <>
              <StatsCard
                title="Admins do Sistema"
                value={allRoles?.filter(r => r.role === 'SYSTEM_ADMIN').length || 0}
                icon={Crown}
                variant="compact"
              />
              <StatsCard
                title="Gestores de Org"
                value={allRoles?.filter(r => r.role === 'ORG_ADMIN').length || 0}
                icon={Building2}
                variant="compact"
              />
              <StatsCard
                title="Gestores de Grupo"
                value={allRoles?.filter(r => r.role === 'GROUP_MANAGER').length || 0}
                icon={UserCog}
                variant="compact"
              />
            </>
          )}
        />

        {/* Users Table */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <BorisTable
            columns={columns as any}
            data={profiles ?? []}
            keyExtractor={(profile) => profile.id}
            loading={profilesLoading || rolesDataLoading}
            error={!!profilesError}
            emptyIcon={UsersIcon}
            emptyMessage="Não há usuários cadastrados no sistema."
          />
        </div>
      </div>

      <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo Usuário</DialogTitle>
            <DialogDescription>Preencha os dados para criar um usuário.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Input
                placeholder="Nome"
                value={newUserName}
                onChange={(e) => setNewUserName(e.target.value)}
              />
            </div>
            <div>
              <Input
                type="email"
                placeholder="Email"
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
              />
            </div>
            <div>
              <Input
                placeholder="WhatsApp (opcional)"
                value={newUserPhone}
                onChange={(e) => setNewUserPhone(e.target.value)}
              />
            </div>
            <div>
              <Input
                type="password"
                placeholder="Senha"
                value={newUserPassword}
                onChange={(e) => setNewUserPassword(e.target.value)}
              />
            </div>
            <div>
              <Input
                type="password"
                placeholder="Confirmar senha"
                value={newUserPasswordConfirm}
                onChange={(e) => setNewUserPasswordConfirm(e.target.value)}
              />
            </div>
            <div className="pt-2 border-t border-border space-y-2">
              <div className="text-sm font-medium text-card-foreground">Permissão inicial</div>
              <RadioGroup value={scopeType} onValueChange={(v) => setScopeType(v as 'organization' | 'group')}>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="organization" id="scope-org" />
                  <label htmlFor="scope-org" className="text-sm">Acessa uma organização</label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="group" id="scope-group" />
                  <label htmlFor="scope-group" className="text-sm">Acessa um grupo específico</label>
                </div>
              </RadioGroup>
              {scopeType === 'organization' && (
                <Select value={selectedScopeOrgId} onValueChange={setSelectedScopeOrgId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Organização" />
                  </SelectTrigger>
                  <SelectContent>
                    {organizations?.map((org) => (
                      <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {scopeType === 'group' && (
                <Select value={selectedScopeGroupId} onValueChange={setSelectedScopeGroupId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Grupo" />
                  </SelectTrigger>
                  <SelectContent>
                    {groups?.map((group) => (
                      <SelectItem key={group.id} value={group.id}>
                        {getOrgName(group.organization_id)} – {group.name}
                      </SelectItem>
                    ))}
                    </SelectContent>
                  </Select>
              )}
              {scopeType === 'organization' && (
                <div className="flex items-center gap-2 pt-2">
                  <input
                    id="assign-org-admin"
                    type="checkbox"
                    checked={assignOrgAdmin}
                    onChange={(e) => setAssignOrgAdmin(e.target.checked)}
                    className="h-4 w-4 rounded border-border"
                  />
                  <label htmlFor="assign-org-admin" className="text-sm text-card-foreground">
                    Conceder papel de Gestor de Organização para esta organização
                  </label>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddUserOpen(false)}>Fechar</Button>
            <Button
              onClick={() => {
                const name = newUserName.trim();
                const email = newUserEmail.trim();
                const password = newUserPassword;
                const confirm = newUserPasswordConfirm;
                const phone = normalizePhoneE164(newUserPhone);
                if (!name || !email || !password || !confirm) {
                  notify.warning('Atenção', 'Preencha todos os campos obrigatórios.');
                  return;
                }
                const emailOk = /.+@.+\..+/.test(email);
                if (!emailOk) {
                  notify.warning('Atenção', 'Informe um email válido.');
                  return;
                }
                if (password !== confirm) {
                  notify.warning('Atenção', 'Senha e confirmação devem ser iguais.');
                  return;
                }
                if (!scopeType) {
                  notify.warning('Atenção', 'Selecione o escopo de acesso.');
                  return;
                }
                let scopeId = '';
                if (scopeType === 'organization') scopeId = selectedScopeOrgId;
                if (scopeType === 'group') scopeId = selectedScopeGroupId;
                if (!scopeId) {
                  notify.warning('Atenção', 'Selecione a organização ou grupo.');
                  return;
                }
                createUserMutation.mutate({
                  name,
                  email,
                  password,
                  whatsapp_phone: phone,
                  scope_type: scopeType as 'organization' | 'group',
                  scope_id: scopeId,
                  assign_org_admin: scopeType === 'organization' && assignOrgAdmin,
                });
              }}
              disabled={createUserMutation.isPending}
            >
              <Plus className="h-4 w-4 mr-1" />
              Criar Usuário
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
