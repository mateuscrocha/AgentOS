import { NavLink } from "react-router-dom";
import { Users, MessageSquare, Activity, ListChecks, Settings, LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";

type ActiveTab = "painel" | "membros" | "mensagens" | "enquetes" | "atividade" | "configuracoes";

interface GroupTabsProps {
  groupId: string;
  activeTab?: ActiveTab;
}

export function GroupTabs({ groupId, activeTab }: GroupTabsProps) {
  const tabs: { key: ActiveTab; label: string; href: string; icon?: any; end?: boolean }[] = [
    { key: "painel", label: "Painel", href: `/groups/${groupId}`, icon: LayoutDashboard, end: true },
    { key: "membros", label: "Membros", href: `/groups/${groupId}/members`, icon: Users },
    { key: "mensagens", label: "Mensagens", href: `/groups/${groupId}/messages`, icon: MessageSquare },
    { key: "enquetes", label: "Enquetes", href: `/groups/${groupId}/polls`, icon: ListChecks },
    { key: "atividade", label: "Atividade", href: `/groups/${groupId}/events`, icon: Activity },
    { key: "configuracoes", label: "Configurações", href: `/groups/${groupId}/edit`, icon: Settings },
  ];

  return (
    <div className="flex gap-1 p-2 bg-secondary/30 overflow-x-auto">
      {tabs.map((tab) => (
        <NavLink
          key={tab.href}
          to={tab.href}
          end={tab.end}
          className={({ isActive }) => cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap",
            (isActive || activeTab === tab.key)
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-card/50"
          )}
        >
          {tab.icon && <tab.icon className="h-4 w-4" />}
          {tab.label}
        </NavLink>
      ))}
    </div>
  );
}
