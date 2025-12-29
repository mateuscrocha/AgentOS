import { ReactNode } from "react";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/ui/breadcrumbs";
import { GroupHeader } from "@/components/group-dashboard/GroupHeader";
import { GroupTabs } from "@/components/group-navigation/GroupTabs";
import { cn } from "@/lib/utils";

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
          bottomSlot={<GroupTabs groupId={group.groupId} activeTab={activeTab} variant="embedded" />}
        />
      </div>
      {filters && (
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="flex flex-wrap items-center gap-3 justify-between">
            <div className="flex flex-wrap items-center gap-3">{filters}</div>
            <div className="flex items-center gap-2">
              {showClearFilters && (
                <button
                  onClick={onClearFilters}
                  className="inline-flex h-8 items-center justify-center rounded-md border bg-transparent px-3 text-sm font-medium transition-colors hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  Limpar filtros
                </button>
              )}
              {rightActions}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
