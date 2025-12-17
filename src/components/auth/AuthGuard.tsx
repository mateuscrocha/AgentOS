import { useEffect, useCallback, ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AuthGuardProps {
  children: ReactNode;
}

// Public routes that don't require authentication
const PUBLIC_ROUTES = ['/auth', '/login', '/signup', '/onboarding', '/onboarding/error'];

export function AuthGuard({ children }: AuthGuardProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, loading } = useAuth();

  const handleSessionExpired = useCallback(() => {
    toast.error("Sessão expirada, faça login novamente.");
    navigate('/auth', { replace: true });
  }, [navigate]);

  useEffect(() => {
    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        // Only show session expired if user was logged in and didn't explicitly log out
        if (isAuthenticated && !PUBLIC_ROUTES.includes(location.pathname)) {
          handleSessionExpired();
        }
      } else if (event === 'TOKEN_REFRESHED') {
        // Token was refreshed successfully
        console.log('Token refreshed');
      }
    });

    return () => subscription.unsubscribe();
  }, [isAuthenticated, location.pathname, handleSessionExpired]);

  useEffect(() => {
    // Redirect to auth if not authenticated and trying to access protected route
    if (!loading && !isAuthenticated && !PUBLIC_ROUTES.includes(location.pathname)) {
      navigate('/auth', { replace: true });
    }
  }, [loading, isAuthenticated, location.pathname, navigate]);

  // Show nothing while loading
  if (loading) {
    return null;
  }

  // If not authenticated and on a protected route, don't render children
  if (!isAuthenticated && !PUBLIC_ROUTES.includes(location.pathname)) {
    return null;
  }

  return <>{children}</>;
}
