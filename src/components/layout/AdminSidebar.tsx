import { useCallback, useEffect, useMemo, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Activity,
  Bell,
  Building2,
  ChevronDown,
  FileText,
  LayoutDashboard,
  ListChecks,
  MessageSquare,
  Settings,
  Shield,
  UserCircle,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUserRoles } from "@/hooks/use-user-roles";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface NavItem {
  icon: React.ElementType;
  label: string;
  href: string;
  badge?: number;
}

const bottomNavItems: NavItem[] = [
  { icon: UserCircle, label: "Minha Conta", href: "/account" },
];

const ONBOARDING_GROUPS_HINT_KEY = "boris_onboarding_groups_hint_done";

export function AdminSidebar() {
  const location = useLocation();
  const { isSystemAdmin, isOrgAdmin, isGroupManager, getAccessibleOrgIds, getAccessibleGroupIds } = useUserRoles();

  const canUseAlerts = isSystemAdmin || isOrgAdmin || isGroupManager;
  const unreadAlertsQuery = useQuery<number>({
    queryKey: ["alerts", "unread-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("alert_events")
        .select("id", { count: "exact", head: true })
        .eq("status", "unread");
      if (error) throw error;
      return count ?? 0;
    },
    enabled: canUseAlerts,
    refetchInterval: 20_000,
  });

  const [showGroupsHint, setShowGroupsHint] = useState(() => {
    try {
      const done = globalThis.localStorage?.getItem(ONBOARDING_GROUPS_HINT_KEY);
      return !done || done === "false";
    } catch {
      return false;
    }
  });
  const [groupsHintPulse, setGroupsHintPulse] = useState(false);

  useEffect(() => {
    if (!showGroupsHint) return;
    setGroupsHintPulse(true);
    const timeoutId = globalThis.setTimeout(() => setGroupsHintPulse(false), 2500);
    return () => globalThis.clearTimeout(timeoutId);
  }, [showGroupsHint]);

  const isActive = useCallback(
    (href: string) => {
      if (href === "/") return location.pathname === "/";
      if (href === "/system/events") return location.pathname === "/system/events";
      if (/^\/groups\/[^/]+$/.test(href) || /^\/group\/[^/]+$/.test(href)) {
        return location.pathname === href || location.pathname === `${href}/dashboard`;
      }
      if (/^\/organization\/[^/]+\/dashboard$/.test(href)) {
        return location.pathname === href;
      }
      return location.pathname.startsWith(href);
    },
    [location.pathname],
  );

  const { currentGroupId, orgIdForNavigation, groupIdFallback } = useMemo(() => {
    const pathname = location.pathname;
    const groupMatch = pathname.match(/^\/(?:group|groups)\/([^/]+)/);
    const orgMatch = pathname.match(/^\/(?:org|organization)\/([^/]+)/);

    const orgIds = getAccessibleOrgIds();
    const groupIds = getAccessibleGroupIds();

    return {
      currentGroupId: groupMatch?.[1] ?? null,
      orgIdForNavigation: orgMatch?.[1] ?? orgIds[0] ?? null,
      groupIdFallback: groupIds[0] ?? null,
    };
  }, [getAccessibleGroupIds, getAccessibleOrgIds, location.pathname]);

  const painelHref = useMemo(() => {
    if (isSystemAdmin) return "/";
    if (currentGroupId) return `/groups/${currentGroupId}`;
    if (orgIdForNavigation) return `/organization/${orgIdForNavigation}/dashboard`;
    if (groupIdFallback) return `/groups/${groupIdFallback}`;
    return "/";
  }, [currentGroupId, groupIdFallback, isSystemAdmin, orgIdForNavigation]);

  const gruposHref = useMemo(() => {
    if (isSystemAdmin) return "/system/groups";
    if (orgIdForNavigation) return `/organization/${orgIdForNavigation}/groups`;
    return "/";
  }, [isSystemAdmin, orgIdForNavigation]);

  const organizacoesHref = useMemo(() => {
    if (!isSystemAdmin) return null;
    return "/system/organizations";
  }, [isSystemAdmin]);

  const generalItems: NavItem[] = useMemo(
    () => {
      const items: NavItem[] = [{ icon: LayoutDashboard, label: "Painel", href: painelHref }];
      if (organizacoesHref) items.push({ icon: Building2, label: "Organizações", href: organizacoesHref });
      items.push({ icon: Users, label: "Grupos", href: gruposHref });
      if (canUseAlerts) {
        items.push({
          icon: Bell,
          label: "Alertas",
          href: "/alerts",
          badge: unreadAlertsQuery.data ? unreadAlertsQuery.data : undefined,
        });
      }
      return items;
    },
    [canUseAlerts, gruposHref, organizacoesHref, painelHref, unreadAlertsQuery.data],
  );

  const groupItems: NavItem[] = useMemo(() => {
    if (!currentGroupId) return [];
    const items: NavItem[] = [
      { icon: LayoutDashboard, label: "Painel do grupo", href: `/groups/${currentGroupId}` },
      { icon: FileText, label: "Diário", href: `/groups/${currentGroupId}/summaries` },
      { icon: MessageSquare, label: "Mensagens", href: `/groups/${currentGroupId}/messages` },
      { icon: Users, label: "Membros", href: `/groups/${currentGroupId}/members` },
      { icon: ListChecks, label: "Enquetes", href: `/groups/${currentGroupId}/polls` },
    ];
    if (isSystemAdmin) items.push({ icon: Settings, label: "Configurações do grupo", href: `/groups/${currentGroupId}/edit` });
    return items;
  }, [currentGroupId, isSystemAdmin]);

  const adminItems: NavItem[] = useMemo(() => {
    if (!isSystemAdmin) return [];
    return [
      { icon: Users, label: "Usuários", href: "/system/users" },
      { icon: Activity, label: "Atividade", href: "/system/activity" },
      { icon: FileText, label: "Logs", href: "/system/events" },
      { icon: Settings, label: "Configurações do sistema", href: "/system/settings" },
    ];
  }, [isSystemAdmin]);

  const adminHasActiveItem = useMemo(() => adminItems.some((x) => isActive(x.href)), [adminItems, isActive]);
  const [adminOpen, setAdminOpen] = useState(adminHasActiveItem);

  useEffect(() => {
    if (adminHasActiveItem) setAdminOpen(true);
  }, [adminHasActiveItem]);

  const handleGroupsNavClick = useCallback(() => {
    try {
      globalThis.localStorage?.setItem(ONBOARDING_GROUPS_HINT_KEY, "true");
    } catch {
      void 0;
    }
    setShowGroupsHint(false);
  }, []);

  const renderNavItem = (item: NavItem) => {
    const active = isActive(item.href);
    const isGroupsItem = item.label === "Grupos";
    const showThisHint = showGroupsHint && isGroupsItem;
    const handleNavClick = () => {
      if (isGroupsItem) handleGroupsNavClick();
    };
    return (
      <SidebarMenuItem key={`${item.href}:${item.label}`}>
        <SidebarMenuButton
          asChild
          isActive={active}
          tooltip={item.label}
          className={cn(
            "relative",
            "before:absolute before:left-0 before:top-1 before:bottom-1 before:w-0.5 before:rounded-full before:bg-transparent",
            showThisHint && "before:bg-primary/40",
            "data-[active=true]:before:bg-primary",
            showThisHint && "bg-primary/5 ring-1 ring-primary/20",
            showThisHint && groupsHintPulse && "animate-pulse",
          )}
        >
          <NavLink to={item.href} onClick={handleNavClick}>
            <item.icon className={cn(active && "text-primary")} />
            <span className="group-data-[collapsible=icon]:hidden">{item.label}</span>
            {showThisHint || item.badge ? (
              <span className="ml-auto flex items-center gap-2 group-data-[collapsible=icon]:hidden">
                {showThisHint ? (
                  <span className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                    Comece por aqui
                  </span>
                ) : null}
                {item.badge ? (
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground">
                    {item.badge}
                  </span>
                ) : null}
              </span>
            ) : null}
          </NavLink>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  return (
    <Sidebar collapsible="icon" variant="sidebar" className="border-r border-sidebar-border">
      <SidebarHeader className="p-2">
        <div className="flex items-center gap-2 rounded-md px-2 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg overflow-hidden shrink-0">
            <img src="/admin-logo.png" alt="Bóris Admin" className="h-8 w-8 object-cover" />
          </div>
          <span className="text-sm font-semibold text-foreground group-data-[collapsible=icon]:hidden">Bóris Admin</span>
          <div className="ml-auto">
            <SidebarTrigger variant="ghost" size="icon" className="h-8 w-8" />
          </div>
        </div>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent>
        <div className="px-2 pt-2">
          <div className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground group-data-[collapsible=icon]:hidden">
            Geral
          </div>
          <SidebarMenu>{generalItems.map(renderNavItem)}</SidebarMenu>
        </div>

        {groupItems.length > 0 ? (
          <>
            <SidebarSeparator />
            <div className="px-2 pt-2">
              <div className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground group-data-[collapsible=icon]:hidden">
                Grupo
              </div>
              <SidebarMenu>{groupItems.map(renderNavItem)}</SidebarMenu>
            </div>
          </>
        ) : null}

        {adminItems.length > 0 ? (
          <>
            <SidebarSeparator />
            <div className="px-2 pt-2">
              <Collapsible open={adminOpen} onOpenChange={setAdminOpen}>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton
                        tooltip="Administração"
                        className={cn(
                          "relative",
                          "before:absolute before:left-0 before:top-1 before:bottom-1 before:w-0.5 before:rounded-full before:bg-transparent",
                          adminHasActiveItem && "before:bg-primary",
                        )}
                      >
                        <Shield className={cn(adminHasActiveItem && "text-primary")} />
                        <span className="group-data-[collapsible=icon]:hidden">Administração</span>
                        <ChevronDown
                          className={cn(
                            "ml-auto h-4 w-4 text-muted-foreground transition-transform group-data-[collapsible=icon]:hidden",
                            adminOpen && "rotate-180",
                          )}
                        />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                  </SidebarMenuItem>
                </SidebarMenu>

                <CollapsibleContent>
                  <div className="mt-1">
                    <SidebarMenu>{adminItems.map(renderNavItem)}</SidebarMenu>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
          </>
        ) : null}
      </SidebarContent>

      <SidebarFooter>
        <SidebarSeparator />
        <SidebarMenu>{bottomNavItems.map(renderNavItem)}</SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
