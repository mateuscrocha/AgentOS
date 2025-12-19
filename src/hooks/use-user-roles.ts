import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './use-auth';

export type AppRole = 'SYSTEM_ADMIN' | 'ORG_ADMIN' | 'GROUP_MANAGER' | 'USER';

interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  organization_id: string | null;
  group_id: string | null;
  created_at: string;
}

interface RoleContext {
  role: AppRole;
  organizationId?: string;
  organizationName?: string;
  groupId?: string;
  groupName?: string;
  groupOrgId?: string;
}

const ROLE_LABELS: Record<AppRole, string> = {
  'SYSTEM_ADMIN': 'Administrador do Sistema',
  'ORG_ADMIN': 'Gestor de Organização',
  'GROUP_MANAGER': 'Gestor de Grupo',
  'USER': 'Usuário',
};

const ROLE_PRIORITY: Record<AppRole, number> = {
  'SYSTEM_ADMIN': 4,
  'ORG_ADMIN': 3,
  'GROUP_MANAGER': 2,
  'USER': 1,
};

export function useUserRoles() {
  const { user, isAuthenticated } = useAuth();

  const { data: roles, isLoading, isPending, error } = useQuery({
    queryKey: ['user-roles', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', user!.id);
      
      if (error) throw error;
      return data as UserRole[];
    },
    enabled: isAuthenticated && !!user?.id,
  });

  // Fetch org/group names for context
  const { data: roleContexts } = useQuery({
    queryKey: ['user-role-contexts', user?.id, roles],
    queryFn: async () => {
      if (!roles || roles.length === 0) return [];
      
      const contexts: RoleContext[] = [];
      
      for (const role of roles) {
        const context: RoleContext = { role: role.role };
        
        if (role.organization_id) {
          const { data: org } = await supabase
            .from('organizations')
            .select('name')
            .eq('id', role.organization_id)
            .maybeSingle();
          context.organizationId = role.organization_id;
          context.organizationName = org?.name || 'Organização';
        }
        
        if (role.group_id) {
          const { data: group } = await supabase
            .from('groups')
            .select('name, organization_id')
            .eq('id', role.group_id)
            .maybeSingle();
          context.groupId = role.group_id;
          context.groupName = group?.name || 'Grupo';
          context.groupOrgId = group?.organization_id || undefined;
        }
        
        contexts.push(context);
      }
      
      return contexts;
    },
    enabled: isAuthenticated && !!user?.id && !!roles && roles.length > 0,
  });

  // Use isPending to know if we're still waiting for initial data
  const isRolesLoading = isPending || isLoading;

  const isSystemAdmin = roles?.some(r => r.role === 'SYSTEM_ADMIN') ?? false;
  const isOrgAdmin = roles?.some(r => r.role === 'ORG_ADMIN') ?? false;
  const isGroupManager = roles?.some(r => r.role === 'GROUP_MANAGER') ?? false;
  
  // Get the primary (highest priority) role
  const primaryRole = roles?.reduce((highest, current) => {
    if (!highest) return current;
    return ROLE_PRIORITY[current.role] > ROLE_PRIORITY[highest.role] ? current : highest;
  }, null as UserRole | null);

  // Get role display label with context
  const getRoleLabel = (): string => {
    if (!primaryRole) return '';
    
    if (primaryRole.role === 'SYSTEM_ADMIN') {
      return ROLE_LABELS['SYSTEM_ADMIN'];
    }
    
    const context = roleContexts?.find(c => 
      c.role === primaryRole.role &&
      c.organizationId === primaryRole.organization_id &&
      c.groupId === primaryRole.group_id
    );
    
    if (primaryRole.role === 'ORG_ADMIN' && context?.organizationName) {
      return `Gestor: ${context.organizationName}`;
    }
    
    if (primaryRole.role === 'GROUP_MANAGER' && context?.groupName) {
      return `Gestor: ${context.groupName}`;
    }
    
    if (primaryRole.role === 'USER' && context?.organizationName) {
      return `Usuário: ${context.organizationName}`;
    }
    
    return ROLE_LABELS[primaryRole.role];
  };

  // Get organization IDs user has access to
  const getAccessibleOrgIds = (): string[] => {
    if (isSystemAdmin) return []; // System admin sees all
    return roles?.filter(r => r.organization_id).map(r => r.organization_id!) ?? [];
  };

  // Get group IDs user has access to
  const getAccessibleGroupIds = (): string[] => {
    if (isSystemAdmin) return []; // System admin sees all
    return roles?.filter(r => r.group_id).map(r => r.group_id!) ?? [];
  };
  
  const hasOrgAccess = (orgId: string) => {
    if (isSystemAdmin) return true;
    return roles?.some(r => 
      r.organization_id === orgId && 
      ['ORG_ADMIN', 'USER'].includes(r.role)
    ) ?? false;
  };

  const hasGroupAccess = (groupId: string, orgId?: string) => {
    if (isSystemAdmin) return true;
    const explicitGroupAccess = roles?.some(r => 
      r.group_id === groupId && ['GROUP_MANAGER', 'USER'].includes(r.role)
    ) ?? false;
    if (explicitGroupAccess) return true;
    const orgAdminAccess = orgId 
      ? roles?.some(r => r.role === 'ORG_ADMIN' && r.organization_id === orgId) ?? false
      : false;
    return orgAdminAccess;
  };

  const canEditOrg = (orgId: string) => {
    if (isSystemAdmin) return true;
    return roles?.some(r => 
      r.role === 'ORG_ADMIN' && r.organization_id === orgId
    ) ?? false;
  };

  const canEditGroup = (groupId: string, orgId?: string) => {
    if (isSystemAdmin) return true;
    if (orgId && roles?.some(r => r.role === 'ORG_ADMIN' && r.organization_id === orgId)) {
      return true;
    }
    return roles?.some(r => 
      r.role === 'GROUP_MANAGER' && r.group_id === groupId
    ) ?? false;
  };

  return {
    roles,
    roleContexts,
    primaryRole,
    isLoading: isRolesLoading,
    error,
    isSystemAdmin,
    isOrgAdmin,
    isGroupManager,
    hasOrgAccess,
    hasGroupAccess,
    canEditOrg,
    canEditGroup,
    getRoleLabel,
    getAccessibleOrgIds,
    getAccessibleGroupIds,
  };
}
