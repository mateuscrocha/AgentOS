import { SectionHeader } from "./SectionHeader";
import { formatDateTimeBR } from "@/lib/date";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";

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
    netGrowth > 0 ? "text-success" : netGrowth < 0 ? "text-warning" : "text-muted-foreground";

  const sortedEvents = (memberEvents ?? []).slice().sort((a, b) => (b.occurredAt || "").localeCompare(a.occurredAt || ""));

  const visibleEvents = sortedEvents.slice(0, 10);
  const hasMoreEvents = sortedEvents.length > 10;
  const eventsHref = groupId ? `/groups/${groupId}/events` : undefined;

  const displayedCurrentMembers =
    membersAtPeriodStart !== undefined ? Math.max(0, membersAtPeriodStart + netGrowth) : currentMembers;

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <SectionHeader
        title="Crescimento do grupo"
        subtitle={`Entradas, saídas e mudanças recentes (${periodLabel})`}
        className="mb-3"
      />

      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 auto-rows-fr">
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
                className={`text-2xl font-semibold tabular-nums ${netGrowthClassName}`}
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
              <p className="text-2xl font-semibold text-card-foreground tabular-nums">{displayedCurrentMembers.toLocaleString("pt-BR")}</p>
            )}
            <div>
              <p className="text-xs font-medium text-muted-foreground">Membros atuais</p>
              <p className="mt-0.5 text-xs text-muted-foreground">tamanho do grupo agora</p>
            </div>
          </div>
        </div>

        <div className="border-t border-border pt-4">
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-card-foreground">Histórico de eventos</p>
              <p className="text-xs text-muted-foreground">últimas mudanças no grupo</p>
            </div>
            {hasMoreEvents && eventsHref ? (
              <Link
                to={eventsHref}
                className="text-xs text-primary hover:underline transition-colors"
              >
                Ver todos
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
                const dotClass = isEntry ? "bg-emerald-500/70" : "bg-rose-500/70";
                const action = isEntry ? "Entrou" : "Saiu";
                return (
                  <li key={ev.id} className="py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`h-2 w-2 rounded-full shrink-0 ${dotClass}`} aria-hidden="true" />
                      <div className="min-w-0 text-sm">
                        <div className="truncate">
                          <span className="font-medium text-card-foreground">{ev.memberName}</span>
                          <span className="text-muted-foreground"> — {action} — {formatDateTimeBR(ev.occurredAt)}</span>
                        </div>
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
