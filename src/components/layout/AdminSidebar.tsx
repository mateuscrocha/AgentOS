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
  Activity,
  MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUserRoles } from "@/hooks/use-user-roles";

interface NavItem {
  icon: React.ElementType;
  label: string;
  href: string;
  badge?: number;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const bottomNavItems: NavItem[] = [
  { icon: UserCircle, label: "Minha Conta", href: "/account" },
];

export function AdminSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const { isSystemAdmin, isOrgAdmin, isGroupManager, getAccessibleOrgIds, getAccessibleGroupIds } = useUserRoles();

  const isActive = (href: string) => {
    if (href === "/") return location.pathname === "/";
    if (href === "/system/events") return location.pathname === "/system/events";
    return location.pathname.startsWith(href);
  };

  const buildSections = (): NavSection[] => {
    const sections: NavSection[] = [];
    const orgIds = getAccessibleOrgIds();
    const groupIds = getAccessibleGroupIds();
    const orgId = orgIds[0];
    const groupId = groupIds[0];

    if (isSystemAdmin) {
      sections.push({
        title: "Sistema",
        items: [
          { icon: LayoutDashboard, label: "Central do Bóris", href: "/" },
          { icon: Building2, label: "Organizações", href: "/system/organizations" },
          { icon: Users, label: "Grupos", href: "/system/groups" },
          { icon: Users, label: "Usuários & Permissões", href: "/system/users" },
          { icon: Activity, label: "Suporte & Diagnóstico", href: "/system/events" },
          { icon: Settings, label: "Configurações do Sistema", href: "/system/settings" },
        ],
      });
    } else if (isOrgAdmin && orgId) {
      sections.push({
        title: "Organização",
        items: [
          { icon: LayoutDashboard, label: "Dashboard", href: `/organization/${orgId}/dashboard` },
          { icon: Users, label: "Grupos", href: `/organization/${orgId}/groups` },
          { icon: MessageSquare, label: "Palavras-chave", href: `/organization/${orgId}/keywords` },
        ],
      });
    } else if (isGroupManager && groupId) {
      sections.push({
        title: "Grupo",
        items: [
          { icon: LayoutDashboard, label: "Visão do Grupo", href: `/groups/${groupId}` },
          { icon: MessageSquare, label: "Mensagens & Resumos", href: `/groups/${groupId}/messages` },
          { icon: Users, label: "Participantes", href: `/groups/${groupId}/members` },
          { icon: Settings, label: "Configurações do Grupo", href: `/group/${groupId}/edit` },
        ],
      });
    } else if (groupId) {
      sections.push({
        title: "Leitura",
        items: [
          { icon: LayoutDashboard, label: "Dashboard do Grupo", href: `/groups/${groupId}` },
        ],
      });
    } else if (orgId) {
      sections.push({
        title: "Leitura",
        items: [
          { icon: LayoutDashboard, label: "Dashboard da Organização", href: `/organization/${orgId}/dashboard` },
        ],
      });
    }

    return sections;
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
      <nav className="flex flex-col gap-4 p-3">
        {buildSections().map((section) => (
          <div key={section.title} className="flex flex-col gap-1">
            {!collapsed && (
              <span className="text-xs font-medium text-muted-foreground px-3 py-2">{section.title}</span>
            )}
            {section.items.map(renderNavItem)}
          </div>
        ))}
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
        {isSystemAdmin && renderNavItem({ icon: Settings, label: "Configurações", href: "/system/settings" })}
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
