import { useState, useEffect, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { queryClient } from '@/lib/query-client';

let explicitSignOutAt = 0;

export function isExplicitSignOutRecent(maxAgeMs = 2000) {
  return explicitSignOutAt > 0 && Date.now() - explicitSignOutAt <= maxAgeMs;
}

function markExplicitSignOut() {
  explicitSignOutAt = Date.now();
}

function clearClientSideSessionData() {
  const removeLocalStorageKeys = new Set<string>([
    'system-admin-period',
  ]);

  const removeLocalStoragePrefixes = ['sb-', 'org-period:', 'group-period:'];

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

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
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
    console.info('[auth] logout:start');

    try {
      await queryClient.cancelQueries();
    } catch (err) {
      console.warn('[auth] logout:cancel-queries-failed', err);
    }

    const { error } = await supabase.auth.signOut({ scope: 'global' });
    if (error) {
      console.warn('[auth] logout:supabase-signOut-error', error);
    }

    try {
      queryClient.clear();
    } catch (err) {
      console.warn('[auth] logout:query-client-clear-failed', err);
    }

    try {
      clearClientSideSessionData();
    } catch (err) {
      console.warn('[auth] logout:storage-cleanup-failed', err);
    }

    setSession(null);
    setUser(null);
    setLoading(false);
    console.info('[auth] logout:done');

    return { error };
  }, []);

  return {
    user,
    session,
    loading,
    signOut,
    isAuthenticated: !!session,
  };
}
