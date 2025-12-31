import { SectionHeader } from "./SectionHeader";
import { formatDateTickBR, formatDateTimeSecondsBR } from "@/lib/date";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { MemberInlineTrigger } from "@/components/members/MemberInlineTrigger";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Minus, TrendingDown, TrendingUp } from "lucide-react";

interface DayCount { date: string; count: number }

type MemberChangeEvent = {
  id: string;
  occurredAt: string;
  eventType: string;
  kind: "entrada" | "saida";
  memberId: string | null;
  memberName: string;
  memberAvatarUrl: string | null;
  externalMemberId: string;
  source: string;
};

interface GroupGrowthSectionProps {
  entriesPerDay: DayCount[];
  exitsPerDay: DayCount[];
  memberEvents?: MemberChangeEvent[];
  currentMembers: number;
  membersAtPeriodStart?: number;
  daysWithActivity: number;
  periodDays: number;
  isLoading?: boolean;
  periodLabel?: string;
}

export function GroupGrowthSection({
  entriesPerDay,
  exitsPerDay,
  memberEvents,
  currentMembers,
  isLoading,
  periodLabel = "período",
}: GroupGrowthSectionProps) {
  const formatDate = (dateStr: string) => {
    return formatDateTickBR(dateStr);
  };

  const byDate: Record<string, { date: string; entradas: number; saídas: number }> = {};
  entriesPerDay.forEach(d => { byDate[d.date] = { date: d.date, entradas: d.count, saídas: 0 }; });
  exitsPerDay.forEach(d => {
    if (!byDate[d.date]) byDate[d.date] = { date: d.date, entradas: 0, saídas: d.count };
    else byDate[d.date].saídas = d.count;
  });
  const chartData = Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));

  const entriesTotal = entriesPerDay.reduce((acc, d) => acc + (d.count || 0), 0);
  const exitsTotal = exitsPerDay.reduce((acc, d) => acc + (d.count || 0), 0);
  const netGrowth = entriesTotal - exitsTotal;

  const metricLabel = (() => {
    const abs = Math.abs(netGrowth);
    const noun = abs === 1 ? "membro" : "membros";
    const liquid = abs === 1 ? "líquido" : "líquidos";
    const sign = netGrowth > 0 ? "+" : "";
    return `${sign}${netGrowth} ${noun} ${liquid}`;
  })();

  const status = (() => {
    if (netGrowth > 0) return { label: "crescimento saudável", tone: "up" as const };
    if (netGrowth <= -5) return { label: "queda", tone: "down_hard" as const };
    if (netGrowth < 0) return { label: "leve queda", tone: "down_soft" as const };
    return { label: "estável", tone: "flat" as const };
  })();

  const StatusIcon =
    status.tone === "up" ? TrendingUp : status.tone === "flat" ? Minus : TrendingDown;

  const statusCardClassName =
    status.tone === "up"
      ? "border-success/20 bg-success/5"
      : status.tone === "down_hard"
        ? "border-destructive/20 bg-destructive/5"
        : status.tone === "down_soft"
          ? "border-warning/20 bg-warning/5"
          : "border-border bg-muted/25";

  const statusPillClassName =
    status.tone === "up"
      ? "border-success/20 bg-success/5 text-success"
      : status.tone === "down_hard"
        ? "border-destructive/20 bg-destructive/5 text-destructive"
        : status.tone === "down_soft"
          ? "border-warning/20 bg-warning/5 text-warning"
          : "border-border bg-muted/30 text-muted-foreground";

  const daysWithChanges = chartData.filter((d) => (d.entradas ?? 0) > 0 || (d.saídas ?? 0) > 0);

  const actionLabel = (eventType: string) => {
    switch (eventType) {
      case "GROUP_PARTICIPANT_ADD":
        return "Entrou";
      case "GROUP_PARTICIPANT_INVITE":
        return "Entrou";
      case "GROUP_PARTICIPANT_LEAVE":
        return "Saiu";
      case "GROUP_PARTICIPANT_REMOVE":
        return "Removido";
      default:
        return "Alteração";
    }
  };

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <SectionHeader
        title="Crescimento do grupo"
        subtitle={`Leitura de entradas, saídas e tamanho do grupo (${periodLabel})`}
        className="mb-3"
      />

      <div className="space-y-8">
        <div className={`rounded-xl border p-5 ${statusCardClassName}`}>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Crescimento no período</p>
              {isLoading ? (
                <Skeleton className="h-10 w-64" />
              ) : (
                <p className="text-3xl sm:text-4xl font-semibold text-card-foreground tabular-nums">{metricLabel}</p>
              )}
              <p className="text-xs text-muted-foreground">Entradas: +{entriesTotal} · Saídas: -{exitsTotal}</p>
            </div>

            <div className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium w-fit ${statusPillClassName}`}>
              <StatusIcon className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
              <span className="capitalize">{status.label}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 auto-rows-fr">
          <div className="rounded-xl border border-border bg-card p-4 min-h-[110px] flex flex-col justify-between">
            {isLoading ? (
              <Skeleton className="h-9 w-20" />
            ) : (
              <p className="text-2xl font-semibold text-card-foreground tabular-nums">{entriesTotal.toLocaleString("pt-BR")}</p>
            )}
            <div>
              <p className="text-xs font-medium text-muted-foreground">Entradas</p>
              <p className="mt-0.5 text-xs text-muted-foreground">participantes que entraram</p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4 min-h-[110px] flex flex-col justify-between">
            {isLoading ? (
              <Skeleton className="h-9 w-20" />
            ) : (
              <p className="text-2xl font-semibold text-card-foreground tabular-nums">{exitsTotal.toLocaleString("pt-BR")}</p>
            )}
            <div>
              <p className="text-xs font-medium text-muted-foreground">Saídas</p>
              <p className="mt-0.5 text-xs text-muted-foreground">participantes que saíram</p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4 min-h-[110px] flex flex-col justify-between">
            {isLoading ? (
              <Skeleton className="h-9 w-20" />
            ) : (
              <p
                className={`text-2xl font-semibold tabular-nums ${
                  netGrowth > 0
                    ? "text-success"
                    : netGrowth <= -5
                      ? "text-destructive"
                      : netGrowth < 0
                        ? "text-warning"
                        : "text-card-foreground"
                }`}
              >
                {netGrowth > 0 ? `+${netGrowth}` : String(netGrowth)}
              </p>
            )}
            <div>
              <p className="text-xs font-medium text-muted-foreground">Crescimento líquido</p>
              <p className="mt-0.5 text-xs text-muted-foreground">entradas menos saídas</p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4 min-h-[110px] flex flex-col justify-between">
            {isLoading ? (
              <Skeleton className="h-9 w-20" />
            ) : (
              <p className="text-2xl font-semibold text-card-foreground tabular-nums">{currentMembers.toLocaleString("pt-BR")}</p>
            )}
            <div>
              <p className="text-xs font-medium text-muted-foreground">Membros atuais</p>
              <p className="mt-0.5 text-xs text-muted-foreground">tamanho do grupo agora</p>
            </div>
          </div>
        </div>

        <div>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-card-foreground">Evolução no período</p>
            <p className="text-xs text-muted-foreground">dias com entradas e saídas</p>
          </div>

          {isLoading ? (
            <Skeleton className="mt-3 h-[220px] w-full" />
          ) : chartData.length === 0 ? (
            <div className="mt-3 h-[220px] flex items-center justify-center rounded-lg border border-border bg-secondary/30">
              <p className="text-sm text-muted-foreground">Sem dados de entradas/saídas</p>
            </div>
          ) : daysWithChanges.length === 0 ? (
            <div className="mt-3 rounded-lg border border-border bg-secondary/30 p-4">
              <p className="text-sm text-muted-foreground">Sem variações no período</p>
            </div>
          ) : (
            <ScrollArea className="mt-3 h-[220px] rounded-lg border border-border bg-card">
              <ol className="relative p-3 space-y-2">
                <div className="absolute left-4 top-3 bottom-3 w-px bg-border" />
                {daysWithChanges.map((d) => (
                  <li key={d.date} className="relative pl-7">
                    <span
                      className={`absolute left-[13px] top-[14px] h-2 w-2 rounded-full ${
                        d.entradas > 0 && d.saídas === 0
                          ? "bg-success"
                          : d.saídas > 0 && d.entradas === 0
                            ? "bg-warning"
                            : "bg-muted-foreground/60"
                      }`}
                      aria-hidden="true"
                    />

                    <div className="rounded-md border border-border bg-muted/15 px-3 py-2">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <p className="text-sm font-medium text-card-foreground tabular-nums">{formatDate(d.date)}</p>
                        <div className="flex flex-wrap items-center gap-2">
                          {d.entradas > 0 ? (
                            <span className="inline-flex items-center rounded-full border border-success/20 bg-success/5 px-2 py-0.5 text-xs text-success tabular-nums">
                              +{d.entradas}
                            </span>
                          ) : null}
                          {d.saídas > 0 ? (
                            <span className="inline-flex items-center rounded-full border border-warning/20 bg-warning/5 px-2 py-0.5 text-xs text-warning tabular-nums">
                              -{d.saídas}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </ScrollArea>
          )}
        </div>

        <div className="border-t border-border pt-6">
          <div className="flex items-baseline justify-between gap-3">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-card-foreground">Histórico de eventos</p>
              <p className="text-xs text-muted-foreground">entradas e saídas, em ordem cronológica</p>
            </div>
            <span className="text-xs text-muted-foreground tabular-nums">{memberEvents?.length || 0} eventos</span>
          </div>

          {isLoading ? (
            <Skeleton className="mt-3 h-[260px] w-full" />
          ) : !memberEvents || memberEvents.length === 0 ? (
            <div className="mt-3 rounded-lg border border-border bg-secondary/30 p-4">
              <p className="text-sm text-muted-foreground">Sem eventos de entradas/saídas ainda.</p>
            </div>
          ) : (
            <ScrollArea className="mt-3 h-[260px] rounded-lg border border-border bg-card">
              <ul className="divide-y divide-border">
                {memberEvents.map((ev) => {
                  const label = actionLabel(ev.eventType);
                  const badgeClass =
                    label === "Removido"
                      ? "border-destructive/20 bg-destructive/5 text-destructive"
                      : ev.kind === "entrada"
                        ? "border-success/20 bg-success/5 text-success"
                        : ev.kind === "saida"
                          ? "border-warning/20 bg-warning/5 text-warning"
                          : "border-border bg-muted/30 text-muted-foreground";

                  return (
                    <li key={ev.id} className="p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="shrink-0">
                            {ev.memberId ? (
                              <MemberInlineTrigger
                                memberId={ev.memberId}
                                name={ev.memberName}
                                avatarUrl={ev.memberAvatarUrl}
                                size="sm"
                              />
                            ) : (
                              <Avatar className="h-6 w-6">
                                {ev.memberAvatarUrl ? (
                                  <AvatarImage src={ev.memberAvatarUrl} alt="" referrerPolicy="no-referrer" />
                                ) : null}
                                <AvatarFallback>{(ev.memberName || "").slice(0, 1).toUpperCase()}</AvatarFallback>
                              </Avatar>
                            )}
                          </div>

                          <div className="min-w-0">
                            <p className="text-sm text-card-foreground truncate">{ev.memberName}</p>
                            <p className="text-xs text-muted-foreground tabular-nums">{formatDateTimeSecondsBR(ev.occurredAt)}</p>
                          </div>
                        </div>

                        <Badge variant="secondary" className={`shrink-0 border ${badgeClass}`}>
                          {label}
                        </Badge>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </ScrollArea>
          )}
        </div>
      </div>
    </section>
  );
}
