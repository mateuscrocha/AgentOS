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
    <div className="overflow-hidden rounded-[28px] border border-slate-200/90 bg-white shadow-[0_22px_60px_-42px_rgba(15,23,42,0.35)]">
      <div className="border-b border-slate-200/80 bg-[radial-gradient(circle_at_top_left,rgba(251,146,60,0.16),transparent_38%),linear-gradient(180deg,rgba(255,255,255,1),rgba(248,250,252,0.98))] p-5 sm:p-6">
        <div className="flex flex-col gap-6">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-start gap-3 min-w-0">
              <div className="min-w-0 space-y-2">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Base do grupo
                </div>
                <h2 className="min-w-0 max-w-full truncate text-[1.9rem] font-semibold tracking-[-0.04em] text-slate-950 sm:text-[2.35rem]">
                  {name}
                </h2>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    className={cn(
                      "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[11px] font-semibold uppercase tracking-[0.08em] leading-none shrink-0",
                      groupStatus.color === "success" && "border-emerald-200 bg-emerald-50 text-emerald-700",
                      groupStatus.color === "warning" && "border-amber-200 bg-amber-50 text-amber-700",
                      groupStatus.color === "destructive" && "border-rose-200 bg-rose-50 text-rose-700",
                      groupStatus.color === "muted" && "border-slate-200 bg-slate-100 text-slate-600",
                    )}
                  >
                    <groupStatus.icon className="h-3.5 w-3.5" />
                    {groupStatus.label}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="bottom" align="start">
                  <div className="text-sm">{totalMembers} membros</div>
                  {lastMessageAt ? (
                    <div className="mt-1 text-xs text-muted-foreground">
                      Última atividade: {formatDateTime(lastMessageAt)}
                    </div>
                  ) : null}
                </TooltipContent>
              </Tooltip>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {metaItems.map(({ key, label, value, hint, Icon }) => (
              <div
                key={key}
                className="rounded-[22px] border border-white/80 bg-white/90 px-4 py-4 shadow-[0_18px_35px_-28px_rgba(15,23,42,0.35)] backdrop-blur"
              >
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  <Icon className="h-3.5 w-3.5" />
                  <span>{label}</span>
                </div>
                <div className="mt-2 truncate text-base font-semibold text-slate-950" title={hint || value}>
                  {value}
                </div>
                {hint && hint !== value ? (
                  <div className="truncate text-[11px] text-slate-500" title={hint}>
                    {hint}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </div>
      {bottomSlot ? (
        <div className="border-t border-slate-200/80 bg-slate-50/70 px-5 py-4 sm:px-6">
          {bottomSlot}
        </div>
      ) : null}
    </div>
  );
}
