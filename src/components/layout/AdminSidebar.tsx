import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { 
  LayoutDashboard, 
  Building2,
  Users, 
  Settings, 
  ChevronLeft,
  ChevronRight,
  Bot,
  Shield,
  Database,
  UserCircle,
  Layers,
  Activity
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUserRoles } from "@/hooks/use-user-roles";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

interface NavItem {
  icon: React.ElementType;
  label: string;
  href: string;
  badge?: number;
  requiresSystemAdmin?: boolean;
}

const mainNavItems: NavItem[] = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/" },
  { icon: Layers, label: "Sistema", href: "/system" },
  { icon: Activity, label: "Events", href: "/system/events", requiresSystemAdmin: true },
];

// Context nav items removed - navigation to orgs/groups should be via /system

const bottomNavItems: NavItem[] = [
  { icon: UserCircle, label: "Minha Conta", href: "/account" },
  { icon: Settings, label: "Configurações", href: "/settings" },
];

export function AdminSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const { isSystemAdmin } = useUserRoles();
  const { isAuthenticated } = useAuth();

  // Fetch recent organizations
  const { data: organizations } = useQuery({
    queryKey: ['sidebar-organizations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organizations')
        .select('id, name')
        .order('created_at', { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
    enabled: isAuthenticated,
  });

  // Fetch recent groups
  const { data: groups } = useQuery({
    queryKey: ['sidebar-groups'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('groups')
        .select('id, name, organization_id')
        .order('created_at', { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
    enabled: isAuthenticated,
  });

  const isActive = (href: string) => {
    if (href === "/") return location.pathname === "/";
    if (href === "/system/events") return location.pathname === "/system/events";
    if (href === "/system") return location.pathname === "/system";
    return location.pathname.startsWith(href);
  };

  const renderNavItem = (item: NavItem) => {
    const active = isActive(item.href);
    return (
      <NavLink
        key={item.href}
        to={item.href}
        className={cn(
          "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
          active
            ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
            : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
        )}
      >
        <item.icon className={cn("h-5 w-5 shrink-0", active && "text-primary")} />
        {!collapsed && (
          <span className="animate-fade-in">{item.label}</span>
        )}
        {!collapsed && item.badge && (
          <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground">
            {item.badge}
          </span>
        )}
      </NavLink>
    );
  };

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen bg-sidebar border-r border-sidebar-border transition-all duration-300 flex flex-col",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center justify-between px-4 border-b border-sidebar-border shrink-0">
        {!collapsed && (
          <div className="flex items-center gap-2 animate-fade-in">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-primary">
              <Bot className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-semibold text-foreground">Bóris Admin</span>
          </div>
        )}
        {collapsed && (
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-primary mx-auto">
            <Bot className="h-5 w-5 text-primary-foreground" />
          </div>
        )}
      </div>

      {/* Main Navigation */}
      <nav className="flex flex-col gap-1 p-3">
        {!collapsed && (
          <span className="text-xs font-medium text-muted-foreground px-3 py-2">Principal</span>
        )}
        {mainNavItems
          .filter(item => !item.requiresSystemAdmin || isSystemAdmin)
          .map(renderNavItem)}
      </nav>

      {/* Quick Access - Organizations */}
      {organizations && organizations.length > 0 && (
        <nav className="flex flex-col gap-1 px-3">
          {!collapsed && (
            <span className="text-xs font-medium text-muted-foreground px-3 py-2">Organizações</span>
          )}
          {organizations.map((org) => {
            const href = `/org/${org.id}`;
            const active = isActive(href);
            return (
              <NavLink
                key={org.id}
                to={href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                )}
              >
                <Building2 className={cn("h-4 w-4 shrink-0", active && "text-primary")} />
                {!collapsed && (
                  <span className="truncate animate-fade-in">{org.name}</span>
                )}
              </NavLink>
            );
          })}
        </nav>
      )}

      {/* Quick Access - Groups */}
      {groups && groups.length > 0 && (
        <nav className="flex flex-col gap-1 px-3 mt-1">
          {!collapsed && (
            <span className="text-xs font-medium text-muted-foreground px-3 py-2">Grupos</span>
          )}
          {groups.map((group) => {
            const href = `/group/${group.id}`;
            const active = isActive(href);
            return (
              <NavLink
                key={group.id}
                to={href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                )}
              >
                <Users className={cn("h-4 w-4 shrink-0", active && "text-primary")} />
                {!collapsed && (
                  <span className="truncate animate-fade-in">{group.name}</span>
                )}
              </NavLink>
            );
          })}
        </nav>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Status indicator */}
      <div className="px-3 mb-2">
        <div className={cn(
          "rounded-lg bg-sidebar-accent/50 p-3",
          collapsed && "p-2"
        )}>
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-success shrink-0" />
            {!collapsed && (
              <div className="animate-fade-in">
                <p className="text-xs font-medium text-sidebar-foreground">Supabase</p>
                <p className="text-xs text-muted-foreground">Conectado</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Security badge */}
      <div className="px-3 mb-2">
        <div className={cn(
          "flex items-center gap-2 rounded-lg border border-sidebar-border bg-sidebar-accent/30 p-2",
          collapsed && "justify-center"
        )}>
          <Shield className="h-4 w-4 text-warning shrink-0" />
          {!collapsed && (
            <span className="text-xs text-muted-foreground animate-fade-in">RLS Pendente</span>
          )}
        </div>
      </div>

      {/* Bottom Navigation */}
      <nav className="flex flex-col gap-1 p-3 border-t border-sidebar-border">
        {bottomNavItems.map(renderNavItem)}
      </nav>

      {/* Collapse button */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-20 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
      >
        {collapsed ? (
          <ChevronRight className="h-4 w-4" />
        ) : (
          <ChevronLeft className="h-4 w-4" />
        )}
      </button>
    </aside>
  );
}
