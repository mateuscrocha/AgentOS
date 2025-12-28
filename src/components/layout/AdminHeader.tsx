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
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/80 backdrop-blur-sm px-6">
      <div>
        <h1 className="text-lg font-semibold text-foreground">{title}</h1>
        {subtitle && (
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        )}
      </div>

      <div className="flex items-center gap-4">
        {actions && (
          <div className="hidden sm:block">
            {actions}
          </div>
        )}
        {/* User menu */}
        {isAuthenticated ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary transition-colors">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-primary">
                  <User className="h-4 w-4 text-primary-foreground" />
                </div>
                <div className="hidden md:block text-left">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground">{displayName}</p>
                    {roleLabel && (
                      <Badge variant={getRoleBadgeVariant()} className="text-[10px] px-1.5 py-0 h-4 flex items-center gap-1">
                        {getRoleIcon()}
                        <span className="hidden lg:inline">{roleLabel}</span>
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{displayEmail}</p>
                </div>
                <ChevronDown className="h-4 w-4 text-muted-foreground hidden md:block" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <div className="px-2 py-1.5">
                <p className="text-sm font-medium">{displayName}</p>
                <p className="text-xs text-muted-foreground">{displayEmail}</p>
                {roleLabel && (
                  <Badge variant={getRoleBadgeVariant()} className="mt-1 text-xs flex items-center gap-1 w-fit">
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
          <button
            onClick={() => navigate('/auth')}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Entrar
          </button>
        )}
      </div>
    </header>
  );
}
