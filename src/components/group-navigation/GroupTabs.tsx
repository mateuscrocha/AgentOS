import { useNavigate } from "react-router-dom";
import { Users, MessageSquare, ListChecks, Settings, LayoutDashboard, FileText } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useUserRoles } from "@/hooks/use-user-roles";

type ActiveTab = "painel" | "membros" | "mensagens" | "resumos" | "enquetes" | "configuracoes";

interface GroupTabsProps {
  groupId: string;
  activeTab?: ActiveTab;
  variant?: "standalone" | "embedded";
}

export function GroupTabs({ groupId, activeTab, variant = "standalone" }: GroupTabsProps) {
  const navigate = useNavigate();
  const { isSystemAdmin } = useUserRoles();
  const tabs: { key: ActiveTab; label: string; href: string; icon?: any }[] = [
    { key: "painel", label: "Painel", href: `/groups/${groupId}`, icon: LayoutDashboard },
    { key: "membros", label: "Membros", href: `/groups/${groupId}/members`, icon: Users },
    { key: "mensagens", label: "Mensagens", href: `/groups/${groupId}/messages`, icon: MessageSquare },
    { key: "resumos", label: "Conversas", href: `/groups/${groupId}/summaries`, icon: FileText },
    { key: "enquetes", label: "Enquetes", href: `/groups/${groupId}/polls`, icon: ListChecks },
  ];
  if (isSystemAdmin) tabs.push({ key: "configuracoes", label: "Configurações", href: `/groups/${groupId}/edit`, icon: Settings });

  const content = (
    <Tabs value={activeTab} onValueChange={(val) => {
      const t = tabs.find((x) => x.key === (val as ActiveTab));
      if (t) navigate(t.href);
    }}>
      <TabsList className={variant === "embedded" ? "border-0" : undefined}>
        {tabs.map((tab) => (
          <TabsTrigger
            key={tab.key}
            value={tab.key}
          >
            {tab.icon && <tab.icon className="h-4 w-4" />}
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );

  if (variant === "embedded") {
    return content;
  }

  return (
    <div className="border-x border-b border-border bg-card rounded-b-xl -mt-px">
      {content}
    </div>
  );
}
