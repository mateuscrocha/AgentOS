import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { badgeVariants } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { useUserRoles } from "@/hooks/use-user-roles";
import { SAO_PAULO_TZ, formatDateSimpleBR, formatDateTimeBR } from "@/lib/date";
import { Users, Shield, Phone, Mail, MessageSquare, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { notify } from "@/components/ui/sonner";

type MemberDetailsDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memberId: string;
  groupId?: string;
  organizationId?: string;
  variant?: "sheet" | "dialog";
};

type MemberRoleKey = "SUPERADMIN" | "ADMIN" | "MEMBRO";

const getMemberRoleKey = (m: { is_super_admin?: boolean | null; is_admin?: boolean | null }): MemberRoleKey => {
  if (m.is_super_admin) return "SUPERADMIN";
  if (m.is_admin) return "ADMIN";
  return "MEMBRO";
};

const ROLE_BADGE: Record<MemberRoleKey, { label: string; className: string }> = {
  SUPERADMIN: {
    label: "Super Admin",
    className: "border-violet-200/70 bg-violet-100/55 text-violet-950",
  },
  ADMIN: {
    label: "Admin",
    className: "border-sky-200/70 bg-sky-100/55 text-sky-950",
  },
  MEMBRO: {
    label: "Membro",
    className: "border-border bg-muted/50 text-muted-foreground",
  },
};

type MemberStatusKey = "ATIVO" | "SAIU" | "INATIVO";

const STATUS_BADGE: Record<MemberStatusKey, { label: string; className: string }> = {
  ATIVO: {
    label: "Ativo",
    className: "border-emerald-200/70 bg-emerald-100/55 text-emerald-950",
  },
  SAIU: {
    label: "Saiu",
    className: "border-amber-200/70 bg-amber-100/55 text-amber-950",
  },
  INATIVO: {
    label: "Inativo",
    className: "border-rose-200/70 bg-rose-100/55 text-rose-950",
  },
};

const getMemberRoleLabel = (role: MemberRoleKey) => {
  if (role === "SUPERADMIN") return "Super Admin";
  if (role === "ADMIN") return "Admin";
  return "Membro";
};

const getMemberRoleDescription = (role: MemberRoleKey) => {
  if (role === "SUPERADMIN") return "Admin com permissões ampliadas.";
  if (role === "ADMIN") return "Pode gerenciar membros e configurar o grupo.";
  return "Participante comum do grupo.";
};

function formatRelativeBR(dateStr?: string | null) {
  if (!dateStr) return "—";
  const now = new Date();
  const d = new Date(dateStr);
  const diff = Math.max(0, now.getTime() - d.getTime());
  const sec = Math.floor(diff / 1000);
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);
  if (day > 0) return `há ${day} dia${day > 1 ? "s" : ""}`;
  if (hr > 0) return `há ${hr} hora${hr > 1 ? "s" : ""}`;
  if (min > 0) return `há ${min} minuto${min > 1 ? "s" : ""}`;
  return "agora";
}

const STOPWORDS_PT = new Set([
  "de","da","do","das","dos","e","a","o","as","os","um","uma","uns","umas","para","por","na","no","nas","nos","em","com","sem","que","se","é","foi","vai","vou","você","vocês","ele","ela","eles","elas","tem","têm","tinha","tiveram","ser","estar","estar","ter","haver","como","mais","menos","muito","pouco","já","ainda","sobre","entre","até","desde"
]);

function tokenizePt(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((t) => t && !STOPWORDS_PT.has(t) && t.length > 2);
}

export function MemberDetailsDrawer({ open, onOpenChange, memberId, groupId, organizationId, variant = "sheet" }: MemberDetailsDrawerProps) {
  const { isSystemAdmin, isOrgAdmin, isGroupManager } = useUserRoles();
  const queryClient = useQueryClient();
  const [updatingRole, setUpdatingRole] = useState(false);
  const [roleOverride, setRoleOverride] = useState<MemberRoleKey | null>(null);

  const { data: member, isLoading: memberLoading, error: memberError } = useQuery({
    queryKey: ["member-details", memberId],
    queryFn: async () => {
      const { data } = await supabase
        .from("members")
        .select("id, name, display_name, phone_e164, profile_pic_url, is_admin, is_super_admin, joined_at, left_at, last_seen_message_at, status, provider, whatsapp_provider_id, metadata, group_id")
        .eq("id", memberId)
        .maybeSingle();
      return data as any;
    },
    enabled: open && !!memberId,
  });

  const ctxGroupId = groupId || member?.group_id || undefined;

  useEffect(() => {
    setRoleOverride(null);
    setUpdatingRole(false);
  }, [memberId, open]);

  const { data: group } = useQuery({
    queryKey: ["member-group", ctxGroupId],
    queryFn: async () => {
      const { data } = await supabase
        .from("groups")
        .select("id, name, organization_id")
        .eq("id", ctxGroupId as string)
        .maybeSingle();
      return data as any;
    },
    enabled: open && !!ctxGroupId,
  });

  const { data: lastMessage } = useQuery({
    queryKey: ["member-last-msg", ctxGroupId, memberId],
    queryFn: async () => {
      const { data } = await supabase
        .from("messages")
        .select("created_at")
        .eq("group_id", ctxGroupId as string)
        .eq("member_id", memberId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data as any;
    },
    enabled: open && !!ctxGroupId && !!memberId,
  });

  const { data: totalMessages } = useQuery({
    queryKey: ["member-total-msg", ctxGroupId, memberId],
    queryFn: async () => {
      const { count } = await supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .eq("group_id", ctxGroupId as string)
        .eq("member_id", memberId)
        .is("deleted_at", null);
      return count || 0;
    },
    enabled: open && !!ctxGroupId && !!memberId,
  });

  const last7StartISO = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString();
  }, []);

  const { data: recentCounts } = useQuery({
    queryKey: ["member-recent-counts", ctxGroupId, memberId],
    queryFn: async () => {
      const { data } = await supabase
        .from("messages")
        .select("created_at")
        .eq("group_id", ctxGroupId as string)
        .eq("member_id", memberId)
        .is("deleted_at", null)
        .gte("created_at", last7StartISO);
      const byDay: Record<string, number> = {};
      (data || []).forEach((m: any) => {
        const day = new Intl.DateTimeFormat("en-CA", { timeZone: SAO_PAULO_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(m.created_at));
        byDay[day] = (byDay[day] || 0) + 1;
      });
      const days: { day: string; count: number }[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = new Intl.DateTimeFormat("en-CA", { timeZone: SAO_PAULO_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
        days.push({ day: key, count: byDay[key] || 0 });
      }
      return days;
    },
    enabled: open && !!ctxGroupId && !!memberId,
  });

  const [recentPage, setRecentPage] = useState(1);
  const RECENT_PAGE_SIZE = 5;
  const { data: recentMessages } = useQuery({
    queryKey: ["member-recent-msg", ctxGroupId, memberId, recentPage],
    queryFn: async () => {
      const from = (recentPage - 1) * RECENT_PAGE_SIZE;
      const to = from + RECENT_PAGE_SIZE - 1;
      const { data } = await supabase
        .from("messages")
        .select("id, created_at, content, text, message_type")
        .eq("group_id", ctxGroupId as string)
        .eq("member_id", memberId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .range(from, to);
      return (data || []).map((m: any) => ({ id: m.id, created_at: m.created_at, preview: (m.text || m.content || "").toString(), type: m.message_type }));
    },
    enabled: open && !!ctxGroupId && !!memberId,
  });

  const last30StartISO = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString();
  }, []);

  const { data: keywords } = useQuery({
    queryKey: ["member-keywords", ctxGroupId, memberId],
    queryFn: async () => {
      const { data } = await supabase
        .from("messages")
        .select("content, text, created_at")
        .eq("group_id", ctxGroupId as string)
        .eq("member_id", memberId)
        .is("deleted_at", null)
        .gte("created_at", last30StartISO)
        .limit(500);
      const counts: Map<string, number> = new Map();
      (data || []).forEach((m: any) => {
        const src = (m.text || m.content || "").toString();
        tokenizePt(src).forEach((t) => counts.set(t, (counts.get(t) || 0) + 1));
      });
      return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([term, count]) => ({ term, count }));
    },
    enabled: open && !!ctxGroupId && !!memberId,
  });

  const { data: memberships } = useQuery({
    queryKey: ["member-memberships", memberId],
    queryFn: async () => {
      if (!member) return [] as any[];
      const conditions: string[] = [];
      if (member.phone_e164) conditions.push(`phone_e164.eq.${member.phone_e164}`);
      if ((member as any).whatsapp_provider_id) conditions.push(`whatsapp_provider_id.eq.${(member as any).whatsapp_provider_id}`);
      if (conditions.length === 0) return [];
      const { data } = await supabase
        .from("members")
        .select("id, group_id, status, left_at, joined_at, groups:group_id(name, organization_id)")
        .or(conditions.join(","));
      const unique: Record<string, any> = {};
      (data || []).forEach((m: any) => { unique[m.group_id] = m; });
      const list = Object.values(unique);
      return list.slice(0, 6);
    },
    enabled: open && !!member,
  });

  const memberRole = useMemo(() => {
    if (!ctxGroupId) return null;
    return getMemberRoleKey(member || {});
  }, [ctxGroupId, member]);

  const effectiveMemberRole = (roleOverride || memberRole) as MemberRoleKey | null;

  const roleLabel = useMemo(() => {
    if (!effectiveMemberRole) return "";
    return getMemberRoleLabel(effectiveMemberRole);
  }, [effectiveMemberRole]);

  const roleDescription = useMemo(() => {
    if (!effectiveMemberRole) return "";
    return getMemberRoleDescription(effectiveMemberRole);
  }, [effectiveMemberRole]);

  const canEditMemberRole = !!ctxGroupId && (isSystemAdmin || isOrgAdmin || isGroupManager);

  const roleValue = useMemo(() => {
    if (!effectiveMemberRole) return "member" as const;
    if (effectiveMemberRole === "SUPERADMIN") return "superadmin" as const;
    if (effectiveMemberRole === "ADMIN") return "admin" as const;
    return "member" as const;
  }, [effectiveMemberRole]);

  const updateMemberRole = async (next: "member" | "admin" | "superadmin") => {
    if (!ctxGroupId || !memberId) return;

    const patch =
      next === "member"
        ? { is_admin: false, is_super_admin: false }
        : next === "admin"
        ? { is_admin: true, is_super_admin: false }
        : { is_admin: true, is_super_admin: true };

    setUpdatingRole(true);
    try {
      const { error } = await supabase
        .from("members")
        .update(patch)
        .eq("id", memberId)
        .eq("group_id", ctxGroupId);

      if (error) throw error;

      const nextRoleKey: MemberRoleKey = next === "superadmin" ? "SUPERADMIN" : next === "admin" ? "ADMIN" : "MEMBRO";
      setRoleOverride(nextRoleKey);

      await queryClient.invalidateQueries({ queryKey: ["member-details", memberId] });
      await queryClient.invalidateQueries({ queryKey: ["group-members", ctxGroupId] });
      await queryClient.invalidateQueries({ queryKey: ["group-special-members", ctxGroupId] });

      notify.success("Função atualizada", "A função do membro foi atualizada neste grupo.");
    } catch (e: any) {
      notify.error("Não foi possível atualizar", e?.message || "Falha ao atualizar a função do membro.");
    } finally {
      setUpdatingRole(false);
    }
  };

  const idLabel = useMemo(() => {
    if (member?.phone_e164) return member.phone_e164;
    return "";
  }, [member]);

  const statusKey = useMemo((): MemberStatusKey => {
    if (member?.left_at) return "SAIU";
    const raw = (member as any)?.status;
    if (raw && raw !== "active") return "INATIVO";
    return "ATIVO";
  }, [member]);

  const statusLabel = useMemo(() => STATUS_BADGE[statusKey].label, [statusKey]);

  const header = (
    <div className="flex items-start gap-3 cursor-default" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
      <Avatar className="h-12 w-12">
        {member?.profile_pic_url ? (
          <AvatarImage src={member.profile_pic_url} alt="" referrerPolicy="no-referrer" />
        ) : (
          <AvatarFallback>
            <Users className="h-5 w-5 text-muted-foreground" />
          </AvatarFallback>
        )}
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="text-xl font-semibold text-card-foreground truncate">{member?.display_name || member?.name || "Membro"}</h3>
          {effectiveMemberRole ? (
            <span
              className={cn(
                "inline-flex items-center h-5 px-2 rounded-full border text-[10px] font-semibold leading-none",
                ROLE_BADGE[effectiveMemberRole].className
              )}
            >
              {ROLE_BADGE[effectiveMemberRole].label}
            </span>
          ) : null}
          <span
            className={cn(
              "inline-flex items-center h-5 px-2 rounded-full border text-[10px] font-semibold leading-none",
              STATUS_BADGE[statusKey].className
            )}
          >
            {statusLabel}
          </span>
        </div>
        <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
          {member?.phone_e164 ? (
            <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{member.phone_e164}</span>
          ) : null}
          {!member?.phone_e164 && (member as any)?.email ? (
            <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" />{(member as any).email}</span>
          ) : null}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            Última atividade: <span className="text-card-foreground">{formatRelativeBR(lastMessage?.created_at)}</span>
          </span>
          {member?.joined_at ? (
            <span className="inline-flex items-center gap-1">
              Entrou: <span className="text-card-foreground">{formatDateSimpleBR(member.joined_at)}</span>
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );

  const overviewCards = ctxGroupId ? (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div className="p-4 rounded-xl border border-border bg-secondary/20">
        <div className="text-[11px] font-medium text-muted-foreground">Entrou no grupo em</div>
        <div className="mt-1 text-base font-semibold text-card-foreground">{member?.joined_at ? formatDateSimpleBR(member.joined_at) : "—"}</div>
      </div>
      <div className="p-4 rounded-xl border border-border bg-secondary/20">
        <div className="text-[11px] font-medium text-muted-foreground">Última atividade</div>
        <div className="mt-1 text-base font-semibold text-card-foreground">{formatRelativeBR(lastMessage?.created_at)}</div>
      </div>
      <div className="p-4 rounded-xl border border-border bg-secondary/20">
        <div className="text-[11px] font-medium text-muted-foreground">Total de mensagens no grupo</div>
        <div className="mt-1 text-base font-semibold text-card-foreground tabular-nums">{totalMessages ?? 0}</div>
      </div>
      <div className="p-4 rounded-xl border border-border bg-secondary/20">
        <div className="text-[11px] font-medium text-muted-foreground">Função no grupo</div>
        <div className="mt-1">
          {canEditMemberRole && effectiveMemberRole ? (
            <Select
              value={roleValue}
              onValueChange={(v) => {
                if (v === "member" || v === "admin" || v === "superadmin") {
                  void updateMemberRole(v);
                }
              }}
              disabled={updatingRole}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="member">Membro</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="superadmin">Super Admin</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <div className="text-base font-semibold text-card-foreground">{roleLabel || "—"}</div>
          )}
          {roleLabel ? (
            <div className="mt-1 text-xs text-muted-foreground">{roleDescription}</div>
          ) : null}
        </div>
      </div>
    </div>
  ) : null;

  const recentChart = (
    <div className="rounded-xl border border-border bg-secondary/20 p-4">
      <div className="text-[11px] font-medium text-muted-foreground mb-2">Mensagens nos últimos 7 dias</div>
      {!recentCounts ? (
        <Skeleton className="h-[120px] w-full" />
      ) : (
        <ChartContainer config={{ count: { label: "Mensagens" } }} className="h-[120px] w-full">
          <BarChart data={(recentCounts || []).map((d) => ({ name: d.day.slice(5), count: d.count }))}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} className="text-muted-foreground" axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10 }} className="text-muted-foreground" axisLine={false} tickLine={false} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="count" fill="hsl(var(--primary))" />
          </BarChart>
        </ChartContainer>
      )}
    </div>
  );

  const recentList = (
    <div className="space-y-2">
      {(recentMessages || []).map((m) => (
        <div key={m.id} className="p-3 rounded-xl border border-border bg-card/50 hover:bg-secondary/20 transition-colors">
          <div className="text-[11px] font-medium text-muted-foreground">{formatDateTimeBR(m.created_at)}</div>
          <div className="mt-1 text-sm text-card-foreground line-clamp-2 break-words">{m.preview || `[${m.type}]`}</div>
          {ctxGroupId ? (
            <a href={`/groups/${ctxGroupId}/messages`} className="inline-flex items-center gap-1 text-xs text-primary mt-1 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm">
              <ArrowRight className="h-3 w-3" />
              Ver na conversa
            </a>
          ) : null}
        </div>
      ))}
    </div>
  );

  const membershipsList = (
    <div className="space-y-2">
      {(memberships || []).map((m: any) => (
        <div key={m.group_id} className="flex items-center justify-between p-3 rounded-xl border border-border bg-secondary/10">
          <div className="min-w-0">
            <div className="text-sm text-card-foreground truncate">{(m as any).groups?.name || "Grupo"}</div>
            <div className="mt-1 flex items-center gap-2">
              <span
                className={cn(
                  badgeVariants({ variant: m.left_at ? "secondary" : (m.status === "active" ? "default" : "destructive") }),
                  "text-[10px] px-2 py-0.5",
                  m.status === "active" && !m.left_at ? "bg-emerald-600 text-white hover:bg-emerald-600/90" : ""
                )}
              >
                {m.left_at ? "Saiu" : (m.status === "active" ? "Ativo" : (m.status || "Inativo"))}
              </span>
            </div>
          </div>
          <a href={`/groups/${m.group_id}`} className="text-xs text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm">Abrir</a>
        </div>
      ))}
      {(memberships || []).length > 5 ? (
        <div className="flex justify-end">
          <a href={`/groups/${group?.id || ctxGroupId || ""}/members`} className="text-xs text-muted-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm">Ver todos</a>
        </div>
      ) : null}
    </div>
  );

  const keywordsList = (
    <div className="space-y-2">
      {(keywords || []).length ? (
        <div className="flex flex-wrap gap-2">
          {(keywords || []).map((k) => (
            <a
              key={k.term}
              href={ctxGroupId ? `/groups/${ctxGroupId}/messages` : "#"}
              className={cn(
                badgeVariants({ variant: "secondary" }),
                "rounded-lg px-2.5 py-1 text-xs",
                ctxGroupId ? "cursor-pointer" : "pointer-events-none opacity-60"
              )}
            >
              <span className="font-medium">{k.term}</span>
              <span className="ml-1 text-muted-foreground tabular-nums">{k.count}</span>
            </a>
          ))}
        </div>
      ) : (
        <div className="text-sm text-muted-foreground">Sem dados</div>
      )}
    </div>
  );

  const actions = (
    <div className="flex flex-wrap gap-2">
      {ctxGroupId ? (
        <Button variant="secondary" size="sm" onClick={() => { window.location.href = `/groups/${ctxGroupId}/messages`; }}>
          <MessageSquare className="h-4 w-4 mr-1" />
          Ver todas as mensagens deste membro
        </Button>
      ) : null}
      {(isSystemAdmin || isOrgAdmin || isGroupManager) ? (
        <Button variant="outline" size="sm" onClick={() => { window.location.href = `/groups/${ctxGroupId || member?.group_id}/members`; }}>
          Ver participação em outros grupos
        </Button>
      ) : null}
      <Button
        variant="outline"
        size="sm"
        onClick={async () => {
          if (!ctxGroupId || !memberId) return;
          const { data } = await supabase
            .from("messages")
            .select("created_at, message_type, text, content")
            .eq("group_id", ctxGroupId as string)
            .eq("member_id", memberId)
            .is("deleted_at", null)
            .order("created_at", { ascending: false })
            .limit(1000);
          const rows = (data || []).map((m: any) => ({
            created_at: m.created_at,
            type: m.message_type,
            content: ((m.text || m.content || "").toString()).replace(/\r?\n/g, " "),
          }));
          const csvHeader = "created_at,type,content\n";
          const escape = (s: string) => '"' + s.replace(/"/g, '""') + '"';
          const csvBody = rows.map(r => [r.created_at, r.type, escape(r.content)].join(",")).join("\n");
          const blob = new Blob([csvHeader + csvBody], { type: "text/csv;charset=utf-8;" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `mensagens_membro_${memberId}.csv`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }}
      >
        Exportar mensagens (CSV)
      </Button>
    </div>
  );

  const contentBody = (
    <div className={cn("flex flex-col", variant === "dialog" ? "h-[85vh]" : "h-full")}>
      <div className="sticky top-0 z-10 border-b border-border bg-card/95 backdrop-blur px-5 sm:px-6 py-4">
        <div className="space-y-3">
          <div className="text-base font-semibold text-card-foreground pr-10">Detalhes do membro</div>
          {!memberLoading && !memberError ? header : null}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto scroll-smooth px-5 sm:px-6 py-5">
        {memberLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : memberError ? (
          <div className="p-3 rounded-md bg-destructive/10 text-sm text-destructive">Não foi possível carregar os detalhes deste membro. Tente novamente.</div>
        ) : (
          <div className="space-y-6">
            <section className="rounded-xl border border-border bg-card/50 p-4 sm:p-5 space-y-3">
              <h4 className="text-sm font-semibold text-card-foreground">Visão geral</h4>
              {overviewCards}
            </section>

            <section className="rounded-xl border border-border bg-card/50 p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h4 className="text-sm font-semibold text-card-foreground">Atividade recente</h4>
                <div className="text-xs text-muted-foreground">Últimos 7 dias</div>
              </div>
              {recentChart}
              {recentList}
              <div className="flex items-center justify-between pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={recentPage <= 1}
                  onClick={() => setRecentPage(p => Math.max(1, p - 1))}
                >
                  Anterior
                </Button>
                <span className="text-xs text-muted-foreground">
                  Página {recentPage} de {Math.max(1, Math.ceil((totalMessages || 0) / RECENT_PAGE_SIZE))}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={recentPage >= Math.max(1, Math.ceil((totalMessages || 0) / RECENT_PAGE_SIZE))}
                  onClick={() => setRecentPage(p => p + 1)}
                >
                  Próxima
                </Button>
              </div>
            </section>

            <section className="rounded-xl border border-border bg-card/50 p-4 sm:p-5 space-y-3">
              <h4 className="text-sm font-semibold text-card-foreground">Participação em grupos</h4>
              {membershipsList}
            </section>

            <section className="rounded-xl border border-border bg-card/50 p-4 sm:p-5 space-y-3">
              <h4 className="text-sm font-semibold text-card-foreground">Tags e assuntos</h4>
              {keywordsList}
            </section>

            <section className="rounded-xl border border-border bg-card/50 p-4 sm:p-5 space-y-3">
              <h4 className="text-sm font-semibold text-card-foreground">Ações</h4>
              {actions}
            </section>

            {isSystemAdmin ? (
              <section className="rounded-xl border border-border bg-card/50 p-4 sm:p-5 space-y-3">
                <h4 className="text-sm font-semibold text-card-foreground">Avançado</h4>
                <Tabs defaultValue="overview">
                  <TabsList>
                    <TabsTrigger value="overview">Visão geral</TabsTrigger>
                    <TabsTrigger value="advanced">Dados</TabsTrigger>
                  </TabsList>
                  <TabsContent value="advanced" className="mt-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                      <div>
                        <div className="text-muted-foreground">member_id</div>
                        <div className="font-mono text-xs break-all">{member?.id || ""}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">group_id</div>
                        <div className="font-mono text-xs break-all">{ctxGroupId || ""}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">origem</div>
                        <div className="text-card-foreground">{member?.provider || "—"}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">whatsapp_provider_id</div>
                        <div className="font-mono text-xs break-all">{(member as any)?.whatsapp_provider_id || ""}</div>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </section>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );

  if (variant === "dialog") {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="bg-card border-border max-w-3xl w-[90vw] p-0 overflow-hidden">
          {contentBody}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl p-0 overflow-hidden">
        {contentBody}
      </SheetContent>
    </Sheet>
  );
}
