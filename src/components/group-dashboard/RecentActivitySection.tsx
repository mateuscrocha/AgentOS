import { CalendarDays, Clock, ArrowUpRight } from "lucide-react";
import { SAO_PAULO_TZ } from "@/lib/date";
import { filterKeywordItems } from "@/utils/keywords";
import { SectionHeader } from "./SectionHeader";
import { useState } from "react";
import { KpiCard } from "./KpiCard";
import { InsightCard } from "./InsightCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { MemberInlineTrigger } from "@/components/members/MemberInlineTrigger";

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
      const day = new Date(d.date).toLocaleDateString("pt-BR", { weekday: "long", timeZone: SAO_PAULO_TZ });
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

  const trendingThemes = (() => {
    const list = ikigaiSuggestions?.themes || [];
    if (!list || list.length === 0) return [];
    const top = list.slice(0, Math.min(6, list.length));
    const maxCount = top[0]?.count || 0;
    const scored = top.map((t) => ({ label: t.phrase, count: t.count, score: t.count / Math.max(1, maxCount) }));
    const positives = scored.filter((t) => t.score >= 0.6);
    const ordered = (positives.length > 0 ? positives : scored).sort((a, b) => b.count - a.count);
    return ordered.slice(0, 3);
  })();
  const trending = trendingThemes;

  const AvatarStack = ({ items }: { items: { id: string; avatarUrl: string | null }[] }) => (
    <div className="flex items-center">
      {items.slice(0, 8).map((m, i) => (
        <div key={m.id} className={i === 0 ? "" : "-ml-2"}>
          <MemberInlineTrigger memberId={m.id} name="" avatarUrl={m.avatarUrl} size="xs" compact={true} />
        </div>
      ))}
    </div>
  );

  return (
    <section id="group-themes" className="rounded-xl border border-border bg-card p-5">
      <SectionHeader
        title="Padrões recentes de atividade"
        subtitle={`Leitura rápida (${periodLabel})`}
        helpText="Resumo de comportamento no período: dia mais movimentado e janela horária com maior atividade."
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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

        
      </div>
    </section>
  );
}
