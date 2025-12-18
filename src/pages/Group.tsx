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
  AlertsSection,
  AdminsSection,
} from "@/components/group-dashboard";

const Group = () => {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { isLoading: rolesLoading } = useUserRoles();
  const {
    group,
    orgName,
    stats,
    previousStats,
    messagesPerDay,
    topParticipants,
    peakHour,
    peakHourMessages,
    memberEngagement,
    popularMessages,
    adminStats,
    atRiskMembers,
    newMembersCount,
    isLoading,
    groupLoading,
    error,
  } = useGroupDashboard(groupId);

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

  return (
    <AdminLayout 
      title="Dashboard do Grupo" 
      subtitle={group.name}
    >
      <div className="space-y-8 animate-fade-in">
        {/* Breadcrumbs */}
        <Breadcrumbs
          items={[
            { label: "Sistema", href: "/system" },
            { label: orgName || "Organização", href: `/org/${group.organization_id}` },
            { label: group.name },
          ]}
        />

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
          newMembersCount={newMembersCount}
          isLoading={isLoading}
        />

        {/* 3. Conversation Rhythm Section */}
        <ConversationRhythmSection
          messagesPerDay={messagesPerDay}
          peakHour={peakHour ?? undefined}
          peakHourMessages={peakHourMessages}
          isLoading={isLoading}
        />

        {/* 4. People Section */}
        <PeopleSection
          groupId={group.id}
          topParticipant={stats.topParticipant}
          topParticipants={topParticipants}
          memberEngagement={memberEngagement}
          isLoading={isLoading}
        />

        {/* 5. Alerts and Opportunities */}
        <AlertsSection
          atRiskMembers={atRiskMembers}
          popularMessages={popularMessages}
          isLoading={isLoading}
        />

        {/* 6. Admins Section */}
        <AdminsSection
          adminStats={adminStats || undefined}
          isLoading={isLoading}
        />
      </div>
    </AdminLayout>
  );
};

export default Group;
