import { NavLink } from "react-router-dom";
import { Users, MessageSquare, Activity, Wifi, WifiOff, AlertCircle, ListChecks } from "lucide-react";
import { cn } from "@/lib/utils";

interface GroupHeaderProps {
  groupId: string;
  name: string;
  provider: string;
  totalMembers: number;
  lastMessageAt: string | null;
  syncStatus: string | null;
}

export function GroupHeader({ 
  groupId,
  name, 
  provider, 
  totalMembers, 
  lastMessageAt,
  syncStatus
}: GroupHeaderProps) {
  const tabs = [
    { label: "Dashboard", href: `/groups/${groupId}`, end: true },
    { label: "Membros", href: `/groups/${groupId}/members`, icon: Users },
    { label: "Mensagens", href: `/groups/${groupId}/messages`, icon: MessageSquare },
    { label: "Enquetes", href: `/groups/${groupId}/polls`, icon: ListChecks },
    { label: "Atividade", href: `/groups/${groupId}/events`, icon: Activity },
  ];

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
            <span className="capitalize">{provider}</span>
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
      
      {/* Tab navigation */}
      <div className="flex gap-1 p-2 bg-secondary/30 overflow-x-auto">
        {tabs.map((tab) => (
          <NavLink
            key={tab.href}
            to={tab.href}
            end={tab.end}
            className={({ isActive }) => cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap",
              isActive 
                ? "bg-card text-foreground shadow-sm" 
                : "text-muted-foreground hover:text-foreground hover:bg-card/50"
            )}
          >
            {tab.icon && <tab.icon className="h-4 w-4" />}
            {tab.label}
          </NavLink>
        ))}
      </div>
    </div>
  );
}
