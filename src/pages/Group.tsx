import { AdminLayout } from "@/components/layout/AdminLayout";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { useParams, NavLink } from "react-router-dom";
import { Users, MessageSquare, Settings, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const Group = () => {
  const { groupId } = useParams();
  
  const tabs = [
    { label: "Visão Geral", href: `/group/${groupId}`, end: true },
    { label: "Members", href: `/group/${groupId}/members`, icon: Users },
    { label: "Messages", href: `/group/${groupId}/messages`, icon: MessageSquare },
  ];

  return (
    <AdminLayout 
      title="Grupo" 
      subtitle={`Detalhes do grupo: ${groupId}`}
    >
      <div className="space-y-6 animate-fade-in">
        {/* Page header with tabs */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex items-center gap-3 p-4 border-b border-border">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-card-foreground">Grupo: {groupId}</h2>
              <p className="text-sm text-muted-foreground">Gerencie membros e mensagens deste grupo</p>
            </div>
            <div className="px-3 py-1 rounded-full bg-success/10 text-success text-xs font-medium">
              Ativo
            </div>
          </div>
          
          {/* Tab navigation */}
          <div className="flex gap-1 p-2 bg-secondary/30">
            {tabs.map((tab) => (
              <NavLink
                key={tab.href}
                to={tab.href}
                end={tab.end}
                className={({ isActive }) => cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
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
        
        {/* Skeleton placeholder */}
        <PageSkeleton variant="cards" />
      </div>
    </AdminLayout>
  );
};

export default Group;
