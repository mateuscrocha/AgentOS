import { useEffect, useCallback, ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth, isExplicitSignOutRecent } from '@/hooks/use-auth';
import { supabase } from '@/integrations/supabase/client';
import { notify } from '@/components/ui/sonner';

interface AuthGuardProps {
  children: ReactNode;
}

// Public routes that don't require authentication
const PUBLIC_ROUTES = ['/auth', '/login', '/signup', '/onboarding', '/onboarding/error'];

function isPublicPath(pathname: string): boolean {
  // Normalize trailing slash
  const normalized = pathname !== '/' ? pathname.replace(/\/+$/, '') : pathname;
  return PUBLIC_ROUTES.some((route) => normalized === route || normalized.startsWith(route + '/'));
}

export function AuthGuard({ children }: AuthGuardProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, loading } = useAuth();

  const handleSessionExpired = useCallback(() => {
    console.info('[auth] session-expired');
    notify.error("Sessão expirada", "Faça login novamente.");
    navigate('/auth', { replace: true });
  }, [navigate]);

  useEffect(() => {
    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        if (isExplicitSignOutRecent()) {
          return;
        }
        // Only show session expired if user was logged in and didn't explicitly log out
        if (isAuthenticated && !isPublicPath(location.pathname)) {
          handleSessionExpired();
        }
      } else if (event === 'TOKEN_REFRESHED') {
        void 0;
      }
    });

    return () => subscription.unsubscribe();
  }, [isAuthenticated, location.pathname, handleSessionExpired]);

  useEffect(() => {
    // Redirect to auth if not authenticated and trying to access protected route
    if (!loading && !isAuthenticated && !isPublicPath(location.pathname)) {
      navigate('/auth', { replace: true });
    }
  }, [loading, isAuthenticated, location.pathname, navigate]);

  // Show nothing while loading
  if (loading) {
    return null;
  }

  // If not authenticated and on a protected route, don't render children
  if (!isAuthenticated && !isPublicPath(location.pathname)) {
    return null;
  }

  return <>{children}</>;
}
