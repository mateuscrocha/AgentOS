import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { SAO_PAULO_TZ, formatDateSimpleBR, formatDateTimeBR } from "@/lib/date";
import { Phone, ArrowRight, Users } from "lucide-react";
import { cn, formatPhoneE164BR, getInitialsFromName, getMemberAccessLevel, getPhoneFallback } from "@/lib/utils";
import { RoleBadge, StatusBadge, type MemberRoleKey, type MemberStatusKey } from "@/components/ui/badge";

type MemberDetailsDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memberId: string;
  groupId?: string;
  organizationId?: string;
  variant?: "sheet" | "dialog";
};

const getMemberRoleKey = (m: { is_super_admin?: boolean | null; is_admin?: boolean | null }): MemberRoleKey => {
  const level = getMemberAccessLevel(m);
  if (level === "superadmin") return "SUPERADMIN";
  if (level === "admin") return "ADMIN";
  return "MEMBRO";
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

export function MemberDetailsDrawer({ open, onOpenChange, memberId, groupId, organizationId, variant = "sheet" }: MemberDetailsDrawerProps) {
  const [photoViewerOpen, setPhotoViewerOpen] = useState(false);

  const { data: member, isLoading: memberLoading, error: memberError } = useQuery({
    queryKey: ["member-details", memberId],
    queryFn: async () => {
      const { data } = await supabase
        .from("members")
        .select("id, name, display_name, phone_e164, lid, profile_pic_url, is_admin, is_super_admin, joined_at, left_at, last_seen_message_at, status, provider, metadata, group_id")
        .eq("id", memberId)
        .maybeSingle();
      return data as any;
    },
    enabled: open && !!memberId,
  });

  const ctxGroupId = groupId || member?.group_id || undefined;

  useEffect(() => {
    setPhotoViewerOpen(false);
  }, [memberId, open]);

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
  const { data: recentMessages, isLoading: recentMessagesLoading } = useQuery({
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

  const effectiveMemberRole = useMemo(() => getMemberRoleKey(member || {}), [member]);

  const statusKey = useMemo((): MemberStatusKey => {
    if (member?.left_at) return "SAIU";
    const raw = (member as any)?.status;
    if (raw && raw !== "active") return "INATIVO";
    return "ATIVO";
  }, [member]);

  const headerTitle = useMemo(() => {
    const rawDisplay = (member?.display_name || "").toString().trim();
    const rawName = (member?.name || "").toString().trim();
    const formattedPhone = formatPhoneE164BR(member?.phone_e164);
    return rawDisplay || rawName || formattedPhone || "Membro";
  }, [member?.display_name, member?.name, member?.phone_e164]);

  const formattedPhone = useMemo(() => {
    if (!member?.phone_e164) return "";
    return formatPhoneE164BR(member.phone_e164) || member.phone_e164;
  }, [member?.phone_e164]);

  const avatarFallback = useMemo(() => {
    return getInitialsFromName(headerTitle) || getPhoneFallback(member?.phone_e164) || "M";
  }, [headerTitle, member?.phone_e164]);

  const header = (
    <div className="flex flex-col sm:flex-row items-start gap-4 cursor-default" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
      <button
        type="button"
        onClick={() => {
          if (member?.profile_pic_url) setPhotoViewerOpen(true);
        }}
        className={cn(
          "shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-full",
          member?.profile_pic_url ? "cursor-zoom-in" : "cursor-default"
        )}
      >
        <Avatar className="h-24 w-24 sm:h-28 sm:w-28 ring-1 ring-border shadow-sm">
          {member?.profile_pic_url ? (
            <AvatarImage src={member.profile_pic_url} alt="" referrerPolicy="no-referrer" className="object-cover" />
          ) : (
            <AvatarFallback className="bg-muted/40 text-xl font-semibold text-muted-foreground">
              {avatarFallback || <Users className="h-9 w-9" />}
            </AvatarFallback>
          )}
        </Avatar>
      </button>

      <div className="flex-1 min-w-0">
        <div className="space-y-1">
          <h3 className="text-2xl font-semibold text-card-foreground truncate">{headerTitle}</h3>
          <div className="flex flex-wrap items-center gap-2">
            <RoleBadge role={effectiveMemberRole} className="h-6 px-2.5 text-[11px]" />
            <StatusBadge status={statusKey} />
          </div>
        </div>

        {formattedPhone ? (
          <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Phone className="h-3 w-3" />
              {formattedPhone}
            </span>
          </div>
        ) : null}

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
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
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
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
      {recentMessagesLoading ? (
        <>
          <Skeleton className="h-[76px] w-full" />
          <Skeleton className="h-[76px] w-full" />
        </>
      ) : (recentMessages || []).length === 0 ? (
        <div className="p-4 rounded-xl border border-border bg-secondary/10 text-sm text-muted-foreground">
          Sem mensagens recentes.
        </div>
      ) : (
        (recentMessages || []).map((m) => (
          <div key={m.id} className="p-3 rounded-xl border border-border bg-card/50 hover:bg-secondary/20 transition-colors">
            <div className="text-[11px] font-medium text-muted-foreground">{formatDateTimeBR(m.created_at)}</div>
            <div className="mt-1 text-sm text-card-foreground line-clamp-2 break-words">{m.preview || `[${m.type}]`}</div>
            {ctxGroupId ? (
              <a
                href={`/groups/${ctxGroupId}/messages`}
                className="inline-flex items-center gap-1 text-xs text-primary mt-1 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
              >
                <ArrowRight className="h-3 w-3" />
                Ver na conversa
              </a>
            ) : null}
          </div>
        ))
      )}
    </div>
  );

  const contentBody = (
    <div className={cn("flex flex-col", variant === "dialog" ? "h-[85vh]" : "h-full")}>
      {member?.profile_pic_url ? (
        <Dialog open={photoViewerOpen} onOpenChange={setPhotoViewerOpen}>
          <DialogContent className="max-w-5xl w-[95vw] p-0 overflow-hidden bg-transparent border-0 shadow-none">
            <div className="p-4 flex items-center justify-center">
              <img
                src={member.profile_pic_url}
                alt=""
                referrerPolicy="no-referrer"
                decoding="async"
                className="max-h-[80vh] max-w-[92vw] w-auto object-contain rounded-xl"
              />
            </div>
          </DialogContent>
        </Dialog>
      ) : null}

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
