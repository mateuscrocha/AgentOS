import { SectionHeader } from "./SectionHeader";
import { formatDateTickBR, formatDateTimeSecondsBR } from "@/lib/date";
import { KpiCard } from "./KpiCard";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, CartesianGrid, XAxis, YAxis } from "recharts";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { MemberInlineTrigger } from "@/components/members/MemberInlineTrigger";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

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
  membersAtPeriodStart,
  daysWithActivity,
  periodDays,
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
  const chartData = Object.values(byDate);

  const chartConfig = {
    entradas: { label: "Entradas", color: "hsl(var(--primary))" },
    saídas: { label: "Saídas", color: "hsl(var(--muted-foreground))" },
  };

  const trendMembers = membersAtPeriodStart !== undefined ? (currentMembers - membersAtPeriodStart) : undefined;
  const activeDaysPercent = periodDays > 0 ? Math.round((daysWithActivity / periodDays) * 100) : 0;

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
        title="Crescimento do Grupo"
        subtitle={`Entradas, saídas e atividade (${periodLabel})`}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          {isLoading ? (
            <Skeleton className="h-[280px] w-full" />
          ) : chartData.length === 0 ? (
            <div className="h-[280px] flex items-center justify-center bg-secondary/30 rounded-lg">
              <p className="text-sm text-muted-foreground">Sem dados de entradas/saídas</p>
            </div>
          ) : (
            <ChartContainer config={chartConfig} className="h-[280px] w-full">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 11 }} className="text-muted-foreground" axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" axisLine={false} tickLine={false} width={40} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="entradas" fill="hsl(var(--primary))" />
                <Bar dataKey="saídas" fill="hsl(var(--muted-foreground))" />
              </BarChart>
            </ChartContainer>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4">
          <KpiCard
            title="Membros atuais"
            value={currentMembers}
            subtitle="comparado ao início do período"
            trend={trendMembers !== undefined ? { value: trendMembers, label: "vs início", isAbsolute: true } : undefined}
            isLoading={isLoading}
          />
          <KpiCard
            title="Dias com atividade"
            value={daysWithActivity}
            subtitle={`${activeDaysPercent}% dos ${periodDays} dias`}
            isLoading={isLoading}
          />
        </div>
      </div>

      <div className="mt-6 border-t border-border pt-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-card-foreground">Histórico de entradas/saídas</p>
          <span className="text-xs text-muted-foreground tabular-nums">{memberEvents?.length || 0} eventos</span>
        </div>

        {isLoading ? (
          <Skeleton className="mt-3 h-[260px] w-full" />
        ) : !memberEvents || memberEvents.length === 0 ? (
          <div className="mt-3 rounded-lg border border-border bg-secondary/30 p-4">
            <p className="text-sm text-muted-foreground">Sem eventos de entradas/saídas ainda.</p>
          </div>
        ) : (
          <ScrollArea className="mt-3 h-[260px] rounded-lg border border-border">
            <ul className="divide-y divide-border">
              {memberEvents.map((ev) => (
                <li key={ev.id} className="flex items-center gap-3 p-3">
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

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm text-card-foreground truncate">{ev.memberName}</p>
                        <p className="text-xs text-muted-foreground tabular-nums">{formatDateTimeSecondsBR(ev.occurredAt)}</p>
                      </div>
                      <Badge variant={ev.kind === "entrada" ? "default" : "secondary"} className="shrink-0">
                        {actionLabel(ev.eventType)}
                      </Badge>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </ScrollArea>
        )}
      </div>
    </section>
  );
}
