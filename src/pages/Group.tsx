import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { GroupPageTop } from "@/components/group-navigation/GroupPageTop";
import { useParams, useNavigate } from "react-router-dom";
import { useUserRoles } from "@/hooks/use-user-roles";
import { useAuth } from "@/hooks/use-auth";
import { useGroupDashboard } from "@/hooks/use-group-dashboard";
import { useUserOnboarding } from "@/hooks/use-user-onboarding";
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
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SendGroupMessageDialog } from "@/components/modals/SendGroupMessageDialog";
import { sendGroupMessageWebhook } from "@/lib/group-message-webhook";
import { notify } from "@/components/ui/sonner";
import { notifyActionError } from "@/lib/notify-action-error";
import { CheckCircle2, SendHorizontal, Sparkles } from "lucide-react";
import { logEvent } from "@/lib/audit";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const hasTrackedSessionEvent = (key: string) => {
  try {
    return globalThis.sessionStorage?.getItem(key) === "1";
  } catch {
    return false;
  }
};

const markSessionEventTracked = (key: string) => {
  try {
    globalThis.sessionStorage?.setItem(key, "1");
  } catch {
    void 0;
  }
};

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
  const { loading: authLoading, user } = useAuth();
  const { isGroupWelcomeDismissed, dismissGroupWelcome, isSaving: onboardingSaving } = useUserOnboarding(user?.id);
  const { isLoading: rolesLoading, canEditGroup, isSystemAdmin } = useUserRoles();
  const isGroupIdValid = typeof groupId === "string" && UUID_RE.test(groupId);
  
  // Period filter state
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>(() => loadSavedGroupPeriod(groupId).period);
  const [customRange, setCustomRange] = useState<DateRange | undefined>(() => loadSavedGroupPeriod(groupId).range);
  const [ikigaiOpen, setIkigaiOpen] = useState(false);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  
  
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

  const canSendMessage = !!group && canEditGroup(group.id, group.organization_id);
  const totalMessages = Number((stats as any)?.totalMessages ?? (stats as any)?.totalMessages7d ?? 0);
  const hasGroupActivity = totalMessages > 0 || Boolean(stats.lastMessageAt);
  const welcomeDismissed = isGroupWelcomeDismissed(groupId ?? null);

  useEffect(() => {
    if (authLoading || rolesLoading) return;
    if (!user?.id || !groupId || welcomeDismissed) return;

    const key = `onboarding-event:group-welcome-started:${user.id}:${groupId}`;
    if (hasTrackedSessionEvent(key)) return;

    markSessionEventTracked(key);
    void logEvent({
      eventType: "GROUP_WELCOME_STARTED",
      entityType: "group",
      entityId: groupId,
      userId: user.id,
      metadata: {
        has_activity: hasGroupActivity,
        total_messages: totalMessages,
        path: typeof window !== "undefined" ? window.location.pathname : null,
      },
    });
  }, [authLoading, groupId, hasGroupActivity, rolesLoading, totalMessages, user?.id, welcomeDismissed]);

  const handleDismissWelcome = async () => {
    if (!groupId) return;
    await dismissGroupWelcome(groupId);
    if (user?.id) {
      void logEvent({
        eventType: "GROUP_WELCOME_COMPLETED",
        entityType: "group",
        entityId: groupId,
        userId: user.id,
        metadata: {
          completed_via: "dismiss",
          has_activity: hasGroupActivity,
          total_messages: totalMessages,
        },
      });
    }
  };

  const handleSendMessage = async (message: string) => {
    if (!group) return;
    setIsSendingMessage(true);
    try {
      await sendGroupMessageWebhook({
        groupId: group.id,
        groupName: group.name || "Grupo",
        message,
      });
      notify.success("Mensagem enviada", "Tudo certo.");
      setSendDialogOpen(false);
    } catch (err) {
      notifyActionError("Não foi possível enviar mensagem", err, "Tente novamente.");
    } finally {
      setIsSendingMessage(false);
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
      title="Painel do Grupo" 
      subtitle={group?.name || "Grupo"}
    >
      <div className="mx-auto max-w-[1480px] animate-fade-in space-y-8 bg-gradient-to-b from-background via-background to-primary/5 pb-8 sm:pb-10">
        <GroupPageTop
          breadcrumbItems={[
            { label: "Central de Comando", href: "/" },
            { label: orgName || "Organização", href: `/organization/${group?.organization_id}` },
            { label: group?.name || "Grupo" },
          ]}
          group={{
            groupId: group.id,
            organizationId: group.organization_id,
            name: group?.name || "",
            provider: group?.provider || "",
            totalMembers: Number(currentMembers ?? stats.totalMembers ?? 0),
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
          rightActions={canSendMessage ? (
            <Button
              type="button"
              size="sm"
              onClick={() => setSendDialogOpen(true)}
            >
              <SendHorizontal className="h-4 w-4" />
              Enviar mensagem
            </Button>
          ) : undefined}
        />

        <SendGroupMessageDialog
          open={sendDialogOpen}
          onOpenChange={setSendDialogOpen}
          groupName={group.name || "Grupo"}
          isSubmitting={isSendingMessage}
          onSubmit={handleSendMessage}
        />

        {!welcomeDismissed && (
          <Card className="border-border/80 shadow-subtle">
            <CardContent className="p-6">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-3">
                  <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">
                    <Sparkles className="h-3.5 w-3.5" />
                    Primeira visita ao grupo
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-lg font-semibold tracking-[-0.02em] text-card-foreground">
                      {hasGroupActivity ? "Seu grupo ja esta em operacao" : "Grupo conectado. Agora e so comecar a acompanhar."}
                    </h2>
                    <p className="max-w-3xl text-sm text-muted-foreground">
                      {hasGroupActivity
                        ? "Aqui voce acompanha ritmo da conversa, participantes, diario e sinais do grupo sem precisar navegar por tudo agora."
                        : "Quando as primeiras mensagens chegarem, o Boris começa a preencher o painel, o diario e os sinais do grupo automaticamente."}
                    </p>
                  </div>
                  <div className="grid gap-2 text-sm">
                    <div className="flex items-start gap-2 rounded-[var(--radius-md)] bg-secondary/30 px-3 py-2 text-card-foreground">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                      <span>Painel principal para acompanhar atividade e participacao.</span>
                    </div>
                    <div className="flex items-start gap-2 rounded-[var(--radius-md)] bg-secondary/30 px-3 py-2 text-card-foreground">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                      <span>Use o Diario para revisar contexto e o Atendimento para agir quando precisar.</span>
                    </div>
                    {!hasGroupActivity ? (
                      <div className="flex items-start gap-2 rounded-[var(--radius-md)] bg-secondary/30 px-3 py-2 text-card-foreground">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                        <span>Se quiser, envie uma mensagem inicial para acelerar a primeira leitura da conversa.</span>
                      </div>
                    ) : null}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col gap-2 sm:flex-row lg:flex-col">
                  {canSendMessage && !hasGroupActivity ? (
                    <Button type="button" onClick={() => setSendDialogOpen(true)}>
                      <SendHorizontal className="h-4 w-4" />
                      Enviar mensagem inicial
                    </Button>
                  ) : null}
                  <Button type="button" variant="outline" onClick={() => navigate(`/groups/${group.id}/summaries`)}>
                    Ver diario
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => void handleDismissWelcome()}
                    disabled={!groupId || onboardingSaving}
                  >
                    Entendi
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="space-y-10">
          <section className="space-y-6">
            <div className="space-y-8">
              {(() => {
                const summaryStats = {
                  totalMessages: Number((stats as any)?.totalMessages ?? (stats as any)?.totalMessages7d ?? 0),
                  activeMembers: Number((stats as any)?.activeMembers ?? (stats as any)?.activeMembers7d ?? 0),
                  engagementRate: Number((stats as any)?.engagementRate ?? 0),
                  totalMembers: Number(currentMembers ?? (stats as any)?.totalMembers ?? 0),
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

          <section className="space-y-6 rounded-[var(--radius-xl)] border border-border/60 bg-card/50 p-4 shadow-subtle sm:p-5">
            <header className="space-y-1">
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Crescimento do grupo</h2>
              <p className="text-sm text-muted-foreground">Entradas, saídas e saldo do período</p>
            </header>

            <div className="space-y-8">
              <GroupGrowthSection
                groupId={group.id}
                canViewFullHistory={isSystemAdmin}
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

          <section className="space-y-6 rounded-[var(--radius-xl)] border border-border/60 bg-card/50 p-4 shadow-subtle sm:p-5">
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
