import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive: "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export type MemberRoleKey = "SUPERADMIN" | "ADMIN" | "MEMBRO";

const MEMBER_ROLE_BADGE: Record<MemberRoleKey, { label: string; className: string }> = {
  SUPERADMIN: {
    label: "Super Admin",
    className: "border-destructive/25 bg-destructive/10 text-destructive",
  },
  ADMIN: {
    label: "Admin",
    className: "border-primary/25 bg-primary/10 text-primary",
  },
  MEMBRO: {
    label: "Membro",
    className: "border-border bg-muted/50 text-muted-foreground",
  },
};

export function RoleBadge({
  role,
  className,
}: {
  role: MemberRoleKey;
  className?: string;
}) {
  const cfg = MEMBER_ROLE_BADGE[role];
  return (
    <span
      className={cn(
        "inline-flex items-center h-6 px-2.5 rounded-full border text-[11px] font-semibold leading-none",
        cfg.className,
        className,
      )}
    >
      {cfg.label}
    </span>
  );
}

export type MemberStatusKey = "ATIVO" | "SAIU" | "INATIVO";

const MEMBER_STATUS_BADGE: Record<MemberStatusKey, { label: string; className: string; dotClassName: string }> = {
  ATIVO: {
    label: "Ativo",
    className: "border-success/20 bg-success/10 text-success",
    dotClassName: "bg-success",
  },
  SAIU: {
    label: "Saiu",
    className: "border-warning/25 bg-warning/10 text-warning",
    dotClassName: "bg-warning",
  },
  INATIVO: {
    label: "Inativo",
    className: "border-border bg-background/60 text-muted-foreground",
    dotClassName: "bg-muted-foreground",
  },
};

export function StatusBadge({
  status,
  showDot = true,
  className,
}: {
  status: MemberStatusKey;
  showDot?: boolean;
  className?: string;
}) {
  const cfg = MEMBER_STATUS_BADGE[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full border text-[11px] font-medium",
        cfg.className,
        className,
      )}
    >
      {showDot ? <span className={cn("h-1.5 w-1.5 rounded-full", cfg.dotClassName)} /> : null}
      {cfg.label}
    </span>
  );
}

export { Badge, badgeVariants };
