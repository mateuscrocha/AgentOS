import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { 
  LayoutDashboard, 
  Users, 
  MessageSquare, 
  Settings, 
  ChevronLeft,
  ChevronRight,
  Bot,
  Shield,
  Database
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  icon: React.ElementType;
  label: string;
  href: string;
  badge?: number;
}

const navItems: NavItem[] = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/" },
  { icon: Users, label: "Groups", href: "/groups" },
  { icon: MessageSquare, label: "Messages", href: "/messages" },
  { icon: Settings, label: "Configurações", href: "/settings" },
];

export function AdminSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen bg-sidebar border-r border-sidebar-border transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center justify-between px-4 border-b border-sidebar-border">
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

      {/* Navigation */}
      <nav className="flex flex-col gap-1 p-3">
        {navItems.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <NavLink
              key={item.href}
              to={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
              )}
            >
              <item.icon className={cn("h-5 w-5 shrink-0", isActive && "text-primary")} />
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
        })}
      </nav>

      {/* Status indicator */}
      <div className="absolute bottom-20 left-0 right-0 px-3">
        <div className={cn(
          "rounded-lg bg-sidebar-accent/50 p-3",
          collapsed && "p-2"
        )}>
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-muted-foreground shrink-0" />
            {!collapsed && (
              <div className="animate-fade-in">
                <p className="text-xs font-medium text-sidebar-foreground">Supabase</p>
                <p className="text-xs text-muted-foreground">Aguardando conexão</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Security badge */}
      <div className="absolute bottom-4 left-0 right-0 px-3">
        <div className={cn(
          "flex items-center gap-2 rounded-lg border border-sidebar-border bg-sidebar-accent/30 p-2",
          collapsed && "justify-center"
        )}>
          <Shield className="h-4 w-4 text-success shrink-0" />
          {!collapsed && (
            <span className="text-xs text-muted-foreground animate-fade-in">RLS Ativo</span>
          )}
        </div>
      </div>

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
