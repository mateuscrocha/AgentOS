import { useEffect, useState } from "react";
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
import { RowActions } from "@/components/ui/boris-table";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
  Loader2,
  Crown,
  UserCheck,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Info
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import AccessDenied from "./AccessDenied";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { cn } from "@/lib/utils";
import { APP_PASSWORD_HINT, APP_PASSWORD_MAX_LENGTH, validateAppPassword } from "@/lib/password-policy";

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

const ROLE_PRIORITY: Record<AppRole, number> = {
  'SYSTEM_ADMIN': 4,
  'ORG_ADMIN': 3,
  'GROUP_MANAGER': 2,
  'USER': 1,
};

type SortKey = 'name' | 'status' | 'created_at';
type SortDir = 'asc' | 'desc';

type UserRow = {
  profile: Profile;
  roles: UserRole[];
  primaryRole: AppRole | null;
};

export default function Users() {
  const { isAuthenticated, loading: authLoading, user } = useAuth();
  const { isSystemAdmin, isLoading: rolesLoading } = useUserRoles();
  const queryClient = useQueryClient();
  
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [isAddRoleOpen, setIsAddRoleOpen] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<UserRole | null>(null);
  const [userToDelete, setUserToDelete] = useState<Profile | null>(null);
  const [userToEdit, setUserToEdit] = useState<Profile | null>(null);
  const [isEditUserOpen, setIsEditUserOpen] = useState(false);
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
  const [editUserName, setEditUserName] = useState("");
  const [editUserPhone, setEditUserPhone] = useState("");
  const [editUserStatus, setEditUserStatus] = useState<'active' | 'inactive' | 'unknown'>('active');
  const [resetPasswordValue, setResetPasswordValue] = useState("");
  const [resetPasswordConfirm, setResetPasswordConfirm] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>("all");
  const [roleFilter, setRoleFilter] = useState<'all' | AppRole | 'none'>("all");
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [recentlyChanged, setRecentlyChanged] = useState<Record<string, number>>({});
  
  // Form state for adding role
  const [newRole, setNewRole] = useState<AppRole>('USER');
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');

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

  const { data: userEmail, isLoading: userEmailLoading, error: userEmailError } = useQuery({
    queryKey: ['admin-user-email', userToEdit?.id],
    queryFn: async () => {
      if (!userToEdit?.id) return null;
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      const { data, error } = await supabase.functions.invoke('admin-get-user-email', {
        body: { user_id: userToEdit.id },
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      });

      if (!error && data?.success) return (data.email as string | null) ?? null;

      let message = error?.message || data?.message || 'Falha ao buscar email';
      let status: number | undefined = undefined;
      let code: string | undefined = data?.code;

      if (error instanceof FunctionsHttpError && (error as any).context) {
        try {
          const body = await (error as any).context.json();
          if (body?.message) message = body.message;
          if (typeof body?.status === 'number') status = body.status;
          if (typeof body?.code === 'string') code = body.code;
        } catch (_e) {
          void 0;
        }
      }

      const err: any = new Error(message);
      err.status = status;
      err.code = code;
      throw err;
    },
    enabled: isEditUserOpen && !!userToEdit?.id && isSystemAdmin,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!isEditUserOpen || !userToEdit?.id) return;
    queryClient.invalidateQueries({ queryKey: ['admin-user-email', userToEdit.id] });
  }, [isEditUserOpen, userToEdit?.id, queryClient]);

  // Add role mutation
  const addRoleMutation = useMutation({
    mutationFn: async ({ userId, role, organizationId, groupId }: {
      userId: string;
      role: AppRole;
      organizationId: string | null;
      groupId: string | null;
    }) => {
      const { data, error } = await supabase.functions.invoke("admin-manage-user-role", {
        body: {
          action: "add",
          user_id: userId,
          role,
          organization_id: organizationId,
          group_id: groupId,
        },
      });

      if (!error && data?.success) return data;

      let message = error?.message || data?.message || "Falha ao adicionar papel";
      let status: number | undefined = undefined;
      let code: string | undefined = data?.code;
      if (error instanceof FunctionsHttpError && (error as any).context) {
        try {
          const body = await (error as any).context.json();
          if (body?.message) message = body.message;
          if (typeof body?.status === "number") status = body.status;
          if (typeof body?.code === "string") code = body.code;
        } catch (_e) {
          void 0;
        }
      }
      const err: any = new Error(message);
      err.status = status;
      err.code = code;
      throw err;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['all-user-roles'] });
      notify.success('Papel atribuído', 'O papel foi adicionado.');
      setIsAddRoleOpen(false);
      resetForm();
      markRecentlyChanged(variables.userId);
    },
    onError: (err: any) => {
      const status = err?.status as number | undefined;
      const code = String(err?.code || "");
      if (status === 409 || code === "ROLE_ALREADY_EXISTS") {
        notify.error('Papel já existe', 'Este papel já foi atribuído ao usuário.');
        return;
      }
      notify.error('Não foi possível concluir', err?.message || 'Algo deu errado. Tente novamente.');
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
        let code: string | undefined = data?.code;
        if (error instanceof FunctionsHttpError && (error as any).context) {
          try {
            const body = await (error as any).context.json();
            if (body?.message) message = body.message;
            if (typeof body?.status === "number") status = body.status;
            if (typeof body?.code === "string") code = body.code;
            if (!status && body?.code === "EMAIL_EXISTS") status = 409;
          } catch (e) { void 0; }
        }
        lastErr = Object.assign(new Error(message), { status, code });
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
      if (typeof result?.user_id === 'string' && result.user_id) {
        markRecentlyChanged(result.user_id);
      }
    },
    onError: (err: any) => {
      const raw = (err?.message || '').toLowerCase();
      if (err?.code === 'PASSWORD_TOO_LONG' || (raw.includes('senha') && raw.includes('muito longa'))) {
        notify.error('Senha muito longa', err?.message || 'Use uma senha menor.');
        return;
      }
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

  const updateUserMutation = useMutation({
    mutationFn: async ({ userId, name, phone_e164, status }: { userId: string; name: string; phone_e164: string | null; status: string | null; }) => {
      const { error } = await supabase
        .from('profiles')
        .update({
          name,
          phone_e164,
          status,
        })
        .eq('id', userId);

      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["all-profiles"] });
      notify.success("Usuário atualizado", "Dados salvos com sucesso.");
      setIsEditUserOpen(false);
      setUserToEdit(null);
      markRecentlyChanged(variables.userId);
    },
    onError: () => {
      notify.error("Não foi possível salvar", "Algo deu errado. Tente novamente.");
    },
  });

  const resetUserPasswordMutation = useMutation({
    mutationFn: async ({ userId, password }: { userId: string; password: string }) => {
      const { data, error } = await supabase.functions.invoke("admin-update-user", {
        body: { user_id: userId, password },
      });

      if (!error && data?.success) return data;

      let message = error?.message || data?.message || "Falha ao redefinir senha";
      let status: number | undefined = undefined;
      let code: string | undefined = data?.code;
      if (error instanceof FunctionsHttpError && (error as any).context) {
        try {
          const body = await (error as any).context.json();
          if (body?.message) message = body.message;
          if (typeof body?.status === "number") status = body.status;
          if (typeof body?.code === "string") code = body.code;
        } catch (_e) {
          void 0;
        }
      }
      const err: any = new Error(message);
      err.status = status;
      err.code = code;
      throw err;
    },
    onSuccess: () => {
      notify.success("Senha redefinida", "A nova senha foi salva com sucesso.");
      setResetPasswordValue("");
      setResetPasswordConfirm("");
    },
    onError: (err: any) => {
      const raw = String(err?.message || "").toLowerCase();
      if (err?.code === "PASSWORD_TOO_LONG" || raw.includes("muito longa")) {
        notify.error("Senha muito longa", err?.message || "Use uma senha menor.");
        return;
      }
      if (err?.code === "WEAK_PASSWORD" || raw.includes("senha deve")) {
        notify.error("Senha inválida", err?.message || "A senha não atende à política.");
        return;
      }
      if (err?.status === 403 || raw.includes("forbidden")) {
        notify.error("Acesso negado", "Você não possui permissão para redefinir senha.");
        return;
      }
      notify.error("Não foi possível redefinir", err?.message || "Algo deu errado. Tente novamente.");
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async ({ userId }: { userId: string }) => {
      const { data, error } = await supabase.functions.invoke("admin-delete-user", {
        body: { user_id: userId },
      });

      if (!error && data?.success) return data;

      let message = error?.message || data?.message || "Falha ao excluir usuário";
      let status: number | undefined = undefined;
      let code: string | undefined = data?.code;

      if (error instanceof FunctionsHttpError && (error as any).context) {
        try {
          const body = await (error as any).context.json();
          if (body?.message) message = body.message;
          if (typeof body?.status === "number") status = body.status;
          if (typeof body?.code === "string") code = body.code;
        } catch (_e) {
          void 0;
        }
      }

      const err: any = new Error(message);
      err.status = status;
      err.code = code;
      throw err;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["all-user-roles"] });
      notify.success("Usuário excluído", "Tudo certo.");
      setUserToDelete(null);
    },
    onError: (err: any) => {
      const status = err?.status as number | undefined;
      const msg = err?.message || "Algo deu errado. Tente novamente.";
      if (status === 404) {
        notify.error("Usuário não encontrado", msg);
        return;
      }
      if (status === 403) {
        notify.error("Acesso negado", msg);
        return;
      }
      if (status === 409) {
        notify.error("Não foi possível excluir", msg);
        return;
      }
      notify.error("Não foi possível concluir", msg);
    },
  });

  // Delete role mutation
  const deleteRoleMutation = useMutation({
    mutationFn: async (role: UserRole) => {
      const { data, error } = await supabase.functions.invoke("admin-manage-user-role", {
        body: { action: "remove", role_id: role.id },
      });

      if (!error && data?.success) return data;

      let message = error?.message || data?.message || "Falha ao remover papel";
      let status: number | undefined = undefined;
      let code: string | undefined = data?.code;
      if (error instanceof FunctionsHttpError && (error as any).context) {
        try {
          const body = await (error as any).context.json();
          if (body?.message) message = body.message;
          if (typeof body?.status === "number") status = body.status;
          if (typeof body?.code === "string") code = body.code;
        } catch (_e) {
          void 0;
        }
      }
      const err: any = new Error(message);
      err.status = status;
      err.code = code;
      throw err;
    },
    onSuccess: (_data, role) => {
      queryClient.invalidateQueries({ queryKey: ['all-user-roles'] });
      notify.success('Papel removido', 'Tudo certo.');
      setRoleToDelete(null);
      markRecentlyChanged(role.user_id);
    },
    onError: (err: any) => {
      const status = err?.status as number | undefined;
      const code = String(err?.code || "");
      if (status === 409 || code === "LAST_SYSTEM_ADMIN") {
        notify.error('Operação bloqueada', err?.message || 'Não é possível remover o último administrador do sistema.');
        return;
      }
      if (status === 404 || code === "ROLE_NOT_FOUND") {
        notify.error('Papel não encontrado', err?.message || 'O papel pode já ter sido removido.');
        return;
      }
      notify.error('Não foi possível concluir', err?.message || 'Algo deu errado. Tente novamente.');
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

  const openEditUser = (profile: Profile) => {
    setUserToEdit(profile);
    setEditUserName(profile.name || "");
    setEditUserPhone(profile.phone_e164 || "");
    setResetPasswordValue("");
    setResetPasswordConfirm("");
    if (profile.status === 'inactive') {
      setEditUserStatus('inactive');
    } else if (profile.status === 'active') {
      setEditUserStatus('active');
    } else {
      setEditUserStatus('unknown');
    }
    setIsEditUserOpen(true);
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

  const markRecentlyChanged = (userId: string) => {
    const ts = Date.now();
    setRecentlyChanged((prev) => ({ ...prev, [userId]: ts }));
    window.setTimeout(() => {
      setRecentlyChanged((prev) => {
        if (prev[userId] !== ts) return prev;
        const { [userId]: _removed, ...rest } = prev;
        return rest;
      });
    }, 15000);
  };

  const toggleSort = (key: SortKey) => {
    setSortKey((prevKey) => {
      if (prevKey !== key) {
        setSortDir('asc');
        return key;
      }
      setSortDir((prevDir) => (prevDir === 'asc' ? 'desc' : 'asc'));
      return prevKey;
    });
  };

  const sortIcon = (key: SortKey) => {
    if (sortKey !== key) return <ArrowUpDown className="h-3.5 w-3.5" />;
    return sortDir === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />;
  };

  const getPrimaryRole = (roles: UserRole[]): AppRole | null => {
    if (!roles || roles.length === 0) return null;
    return roles.reduce((best, current) => {
      if (!best) return current;
      return ROLE_PRIORITY[current.role] > ROLE_PRIORITY[best.role] ? current : best;
    }, null as UserRole | null)?.role ?? null;
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

  const isDataLoading = profilesLoading || rolesDataLoading;
  const hasDataError = !!profilesError;

  const allRows: UserRow[] = (profiles ?? []).map((profile) => {
    const roles = getUserRoles(profile.id);
    const primaryRole = getPrimaryRole(roles);
    return { profile, roles, primaryRole };
  });

  const q = (searchQuery || '').trim().toLowerCase();
  const filteredRows = allRows.filter((row) => {
    if (statusFilter !== 'all') {
      const isActive = row.profile.status === 'active';
      if (statusFilter === 'active' && !isActive) return false;
      if (statusFilter === 'inactive' && isActive) return false;
    }
    if (roleFilter !== 'all') {
      if (roleFilter === 'none') {
        if (row.roles.length > 0) return false;
      } else {
        if (!row.roles.some((r) => r.role === roleFilter)) return false;
      }
    }
    if (!q) return true;
    const hay = `${row.profile.name ?? ''} ${row.profile.phone_e164 ?? ''}`.toLowerCase();
    return hay.includes(q);
  });

  const groupedRows: Record<string, UserRow[]> = {
    SYSTEM_ADMIN: [],
    ORG_ADMIN: [],
    GROUP_MANAGER: [],
    USER: [],
    none: [],
  };
  for (const row of filteredRows) {
    const key = (row.primaryRole ?? 'none') as string;
    (groupedRows[key] ?? (groupedRows[key] = [])).push(row);
  }

  const sortRows = (rows: UserRow[]) => {
    const dir = sortDir === 'asc' ? 1 : -1;
    const sorted = [...rows].sort((a, b) => {
      if (sortKey === 'name') {
        const an = (a.profile.name || 'Sem nome').toLocaleLowerCase('pt-BR');
        const bn = (b.profile.name || 'Sem nome').toLocaleLowerCase('pt-BR');
        return an.localeCompare(bn, 'pt-BR') * dir;
      }
      if (sortKey === 'status') {
        const ar = a.profile.status === 'active' ? 0 : 1;
        const br = b.profile.status === 'active' ? 0 : 1;
        if (ar !== br) return (ar - br) * dir;
        const an = (a.profile.name || '').toLocaleLowerCase('pt-BR');
        const bn = (b.profile.name || '').toLocaleLowerCase('pt-BR');
        return an.localeCompare(bn, 'pt-BR') * dir;
      }
      const at = new Date(a.profile.created_at).getTime();
      const bt = new Date(b.profile.created_at).getTime();
      return (at - bt) * dir;
    });
    return sorted;
  };

  const headerCls = "px-4 py-3 text-left text-[13px] font-semibold text-foreground/75";
  const cellCls = "px-4 py-3 text-[14px] font-normal text-card-foreground align-middle";

  const renderRolesBadges = (roles: UserRole[]) => {
    if (roles.length === 0) {
      return <span className="text-muted-foreground text-sm">Sem papéis</span>;
    }
    return (
      <div className="flex flex-wrap gap-1.5">
        {roles.map((role) => {
          const Icon = ROLE_ICONS[role.role];
          const label = (() => {
            if (role.role === 'SYSTEM_ADMIN') return 'Admin do Sistema';
            if (role.role === 'ORG_ADMIN') return `Gestor: ${getOrgName(role.organization_id)}`;
            if (role.role === 'GROUP_MANAGER') return `Gestor: ${getGroupName(role.group_id)}`;
            if (role.role === 'USER') return `Usuário: ${getOrgName(role.organization_id)}`;
            return ROLE_LABELS[role.role];
          })();
          return (
            <Tooltip key={role.id}>
              <TooltipTrigger asChild>
                <Badge className={cn(ROLE_COLORS[role.role], "flex items-center gap-1")}> 
                  <Icon className="h-3 w-3" />
                  <span className="text-xs">{label}</span>
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <span>{label}</span>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    );
  };

  const renderStatus = (profile: Profile) => {
    const isActive = profile.status === 'active';
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge className={cn(isActive ? "bg-success text-success-foreground hover:bg-success/90" : "bg-secondary text-secondary-foreground")}>
            {isActive ? 'Ativo' : profile.status || 'Desconhecido'}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <span className="inline-flex items-center gap-2">
            <Info className="h-4 w-4" />
            <span>Criado em {format(new Date(profile.created_at), 'dd/MM/yyyy', { locale: ptBR })}</span>
          </span>
        </TooltipContent>
      </Tooltip>
    );
  };

  const renderActions = (profile: Profile) => (
    <RowActions>
      <button
        onClick={(e) => {
          e.stopPropagation();
          openEditUser(profile);
        }}
        className="w-full text-left px-2 py-1.5 text-sm"
      >
        Ver e editar
      </button>
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
      {profile.id !== user?.id && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setUserToDelete(profile);
          }}
          className="w-full text-left px-2 py-1.5 text-sm text-destructive"
        >
          Excluir usuário
        </button>
      )}
    </RowActions>
  );

  const renderListTable = (rows: UserRow[]) => {
    const sorted = sortRows(rows);
    return (
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-secondary/20">
                <th className={cn(headerCls, "w-[320px]")}> 
                  <button onClick={() => toggleSort('name')} className="inline-flex items-center gap-2 hover:text-card-foreground transition-colors">
                    <span>Nome</span>
                    <span className="text-muted-foreground">{sortIcon('name')}</span>
                  </button>
                </th>
                <th className={cn(headerCls, "hidden sm:table-cell w-[170px]")}>Telefone</th>
                <th className={cn(headerCls, "min-w-[260px]")}>Papéis</th>
                <th className={cn(headerCls, "w-[150px]")}> 
                  <button onClick={() => toggleSort('status')} className="inline-flex items-center gap-2 hover:text-card-foreground transition-colors">
                    <span>Status</span>
                    <span className="text-muted-foreground">{sortIcon('status')}</span>
                  </button>
                </th>
                <th className={cn(headerCls, "hidden md:table-cell w-[140px]")}>
                  <button onClick={() => toggleSort('created_at')} className="inline-flex items-center gap-2 hover:text-card-foreground transition-colors">
                    <span>Criado em</span>
                    <span className="text-muted-foreground">{sortIcon('created_at')}</span>
                  </button>
                </th>
                <th className={cn(headerCls, "w-12")}></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sorted.map((row) => {
                const profile = row.profile;
                const isRecent = !!recentlyChanged[profile.id];
                const PrimaryIcon = row.primaryRole ? ROLE_ICONS[row.primaryRole] : UsersIcon;
                return (
                  <tr
                    key={profile.id}
                    className={cn("transition-colors h-11", isRecent && "bg-primary/5", "hover:bg-secondary/40")}
                  >
                    <td className={cellCls}>
                      <div className="flex items-start gap-3">
                        <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center", row.primaryRole ? ROLE_COLORS[row.primaryRole] : "bg-secondary text-secondary-foreground")}>
                          <PrimaryIcon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-card-foreground truncate">{profile.name || 'Sem nome'}</span>
                            {isRecent && (
                              <Badge className="bg-primary/15 text-primary hover:bg-primary/15">Atualizado</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className={cn(cellCls, "hidden sm:table-cell text-muted-foreground")}>{profile.phone_e164 || '-'}</td>
                    <td className={cellCls}>{renderRolesBadges(row.roles)}</td>
                    <td className={cellCls}>{renderStatus(profile)}</td>
                    <td className={cn(cellCls, "hidden md:table-cell text-muted-foreground")}>{format(new Date(profile.created_at), 'dd/MM/yyyy', { locale: ptBR })}</td>
                    <td className={cn(cellCls, "w-10")}>{renderActions(profile)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderLoading = () => {
    return (
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="border-b border-border p-4 flex gap-4">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-4 w-24" />
          ))}
        </div>
        {Array.from({ length: 6 }).map((_, rowIdx) => (
          <div key={rowIdx} className="border-b border-border p-4 flex gap-4 last:border-0">
            {Array.from({ length: 6 }).map((_, colIdx) => (
              <Skeleton key={colIdx} className="h-4 w-24" />
            ))}
          </div>
        ))}
      </div>
    );
  };

  return (
    <AdminLayout 
      title="Usuários" 
      subtitle="Gerenciamento de usuários e papéis do sistema"
    >
      <div className="space-y-6">
        <AdminPageHeader
          breadcrumbItems={[{ label: "Central do Bóris", href: "/" }, { label: "Usuários" }]}
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
              <div className="relative">
                <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar por nome ou telefone"
                  className="pl-9 w-[280px]"
                />
              </div>

              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="active">Ativo</SelectItem>
                  <SelectItem value="inactive">Inativo</SelectItem>
                </SelectContent>
              </Select>

              <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as any)}>
                <SelectTrigger className="w-[190px]">
                  <SelectValue placeholder="Papel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os papéis</SelectItem>
                  <SelectItem value="SYSTEM_ADMIN">Administrador do Sistema</SelectItem>
                  <SelectItem value="ORG_ADMIN">Gestor de Organização</SelectItem>
                  <SelectItem value="GROUP_MANAGER">Gestor de Grupo</SelectItem>
                  <SelectItem value="USER">Usuário</SelectItem>
                  <SelectItem value="none">Sem papéis</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          showClearFilters={!!searchQuery || statusFilter !== 'all' || roleFilter !== 'all'}
          onClearFilters={() => { setSearchQuery(''); setStatusFilter('all'); setRoleFilter('all'); }}
          generalKpis={(
            <>
              <StatsCard
                title="Admins do Sistema"
                value={allRoles?.filter(r => r.role === 'SYSTEM_ADMIN').length || 0}
                icon={Crown}
                variant="compact"
                help={{
                  whatIs: "Quantidade de usuários com papel de Administrador do Sistema.",
                  howToInterpret: "Representa usuários com maior nível de permissão global.",
                  whatToObserve: "Revise periodicamente para manter controle de acesso mínimo necessário.",
                }}
              />
              <StatsCard
                title="Gestores de Org"
                value={allRoles?.filter(r => r.role === 'ORG_ADMIN').length || 0}
                icon={Building2}
                variant="compact"
                help={{
                  whatIs: "Quantidade de usuários com papel de gestor de organização.",
                  howToInterpret: "Mostra quem administra organizações no sistema.",
                  whatToObserve: "Compare com o número de organizações para avaliar cobertura de gestão.",
                }}
              />
              <StatsCard
                title="Gestores de Grupo"
                value={allRoles?.filter(r => r.role === 'GROUP_MANAGER').length || 0}
                icon={UserCog}
                variant="compact"
                help={{
                  whatIs: "Quantidade de usuários com papel de gestor de grupo.",
                  howToInterpret: "Indica quem tem permissão de gestão no nível de grupos.",
                  whatToObserve: "Observe crescimento e distribuição em relação ao volume de grupos operados.",
                }}
              />
            </>
          )}
        />

        <TooltipProvider>
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-muted-foreground">
                Exibindo <span className="font-semibold text-card-foreground">{filteredRows.length}</span> de {profiles?.length ?? 0} usuários
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Ordenar por</span>
                <Select value={`${sortKey}:${sortDir}`} onValueChange={(v) => {
                  const [k, d] = (v || '').split(':');
                  if (k === 'name' || k === 'status' || k === 'created_at') setSortKey(k);
                  if (d === 'asc' || d === 'desc') setSortDir(d);
                }}>
                  <SelectTrigger className="w-[220px] h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="created_at:desc">Criação (mais recente)</SelectItem>
                    <SelectItem value="created_at:asc">Criação (mais antigo)</SelectItem>
                    <SelectItem value="name:asc">Nome (A–Z)</SelectItem>
                    <SelectItem value="name:desc">Nome (Z–A)</SelectItem>
                    <SelectItem value="status:asc">Status (ativo primeiro)</SelectItem>
                    <SelectItem value="status:desc">Status (inativo primeiro)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {hasDataError ? (
              <ErrorState
                title="Não foi possível carregar os usuários"
                message="Tente novamente."
                retry={() => queryClient.invalidateQueries({ queryKey: ['all-profiles'] })}
              />
            ) : isDataLoading ? (
              renderLoading()
            ) : filteredRows.length === 0 ? (
              <EmptyState
                icon={UsersIcon}
                title="Nenhum usuário encontrado"
                message={searchQuery || statusFilter !== 'all' || roleFilter !== 'all' ? 'Ajuste a busca ou os filtros para ver resultados.' : 'Não há usuários cadastrados no sistema.'}
              />
            ) : (
              <div className="space-y-6">
                {([
                  { key: 'SYSTEM_ADMIN' as const, title: 'Administradores do Sistema', icon: Crown, hint: 'Acesso total ao sistema' },
                  { key: 'ORG_ADMIN' as const, title: 'Gestores de Organização', icon: Building2, hint: 'Administração dentro da organização' },
                  { key: 'GROUP_MANAGER' as const, title: 'Gestores de Grupo', icon: UserCog, hint: 'Gestão de grupos específicos' },
                  { key: 'USER' as const, title: 'Usuários', icon: UserCheck, hint: 'Visualização dentro do escopo atribuído' },
                  { key: 'none' as const, title: 'Sem papéis', icon: UsersIcon, hint: 'Usuários sem vínculo de papel' },
                ] as const).map((section) => {
                  const rows = groupedRows[section.key] ?? [];
                  if (rows.length === 0) return null;
                  const SectionIcon = section.icon;
                  return (
                    <div key={section.key} className="space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-lg bg-secondary/60 flex items-center justify-center">
                            <SectionIcon className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-base font-semibold text-card-foreground">{section.title}</h3>
                              <Badge variant="secondary" className="tabular-nums">{rows.length}</Badge>
                            </div>
                            <div className="text-sm text-muted-foreground">{section.hint}</div>
                          </div>
                        </div>
                      </div>

                      {renderListTable(rows)}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </TooltipProvider>
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
                minLength={10}
                maxLength={APP_PASSWORD_MAX_LENGTH}
              />
              <p className="mt-1 text-xs text-muted-foreground">{APP_PASSWORD_HINT}</p>
            </div>
            <div>
              <Input
                type="password"
                placeholder="Confirmar senha"
                value={newUserPasswordConfirm}
                onChange={(e) => setNewUserPasswordConfirm(e.target.value)}
                minLength={10}
                maxLength={APP_PASSWORD_MAX_LENGTH}
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
                const passwordError = validateAppPassword(password);
                if (passwordError) {
                  notify.warning('Atenção', passwordError);
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

      <Dialog open={isEditUserOpen} onOpenChange={setIsEditUserOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Dados do Usuário</DialogTitle>
            <DialogDescription>
              {userToEdit?.name || 'Usuário'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3">
              <div>
                <div className="text-xs text-muted-foreground">ID</div>
                <div className="text-sm text-card-foreground break-all">{userToEdit?.id || '-'}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Email</div>
                <div className="text-sm text-card-foreground break-all">
                  {userEmailLoading ? 'Carregando...' : userEmailError ? 'Não disponível' : userEmail || '-'}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Criado em</div>
                <div className="text-sm text-card-foreground">
                  {userToEdit?.created_at ? format(new Date(userToEdit.created_at), 'dd/MM/yyyy', { locale: ptBR }) : '-'}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Papéis</div>
                <div className="mt-1">
                  {userToEdit ? renderRolesBadges(getUserRoles(userToEdit.id)) : null}
                </div>
              </div>
            </div>
            <div className="space-y-3 pt-2 border-t border-border">
              <div>
                <Input
                  placeholder="Nome"
                  value={editUserName}
                  onChange={(e) => setEditUserName(e.target.value)}
                />
              </div>
              <div>
                <Input
                  placeholder="WhatsApp"
                  value={editUserPhone}
                  onChange={(e) => setEditUserPhone(e.target.value)}
                />
              </div>
              <div>
                <Select value={editUserStatus} onValueChange={(v) => setEditUserStatus(v as any)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="inactive">Inativo</SelectItem>
                    <SelectItem value="unknown">Desconhecido</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-3 pt-2 border-t border-border">
              <div className="text-sm font-medium text-card-foreground">Redefinir senha</div>
              <div>
                <Input
                  type="password"
                  placeholder="Nova senha"
                  value={resetPasswordValue}
                  onChange={(e) => setResetPasswordValue(e.target.value)}
                  minLength={10}
                  maxLength={APP_PASSWORD_MAX_LENGTH}
                />
                <p className="mt-1 text-xs text-muted-foreground">{APP_PASSWORD_HINT}</p>
              </div>
              <div>
                <Input
                  type="password"
                  placeholder="Confirmar nova senha"
                  value={resetPasswordConfirm}
                  onChange={(e) => setResetPasswordConfirm(e.target.value)}
                  minLength={10}
                  maxLength={APP_PASSWORD_MAX_LENGTH}
                />
              </div>
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  disabled={resetUserPasswordMutation.isPending}
                  onClick={() => {
                    if (!userToEdit) return;
                    const password = resetPasswordValue;
                    const confirm = resetPasswordConfirm;
                    if (!password || !confirm) {
                      notify.warning("Atenção", "Preencha senha e confirmação.");
                      return;
                    }
                    const passwordError = validateAppPassword(password);
                    if (passwordError) {
                      notify.warning("Atenção", passwordError);
                      return;
                    }
                    if (password !== confirm) {
                      notify.warning("Atenção", "Senha e confirmação devem ser iguais.");
                      return;
                    }
                    resetUserPasswordMutation.mutate({ userId: userToEdit.id, password });
                  }}
                >
                  {resetUserPasswordMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Redefinindo</span>
                    </>
                  ) : (
                    <span>Redefinir senha</span>
                  )}
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditUserOpen(false)}>Fechar</Button>
            <Button
              onClick={() => {
                if (!userToEdit) return;
                const name = editUserName.trim();
                if (!name) {
                  notify.warning('Atenção', 'O nome é obrigatório.');
                  return;
                }
                const phone = normalizePhoneE164(editUserPhone);
                const status = editUserStatus === 'unknown' ? null : editUserStatus;
                updateUserMutation.mutate({
                  userId: userToEdit.id,
                  name,
                  phone_e164: phone || null,
                  status,
                });
              }}
              disabled={updateUserMutation.isPending}
            >
              {updateUserMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Salvando</span>
                </>
              ) : (
                <span>Salvar</span>
              )}
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
              onClick={() => roleToDelete && deleteRoleMutation.mutate(roleToDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!userToDelete} onOpenChange={() => setUserToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Usuário</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o usuário "{userToDelete?.name || "Sem nome"}"?
              Esta ação é permanente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteUserMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => userToDelete && deleteUserMutation.mutate({ userId: userToDelete.id })}
              disabled={deleteUserMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteUserMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Excluindo</span>
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4" />
                  <span>Excluir</span>
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
