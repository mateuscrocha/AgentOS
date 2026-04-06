import { useState } from "react";
import { UserInline } from "@/components/ui/UserInline";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { MemberDetailsDrawer } from "./MemberDetailsDrawer";

type MemberInlineTriggerProps = {
  memberId: string;
  groupId?: string;
  name: string;
  avatarUrl?: string | null;
  size?: "xs" | "sm" | "md";
  className?: string;
  variant?: "sheet" | "dialog";
  compact?: boolean;
};

export function MemberInlineTrigger({ memberId, groupId, name, avatarUrl, size = "sm", className, variant = "sheet", compact = false }: MemberInlineTriggerProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="text-left" onClick={() => setOpen(true)}>
        {compact ? (
          <Avatar className={size === "xs" ? "h-5 w-5" : size === "md" ? "h-8 w-8" : "h-6 w-6"}>
            {avatarUrl ? (
              <AvatarImage src={avatarUrl} alt="" referrerPolicy="no-referrer" />
            ) : (
              <AvatarFallback />
            )}
          </Avatar>
        ) : (
          <UserInline name={name} avatarUrl={avatarUrl} size={size} className={className} />
        )}
      </button>
      <MemberDetailsDrawer open={open} onOpenChange={setOpen} memberId={memberId} groupId={groupId} variant={variant} />
    </>
  );
}
