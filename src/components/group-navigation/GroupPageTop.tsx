import { ReactNode, useMemo, useState } from "react";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/ui/breadcrumbs";
import { GroupHeader } from "@/components/group-dashboard/GroupHeader";
import { cn, formatPhoneE164BR, getInitialsFromName, getPhoneFallback, isProbablyPhone } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ChevronRight, Shield, Star, Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RoleBadge } from "@/components/ui/badge";

type MemberRoleKey = "SUPERADMIN" | "ADMIN";

type SpecialMember = {
  id: string;
  name: string;
  display_name: string | null;
  phone_e164: string | null;
  profile_pic_url: string | null;
  is_super_admin: boolean;
  is_admin: boolean;
  last_sender_name?: string | null;
};

const ROLE_META: Record<MemberRoleKey, { label: string; shortLabel: string; Icon: typeof Shield }> = {
  SUPERADMIN: {
    label: "Super Admin",
    shortLabel: "Super Admin",
    Icon: Star,
  },
  ADMIN: {
    label: "Admin",
    shortLabel: "Admin",
    Icon: Shield,
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
  filters?: ReactNode;
  showClearFilters?: boolean;
  onClearFilters?: () => void;
  rightActions?: ReactNode;
  className?: string;
}

export function GroupPageTop({
  breadcrumbItems,
  group,
  filters,
  showClearFilters: _showClearFilters,
  onClearFilters: _onClearFilters,
  rightActions,
  className,
}: GroupPageTopProps) {
  const [adminsModalOpen, setAdminsModalOpen] = useState(false);

  const { data: specialMembers } = useQuery({
    queryKey: ["group-special-members", group.groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("members")
        .select("id, name, display_name, phone_e164, profile_pic_url, is_super_admin, is_admin")
        .eq("group_id", group.groupId)
        .is("deleted_at", null)
        .or("is_super_admin.eq.true,is_admin.eq.true");
      if (error) throw error;

      const members = (data ?? []) as SpecialMember[];
      const ids = members.map((m) => m.id).filter(Boolean);
      if (ids.length === 0) return members;

      const { data: msgs } = await supabase
        .from("messages")
        .select("member_id, sender_name, created_at")
        .eq("group_id", group.groupId)
        .in("member_id", ids)
        .is("deleted_at", null)
        .not("sender_name", "is", null)
        .order("created_at", { ascending: false })
        .limit(200);

      const latestByMemberId: Record<string, string> = {};
      (msgs ?? []).forEach((m: any) => {
        const memberId = String(m.member_id || "");
        if (!memberId || latestByMemberId[memberId]) return;
        const senderName = String(m.sender_name || "").trim();
        if (!senderName || isProbablyPhone(senderName)) return;
        latestByMemberId[memberId] = senderName;
      });

      return members.map((m) => ({ ...m, last_sender_name: latestByMemberId[m.id] || null }));
    },
    enabled: !!group.groupId,
  });

  const { data: messages24hCount } = useQuery({
    queryKey: ["group-messages-24h-count", group.groupId],
    queryFn: async () => {
      const sinceIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { count, error } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("group_id", group.groupId)
        .is("deleted_at", null)
        .gte("created_at", sinceIso);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!group.groupId,
    staleTime: 60_000,
  });

  const orderedSpecialMembers = useMemo(() => {
    const list = (specialMembers ?? []).map((m) => {
      const roleKey = m.is_super_admin ? ("SUPERADMIN" as const) : ("ADMIN" as const);
      const rawName = (m.name || "").trim();
      const rawDisplayName = (m.display_name || "").trim();
      const whatsapp = formatPhoneE164BR(m.phone_e164) || "-";

      const rawLastSenderName = (m.last_sender_name || "").trim();
      const candidateLastSenderName = rawLastSenderName && !isProbablyPhone(rawLastSenderName) ? rawLastSenderName : "";
      const candidateName = rawName && !isProbablyPhone(rawName) ? rawName : "";
      const candidateDisplayName = rawDisplayName && !isProbablyPhone(rawDisplayName) ? rawDisplayName : "";

      const fullName = candidateName || candidateLastSenderName || candidateDisplayName || whatsapp || "Membro";
      const username = rawDisplayName && rawDisplayName !== fullName && !isProbablyPhone(rawDisplayName) ? rawDisplayName : null;
      const displayLabel = fullName || username || whatsapp || "Membro";
      const avatarFallback = getInitialsFromName(fullName) || getPhoneFallback(m.phone_e164) || "M";

      return {
        ...m,
        roleKey,
        fullName,
        username,
        whatsapp,
        displayLabel,
        avatarFallback,
      };
    });

    const order: Record<MemberRoleKey, number> = { SUPERADMIN: 0, ADMIN: 1 };
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
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
              Administração do grupo
            </div>
            <div className="text-xs text-muted-foreground">Sem funções especiais configuradas</div>
          </div>
        </div>
      );
    }

    return (
      <>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
              Administração do grupo
            </div>
            <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Users className="h-3.5 w-3.5" />
              <span>{total} {total === 1 ? "administrador" : "administradores"}</span>
            </div>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2.5 text-xs text-muted-foreground"
            onClick={() => setAdminsModalOpen(true)}
          >
            Ver administradores
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <Dialog open={adminsModalOpen} onOpenChange={setAdminsModalOpen}>
          <DialogContent className="bg-card border-border max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-card-foreground">Administração do grupo</DialogTitle>
            </DialogHeader>

            <div className="space-y-2">
              <div className="hidden sm:grid grid-cols-[1.2fr_1fr_0.9fr_auto] gap-3 px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <div>Nome completo</div>
                <div>Usuário</div>
                <div>Contato</div>
                <div className="text-right">Papel</div>
              </div>
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
                      <div className="min-w-0 flex-1">
                        <div className="grid grid-cols-1 sm:grid-cols-[1.2fr_1fr_0.9fr] gap-3">
                          <div className="min-w-0">
                            <div className="sm:hidden text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Nome completo</div>
                            <div className="flex items-center gap-2 min-w-0">
                              <RoleIcon className="h-4 w-4 text-muted-foreground flex-none" />
                              <div className="text-sm font-medium text-card-foreground truncate">{m.fullName}</div>
                            </div>
                          </div>

                          <div className="min-w-0">
                            <div className="sm:hidden text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Usuário</div>
                            <div className="text-sm text-muted-foreground truncate">{m.username || "-"}</div>
                          </div>

                          <div className="min-w-0">
                            <div className="sm:hidden text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Contato</div>
                            <div className="text-sm text-muted-foreground truncate">{m.whatsapp}</div>
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground sm:hidden mt-1">{role.label}</div>
                      </div>
                    </div>

                    <RoleBadge role={m.roleKey} className="h-5 px-2 text-[10px]" />
                  </div>
                );
              })}
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }, [adminsModalOpen, orderedSpecialMembers]);

  return (
    <section className={cn("mb-6 space-y-5", className)}>
      <div className="static z-20 -mx-4 border-b border-border/60 bg-background/80 px-4 py-3 backdrop-blur sm:sticky sm:top-16 sm:-mx-6 sm:px-6">
        <Breadcrumbs items={breadcrumbItems} />
      </div>
      <div className="space-y-0">
        <GroupHeader
          name={group.name}
          provider={group.provider}
          totalMembers={group.totalMembers}
          messages24h={typeof messages24hCount === "number" ? messages24hCount : null}
          lastMessageAt={group.lastMessageAt}
          syncStatus={group.syncStatus}
          bottomSlot={headerAdminSection}
        />
      </div>

      {filters && (
        <div className="rounded-[var(--radius-lg)] border border-border/80 bg-card/95 p-3 shadow-subtle">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">{filters}</div>
            <div className="flex items-center gap-2">
              {_showClearFilters && _onClearFilters ? (
                <Button type="button" variant="ghost" size="sm" onClick={_onClearFilters}>
                  Limpar filtros
                </Button>
              ) : null}
              {rightActions}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
