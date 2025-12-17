import { cn } from "@/lib/utils";

interface ReactionSummary {
  emoji: string;
  count: number;
}

interface ReactionBadgesProps {
  reactions: ReactionSummary[];
  className?: string;
}

export function ReactionBadges({ reactions, className }: ReactionBadgesProps) {
  if (!reactions || reactions.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap gap-1 mt-1", className)}>
      {reactions.map((reaction) => (
        <span
          key={reaction.emoji}
          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-secondary/80 text-xs"
        >
          <span>{reaction.emoji}</span>
          <span className="text-muted-foreground">{reaction.count}</span>
        </span>
      ))}
    </div>
  );
}
