import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { queryClient } from '@/lib/query-client';

let explicitSignOutAt = 0;
let explicitSignOutPending = false;

export function isExplicitSignOutRecent(maxAgeMs = 10000) {
  return explicitSignOutPending || (explicitSignOutAt > 0 && Date.now() - explicitSignOutAt <= maxAgeMs);
}

function markExplicitSignOut() {
  explicitSignOutAt = Date.now();
  explicitSignOutPending = true;
}

function clearExplicitSignOut() {
  explicitSignOutPending = false;
}

function clearClientSideSessionData() {
  const removeLocalStorageKeys = new Set<string>([
    'system-admin-period',
  ]);

  const removeLocalStoragePrefixes = ['sb-', 'org-period:', 'group-period:', 'boris-onboarding:'];

  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (key) keys.push(key);
  }

  for (const key of keys) {
    if (removeLocalStorageKeys.has(key)) {
      localStorage.removeItem(key);
      continue;
    }

    if (removeLocalStoragePrefixes.some((p) => key.startsWith(p))) {
      localStorage.removeItem(key);
    }
  }

  sessionStorage.clear();
}

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<{ error: unknown }>;
  isAuthenticated: boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function useProvideAuth(): AuthContextValue {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_OUT' || event === 'SIGNED_IN') {
          clearExplicitSignOut();
        }
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      const msg = String((error as any)?.message ?? "");
      if (error && /invalid refresh token/i.test(msg)) {
        try {
          clearClientSideSessionData();
        } catch {
          void 0;
        }
        clearExplicitSignOut();
        setSession(null);
        setUser(null);
        setLoading(false);
        return;
      }

      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = useCallback(async () => {
    markExplicitSignOut();

    try {
      await queryClient.cancelQueries();
    } catch {
      void 0;
    }

    const { error } = await supabase.auth.signOut({ scope: 'global' });
    void error;

    try {
      queryClient.clear();
    } catch {
      void 0;
    }

    try {
      clearClientSideSessionData();
    } catch {
      void 0;
    }

    setSession(null);
    setUser(null);
    setLoading(false);

    return { error: error ?? null };
  }, []);

  return useMemo(
    () => ({
      user,
      session,
      loading,
      signOut,
      isAuthenticated: !!session,
    }),
    [user, session, loading, signOut]
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const value = useProvideAuth();
  return createElement(AuthContext.Provider, { value }, children);
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within <AuthProvider>');
  }
  return ctx;
}
