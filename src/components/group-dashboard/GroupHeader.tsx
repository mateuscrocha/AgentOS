import { Users, Wifi, WifiOff, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { ReactNode } from "react";
import { useUserRoles } from "@/hooks/use-user-roles";

interface GroupHeaderProps {
  groupId: string;
  name: string;
  provider: string;
  totalMembers: number;
  lastMessageAt: string | null;
  syncStatus: string | null;
  bottomSlot?: ReactNode;
}

export function GroupHeader({ 
  groupId,
  name, 
  provider, 
  totalMembers, 
  lastMessageAt,
  syncStatus,
  bottomSlot
}: GroupHeaderProps) {
  const { isSystemAdmin } = useUserRoles();
  

  const getGroupStatus = () => {
    if (syncStatus === 'error') {
      return { label: 'Desconectado', color: 'destructive', icon: WifiOff };
    }
    if (!lastMessageAt) {
      return { label: 'Sem atividade', color: 'muted', icon: AlertCircle };
    }
    const lastMsgDate = new Date(lastMessageAt);
    const hoursSinceLastMsg = (Date.now() - lastMsgDate.getTime()) / (1000 * 60 * 60);
    if (hoursSinceLastMsg > 48) {
      return { label: 'Inativo', color: 'warning', icon: AlertCircle };
    }
    return { label: 'Ativo', color: 'success', icon: Wifi };
  };

  const groupStatus = getGroupStatus();

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-5 border-b border-border">
        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 shrink-0">
          <Users className="h-7 w-7 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-semibold text-card-foreground truncate">{name}</h2>
          <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-muted-foreground">
            {isSystemAdmin ? (
              <span className="capitalize">{provider}</span>
            ) : (
              <span>{groupStatus.label === 'Desconectado' ? 'Integração desconectada' : 'Integração ativa'}</span>
            )}
            <span>•</span>
            <span>{totalMembers} membros</span>
            <span>•</span>
            <span className={cn(
              "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium",
              groupStatus.color === 'success' && "bg-success/10 text-success",
              groupStatus.color === 'warning' && "bg-warning/10 text-warning",
              groupStatus.color === 'destructive' && "bg-destructive/10 text-destructive",
              groupStatus.color === 'muted' && "bg-muted text-muted-foreground"
            )}>
              <groupStatus.icon className="h-3 w-3" />
              {groupStatus.label}
            </span>
          </div>
          {lastMessageAt && (
            <p className="text-xs text-muted-foreground mt-1">
              Última atividade: {formatDateTime(lastMessageAt)}
            </p>
          )}
        </div>
      </div>
      {bottomSlot && (
        <div className="px-5 py-3">
          {bottomSlot}
        </div>
      )}
      
      
    </div>
  );
}
