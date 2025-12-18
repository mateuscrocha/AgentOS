import { useState } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { useParams, useNavigate } from "react-router-dom";
import { useUserRoles } from "@/hooks/use-user-roles";
import { useAuth } from "@/hooks/use-auth";
import { useGroupDashboard } from "@/hooks/use-group-dashboard";
import AccessDenied from "./AccessDenied";
  import {
    GroupHeader,
    SummarySection,
    ConversationRhythmSection,
    PeopleSection,
    ParticipationQualitySection,
    GroupGrowthSection,
    EffortNoiseSection,
    AlertsSection,
    AdminsSection,
  } from "@/components/group-dashboard";
import { PeriodFilter, PeriodType, DateRange, getDateRange } from "@/components/group-dashboard/PeriodFilter";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { HelpCircle } from "lucide-react";

const Group = () => {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { isLoading: rolesLoading } = useUserRoles();
  
  // Period filter state
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>('7d');
  const [customRange, setCustomRange] = useState<DateRange | undefined>();
  const [helpOpen, setHelpOpen] = useState(false);
  
  const currentRange = getDateRange(selectedPeriod, customRange);

  const {
    group,
    orgName,
    stats,
    previousStats,
    messagesPerDay,
    activeMembersPerDay,
    membersOverview,
    previousMembersOverview,
    memberEntriesPerDay,
    memberExitsPerDay,
    currentMembers,
    membersAtPeriodStart,
    daysWithActivity,
    topParticipants,
    peakHour,
    peakHourMessages,
    previousPeakHour,
    previousPeakHourMessages,
    memberEngagement,
    previousMemberEngagement,
    popularMessages,
    adminStats,
    previousAdminStats,
    atRiskMembers,
    newMembersCount,
    previousNewMembersCount,
    exitedMembersCount,
    previousExitedMembersCount,
    isLoading,
    groupLoading,
    error,
    periodDays,
  } = useGroupDashboard({ groupId, dateRange: currentRange });

  const handlePeriodChange = (period: PeriodType, range: DateRange) => {
    setSelectedPeriod(period);
    if (period === 'custom') {
      setCustomRange(range);
    }
  };

  // Loading state while checking auth/roles
  if (authLoading || rolesLoading) {
    return (
      <AdminLayout title="Grupo" subtitle="Verificando acesso...">
        <LoadingState message="Verificando permissões..." />
      </AdminLayout>
    );
  }

  if (groupLoading) {
    return (
      <AdminLayout title="Grupo" subtitle="Carregando...">
        <LoadingState message="Carregando dashboard do grupo..." />
      </AdminLayout>
    );
  }

  // Check access - RLS will return null if no access
  if (error || !group) {
    const errorCode = (error as any)?.code;
    if (error?.message?.includes('permission') || errorCode === 'PGRST301') {
      return (
        <AccessDenied
          message="Você não tem permissão para acessar este grupo."
        />
      );
    }
    return (
      <AdminLayout title="Grupo" subtitle="Erro">
        <ErrorState 
          title="Grupo não encontrado"
          message="Não foi possível carregar os detalhes deste grupo. Você pode não ter acesso."
          retry={() => navigate('/system')}
        />
      </AdminLayout>
    );
  }

  // Format period label for display
  const getPeriodLabel = () => {
    switch (selectedPeriod) {
      case 'today': return 'hoje';
      case 'yesterday': return 'ontem';
      case 'this_week': return 'esta semana';
      case 'last_week': return 'semana passada';
      case '7d': return 'últimos 7 dias';
      case '14d': return 'últimos 14 dias';
      case '30d': return 'últimos 30 dias';
      case 'custom': return `${periodDays} dias`;
      default: return `${periodDays} dias`;
    }
  };

  return (
    <AdminLayout 
      title="Dashboard do Grupo" 
      subtitle={group.name}
    >
      <div className="space-y-8 animate-fade-in">
        {/* Breadcrumbs + Period Filter */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <Breadcrumbs
            items={[
              { label: "Sistema", href: "/system" },
              { label: orgName || "Organização", href: `/org/${group.organization_id}` },
              { label: group.name },
            ]}
          />

          <div className="flex items-center gap-3">
            <PeriodFilter
              value={selectedPeriod}
              customRange={customRange}
              onChange={handlePeriodChange}
            />
            <button
              onClick={() => setHelpOpen(true)}
              className="flex items-center gap-2 text-xs text-primary hover:underline"
            >
              <HelpCircle className="h-4 w-4" />
              Como ler este dashboard
            </button>
          </div>
        </div>

        {/* Help Sheet */}
        <Sheet open={helpOpen} onOpenChange={setHelpOpen}>
          <SheetContent side="right" className="sm:max-w-sm">
            <SheetHeader>
              <SheetTitle>Como ler este dashboard</SheetTitle>
              <SheetDescription>
                Orientação rápida para interpretar os dados sem ansiedade.
              </SheetDescription>
            </SheetHeader>
            <div className="space-y-5 mt-4">
              <div className="space-y-2">
                <p className="text-sm font-medium text-card-foreground">Para que serve este dashboard</p>
                <p className="text-sm text-muted-foreground">
                  Este painel mostra o comportamento do grupo no período.
                  Ajuda a observar padrões e intensidade, sem julgar pessoas.
                </p>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-card-foreground">Como ler os dados</p>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <p>1. Pulso do Grupo: resumo de volume e participação.</p>
                  <p>2. Ritmo da Conversa: mensagens por dia e picos.</p>
                  <p>3. Qualidade da Participação: distribuição e concentração.</p>
                  <p>4. Crescimento: entradas/saídas e membros atuais.</p>
                  <p>5. Esforço e Ruído: percepção de esforço e intensidade.</p>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-card-foreground">O que este painel não faz</p>
                <p className="text-sm text-muted-foreground">
                  Não mede satisfação, nem avalia qualidade individual.
                </p>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-card-foreground">Dica rápida</p>
                <p className="text-sm text-muted-foreground">
                  Evite conclusões por um único pico. Observe o padrão do período.
                </p>
              </div>
            </div>
          </SheetContent>
        </Sheet>

        {/* 1. Group Header */}
        <GroupHeader
          groupId={group.id}
          name={group.name}
          provider={group.provider}
          totalMembers={stats.totalMembers}
          lastMessageAt={stats.lastMessageAt}
          syncStatus={group.sync_status}
        />

        {/* 2. Summary Section - KPIs */}
        <SummarySection
          stats={stats}
          previousStats={previousStats || undefined}
          periodDays={periodDays}
          newMembersCount={newMembersCount}
          previousNewMembersCount={previousNewMembersCount}
          exitedMembersCount={exitedMembersCount}
          previousExitedMembersCount={previousExitedMembersCount}
          isLoading={isLoading}
          periodLabel={getPeriodLabel()}
        />

        {/* 3. Conversation Rhythm Section */}
        <ConversationRhythmSection
          messagesPerDay={messagesPerDay}
          activeMembersPerDay={activeMembersPerDay}
          peakHour={peakHour ?? undefined}
          peakHourMessages={peakHourMessages}
          previousPeakHour={previousPeakHour}
          previousPeakHourMessages={previousPeakHourMessages}
          isLoading={isLoading}
          periodLabel={getPeriodLabel()}
        />

        {/* 4. People Section */}
        <PeopleSection
          groupId={group.id}
          topParticipant={stats.topParticipant}
          previousTopParticipant={previousStats?.topParticipant}
          topParticipants={topParticipants}
          memberEngagement={memberEngagement}
          previousMemberEngagement={previousMemberEngagement}
          isLoading={isLoading}
          periodLabel={getPeriodLabel()}
        />

        {/* 4.1 Participation Quality Section */}
        <ParticipationQualitySection
          membersOverview={membersOverview}
          previousMembersOverview={previousMembersOverview}
          stats={stats}
          previousStats={previousStats || undefined}
          isLoading={isLoading}
          periodLabel={getPeriodLabel()}
        />

        {/* 4.2 Group Growth Section */}
        <GroupGrowthSection
          entriesPerDay={memberEntriesPerDay}
          exitsPerDay={memberExitsPerDay}
          currentMembers={currentMembers}
          membersAtPeriodStart={membersAtPeriodStart}
          daysWithActivity={daysWithActivity}
          periodDays={periodDays}
          isLoading={isLoading}
          periodLabel={getPeriodLabel()}
        />

        {/* 4.3 Effort and Noise Section */}
        <EffortNoiseSection
          stats={stats}
          messagesPerDay={messagesPerDay}
          membersOverview={membersOverview}
          periodDays={periodDays}
          isLoading={isLoading}
          periodLabel={getPeriodLabel()}
        />

        {/* 5. Alerts and Opportunities */}
        <AlertsSection
          atRiskMembers={atRiskMembers}
          popularMessages={popularMessages}
          isLoading={isLoading}
          groupId={group.id}
          totalMembers={currentMembers}
        />

        {/* 6. Admins Section */}
        <AdminsSection
          adminStats={adminStats || undefined}
          previousAdminStats={previousAdminStats}
          isLoading={isLoading}
          periodLabel={getPeriodLabel()}
        />
      </div>
    </AdminLayout>
  );
};

export default Group;
