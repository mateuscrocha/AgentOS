import { CalendarDays, Clock, ArrowUpRight, ArrowRight } from "lucide-react";
import { filterKeywordItems } from "@/utils/keywords";
import { SectionHeader } from "./SectionHeader";
import { useState } from "react";
import { KpiCard } from "./KpiCard";
import { InsightCard } from "./InsightCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

interface RecentActivitySectionProps {
  messagesPerDay: { date: string; count: number }[];
  activityByHour: { hour: number; count: number }[];
  ikigaiSuggestions: { themes: { phrase: string; count: number }[]; keywords: { term: string; count: number }[] } | null;
  busyDayAvatars?: { id: string; avatarUrl: string | null }[];
  peakWindowAvatars?: { id: string; avatarUrl: string | null }[];
  themeAvatars?: { id: string; avatarUrl: string | null }[];
  isLoading?: boolean;
  periodLabel?: string;
}

export function RecentActivitySection({
  messagesPerDay,
  activityByHour,
  ikigaiSuggestions,
  busyDayAvatars = [],
  peakWindowAvatars = [],
  themeAvatars = [],
  isLoading,
  periodLabel = "período",
}: RecentActivitySectionProps) {
  const mostActiveDay = (() => {
    if (!messagesPerDay || messagesPerDay.length === 0) return null;
    const counts: Record<string, number> = {};
    messagesPerDay.forEach((d) => {
      const day = new Date(d.date).toLocaleDateString("pt-BR", { weekday: "long" });
      counts[day] = (counts[day] || 0) + d.count;
    });
    const entries = Object.entries(counts);
    if (entries.length === 0) return null;
    const [day, count] = entries.reduce((max, curr) => (curr[1] > max[1] ? curr : max));
    const dayLabel = day.charAt(0).toUpperCase() + day.slice(1);
    return { day: dayLabel, count };
  })();

  const peakTwoHourWindow = (() => {
    if (!activityByHour || activityByHour.length === 0) return null;
    const countsByHour: number[] = Array(24).fill(0);
    activityByHour.forEach(({ hour, count }) => {
      countsByHour[hour] = count;
    });
    let bestStart = 0;
    let bestSum = 0;
    for (let i = 0; i < 24; i++) {
      const sum = countsByHour[i] + countsByHour[(i + 1) % 24];
      if (sum > bestSum) {
        bestSum = sum;
        bestStart = i;
      }
    }
    const fmt = (h: number) => `${h.toString().padStart(2, "0")}h`;
    const label = `${fmt(bestStart)}–${fmt((bestStart + 2) % 24)}`;
    return { label, count: bestSum };
  })();

  const [mode, setMode] = useState<'themes'|'words'>('themes');

  const trendingThemes = (() => {
    const list = ikigaiSuggestions?.themes || [];
    if (!list || list.length === 0) return [];
    const top = list.slice(0, Math.min(8, Math.max(5, list.length)));
    const maxCount = top[0]?.count || 0;
    return top.map((t, idx) => ({ label: t.phrase, count: t.count, up: idx < 3 && t.count >= Math.max(2, Math.round(maxCount * 0.6)) }));
  })();

  const trendingWords = (() => {
    const list = ikigaiSuggestions?.keywords || [];
    if (!list || list.length === 0) return [];
    const filtered = filterKeywordItems(list.map((k) => ({ word: k.term, count: k.count })));
    if (filtered.length === 0) return [];
    const top = filtered.slice(0, Math.min(8, Math.max(5, filtered.length)));
    const maxCount = top[0]?.count || 0;
    return top.map((k, idx) => ({ label: k.word, count: k.count, up: idx < 3 && k.count >= Math.max(3, Math.round(maxCount * 0.6)) }));
  })();

  const trending = mode === 'themes' ? trendingThemes : trendingWords;

  const AvatarStack = ({ items }: { items: { id: string; avatarUrl: string | null }[] }) => (
    <div className="flex items-center">
      {items.slice(0, 8).map((m, i) => (
        <div key={m.id} className={i === 0 ? "" : "-ml-2"}>
          <Avatar className="h-6 w-6 ring-1 ring-border">
            {m.avatarUrl ? (
              <AvatarImage src={m.avatarUrl} alt="" referrerPolicy="no-referrer" />
            ) : (
              <AvatarFallback />
            )}
          </Avatar>
        </div>
      ))}
    </div>
  );

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <SectionHeader
        title="Padrões recentes de atividade"
        subtitle={`Leitura rápida (${periodLabel})`}
        helpText="Resumo dos padrões de comportamento no período: dia mais movimentado, janela horária com maior atividade e palavras-chave em alta."
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="space-y-2">
          <KpiCard
            title="Dia mais movimentado"
            value={isLoading ? "" : mostActiveDay ? mostActiveDay.day : "—"}
            subtitle={isLoading ? undefined : mostActiveDay ? `${mostActiveDay.count} msgs` : "Sem dados"}
            icon={CalendarDays}
            isLoading={isLoading}
          />
          {!isLoading && mostActiveDay && busyDayAvatars.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Membros mais presentes nesse dia</p>
              <AvatarStack items={busyDayAvatars} />
            </div>
          )}
        </div>

        <div className="space-y-2">
          <KpiCard
            title="Horário de maior atividade"
            value={isLoading ? "" : peakTwoHourWindow ? peakTwoHourWindow.label : "—"}
            subtitle={isLoading ? undefined : peakTwoHourWindow ? `${peakTwoHourWindow.count} msgs` : "Sem dados"}
            icon={Clock}
            isLoading={isLoading}
          />
          {/* Removed widget "Membros mais ativos nesse horário" */}
        </div>

        <div className="flex-1">
          {isLoading ? (
            <Skeleton className="h-[120px] w-full" />
          ) : trending.length === 0 ? (
            <InsightCard title="Palavras-chave em alta" severity="info" description="Sem termos destacados neste período." />
          ) : (
            <InsightCard title="Palavras-chave em alta" severity="info">
              <div className="flex justify-end mb-2 gap-1">
                <button
                  onClick={() => setMode('themes')}
                  className={`text-xs px-2 py-1 rounded border ${mode==='themes' ? 'bg-secondary text-card-foreground' : 'text-muted-foreground'}`}
                >Temas</button>
                <button
                  onClick={() => setMode('words')}
                  className={`text-xs px-2 py-1 rounded border ${mode==='words' ? 'bg-secondary text-card-foreground' : 'text-muted-foreground'}`}
                >Palavras</button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {trending.map((k) => (
                  <div key={`${k.label}-${k.count}`} className="flex items-center gap-2 rounded-lg border border-border bg-secondary/30 px-2 py-1.5">
                    <span className="text-sm font-medium text-card-foreground truncate flex-1">{k.label}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">{k.count}</span>
                    {k.up ? (
                      <ArrowUpRight className="h-3.5 w-3.5 text-success" />
                    ) : (
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                  </div>
                ))}
              </div>
              {themeAvatars.length > 0 && (
                <div className="mt-3 space-y-1">
                  <p className="text-xs text-muted-foreground">Membros que puxam esses temas</p>
                  <AvatarStack items={themeAvatars} />
                </div>
              )}
            </InsightCard>
          )}
        </div>
      </div>
    </section>
  );
}
