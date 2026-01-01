import { Shield, Users, AlertCircle } from "lucide-react";
import { SectionHeader } from "./SectionHeader";
import { InsightCard } from "./InsightCard";
import { Skeleton } from "@/components/ui/skeleton";
import { KpiCard } from "./KpiCard";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

interface AdminStats {
  total: number;
  active: number;
  inactive: number;
  messagesFromAdmins: number;
  totalMessages: number;
  topAdmin: { id: string; name: string; messages: number; avatarUrl: string | null } | null;
}

interface PreviousAdminStats {
  active: number;
  messagesFromAdmins: number;
  totalMessages: number;
}

interface AdminsSectionProps {
  adminStats?: AdminStats;
  previousAdminStats?: PreviousAdminStats | null;
  isLoading?: boolean;
  periodLabel?: string;
}

export function AdminsSection({ adminStats, previousAdminStats, isLoading, periodLabel = "período" }: AdminsSectionProps) {
  if (isLoading) {
    return (
      <section className="rounded-xl border border-border bg-card p-5">
      <SectionHeader 
        title="Admins do Grupo" 
        subtitle={`Comportamento de liderança (${periodLabel})`}
      />
        <Skeleton className="h-[120px] w-full" />
      </section>
    );
  }

  if (!adminStats || adminStats.total === 0) {
    return (
      <section className="rounded-xl border border-border bg-card p-5">
      <SectionHeader 
        title="Admins do Grupo" 
        subtitle={`Comportamento de liderança (${periodLabel})`}
      />
        <InsightCard
          title="Nenhum admin identificado"
          description="Não foi possível identificar administradores neste grupo. Isso pode ocorrer se os dados de admin não estiverem disponíveis."
          severity="info"
          icon={AlertCircle}
        />
      </section>
    );
  }

  const adminParticipationRate = adminStats.totalMessages > 0 
    ? Math.round((adminStats.messagesFromAdmins / adminStats.totalMessages) * 100)
    : 0;

  const previousAdminParticipationRate = previousAdminStats && previousAdminStats.totalMessages > 0
    ? Math.round((previousAdminStats.messagesFromAdmins / previousAdminStats.totalMessages) * 100)
    : undefined;

  // Calculate trends
  const activeTrend = previousAdminStats 
    ? adminStats.active - previousAdminStats.active
    : undefined;

  const participationTrend = previousAdminParticipationRate !== undefined
    ? adminParticipationRate - previousAdminParticipationRate
    : undefined;

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <SectionHeader 
        title="Admins do Grupo" 
        subtitle={`Comportamento de liderança (${periodLabel})`}
      />
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Admin KPIs */}
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            title="Total de admins"
            value={adminStats.total}
            subtitle="estrutura do grupo"
            icon={Shield}
          />

          <KpiCard
            title="Admins ativos"
            value={adminStats.active}
            subtitle="enviaram mensagens no período"
            icon={Users}
            trend={activeTrend !== undefined ? { value: activeTrend, label: "vs anterior", isAbsolute: true } : undefined}
          />

          <KpiCard
            title="Admins inativos"
            value={adminStats.inactive}
            subtitle="sem mensagens no período"
            icon={Users}
            trend={activeTrend !== undefined ? { value: -activeTrend, label: "vs anterior", isAbsolute: true } : undefined}
          />

          <KpiCard
            title="Participação dos admins"
            value={`${adminParticipationRate}%`}
            subtitle="das mensagens"
            trend={participationTrend !== undefined ? { value: participationTrend, label: "pp vs anterior", isAbsolute: true } : undefined}
          />
        </div>

        {/* Leadership insight */}
        <div>
          {adminStats.topAdmin ? (
            <InsightCard
              title="Insight de liderança"
              severity="info"
            >
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  <span className="inline-flex items-center gap-2">
                    {adminStats.topAdmin.avatarUrl ? (
                      <Avatar className="h-7 w-7">
                        <AvatarImage src={adminStats.topAdmin.avatarUrl} alt="" referrerPolicy="no-referrer" />
                        <AvatarFallback>{(adminStats.topAdmin.name || "A")[0]?.toUpperCase?.() || "A"}</AvatarFallback>
                      </Avatar>
                    ) : (
                      <Badge variant="secondary" className="h-7 w-7 justify-center px-0">
                        ADM
                      </Badge>
                    )}
                    <strong className="text-card-foreground">{adminStats.topAdmin.name}</strong>
                  </span>
                  <span> é o admin mais ativo com {adminStats.topAdmin.messages} mensagens.</span>
                </p>
                {adminParticipationRate > 50 ? (
                  <p>Os admins dominam a conversa ({adminParticipationRate}% das mensagens). Considere incentivar mais participação dos membros.</p>
                ) : adminParticipationRate < 10 ? (
                  <p>Os admins têm baixa participação ({adminParticipationRate}%). A comunidade está bem distribuída.</p>
                ) : (
                  <p>Os admins mantêm uma participação equilibrada ({adminParticipationRate}% das mensagens).</p>
                )}
              </div>
            </InsightCard>
          ) : (
            <InsightCard
              title="Admins sem mensagens"
              description="Os admins do grupo não enviaram mensagens neste período."
              severity="warning"
            />
          )}
        </div>
      </div>
    </section>
  );
}
