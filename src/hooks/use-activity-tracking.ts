import { useEffect, useMemo, useRef } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useUserRoles } from "@/hooks/use-user-roles";

type TrackedPage = "dashboard" | "grupos" | "configuracoes" | "usuarios" | "relatorios" | "onboarding";

function mapPathToPage(pathname: string): TrackedPage | null {
  if (pathname === "/") return "dashboard";

  if (/^\/(?:org|organization)\/[^/]+\/?$/.test(pathname)) return "dashboard";
  if (/^\/(?:org|organization)\/[^/]+\/dashboard\/?$/.test(pathname)) return "dashboard";

  if (/^\/(?:org|organization)\/[^/]+\/groups(?:\/|$)/.test(pathname)) return "grupos";
  if (/^\/(?:group|groups)\/[^/]+(?:\/|$)/.test(pathname)) return "grupos";

  if (/^\/settings(?:\/|$)/.test(pathname) || /^\/account(?:\/|$)/.test(pathname)) return "configuracoes";

  if (/^\/(?:group|groups)\/[^/]+\/summaries(?:\/|$)/.test(pathname)) return "relatorios";

  return null;
}

export function useActivityTracking() {
  const location = useLocation();
  const { user, session, isAuthenticated } = useAuth();
  const { roles, isLoading: rolesLoading } = useUserRoles();

  const orgId = useMemo(() => {
    const orgRole = (roles ?? []).find((r) => r.role === "ORG_ADMIN" && !!r.organization_id);
    return orgRole?.organization_id ?? null;
  }, [roles]);

  const isOrgAdmin = useMemo(() => (roles ?? []).some((r) => r.role === "ORG_ADMIN"), [roles]);

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
    if (!isOrgAdmin) return;
    if (!orgId) return;

    const pendingUserId = pendingLoginUserIdRef.current;
    if (!pendingUserId || pendingUserId !== user.id) return;

    const loginKey = `${user.id}:${session?.access_token ?? ""}`;
    if (lastLoginKeyRef.current === loginKey) return;
    lastLoginKeyRef.current = loginKey;
    pendingLoginUserIdRef.current = null;

    void supabase
      .from("user_activity_log")
      .insert({
        user_id: user.id,
        org_id: orgId,
        role: "org_admin",
        event_type: "login",
      });
  }, [isAuthenticated, orgId, isOrgAdmin, rolesLoading, session?.access_token, user?.id]);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (!user?.id) return;
    if (rolesLoading) return;
    if (!isOrgAdmin) return;
    if (!orgId) return;

    const page = mapPathToPage(location.pathname);
    if (!page) return;

    const pageKey = `${page}:${location.pathname}`;
    if (lastPageKeyRef.current === pageKey) return;
    lastPageKeyRef.current = pageKey;

    void supabase
      .from("user_activity_log")
      .insert({
        user_id: user.id,
        org_id: orgId,
        role: "org_admin",
        event_type: "page_view",
        page,
      });
  }, [isAuthenticated, location.pathname, orgId, isOrgAdmin, rolesLoading, user?.id]);
}

