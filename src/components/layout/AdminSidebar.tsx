import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { 
  LayoutDashboard, 
  Building2,
  Users, 
  Settings, 
  ChevronLeft,
  ChevronRight,
  Shield,
  UserCircle,
  Activity
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUserRoles } from "@/hooks/use-user-roles";

interface NavItem {
  icon: React.ElementType;
  label: string;
  href: string;
  badge?: number;
  requiresSystemAdmin?: boolean;
  requiresOrgAdmin?: boolean;
}

const mainNavItems: NavItem[] = [
  { icon: LayoutDashboard, label: "Central do Bóris", href: "/" },
  { icon: Building2, label: "Gerenciar organizações", href: "/system/organizations", requiresSystemAdmin: true },
  { icon: Users, label: "Gerenciar grupos", href: "/system/groups", requiresSystemAdmin: true },
  { icon: Users, label: "Pessoas", href: "/system/people", requiresSystemAdmin: true },
  { icon: Users, label: "Usuários", href: "/system/users", requiresSystemAdmin: true },
  { icon: Activity, label: "Eventos", href: "/system/events", requiresSystemAdmin: true },
];

const bottomNavItems: NavItem[] = [
  { icon: UserCircle, label: "Minha Conta", href: "/account" },
  { icon: Settings, label: "Configurações", href: "/settings", requiresSystemAdmin: true },
];

export function AdminSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const { isSystemAdmin, isOrgAdmin, getAccessibleOrgIds, getAccessibleGroupIds } = useUserRoles();

  const isActive = (href: string) => {
    if (href === "/") return location.pathname === "/";
    if (href === "/system/events") return location.pathname === "/system/events";
    return location.pathname.startsWith(href);
  };

  const shouldShowItem = (item: NavItem) => {
    if (item.requiresSystemAdmin && !isSystemAdmin) return false;
    if (item.requiresOrgAdmin && !isOrgAdmin && !isSystemAdmin) return false;
    return true;
  };

  const renderNavItem = (item: NavItem) => {
    if (!shouldShowItem(item)) return null;
    
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
            <div className="flex h-8 w-8 items-center justify-center rounded-lg overflow-hidden">
              <img src="/admin-logo.png" alt="Bóris Admin" className="h-8 w-8 object-cover" />
            </div>
            <span className="font-semibold text-foreground">Bóris Admin</span>
          </div>
        )}
        {collapsed && (
          <div className="flex h-8 w-8 items-center justify-center rounded-lg overflow-hidden mx-auto">
            <img src="/admin-logo.png" alt="Bóris Admin" className="h-8 w-8 object-cover" />
          </div>
        )}
      </div>

      {/* Main Navigation */}
      <nav className="flex flex-col gap-1 p-3">
        {!collapsed && (
          <span className="text-xs font-medium text-muted-foreground px-3 py-2">Principal</span>
        )}
        {mainNavItems.map(renderNavItem)}
        {(() => {
          if (isSystemAdmin) return null;
          const orgIds = getAccessibleOrgIds();
          const groupIds = getAccessibleGroupIds();
          if (isOrgAdmin && orgIds.length > 0) {
            const orgId = orgIds[0];
            return (
              <>
                {renderNavItem({ icon: LayoutDashboard, label: "Início", href: `/organization/${orgId}` })}
                {renderNavItem({ icon: Users, label: "Grupos", href: `/organization/${orgId}/groups` })}
                {renderNavItem({ icon: Users, label: "Membros", href: `/organization/${orgId}/members` })}
                {renderNavItem({ icon: Activity, label: "Painéis e métricas", href: `/organization/${orgId}/dashboard` })}
                {renderNavItem({ icon: Settings, label: "Configurações", href: `/organization/${orgId}/settings` })}
              </>
            );
          }
          if (groupIds.length > 0) {
            return renderNavItem({ icon: Users, label: "Meus grupos", href: `/groups/${groupIds[0]}` });
          }
          return null;
        })()}
      </nav>


      {/* Spacer */}
      <div className="flex-1" />

      

      {/* Security badge - only for system admins */}
      {isSystemAdmin && (
        <div className="px-3 mb-2">
          <div className={cn(
            "flex items-center gap-2 rounded-lg border border-sidebar-border bg-sidebar-accent/30 p-2",
            collapsed && "justify-center"
          )}>
            <Shield className="h-4 w-4 text-warning shrink-0" />
            {!collapsed && (
              <span className="text-xs text-muted-foreground animate-fade-in">Admin</span>
            )}
          </div>
        </div>
      )}

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
