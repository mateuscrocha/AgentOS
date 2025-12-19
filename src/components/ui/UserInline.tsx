import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface UserInlineProps {
  name: string;
  avatarUrl?: string | null;
  size?: "xs" | "sm" | "md";
  className?: string;
}

export function UserInline({ name, avatarUrl, size = "sm", className }: UserInlineProps) {
  const sizeClass = size === "xs" ? "h-5 w-5" : size === "md" ? "h-8 w-8" : "h-6 w-6";

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Avatar className={sizeClass}>
        {avatarUrl ? (
          <AvatarImage src={avatarUrl} alt="" referrerPolicy="no-referrer" />
        ) : (
          <AvatarFallback>{name?.[0]?.toUpperCase() || ""}</AvatarFallback>
        )}
      </Avatar>
      <span className="text-sm text-card-foreground">{name}</span>
    </div>
  );
}

