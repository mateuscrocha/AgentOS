import { SectionHeader } from "./SectionHeader";
import { formatDateTimeBR } from "@/lib/date";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

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
  groupId?: string;
}

export function GroupGrowthSection({
  entriesPerDay: _entriesPerDay,
  exitsPerDay: _exitsPerDay,
  memberEvents,
  currentMembers,
  membersAtPeriodStart,
  isLoading,
  periodLabel = "período",
  groupId,
}: GroupGrowthSectionProps) {
  const entryIds = new Set<string>();
  const exitIds = new Set<string>();

  (memberEvents ?? []).forEach((e) => {
    const key = (e.memberId || e.externalMemberId || e.id || "").toString();
    if (!key) return;
    if (e.kind === "entrada") entryIds.add(key);
    if (e.kind === "saida") exitIds.add(key);
  });

  const entriesTotal = entryIds.size;
  const exitsTotal = exitIds.size;
  const netGrowth = entriesTotal - exitsTotal;

  const netGrowthClassName =
    netGrowth > 0 ? "text-success" : "text-muted-foreground";
  const netGrowthLabel =
    netGrowth > 0 ? `+${netGrowth}` : netGrowth < 0 ? `−${Math.abs(netGrowth)}` : "0";

  const sortedEvents = (memberEvents ?? []).slice().sort((a, b) => (b.occurredAt || "").localeCompare(a.occurredAt || ""));

  const visibleEvents = sortedEvents.slice(0, 5);
  const hasMoreEvents = sortedEvents.length > 5;
  const eventsHref = groupId ? `/groups/${groupId}/events` : undefined;

  const displayedCurrentMembers = Math.max(0, currentMembers);

  return (
    <section className="rounded-2xl border border-border/80 bg-card/90 p-5 shadow-sm">
      <SectionHeader
        title="Evolução do grupo"
        subtitle={`Mudanças de entrada/saída (${periodLabel})`}
        density="compact"
      />

      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 auto-rows-fr">
          <div className="rounded-xl border border-border/70 bg-card/85 p-4 min-h-[96px] flex flex-col justify-between">
            {isLoading ? (
              <Skeleton className="h-10 w-28" />
            ) : (
              <p className="text-2xl font-semibold text-card-foreground tabular-nums">
                {displayedCurrentMembers.toLocaleString("pt-BR")} <span className="text-base font-medium text-muted-foreground">membros</span>
              </p>
            )}
            <div>
              <p className="text-xs font-medium text-muted-foreground">Membros atuais</p>
            </div>
          </div>

          <div className="rounded-xl border border-border/70 bg-card/85 p-4 min-h-[96px] flex flex-col justify-between">
            {isLoading ? (
              <Skeleton className="h-9 w-20" />
            ) : (
              <p className={`text-2xl font-semibold tabular-nums ${netGrowthClassName}`}>
                {netGrowthLabel}
              </p>
            )}
            <div>
              <p className="text-xs font-medium text-muted-foreground">Saldo do período</p>
            </div>
          </div>

          <div className="rounded-xl border border-border/70 bg-card/85 p-4 min-h-[96px] flex flex-col justify-between">
            {isLoading ? (
              <Skeleton className="h-9 w-20" />
            ) : (
              <p className="text-2xl font-semibold tabular-nums text-success">+{entriesTotal.toLocaleString("pt-BR")}</p>
            )}
            <div>
              <p className="text-xs font-medium text-muted-foreground">Entradas</p>
            </div>
          </div>

          <div className="rounded-xl border border-border/70 bg-card/85 p-4 min-h-[96px] flex flex-col justify-between">
            {isLoading ? (
              <Skeleton className="h-9 w-20" />
            ) : (
              <p className="text-2xl font-semibold tabular-nums text-muted-foreground">−{exitsTotal.toLocaleString("pt-BR")}</p>
            )}
            <div>
              <p className="text-xs font-medium text-muted-foreground">Saídas</p>
            </div>
          </div>
        </div>

        <div className="border-t border-border pt-4">
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-card-foreground">Histórico de eventos</p>
              <p className="text-xs text-muted-foreground">últimas mudanças</p>
            </div>
            {hasMoreEvents && eventsHref ? (
              <Link
                to={eventsHref}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Ver histórico completo
              </Link>
            ) : null}
          </div>

          {isLoading ? (
            <div className="mt-3 space-y-2">
              <Skeleton className="h-4 w-11/12" />
              <Skeleton className="h-4 w-10/12" />
              <Skeleton className="h-4 w-9/12" />
              <Skeleton className="h-4 w-8/12" />
            </div>
          ) : visibleEvents.length === 0 ? (
            <div className="mt-3">
              <p className="text-sm text-muted-foreground">Sem eventos recentes de entradas/saídas.</p>
            </div>
          ) : (
            <ul className="mt-3 divide-y divide-border">
              {visibleEvents.map((ev) => {
                const isEntry = ev.kind === "entrada";
                const Icon = isEntry ? ArrowUpRight : ArrowDownRight;
                const iconClass = isEntry ? "text-success" : "text-muted-foreground";
                const text = isEntry ? "Um membro entrou" : "Um membro saiu";
                return (
                  <li key={ev.id} className="py-2">
                    <div className="flex items-start gap-3">
                      <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${iconClass}`} aria-hidden="true" />
                      <div className="min-w-0">
                        <p className="text-sm text-card-foreground">
                          {text}
                          {ev.memberName ? <span className="text-muted-foreground"> — {ev.memberName}</span> : null}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">{formatDateTimeBR(ev.occurredAt)}</p>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
