import { ReactNode } from "react";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/ui/breadcrumbs";
import { GroupHeader } from "@/components/group-dashboard/GroupHeader";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { LayoutDashboard, MessageSquare, Users } from "lucide-react";

type ActiveTab = "painel" | "membros" | "mensagens" | "enquetes" | "atividade" | "configuracoes";

interface GroupTopInfo {
  groupId: string;
  name: string;
  provider: string;
  totalMembers: number;
  lastMessageAt: string | null;
  syncStatus: string | null;
}

interface GroupPageTopProps {
  breadcrumbItems: BreadcrumbItem[];
  group: GroupTopInfo;
  activeTab: ActiveTab;
  filters?: ReactNode;
  showClearFilters?: boolean;
  onClearFilters?: () => void;
  rightActions?: ReactNode;
  className?: string;
}

export function GroupPageTop({
  breadcrumbItems,
  group,
  activeTab,
  filters,
  showClearFilters,
  onClearFilters,
  rightActions,
  className,
}: GroupPageTopProps) {
  const navItems: Array<{
    key: ActiveTab;
    label: string;
    href: string;
    Icon: typeof LayoutDashboard;
  }> = [
    { key: "painel", label: "Painel", href: `/groups/${group.groupId}`, Icon: LayoutDashboard },
    { key: "mensagens", label: "Mensagens", href: `/groups/${group.groupId}/messages`, Icon: MessageSquare },
    { key: "membros", label: "Membros", href: `/groups/${group.groupId}/members`, Icon: Users },
  ];

  return (
    <section className={cn("space-y-4 mb-6", className)}>
      <Breadcrumbs items={breadcrumbItems} />
      <div className="space-y-0">
        <GroupHeader
          groupId={group.groupId}
          name={group.name}
          provider={group.provider}
          totalMembers={group.totalMembers}
          lastMessageAt={group.lastMessageAt}
          syncStatus={group.syncStatus}
        />
      </div>

      <div className="rounded-lg border border-border bg-card p-2">
        <div className="flex items-center gap-2 overflow-x-auto">
          {navItems.map(({ key, label, href, Icon }) => (
            <Button
              key={key}
              asChild
              size="sm"
              variant={key === activeTab ? "secondary" : "ghost"}
              className={cn(
                "shrink-0 justify-start gap-2",
                key === activeTab
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Link to={href}>
                <Icon className={cn("h-4 w-4", key === activeTab ? "text-primary" : "text-muted-foreground")} />
                {label}
              </Link>
            </Button>
          ))}
        </div>
      </div>

      {filters && (
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="flex flex-wrap items-center gap-3 justify-between">
            <div className="flex flex-wrap items-center gap-3">{filters}</div>
            <div className="flex items-center gap-2">
              {showClearFilters && (
                <Button variant="ghost" size="sm" onClick={onClearFilters}>
                  Limpar filtros
                </Button>
              )}
              {rightActions}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
