import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { GroupPageTop } from "@/components/group-navigation/GroupPageTop";
import { useParams, useNavigate } from "react-router-dom";
import { useUserRoles } from "@/hooks/use-user-roles";
import { useAuth } from "@/hooks/use-auth";
import { useGroupDashboard } from "@/hooks/use-group-dashboard";
import AccessDenied from "./AccessDenied";
import {
  SummarySection,
  ConversationRhythmSection,
  PeakMomentSection,
  PeopleSection,
  GroupGrowthSection,
  PurposeAlignmentSection,
} from "@/components/group-dashboard";
import { PeriodReport } from "@/components/group-dashboard";
import { PeriodFilter } from "@/components/group-dashboard/PeriodFilter";
import {
  PeriodType,
  DateRange,
  getDateRange,
  parseStoredPeriod,
  buildStoredPeriod,
} from "@/components/group-dashboard/period-utils";
import { EditIkigaiModal } from "@/components/modals/EditIkigaiModal";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
 

function loadSavedGroupPeriod(groupId?: string): { period: PeriodType; range?: DateRange } {
  if (!groupId) return { period: "7d" };

  try {
    const raw = localStorage.getItem(`group-period:${groupId}`);
    const parsed = raw ? JSON.parse(raw) : null;
    const { period, range, isValid } = parseStoredPeriod(parsed, "7d");
    if (!isValid) {
      try {
        localStorage.removeItem(`group-period:${groupId}`);
      } catch {
        return { period: "7d" };
      }
    }
    return { period, range };
  } catch {
    try {
      localStorage.removeItem(`group-period:${groupId}`);
    } catch {
      return { period: "7d" };
    }
    return { period: "7d" };
  }
}

const Group = () => {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { loading: authLoading } = useAuth();
  const { isLoading: rolesLoading } = useUserRoles();
  const isGroupIdValid = typeof groupId === "string" && UUID_RE.test(groupId);
  
  // Period filter state
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>(() => loadSavedGroupPeriod(groupId).period);
  const [customRange, setCustomRange] = useState<DateRange | undefined>(() => loadSavedGroupPeriod(groupId).range);
  const [ikigaiOpen, setIkigaiOpen] = useState(false);
  
  
  const currentRange = getDateRange(selectedPeriod, customRange);

  useEffect(() => {
    const { period, range } = loadSavedGroupPeriod(groupId);
    setSelectedPeriod(period);
    setCustomRange(range);
  }, [groupId]);

  useEffect(() => {
    if (!groupId) return;

    const payload = buildStoredPeriod(selectedPeriod, customRange);
    try {
      localStorage.setItem(`group-period:${groupId}`, JSON.stringify(payload));
    } catch { void 0; }
  }, [groupId, selectedPeriod, customRange]);


  const {
    group,
    orgName,
    stats,
    previousStats,
    messagesPerDay,
    activeMembersPerDay,
    memberEntriesPerDay,
    memberExitsPerDay,
    memberEvents,
    currentMembers,
    membersAtPeriodStart,
    daysWithActivity,
    topParticipants,
    memberEngagement,
    previousMemberEngagement,
    newMembersCount,
    previousNewMembersCount,
    exitedMembersCount,
    previousExitedMembersCount,
    isLoading,
    groupLoading,
    error,
    periodDays,
    alignedMessagesPercent,
    hasIkigai,
    activePercent,
    activeDaysPercent,
    lowEffortPercent,
    recurringPercent,
    ikigaiKeywordsList,
    ikigaiSuggestions,
  } = useGroupDashboard({ groupId, dateRange: currentRange });

  const handlePeriodChange = (period: PeriodType, range: DateRange) => {
    setSelectedPeriod(period);
    setCustomRange(period === 'custom' ? range : undefined);
  };

  // Loading state while checking auth/roles
  if (authLoading || rolesLoading) {
    return (
      <AdminLayout title="Grupo" subtitle="Verificando acesso...">
        <LoadingState message="Verificando permissões..." />
      </AdminLayout>
    );
  }

  if (!groupId || !isGroupIdValid) {
    return (
      <AdminLayout title="Grupo" subtitle="Erro">
        <ErrorState
          title="ID do grupo inválido"
          message="O link deste grupo parece incorreto. Verifique o endereço e tente novamente."
          retry={() => navigate("/")}
        />
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
          retry={() => navigate('/')}
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
      case 'this_month': return 'este mês';
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
      subtitle={group?.name || "Grupo"}
    >
      <div className="animate-fade-in -mx-4 sm:-mx-6 -mt-4 sm:-mt-6 px-4 sm:px-6 pt-4 sm:pt-6 pb-8 sm:pb-10 bg-background space-y-8">
        <GroupPageTop
          breadcrumbItems={[
            { label: "Central do Bóris", href: "/" },
            { label: orgName || "Organização", href: `/organization/${group?.organization_id}` },
            { label: group?.name || "Grupo" },
          ]}
          group={{
            groupId: group.id,
            organizationId: group.organization_id,
            name: group?.name || "",
            provider: group?.provider || "",
            totalMembers: stats.totalMembers,
            lastMessageAt: stats.lastMessageAt,
            syncStatus: group?.sync_status,
          }}
          filters={(
            <PeriodFilter
              value={selectedPeriod}
              customRange={customRange}
              onChange={handlePeriodChange}
            />
          )}
        />

        <div className="space-y-12">
          <section className="space-y-6">
            <div className="space-y-8">
              {(() => {
                const summaryStats = {
                  totalMessages: Number((stats as any)?.totalMessages ?? (stats as any)?.totalMessages7d ?? 0),
                  activeMembers: Number((stats as any)?.activeMembers ?? (stats as any)?.activeMembers7d ?? 0),
                  engagementRate: Number((stats as any)?.engagementRate ?? 0),
                  totalMembers: Number((stats as any)?.totalMembers ?? currentMembers ?? 0),
                };
                const prevSummaryStats = previousStats ? {
                  totalMessages: Number((previousStats as any)?.totalMessages ?? (previousStats as any)?.totalMessages7d ?? 0),
                  activeMembers: Number((previousStats as any)?.activeMembers ?? (previousStats as any)?.activeMembers7d ?? 0),
                  totalMembers: Number((previousStats as any)?.totalMembers ?? (previousStats as any)?.totalMembersSnapshot ?? 0),
                  engagementRate: Number((previousStats as any)?.engagementRate ?? 0),
                } : undefined;
                return (
                  <SummarySection
                    stats={summaryStats}
                    previousStats={prevSummaryStats}
                    currentMembers={currentMembers}
                    selectedPeriod={selectedPeriod}
                    newMembersCount={newMembersCount}
                    previousNewMembersCount={previousNewMembersCount}
                    exitedMembersCount={exitedMembersCount}
                    previousExitedMembersCount={previousExitedMembersCount}
                    isLoading={isLoading}
                  />
                );
              })()}

              <PeriodReport
                stats={stats}
                previousStats={previousStats || undefined}
                currentMembers={currentMembers}
                periodDays={periodDays}
                memberEngagement={memberEngagement}
              />
            </div>
          </section>

          <section className="space-y-8">
            <div className="space-y-8">
              <ConversationRhythmSection
                messagesPerDay={messagesPerDay}
                activeMembersPerDay={activeMembersPerDay}
                isLoading={isLoading}
                periodLabel={getPeriodLabel()}
              />

              <PeakMomentSection
                groupId={group.id}
                startDate={currentRange.from}
                endDate={currentRange.to}
                messagesPerDay={messagesPerDay}
                isDashboardLoading={isLoading}
              />
            </div>
          </section>

          <section className="space-y-6">
            <div className="space-y-8">
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
            </div>
          </section>

          <section className="space-y-6">
            <header className="space-y-1">
              <h2 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Crescimento do grupo</h2>
              <p className="text-sm text-muted-foreground">Entradas, saídas e saldo do período</p>
            </header>

            <div className="space-y-8">
              <GroupGrowthSection
                groupId={group.id}
                entriesPerDay={memberEntriesPerDay}
                exitsPerDay={memberExitsPerDay}
                memberEvents={memberEvents}
                currentMembers={currentMembers}
                membersAtPeriodStart={membersAtPeriodStart}
                daysWithActivity={daysWithActivity}
                periodDays={periodDays}
                isLoading={isLoading}
                periodLabel={getPeriodLabel()}
              />
            </div>
          </section>

          <section className="space-y-6">
            <div className="space-y-8">
              <PurposeAlignmentSection
                alignedPercent={alignedMessagesPercent}
                activePercent={activePercent}
                recurringPercent={recurringPercent}
                activeDaysPercent={activeDaysPercent}
                lowEffortPercent={lowEffortPercent}
                disabled
                isLoading={isLoading}
                hasIkigai={hasIkigai}
                periodLabel={getPeriodLabel()}
                onOpenIkigai={() => setIkigaiOpen(true)}
              />
            </div>
          </section>
        </div>
      </div>
      <EditIkigaiModal
        groupId={group.id}
        open={ikigaiOpen}
        onOpenChange={setIkigaiOpen}
        periodLabel={getPeriodLabel()}
        currentKeywords={(ikigaiKeywordsList || []) as string[]}
        suggestions={ikigaiSuggestions as any}
        groupMetadata={group.metadata as any}
      />
    </AdminLayout>
  );
};

export default Group;
