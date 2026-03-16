import { Wifi, WifiOff, AlertCircle, Users, Clock3, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface GroupHeaderProps {
  name: string;
  provider: string;
  totalMembers: number;
  messages24h?: number | null;
  lastMessageAt: string | null;
  syncStatus: string | null;
  bottomSlot?: ReactNode;
}

export function GroupHeader({ 
  name, 
  provider: _provider, 
  totalMembers, 
  messages24h,
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

  const formatRelativeLastActivity = (dateStr: string | null) => {
    if (!dateStr) return "Sem atividade";
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const diffMin = Math.max(0, Math.floor(diffMs / (1000 * 60)));
    if (diffMin < 1) return "Agora";
    if (diffMin < 60) return `${diffMin} min atrás`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours} h atrás`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} d atrás`;
  };

  const metaItems = [
    {
      key: "members",
      label: "Membros",
      value: totalMembers.toLocaleString("pt-BR"),
      Icon: Users,
    },
    {
      key: "activity",
      label: "Última atividade",
      value: formatRelativeLastActivity(lastMessageAt),
      hint: lastMessageAt ? formatDateTime(lastMessageAt) : undefined,
      Icon: Clock3,
    },
    {
      key: "messages24h",
      label: "Mensagens (24h)",
      value: messages24h == null ? "—" : messages24h.toLocaleString("pt-BR"),
      Icon: MessageSquare,
    },
  ];

  return (
    <div className="overflow-hidden rounded-[var(--radius-xl)] border border-border/70 bg-card/95 shadow-subtle">
      <div className="flex flex-col gap-5 border-b border-border/60 p-5 sm:p-6">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-start gap-3 min-w-0">
            <h2 className="min-w-0 max-w-full truncate text-2xl font-semibold tracking-[-0.03em] text-card-foreground sm:text-[2rem]">{name}</h2>
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  className={cn(
                    "inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-semibold uppercase tracking-[0.06em] leading-none shrink-0",
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

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {metaItems.map(({ key, label, value, hint, Icon }) => (
            <div key={key} className="rounded-[var(--radius-lg)] border border-border/50 bg-background/70 px-3 py-3 shadow-subtle">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                <Icon className="h-3.5 w-3.5" />
                <span>{label}</span>
              </div>
              <div className="mt-2 truncate text-sm font-semibold text-card-foreground" title={hint || value}>
                {value}
              </div>
              {hint && hint !== value ? (
                <div className="truncate text-[11px] text-muted-foreground" title={hint}>
                  {hint}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
      {bottomSlot && (
        <div className="bg-muted/20 px-5 py-4 sm:px-6">
          {bottomSlot}
        </div>
      )}
      
      
    </div>
  );
}
