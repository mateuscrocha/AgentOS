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
    RecentActivitySection,
    ConversationRhythmSection,
    PeopleSection,
    ParticipationQualitySection,
    GroupGrowthSection,
    EffortNoiseSection,
    AlertsSection,
    AdminsSection,
    PurposeAlignmentSection,
  } from "@/components/group-dashboard";
import { PeriodFilter, PeriodType, DateRange, getDateRange } from "@/components/group-dashboard/PeriodFilter";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { HelpCircle, RefreshCw } from "lucide-react";
import { EditIkigaiModal } from "@/components/modals/EditIkigaiModal";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

const Group = () => {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { isLoading: rolesLoading } = useUserRoles();
  
  // Period filter state
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>('7d');
  const [customRange, setCustomRange] = useState<DateRange | undefined>();
  const [helpOpen, setHelpOpen] = useState(false);
  const [ikigaiOpen, setIkigaiOpen] = useState(false);
  const [revalidating, setRevalidating] = useState(false);
  
  const currentRange = getDateRange(selectedPeriod, customRange);


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
    alignedMessagesPercent,
    hasIkigai,
    activePercent,
    activeDaysPercent,
    lowEffortPercent,
    recurringPercent,
    ikigaiKeywordsList,
    ikigaiSuggestions,
  } = useGroupDashboard({ groupId, dateRange: currentRange });

  const queryClient = useQueryClient();

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
      case '7d': return 'últimos 7 dias';
      case '14d': return 'últimos 14 dias';
      case '30d': return 'últimos 30 dias';
      case 'custom': return `${periodDays} dias`;
      default: return `${periodDays} dias`;
    }
  };

  const normalizePhoneE164 = (phone: string): string => {
    const digits = phone.replace(/\D/g, '');
    if (!phone.startsWith('+')) {
      if (digits.startsWith('55') && digits.length > 11) {
        return '+' + digits;
      }
      return '+55' + digits;
    }
    return '+' + digits;
  };

  const handleRevalidateGroup = async () => {
    if (!group.invite_link) {
      toast.error('Configure o link de convite do grupo para revalidar');
      return;
    }
    setRevalidating(true);
    try {
      const response = await supabase.functions.invoke('validate-whatsapp-group', {
        body: { invite_link: group.invite_link }
      });
      if (response.error) {
        throw new Error(response.error.message || 'Erro ao validar grupo');
      }
      const data = response.data as any;
      if (!data?.is_valid || !data?.is_boris_in_group) {
        toast.error('Não foi possível validar o grupo agora');
        return;
      }
      const participants = Array.isArray(data.participants) ? data.participants : [];
      const adminProviderIds = participants.filter((p: any) => p.is_admin).map((p: any) => p.provider_member_id).filter(Boolean);
      const superAdminProviderIds = participants.filter((p: any) => p.is_super_admin).map((p: any) => p.provider_member_id).filter(Boolean);
      const adminPhones = participants.filter((p: any) => p.is_admin).map((p: any) => normalizePhoneE164(p.phone)).filter(Boolean);
      const superAdminPhones = participants.filter((p: any) => p.is_super_admin).map((p: any) => normalizePhoneE164(p.phone)).filter(Boolean);

      await supabase
        .from('members')
        .update({ is_admin: false, is_super_admin: false })
        .eq('group_id', group.id)
        .is('deleted_at', null);

      if (adminProviderIds.length > 0) {
        await supabase
          .from('members')
          .update({ is_admin: true })
          .eq('group_id', group.id)
          .is('deleted_at', null)
          .in('provider_member_id', adminProviderIds);
      }
      if (adminPhones.length > 0) {
        await supabase
          .from('members')
          .update({ is_admin: true })
          .eq('group_id', group.id)
          .is('deleted_at', null)
          .in('phone_e164', adminPhones);
      }
      if (superAdminProviderIds.length > 0) {
        await supabase
          .from('members')
          .update({ is_super_admin: true })
          .eq('group_id', group.id)
          .is('deleted_at', null)
          .in('provider_member_id', superAdminProviderIds);
      }
      if (superAdminPhones.length > 0) {
        await supabase
          .from('members')
          .update({ is_super_admin: true })
          .eq('group_id', group.id)
          .is('deleted_at', null)
          .in('phone_e164', superAdminPhones);
      }

      queryClient.invalidateQueries({ queryKey: ['group-dashboard-admins'] });
      queryClient.invalidateQueries({ queryKey: ['group-dashboard-previous-admins'] });
      queryClient.invalidateQueries({ queryKey: ['group-members'] });
      toast.success('Admins atualizados');
    } catch (e: any) {
      toast.error(e.message || 'Erro ao revalidar o grupo');
    } finally {
      setRevalidating(false);
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
              { label: "Central de Comando", href: "/" },
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
            <Button
              onClick={handleRevalidateGroup}
              size="sm"
              variant="outline"
              disabled={revalidating}
            >
              <RefreshCw className={`h-4 w-4 ${revalidating ? 'animate-spin' : ''}`} />
              Revalidar Grupo
            </Button>
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
                  <p><strong className="text-card-foreground">Qualidade da Participação (gráfico):</strong> compara contribuição de quem mais enviou mensagens. Serve para visualizar distribuição, não para ranquear pessoas.</p>
                  <p><strong className="text-card-foreground">Concentração de mensagens:</strong> quanto da conversa vem de poucos participantes. Não indica se isso é bom ou ruim por si só.</p>
                  <p><strong className="text-card-foreground">Taxa de silêncio:</strong> percentual de membros sem mensagem no período. Não implica desinteresse; pode refletir apenas observação.</p>
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
                  <p><strong className="text-card-foreground">Participação dos admins:</strong> percentual das mensagens enviadas por admins. Indica presença de liderança na conversa, não qualidade.</p>
                  <p><strong className="text-card-foreground">Admins: total, ativos e inativos:</strong> contagem e status de administradores. Mostra estrutura de liderança, sem implicar responsabilidade pelo volume.</p>
                </div>
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
          currentMembers={currentMembers}
          periodDays={periodDays}
          newMembersCount={newMembersCount}
          previousNewMembersCount={previousNewMembersCount}
          exitedMembersCount={exitedMembersCount}
          previousExitedMembersCount={previousExitedMembersCount}
          isLoading={isLoading}
          periodLabel={getPeriodLabel()}
        />

        {/* Recent Activity Patterns */}
        <RecentActivitySection
          messagesPerDay={messagesPerDay}
          activityByHour={activityByHour}
          ikigaiSuggestions={ikigaiSuggestions as any}
          busyDayAvatars={busyDayAvatars as any}
          peakWindowAvatars={peakWindowAvatars as any}
          themeAvatars={themeAvatars as any}
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

        {/* 4.0 Purpose Alignment Section */}
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

        {/* 4.1 Participation Quality Section */}
        <ParticipationQualitySection
          membersOverview={membersOverview}
          previousMembersOverview={previousMembersOverview}
          stats={stats}
          previousStats={previousStats || undefined}
          currentMembers={currentMembers}
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
          currentMembers={currentMembers}
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
