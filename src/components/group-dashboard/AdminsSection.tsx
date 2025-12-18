import { Shield, Users, AlertCircle } from "lucide-react";
import { SectionHeader } from "./SectionHeader";
import { InsightCard } from "./InsightCard";
import { KpiCard } from "./KpiCard";
import { Skeleton } from "@/components/ui/skeleton";

interface AdminStats {
  total: number;
  active: number;
  inactive: number;
  messagesFromAdmins: number;
  totalMessages: number;
  topAdmin: { name: string; messages: number } | null;
}

interface AdminsSectionProps {
  adminStats?: AdminStats;
  isLoading?: boolean;
  periodLabel?: string;
}

export function AdminsSection({ adminStats, isLoading, periodLabel = "período" }: AdminsSectionProps) {
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

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <SectionHeader 
        title="Admins do Grupo" 
        subtitle={`Comportamento de liderança (${periodLabel})`}
      />
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Admin KPIs */}
        <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="rounded-lg border border-border bg-secondary/30 p-4 text-center">
            <Shield className="h-5 w-5 text-primary mx-auto mb-2" />
            <p className="text-2xl font-bold text-card-foreground">{adminStats.total}</p>
            <p className="text-xs text-muted-foreground">Total admins</p>
          </div>
          
          <div className="rounded-lg border border-border bg-secondary/30 p-4 text-center">
            <Users className="h-5 w-5 text-success mx-auto mb-2" />
            <p className="text-2xl font-bold text-card-foreground">{adminStats.active}</p>
            <p className="text-xs text-muted-foreground">Ativos</p>
          </div>
          
          <div className="rounded-lg border border-border bg-secondary/30 p-4 text-center">
            <Users className="h-5 w-5 text-muted-foreground mx-auto mb-2" />
            <p className="text-2xl font-bold text-card-foreground">{adminStats.inactive}</p>
            <p className="text-xs text-muted-foreground">Inativos</p>
          </div>
          
          <div className="rounded-lg border border-border bg-secondary/30 p-4 text-center">
            <p className="text-2xl font-bold text-card-foreground">{adminParticipationRate}%</p>
            <p className="text-xs text-muted-foreground mt-1">das mensagens</p>
          </div>
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
                  <strong className="text-card-foreground">{adminStats.topAdmin.name}</strong> é o admin mais ativo com {adminStats.topAdmin.messages} mensagens.
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
              description="Os admins do grupo não enviaram mensagens nos últimos 7 dias."
              severity="warning"
            />
          )}
        </div>
      </div>
    </section>
  );
}
