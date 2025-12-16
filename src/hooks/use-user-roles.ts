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

  // Use isPending to know if we're still waiting for initial data
  // isLoading is false when query is disabled, isPending is true until first data
  const isRolesLoading = isPending || isLoading;

  const isSystemAdmin = roles?.some(r => r.role === 'SYSTEM_ADMIN') ?? false;
  
  const hasOrgAccess = (orgId: string) => {
    if (isSystemAdmin) return true;
    return roles?.some(r => 
      r.organization_id === orgId && 
      ['ORG_ADMIN', 'GROUP_MANAGER', 'USER'].includes(r.role)
    ) ?? false;
  };

  const hasGroupAccess = (groupId: string) => {
    if (isSystemAdmin) return true;
    return roles?.some(r => 
      r.group_id === groupId || 
      (r.role === 'ORG_ADMIN' || r.role === 'GROUP_MANAGER' || r.role === 'USER')
    ) ?? false;
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
    isLoading: isRolesLoading,
    error,
    isSystemAdmin,
    hasOrgAccess,
    hasGroupAccess,
    canEditOrg,
    canEditGroup,
  };
}
