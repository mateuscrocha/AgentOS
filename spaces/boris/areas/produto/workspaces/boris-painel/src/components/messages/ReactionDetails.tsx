import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Reactor {
  member_id: string | null;
  member_name: string | null;
  member_avatar: string | null;
  reacted_at: string;
}

interface ReactionGroup {
  emoji: string;
  count: number;
  reactors: Reactor[];
}

interface ReactionDetailsProps {
  reactions: ReactionGroup[];
}

export function ReactionDetails({ reactions }: ReactionDetailsProps) {
  if (!reactions || reactions.length === 0) return null;

  const totalCount = reactions.reduce((sum, r) => sum + r.count, 0);

  return (
    <div className="border-t border-border pt-4 mt-4">
      <h4 className="text-sm font-medium text-card-foreground mb-3">
        Reações ({totalCount})
      </h4>
      <div className="space-y-3">
        {reactions.map((group) => (
          <div key={group.emoji} className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-lg">{group.emoji}</span>
              <span className="text-sm text-muted-foreground">{group.count}</span>
            </div>
            <div className="pl-6 space-y-1">
              {group.reactors.map((reactor, idx) => (
                <div key={`${reactor.member_id}-${idx}`} className="flex items-center gap-2 text-sm">
                  <Avatar className="h-5 w-5">
                    <AvatarImage src={reactor.member_avatar || undefined} />
                    <AvatarFallback className="text-[10px]">
                      {(reactor.member_name || '?')[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-card-foreground">
                    {reactor.member_name || 'Desconhecido'}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {format(new Date(reactor.reacted_at), "HH:mm", { locale: ptBR })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
