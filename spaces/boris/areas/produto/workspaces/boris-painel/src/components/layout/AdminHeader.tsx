import { User, LogOut, ChevronDown, Shield, Building2, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { useUserRoles } from "@/hooks/use-user-roles";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { notify } from "@/components/ui/sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { ReactNode } from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

interface AdminHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function AdminHeader({ title, subtitle, actions }: AdminHeaderProps) {
  const navigate = useNavigate();
  const { user, signOut, isAuthenticated } = useAuth();
  const { getRoleLabel, isSystemAdmin, isOrgAdmin, isGroupManager } = useUserRoles();

  // Fetch profile for name
  const { data: profile } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('name')
        .eq('id', user!.id)
        .maybeSingle();
      return data;
    },
    enabled: isAuthenticated && !!user?.id,
  });

  const displayName = profile?.name || user?.email?.split('@')[0] || 'Usuário';
  const displayEmail = user?.email || '';
  const roleLabel = getRoleLabel();

  // Determine role icon and color
  const getRoleIcon = () => {
    if (isSystemAdmin) return <Shield className="h-3 w-3" />;
    if (isOrgAdmin) return <Building2 className="h-3 w-3" />;
    if (isGroupManager) return <Users className="h-3 w-3" />;
    return <User className="h-3 w-3" />;
  };

  const getRoleBadgeVariant = () => {
    if (isSystemAdmin) return "destructive";
    if (isOrgAdmin) return "default";
    if (isGroupManager) return "secondary";
    return "outline";
  };

  const handleLogout = async () => {
    await signOut();
    notify.success("Você saiu", "Logout realizado com sucesso.");
    window.location.assign('/auth');
  };

  return (
    <header className="sticky top-0 z-30 border-b border-border/80 bg-background/85 backdrop-blur-md">
      <div className="flex min-h-16 flex-wrap items-center justify-between gap-3 px-4 py-3 sm:h-16 sm:flex-nowrap sm:px-6 sm:py-0">
      <div className="flex min-w-0 items-start gap-3">
        <SidebarTrigger variant="ghost" size="icon" className="mt-0.5 md:hidden" />
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold tracking-[-0.02em] text-foreground">{title}</h1>
          {subtitle && (
            <p className="truncate text-[13px] text-muted-foreground">{subtitle}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 sm:gap-4">
        {actions && (
          <div className="hidden sm:block">
            {actions}
          </div>
        )}
        {isAuthenticated ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-transparent px-2.5 py-2 transition-colors hover:border-border/70 hover:bg-muted/50"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-primary shadow-subtle">
                  <User className="h-4 w-4 text-primary-foreground" />
                </div>
                <div className="hidden min-w-0 md:block text-left">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-foreground">{displayName}</p>
                    {roleLabel && (
                      <Badge variant={getRoleBadgeVariant()} className="flex h-5 items-center gap-1 px-1.5 py-0 text-[10px]">
                        {getRoleIcon()}
                        <span className="hidden lg:inline">{roleLabel}</span>
                      </Badge>
                    )}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{displayEmail}</p>
                </div>
                <ChevronDown className="h-4 w-4 text-muted-foreground hidden md:block" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 rounded-[var(--radius-lg)] border-border/80 p-1 shadow-medium">
              <div className="px-2 py-2">
                <p className="text-sm font-medium">{displayName}</p>
                <p className="text-xs text-muted-foreground">{displayEmail}</p>
                {roleLabel && (
                  <Badge variant={getRoleBadgeVariant()} className="mt-2 flex w-fit items-center gap-1 text-[11px]">
                    {getRoleIcon()}
                    {roleLabel}
                  </Badge>
                )}
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate('/account')}>
                <User className="h-4 w-4 mr-2" />
                Minha Conta
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                <LogOut className="h-4 w-4 mr-2" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button type="button" onClick={() => navigate('/auth')}>
            Entrar
          </Button>
        )}
      </div>
      </div>
    </header>
  );
}
