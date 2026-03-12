import { useEffect, useMemo, useRef } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useUserRoles } from "@/hooks/use-user-roles";

type TrackedPage = "dashboard" | "grupos" | "configuracoes" | "usuarios" | "relatorios" | "resumos" | "alertas" | "insights" | "onboarding";

function mapPathToPage(pathname: string): TrackedPage | null {
  if (pathname === "/") return "dashboard";
  if (/^\/system\/?$/.test(pathname)) return "dashboard";

  if (/^\/(?:org|organization)\/[^/]+\/?$/.test(pathname)) return "dashboard";
  if (/^\/(?:org|organization)\/[^/]+\/dashboard\/?$/.test(pathname)) return "dashboard";

  if (/^\/system\/groups(?:\/|$)/.test(pathname)) return "grupos";
  if (/^\/(?:org|organization)\/[^/]+\/groups(?:\/|$)/.test(pathname)) return "grupos";
  if (/^\/(?:group|groups)\/[^/]+(?:\/|$)/.test(pathname)) return "grupos";

  if (/^\/system\/users(?:\/|$)/.test(pathname)) return "usuarios";
  if (/^\/(?:system\/)?alerts(?:\/|$)/.test(pathname) || /^\/(?:system\/)?alert-definitions(?:\/|$)/.test(pathname)) return "alertas";
  if (/^\/system\/settings(?:\/|$)/.test(pathname)) return "configuracoes";
  if (/^\/settings(?:\/|$)/.test(pathname) || /^\/account(?:\/|$)/.test(pathname)) return "configuracoes";

  if (/^\/system\/activity(?:\/|$)/.test(pathname) || /^\/system\/events(?:\/|$)/.test(pathname) || /^\/system\/trends(?:\/|$)/.test(pathname)) return "insights";
  if (/^\/(?:group|groups)\/[^/]+\/summaries(?:\/|$)/.test(pathname)) return "resumos";

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

export function useActivityTracking() {
  const location = useLocation();
  const { user, session, isAuthenticated } = useAuth();
  const { roles, isLoading: rolesLoading, isSystemAdmin, isOrgAdmin } = useUserRoles();

  const orgId = useMemo(() => {
    const orgRole = (roles ?? []).find((r) => r.role === "ORG_ADMIN" && !!r.organization_id);
    return orgRole?.organization_id ?? null;
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
    if (!isOrgAdmin && !isSystemAdmin) return;
    if (!orgId && !isSystemAdmin) return;

    const pendingUserId = pendingLoginUserIdRef.current;
    const loginKey = `${user.id}:${session?.access_token ?? ""}`;
    const shouldTrackPendingLogin = !!pendingUserId && pendingUserId === user.id;
    const shouldTrackSessionBootstrap = !pendingUserId && !hasTrackedLogin(loginKey);

    if (!shouldTrackPendingLogin && !shouldTrackSessionBootstrap) return;
    lastLoginKeyRef.current = loginKey;
    markTrackedLogin(loginKey);
    pendingLoginUserIdRef.current = null;

    void supabase.rpc("record_user_activity", {
      _event_type: "login",
      _route: location.pathname,
      _session_id: getSessionId(user.id, session?.access_token),
      _metadata: {
        pathname: location.pathname,
      },
    });
  }, [isAuthenticated, isOrgAdmin, isSystemAdmin, location.pathname, orgId, rolesLoading, session?.access_token, user?.id]);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (!user?.id) return;
    if (rolesLoading) return;
    if (!isOrgAdmin && !isSystemAdmin) return;
    if (!orgId && !isSystemAdmin) return;

    const page = mapPathToPage(location.pathname);
    if (!page) return;

    const pageKey = `${page}:${location.pathname}`;
    if (lastPageKeyRef.current === pageKey) return;
    lastPageKeyRef.current = pageKey;

    void supabase.rpc("record_user_activity", {
      _event_type: "page_view",
      _page: page,
      _route: location.pathname,
      _session_id: getSessionId(user.id, session?.access_token),
      _metadata: {
        pathname: location.pathname,
      },
    });
  }, [isAuthenticated, isOrgAdmin, isSystemAdmin, location.pathname, orgId, rolesLoading, session?.access_token, user?.id]);
}
