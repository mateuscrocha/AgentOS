import { Wifi, WifiOff, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

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
  provider: _provider, 
  totalMembers, 
  lastMessageAt,
  syncStatus,
  bottomSlot
}: GroupHeaderProps) {
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
    <div className="rounded-2xl border border-border/60 bg-card/70 overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-5 border-b border-border/60">
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-3 min-w-0">
            <h2 className="text-xl sm:text-2xl font-semibold text-card-foreground truncate min-w-0">{name}</h2>
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold leading-none shrink-0",
                    groupStatus.color === 'success' && "bg-success/10 text-success",
                    groupStatus.color === 'warning' && "bg-warning/10 text-warning",
                    groupStatus.color === 'destructive' && "bg-destructive/10 text-destructive",
                    groupStatus.color === 'muted' && "bg-muted text-muted-foreground",
                  )}
                >
                  <groupStatus.icon className="h-3.5 w-3.5" />
                  {groupStatus.label}
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom" align="start">
                <div className="text-sm">{totalMembers} membros</div>
                {lastMessageAt ? (
                  <div className="text-xs text-muted-foreground mt-1">Última atividade: {formatDateTime(lastMessageAt)}</div>
                ) : null}
              </TooltipContent>
            </Tooltip>
          </div>
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
