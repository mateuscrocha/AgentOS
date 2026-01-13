import { ReactNode, useMemo, useState } from "react";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/ui/breadcrumbs";
import { GroupHeader } from "@/components/group-dashboard/GroupHeader";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Activity, Crown, FileText, LayoutDashboard, ListChecks, MessageSquare, Settings, Shield, Star, Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useUserRoles } from "@/hooks/use-user-roles";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type ActiveTab = "painel" | "membros" | "mensagens" | "resumos" | "enquetes" | "atividade" | "configuracoes";

type MemberRoleKey = "OWNER" | "SUPERADMIN" | "ADMIN";

type SpecialMember = {
  id: string;
  name: string;
  display_name: string | null;
  phone_e164: string | null;
  profile_pic_url: string | null;
  is_owner: boolean;
  is_super_admin: boolean;
  is_admin: boolean;
};

function formatPhoneE164BR(input?: string | null) {
  const raw = (input || "").trim();
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  const d = digits.startsWith("55") ? digits.slice(2) : digits;
  if (!d) return raw;
  const ddd = d.slice(0, 2);
  const rest = d.slice(2);
  if (rest.length === 8) {
    return `(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
  }
  if (rest.length === 9) {
    return `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
  }
  return raw;
}

function getInitialsFromName(name?: string | null) {
  const n = (name || "").trim();
  if (!n) return "";
  const parts = n.split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] || "";
  const b = parts.length > 1 ? parts[parts.length - 1]?.[0] || "" : "";
  return (a + b).toUpperCase();
}

function getPhoneFallback(phone?: string | null) {
  const digits = (phone || "").replace(/\D/g, "");
  if (!digits) return "";
  const d = digits.startsWith("55") ? digits.slice(2) : digits;
  return d.slice(-2);
}

const ROLE_META: Record<MemberRoleKey, { label: string; shortLabel: string; Icon: typeof Crown; badgeClass: string }> = {
  OWNER: {
    label: "Dono do grupo",
    shortLabel: "Dono do grupo",
    Icon: Crown,
    badgeClass: "border-orange-200/70 bg-orange-100/55 text-orange-950",
  },
  SUPERADMIN: {
    label: "Super Admin",
    shortLabel: "Super Admin",
    Icon: Star,
    badgeClass: "border-violet-200/70 bg-violet-100/55 text-violet-950",
  },
  ADMIN: {
    label: "Admin",
    shortLabel: "Admin",
    Icon: Shield,
    badgeClass: "border-sky-200/70 bg-sky-100/55 text-sky-950",
  },
};

interface GroupTopInfo {
  groupId: string;
  organizationId?: string;
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
  const [adminsModalOpen, setAdminsModalOpen] = useState(false);
  const { canEditGroup, isLoading: rolesLoading } = useUserRoles();

  const { data: specialMembers } = useQuery({
    queryKey: ["group-special-members", group.groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("members")
        .select("id, name, display_name, phone_e164, profile_pic_url, is_owner, is_super_admin, is_admin")
        .eq("group_id", group.groupId)
        .is("deleted_at", null)
        .or("is_owner.eq.true,is_super_admin.eq.true,is_admin.eq.true");
      if (error) throw error;
      return (data ?? []) as SpecialMember[];
    },
    enabled: !!group.groupId,
  });

  const orderedSpecialMembers = useMemo(() => {
    const list = (specialMembers ?? []).map((m) => ({
      ...m,
      roleKey: m.is_owner ? ("OWNER" as const) : m.is_super_admin ? ("SUPERADMIN" as const) : ("ADMIN" as const),
      displayLabel: m.display_name || m.name || formatPhoneE164BR(m.phone_e164) || "Membro",
      avatarFallback: getInitialsFromName(m.display_name || m.name) || getPhoneFallback(m.phone_e164) || "M",
    }));

    const order: Record<MemberRoleKey, number> = { OWNER: 0, SUPERADMIN: 1, ADMIN: 2 };
    return list.sort((a, b) => {
      const d = order[a.roleKey] - order[b.roleKey];
      if (d !== 0) return d;
      return a.displayLabel.localeCompare(b.displayLabel, "pt-BR");
    });
  }, [specialMembers]);

  const headerAdminSection = useMemo(() => {
    const total = orderedSpecialMembers.length;
    if (total === 0) {
      return (
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Administração do grupo</div>
          <div className="text-sm text-muted-foreground">Sem funções especiais configuradas.</div>
        </div>
      );
    }

    return (
      <>
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Administração do grupo</div>
          <Button
            type="button"
            variant="link"
            size="sm"
            className="h-auto px-0 py-0 text-xs text-muted-foreground"
            onClick={() => setAdminsModalOpen(true)}
          >
            Ver administradores ({total})
          </Button>
        </div>

        <Dialog open={adminsModalOpen} onOpenChange={setAdminsModalOpen}>
          <DialogContent className="bg-card border-border max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-card-foreground">Administração do grupo</DialogTitle>
            </DialogHeader>

            <div className="space-y-2">
              {orderedSpecialMembers.map((m) => {
                const role = ROLE_META[m.roleKey];
                const RoleIcon = role.Icon;
                return (
                  <div key={m.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border bg-secondary/30">
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar className="h-9 w-9">
                        {m.profile_pic_url ? (
                          <AvatarImage src={m.profile_pic_url} alt="" referrerPolicy="no-referrer" />
                        ) : (
                          <AvatarFallback>{m.avatarFallback}</AvatarFallback>
                        )}
                      </Avatar>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <RoleIcon className="h-4 w-4 text-muted-foreground" />
                          <div className="text-sm font-medium text-card-foreground truncate">{m.displayLabel}</div>
                        </div>
                        <div className="text-xs text-muted-foreground">{role.label}</div>
                      </div>
                    </div>

                    <span
                      className={cn(
                        "inline-flex items-center h-5 px-2 rounded-full border text-[10px] font-semibold leading-none",
                        role.badgeClass,
                      )}
                    >
                      {role.shortLabel}
                    </span>
                  </div>
                );
              })}
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }, [adminsModalOpen, orderedSpecialMembers]);

  const canShowSettingsTab = !rolesLoading && canEditGroup(group.groupId, group.organizationId);

  const navItems: Array<{
    key: ActiveTab;
    label: string;
    href: string;
    Icon: typeof LayoutDashboard;
  }> = [
    { key: "painel", label: "Painel", href: `/groups/${group.groupId}`, Icon: LayoutDashboard },
    { key: "mensagens", label: "Mensagens", href: `/groups/${group.groupId}/messages`, Icon: MessageSquare },
    { key: "resumos", label: "Diário", href: `/groups/${group.groupId}/summaries`, Icon: FileText },
    { key: "enquetes", label: "Enquetes", href: `/groups/${group.groupId}/polls`, Icon: ListChecks },
    { key: "membros", label: "Membros", href: `/groups/${group.groupId}/members`, Icon: Users },
    { key: "atividade", label: "Atividade", href: `/groups/${group.groupId}/events`, Icon: Activity },
    ...(canShowSettingsTab
      ? [{ key: "configuracoes" as const, label: "Configurações", href: `/groups/${group.groupId}/edit`, Icon: Settings }]
      : []),
  ];

  return (
    <section className={cn("space-y-4 mb-6", className)}>
      <div className="sticky top-16 z-20 -mx-6 px-6 py-3 bg-background/80 backdrop-blur border-b border-border">
        <Breadcrumbs items={breadcrumbItems} />
      </div>
      <div className="space-y-0">
        <GroupHeader
          groupId={group.groupId}
          name={group.name}
          provider={group.provider}
          totalMembers={group.totalMembers}
          lastMessageAt={group.lastMessageAt}
          syncStatus={group.syncStatus}
          bottomSlot={headerAdminSection}
        />
      </div>

      <Tabs value={activeTab}>
        <TabsList className="w-full justify-start gap-1 overflow-x-auto bg-card border border-border p-1 h-auto">
          {navItems.map(({ key, label, href, Icon }) => (
            <TabsTrigger
              key={key}
              value={key}
              asChild
              className={cn(
                "shrink-0 justify-start gap-2",
                key === activeTab ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Link to={href}>
                <Icon className={cn("h-4 w-4", key === activeTab ? "text-primary" : "text-muted-foreground")} />
                {label}
              </Link>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

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
