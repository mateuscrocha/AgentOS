import { useEffect, useMemo, useRef } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useUserRoles } from "@/hooks/use-user-roles";

type TrackedPage =
  | "dashboard"
  | "organizacoes"
  | "grupos"
  | "membros"
  | "mensagens"
  | "suporte"
  | "eventos"
  | "enquetes"
  | "crm"
  | "configuracoes"
  | "usuarios"
  | "relatorios"
  | "resumos"
  | "alertas"
  | "insights"
  | "onboarding";

function mapPathToPage(pathname: string): TrackedPage | null {
  if (pathname === "/") return "dashboard";
  if (/^\/system\/?$/.test(pathname)) return "dashboard";
  if (/^\/system\/organizations(?:\/|$)/.test(pathname)) return "organizacoes";

  if (/^\/(?:org|organization)\/[^/]+\/?$/.test(pathname)) return "dashboard";
  if (/^\/(?:org|organization)\/[^/]+\/dashboard\/?$/.test(pathname)) return "dashboard";
  if (/^\/(?:org|organization)\/[^/]+\/(?:keywords|profile)\/?$/.test(pathname)) return "dashboard";

  if (/^\/(?:group|groups)\/[^/]+\/summaries(?:\/|$)/.test(pathname)) return "resumos";
  if (/^\/(?:group|groups)\/[^/]+\/messages(?:\/|$)/.test(pathname)) return "mensagens";
  if (/^\/(?:group|groups)\/[^/]+\/support(?:\/|$)/.test(pathname)) return "suporte";
  if (/^\/(?:group|groups)\/[^/]+\/events(?:\/|$)/.test(pathname)) return "eventos";
  if (/^\/(?:group|groups)\/[^/]+\/polls(?:\/|$)/.test(pathname)) return "enquetes";
  if (/^\/(?:group|groups)\/[^/]+\/members(?:\/|$)/.test(pathname)) return "membros";
  if (/^\/(?:group|groups)\/[^/]+\/edit(?:\/|$)/.test(pathname)) return "configuracoes";
  if (/^\/system\/groups(?:\/|$)/.test(pathname)) return "grupos";
  if (/^\/(?:org|organization)\/[^/]+\/groups(?:\/|$)/.test(pathname)) return "grupos";
  if (/^\/(?:group|groups)\/[^/]+(?:\/|$)/.test(pathname)) return "grupos";

  if (/^\/system\/users(?:\/|$)/.test(pathname)) return "usuarios";
  if (/^\/(?:system\/)?alerts(?:\/|$)/.test(pathname) || /^\/(?:system\/)?alert-definitions(?:\/|$)/.test(pathname)) return "alertas";
  if (/^\/system\/crm(?:\/|$)/.test(pathname)) return "crm";
  if (/^\/system\/settings(?:\/|$)/.test(pathname)) return "configuracoes";
  if (/^\/settings(?:\/|$)/.test(pathname) || /^\/account(?:\/|$)/.test(pathname)) return "configuracoes";
  if (/^\/system\/events(?:\/|$)/.test(pathname)) return "eventos";
  if (/^\/system\/activity(?:\/|$)/.test(pathname) || /^\/system\/trends(?:\/|$)/.test(pathname)) return "insights";

  return null;
}

function getSessionId(userId: string | undefined, accessToken: string | undefined) {
  if (!userId) return null;
  if (!accessToken) return userId;
  return `${userId}:${accessToken.slice(-12)}`;
}

function hasTrackedLogin(loginKey: string) {
  try {
    return sessionStorage.getItem(`activity-login:${loginKey}`) === "1";
  } catch {
    return false;
  }
}

function markTrackedLogin(loginKey: string) {
  try {
    sessionStorage.setItem(`activity-login:${loginKey}`, "1");
  } catch {
    void 0;
  }
}

async function trackActivity(payload: {
  _event_type: "login" | "page_view";
  _page?: TrackedPage;
  _route: string;
  _session_id: string | null;
  _metadata: { pathname: string };
}) {
  const { error } = await supabase.rpc("record_user_activity", payload);
  if (error) {
    console.warn("activity tracking failed", {
      eventType: payload._event_type,
      route: payload._route,
      error,
    });
  }
}

export function useActivityTracking() {
  const location = useLocation();
  const { user, session, isAuthenticated } = useAuth();
  const { roles, isLoading: rolesLoading, isSystemAdmin } = useUserRoles();

  const hasScopedAccess = useMemo(() => {
    return (roles ?? []).some((role) => !!role.organization_id || !!role.group_id);
  }, [roles]);

  const lastPageKeyRef = useRef<string | null>(null);
  const pendingLoginUserIdRef = useRef<string | null>(null);
  const lastLoginKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === "SIGNED_IN") {
        pendingLoginUserIdRef.current = nextSession?.user?.id ?? null;
      }
      if (event === "SIGNED_OUT") {
        pendingLoginUserIdRef.current = null;
        lastLoginKeyRef.current = null;
        lastPageKeyRef.current = null;
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (!user?.id) return;
    if (rolesLoading) return;
    if (!isSystemAdmin && !hasScopedAccess) return;

    const pendingUserId = pendingLoginUserIdRef.current;
    const loginKey = `${user.id}:${session?.access_token ?? ""}`;
    const shouldTrackPendingLogin = !!pendingUserId && pendingUserId === user.id;
    const shouldTrackSessionBootstrap = !pendingUserId && !hasTrackedLogin(loginKey);

    if (!shouldTrackPendingLogin && !shouldTrackSessionBootstrap) return;
    lastLoginKeyRef.current = loginKey;
    markTrackedLogin(loginKey);
    pendingLoginUserIdRef.current = null;

    void trackActivity({
      _event_type: "login",
      _route: location.pathname,
      _session_id: getSessionId(user.id, session?.access_token),
      _metadata: {
        pathname: location.pathname,
      },
    });
  }, [hasScopedAccess, isAuthenticated, isSystemAdmin, location.pathname, rolesLoading, session?.access_token, user?.id]);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (!user?.id) return;
    if (rolesLoading) return;
    if (!isSystemAdmin && !hasScopedAccess) return;

    const page = mapPathToPage(location.pathname);
    if (!page) return;

    const pageKey = `${page}:${location.pathname}`;
    if (lastPageKeyRef.current === pageKey) return;
    lastPageKeyRef.current = pageKey;

    void trackActivity({
      _event_type: "page_view",
      _page: page,
      _route: location.pathname,
      _session_id: getSessionId(user.id, session?.access_token),
      _metadata: {
        pathname: location.pathname,
      },
    });
  }, [hasScopedAccess, isAuthenticated, isSystemAdmin, location.pathname, rolesLoading, session?.access_token, user?.id]);
}
