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
  EffortNoiseSection,
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
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { HelpCircle, Loader2 } from "lucide-react";
import { EditIkigaiModal } from "@/components/modals/EditIkigaiModal";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { notify } from "@/components/ui/sonner";
import { useQueryClient } from "@tanstack/react-query";

type GroupMembersSyncResult = {
  success: boolean;
  code?: string;
  message?: string;
  group_id?: string;
  group_name?: string;
  whatsapp_group_id?: string | null;
  whatsapp_participants_count?: number;
  members_to_add_count?: number;
  members_to_mark_as_left_count?: number;
  members_reactivated_count?: number;
  members_ok_count?: number;
  skipped_count?: number;
  duplicates?: { phones: string[]; provider_ids: string[] };
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
  const { loading: authLoading } = useAuth();
  const { isLoading: rolesLoading } = useUserRoles();
  const queryClient = useQueryClient();
  
  // Period filter state
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>(() => loadSavedGroupPeriod(groupId).period);
  const [customRange, setCustomRange] = useState<DateRange | undefined>(() => loadSavedGroupPeriod(groupId).range);
  const [helpOpen, setHelpOpen] = useState(false);
  const [ikigaiOpen, setIkigaiOpen] = useState(false);
  const [syncingMembers, setSyncingMembers] = useState(false);
  const [membersSyncResult, setMembersSyncResult] = useState<GroupMembersSyncResult | null>(null);
  
  
  const currentRange = getDateRange(selectedPeriod, customRange);
  const hasActiveFilters = selectedPeriod !== '7d' || !!customRange;
  const handleClearFilters = () => {
    setSelectedPeriod('7d');
    setCustomRange(undefined);
  };

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
    activityByHour,
    busyDayAvatars,
    peakWindowAvatars,
    themeAvatars,
    membersOverview,
    memberEntriesPerDay,
    memberExitsPerDay,
    memberEvents,
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
    atRiskMembers,
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
      <div className="space-y-8 animate-fade-in">
        <GroupPageTop
          breadcrumbItems={[
            { label: "Central do Bóris", href: "/" },
            { label: orgName || "Organização", href: `/organization/${group?.organization_id}` },
            { label: group?.name || "Grupo" },
          ]}
          group={{
            groupId: group.id,
            name: group?.name || "",
            provider: group?.provider || "",
            totalMembers: stats.totalMembers,
            lastMessageAt: stats.lastMessageAt,
            syncStatus: group?.sync_status,
          }}
          activeTab="painel"
          filters={(
            <PeriodFilter
              value={selectedPeriod}
              customRange={customRange}
              onChange={handlePeriodChange}
            />
          )}
          showClearFilters={hasActiveFilters}
          onClearFilters={handleClearFilters}
          rightActions={(
            <Button variant="link" size="sm" className="h-8 px-0 text-xs" onClick={() => setHelpOpen(true)}>
              <HelpCircle className="h-4 w-4" />
              Como ler este dashboard
            </Button>
          )}
        />

        

        {/* Help Sheet */}
        <Sheet open={helpOpen} onOpenChange={setHelpOpen}>
          <SheetContent side="right" className="sm:max-w-sm overflow-y-auto">
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
                  <p>3. Crescimento: entradas/saídas e membros atuais.</p>
                  <p>4. Esforço e Ruído: percepção de esforço e intensidade.</p>
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
              <div className="space-y-2">
                <p className="text-sm font-medium text-card-foreground">Explicações por KPI e gráfico</p>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <p><strong className="text-card-foreground">Mensagens (período):</strong> total de mensagens no intervalo escolhido. Não indica qualidade do conteúdo.</p>
                  <p><strong className="text-card-foreground">Membros ativos:</strong> quem enviou ao menos uma mensagem no período. Não significa atividade diária constante.</p>
                  <p><strong className="text-card-foreground">Taxa de participação:</strong> percentual do grupo que participou no período. Não mede profundidade ou qualidade da conversa.</p>
                  <p><strong className="text-card-foreground">Crescimento líquido:</strong> entradas menos saídas no período. Não mostra motivos das mudanças.</p>
                  <p><strong className="text-card-foreground">Ritmo da Conversa (gráfico):</strong> evolução de mensagens por dia para perceber picos e calmarias. Útil para padrão temporal, não para avaliar conteúdo.</p>
                  <p><strong className="text-card-foreground">Horário mais ativo:</strong> faixa de hora com maior volume. Indica concentração de atividade, não necessidade de resposta.</p>
                  <p><strong className="text-card-foreground">Mensagens no pico:</strong> quantidade de mensagens na hora mais ativa. Mostra intensidade pontual, não pressão constante.</p>
                  <p><strong className="text-card-foreground">Top 5 participantes / Membro mais ativo:</strong> quem mais contribuiu em volume. Não é medida de valor individual ou qualidade.</p>
                  <p><strong className="text-card-foreground">Crescimento do Grupo (entradas/saídas):</strong> barras de mudanças de membros. Não avalia motivos pessoais ou operacionais.</p>
                  <p><strong className="text-card-foreground">Membros atuais:</strong> total de membros ao fim do período. Contextualiza tamanho, não engajamento.</p>
                  <p><strong className="text-card-foreground">Dias com atividade:</strong> dias que tiveram mensagens. Mostra frequência geral, não constância individual.</p>
                  <p><strong className="text-card-foreground">Mensagens por membro ativo:</strong> média de mensagens entre quem participou. Não reflete distribuição entre todos os membros.</p>
                  <p><strong className="text-card-foreground">Dias com excesso de mensagens:</strong> dias acima da média diária do grupo. Indica intensidade, não problema.</p>
                  <p><strong className="text-card-foreground">Distribuição da atividade:</strong> leitura se a conversa está concentrada ou distribuída. É descritivo, sem pontuação ou julgamento.</p>
                  <p><strong className="text-card-foreground">Membros sem participação recente:</strong> membros sem mensagens no período. Não define desinteresse e pode ser circunstancial.</p>
                  <p><strong className="text-card-foreground">O que engajou no grupo:</strong> mensagens que receberam reações. Mostra estímulos de engajamento, não validações de conteúdo.</p>
                  <p><strong className="text-card-foreground">Distribuição de engajamento (gráfico):</strong> percentuais de recorrentes, esporádicos e inativos. Descreve perfis de participação, sem julgamento.</p>
                </div>
              </div>
            </div>
          </SheetContent>
        </Sheet>

        

        <div className="space-y-12">
          {(() => {
            const isEnabled = import.meta.env.MODE !== "production" && group.id === "bd0f288d-310b-47d4-bca5-e10da4beb2ab";
            if (!isEnabled) return null;

            const summary = membersSyncResult?.success
              ? `+${membersSyncResult.members_to_add_count ?? 0} novos membros • ${membersSyncResult.members_to_mark_as_left_count ?? 0} marcados como fora do grupo`
              : null;

            return (
              <section className="rounded-xl border border-border bg-card p-5">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">Revisar base de membros</h2>
                    <p className="text-sm text-muted-foreground">Use essa opção para alinhar a base de membros do Bóris com os participantes reais do grupo no WhatsApp.</p>
                  </div>
                  <Button
                    onClick={async () => {
                      setSyncingMembers(true);
                      try {
                        const response = await supabase.functions.invoke("sync-whatsapp-group-members", {
                          body: { group_id: group.id, operation: "full_sync" },
                        });

                        if (response.error) {
                          throw new Error(response.error.message || "Erro ao sincronizar");
                        }

                        const data = response.data as GroupMembersSyncResult;
                        setMembersSyncResult(data);

                        if (!data?.success) {
                          notify.error("Não foi possível sincronizar", data?.message || "Algo deu errado. Tente novamente.");
                          return;
                        }

                        notify.success(
                          "Base atualizada a partir do WhatsApp.",
                          `+${data.members_to_add_count ?? 0} novos membros • ${data.members_to_mark_as_left_count ?? 0} marcados como fora do grupo`,
                        );

                        queryClient.invalidateQueries({ queryKey: ["group-members", group.id] });
                        queryClient.invalidateQueries({ queryKey: ["group-members-total", group.id] });
                        queryClient.invalidateQueries({ queryKey: ["group-dashboard"] });
                      } catch (e: any) {
                        notify.error(
                          "Não foi possível buscar os participantes do grupo no WhatsApp agora.",
                          "Tente novamente mais tarde.",
                        );
                      } finally {
                        setSyncingMembers(false);
                      }
                    }}
                    disabled={syncingMembers}
                    className="md:self-start"
                  >
                    {syncingMembers ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                    Verificar e atualizar
                  </Button>
                </div>

                {summary ? (
                  <div className="mt-4 rounded-xl border border-success/30 bg-success/5 p-4">
                    <p className="text-sm font-medium text-card-foreground">Base atualizada a partir do WhatsApp.</p>
                    <p className="text-xs text-muted-foreground mt-1">{summary}</p>
                    {(membersSyncResult?.skipped_count ?? 0) > 0 || (membersSyncResult?.duplicates?.phones?.length ?? 0) > 0 ? (
                      <p className="text-xs text-muted-foreground mt-2">Alguns registros foram ignorados para evitar inconsistências.</p>
                    ) : null}
                  </div>
                ) : null}
              </section>
            );
          })()}
          <section className="space-y-6">
            <header className="space-y-1">
              <h2 className="text-lg font-semibold text-foreground">Panorama</h2>
              <p className="text-sm text-muted-foreground">KPIs principais, base ativa x observadores e resumo do período</p>
            </header>

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
                previousMemberEngagement={previousMemberEngagement}
                atRiskMembersCount={atRiskMembers.length}
                groupId={group.id}
              />
            </div>
          </section>

          <section className="space-y-6">
            <header className="space-y-1">
              <h2 className="text-lg font-semibold text-foreground">Ritmo da conversa</h2>
              <p className="text-sm text-muted-foreground">Evolução do volume, picos e horários</p>
            </header>

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

              <EffortNoiseSection
                stats={stats}
                messagesPerDay={messagesPerDay}
                membersOverview={membersOverview}
                periodDays={periodDays}
                isLoading={isLoading}
                periodLabel={getPeriodLabel()}
                currentMembers={currentMembers}
              />
            </div>
          </section>

          <section className="space-y-6">
            <header className="space-y-1">
              <h2 className="text-lg font-semibold text-foreground">Pessoas & Engajamento</h2>
              <p className="text-sm text-muted-foreground">Membros ativos, distribuição da conversa e recorrência</p>
            </header>

            <div className="space-y-8">
              <PeopleSection
                groupId={group.id}
                topParticipant={stats.topParticipant}
                previousTopParticipant={previousStats?.topParticipant}
                topParticipants={topParticipants}
                totalMessagesInPeriod={stats.totalMessages7d}
                memberEngagement={memberEngagement}
                previousMemberEngagement={previousMemberEngagement}
                isLoading={isLoading}
                periodLabel={getPeriodLabel()}
              />
            </div>
          </section>

          <section className="space-y-6">
            <header className="space-y-1">
              <h2 className="text-lg font-semibold text-foreground">Crescimento do grupo</h2>
              <p className="text-sm text-muted-foreground">Entradas e saídas, crescimento líquido e evolução</p>
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
            <header className="space-y-1">
              <h2 className="text-lg font-semibold text-foreground">Temas & Propósito</h2>
              <p className="text-sm text-muted-foreground">Leitura qualitativa e insights interpretativos</p>
            </header>

            <div className="space-y-8">
              <PurposeAlignmentSection
                alignedPercent={alignedMessagesPercent}
                activePercent={activePercent}
                recurringPercent={recurringPercent}
                activeDaysPercent={activeDaysPercent}
                lowEffortPercent={lowEffortPercent}
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
