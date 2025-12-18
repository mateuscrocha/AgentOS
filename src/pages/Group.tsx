import { AdminLayout } from "@/components/layout/AdminLayout";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { EmptyState } from "@/components/ui/empty-state";
import { useParams, useNavigate, NavLink } from "react-router-dom";
import { 
  Users, MessageSquare, Activity, TrendingUp, 
  Clock, User, Image, FileText, Mic, Video,
  Wifi, WifiOff, AlertCircle
} from "lucide-react";
import { useUserRoles } from "@/hooks/use-user-roles";
import { useAuth } from "@/hooks/use-auth";
import { useGroupDashboard } from "@/hooks/use-group-dashboard";
import AccessDenied from "./AccessDenied";
import { cn } from "@/lib/utils";
import { 
  ChartContainer, 
  ChartTooltip, 
  ChartTooltipContent 
} from "@/components/ui/chart";
import { 
  Bar, 
  BarChart, 
  Line, 
  LineChart, 
  XAxis, 
  YAxis, 
  ResponsiveContainer,
  CartesianGrid,
  Cell
} from "recharts";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

const Group = () => {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { isLoading: rolesLoading } = useUserRoles();
  const {
    group,
    orgName,
    stats,
    messagesPerDay,
    topParticipants,
    recentMessages,
    membersOverview,
    isLoading,
    groupLoading,
    error,
  } = useGroupDashboard(groupId);

  const tabs = [
    { label: "Dashboard", href: `/group/${groupId}`, end: true },
    { label: "Membros", href: `/group/${groupId}/members`, icon: Users },
    { label: "Mensagens", href: `/group/${groupId}/messages`, icon: MessageSquare },
    { label: "Atividade", href: `/group/${groupId}/events`, icon: Activity },
  ];

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

  // Calculate group status
  const getGroupStatus = () => {
    if (group.sync_status === 'error') {
      return { label: 'Desconectado', color: 'destructive', icon: WifiOff };
    }
    if (!stats.lastMessageAt) {
      return { label: 'Sem atividade', color: 'muted', icon: AlertCircle };
    }
    const lastMsgDate = new Date(stats.lastMessageAt);
    const hoursSinceLastMsg = (Date.now() - lastMsgDate.getTime()) / (1000 * 60 * 60);
    if (hoursSinceLastMsg > 48) {
      return { label: 'Inativo', color: 'warning', icon: AlertCircle };
    }
    return { label: 'Ativo', color: 'success', icon: Wifi };
  };

  const groupStatus = getGroupStatus();

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
    });
  };

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const translateMessageType = (type: string) => {
    const types: Record<string, string> = {
      text: 'Texto',
      image: 'Imagem',
      video: 'Vídeo',
      audio: 'Áudio',
      document: 'Documento',
      sticker: 'Figurinha',
      location: 'Localização',
      contact: 'Contato',
      poll: 'Enquete',
    };
    return types[type] || type;
  };

  const getMessageIcon = (type: string) => {
    switch (type) {
      case 'image': return Image;
      case 'video': return Video;
      case 'audio': return Mic;
      case 'document': return FileText;
      default: return MessageSquare;
    }
  };

  const chartConfig = {
    messages: {
      label: "Mensagens",
      color: "hsl(var(--primary))",
    },
    count: {
      label: "Mensagens",
      color: "hsl(var(--primary))",
    },
  };

  return (
    <AdminLayout 
      title="Dashboard do Grupo" 
      subtitle={group.name}
    >
      <div className="space-y-6 animate-fade-in">
        {/* Breadcrumbs */}
        <Breadcrumbs
          items={[
            { label: "Sistema", href: "/system" },
            { label: orgName || "Organização", href: `/org/${group.organization_id}` },
            { label: group.name },
          ]}
        />

        {/* Group Header */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-5 border-b border-border">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 shrink-0">
              <Users className="h-7 w-7 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-semibold text-card-foreground truncate">{group.name}</h2>
              <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-muted-foreground">
                <span className="capitalize">{group.provider}</span>
                <span>•</span>
                <span>{stats.totalMembers} membros</span>
                <span>•</span>
                <span className={cn(
                  "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium",
                  groupStatus.color === 'success' && "bg-success/10 text-success",
                  groupStatus.color === 'warning' && "bg-warning/10 text-warning",
                  groupStatus.color === 'destructive' && "bg-destructive/10 text-destructive",
                  groupStatus.color === 'muted' && "bg-muted text-muted-foreground"
                )}>
                  <groupStatus.icon className="h-3 w-3" />
                  {groupStatus.label}
                </span>
              </div>
              {stats.lastMessageAt && (
                <p className="text-xs text-muted-foreground mt-1">
                  Última atividade: {formatDateTime(stats.lastMessageAt)}
                </p>
              )}
            </div>
          </div>
          
          {/* Tab navigation */}
          <div className="flex gap-1 p-2 bg-secondary/30 overflow-x-auto">
            {tabs.map((tab) => (
              <NavLink
                key={tab.href}
                to={tab.href}
                end={tab.end}
                className={({ isActive }) => cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap",
                  isActive 
                    ? "bg-card text-foreground shadow-sm" 
                    : "text-muted-foreground hover:text-foreground hover:bg-card/50"
                )}
              >
                {tab.icon && <tab.icon className="h-4 w-4" />}
                {tab.label}
              </NavLink>
            ))}
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {/* Messages 7d */}
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">Mensagens (7d)</span>
              <MessageSquare className="h-4 w-4 text-primary" />
            </div>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <p className="text-2xl font-bold text-card-foreground">{stats.totalMessages7d}</p>
            )}
          </div>

          {/* Active Members 7d */}
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">Membros ativos (7d)</span>
              <Users className="h-4 w-4 text-primary" />
            </div>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <p className="text-2xl font-bold text-card-foreground">{stats.activeMembers7d}</p>
            )}
          </div>

          {/* Engagement Rate */}
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">Engajamento (7d)</span>
              <TrendingUp className="h-4 w-4 text-primary" />
            </div>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <p className="text-2xl font-bold text-card-foreground">{stats.engagementRate}%</p>
            )}
          </div>

          {/* Top Participant */}
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">Top participante (7d)</span>
              <User className="h-4 w-4 text-primary" />
            </div>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : stats.topParticipant ? (
              <div>
                <p className="text-sm font-semibold text-card-foreground truncate">{stats.topParticipant.name}</p>
                <p className="text-xs text-muted-foreground">{stats.topParticipant.count} msgs</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">—</p>
            )}
          </div>

          {/* Last Message */}
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">Última mensagem</span>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </div>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : stats.lastMessageAt ? (
              <p className="text-sm font-medium text-card-foreground">{formatDateTime(stats.lastMessageAt)}</p>
            ) : (
              <p className="text-sm text-muted-foreground">—</p>
            )}
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Messages per day chart */}
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="text-sm font-semibold text-card-foreground mb-4">Mensagens por dia (últimos 7 dias)</h3>
            {isLoading ? (
              <div className="h-[200px] flex items-center justify-center">
                <Skeleton className="h-full w-full" />
              </div>
            ) : messagesPerDay.length === 0 ? (
              <div className="h-[200px] flex items-center justify-center">
                <p className="text-sm text-muted-foreground">Sem dados</p>
              </div>
            ) : (
              <ChartContainer config={chartConfig} className="h-[200px] w-full">
                <LineChart data={messagesPerDay}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={formatDate}
                    tick={{ fontSize: 12 }}
                    className="text-muted-foreground"
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }}
                    className="text-muted-foreground"
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line 
                    type="monotone" 
                    dataKey="count" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    dot={{ fill: "hsl(var(--primary))", strokeWidth: 0 }}
                  />
                </LineChart>
              </ChartContainer>
            )}
          </div>

          {/* Top 5 participants chart */}
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="text-sm font-semibold text-card-foreground mb-4">Top 5 participantes (últimos 7 dias)</h3>
            {isLoading ? (
              <div className="h-[200px] flex items-center justify-center">
                <Skeleton className="h-full w-full" />
              </div>
            ) : topParticipants.length === 0 ? (
              <div className="h-[200px] flex items-center justify-center">
                <p className="text-sm text-muted-foreground">Sem dados</p>
              </div>
            ) : (
              <ChartContainer config={chartConfig} className="h-[200px] w-full">
                <BarChart data={topParticipants} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 12 }} />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    tick={{ fontSize: 11 }}
                    width={100}
                    tickFormatter={(value) => value.length > 12 ? value.slice(0, 12) + '...' : value}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]}>
                    {topParticipants.map((_, index) => (
                      <Cell key={`cell-${index}`} fillOpacity={1 - (index * 0.15)} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-card-foreground">Atividade recente</h3>
            <button 
              onClick={() => navigate(`/group/${groupId}/messages`)}
              className="text-xs text-primary hover:underline"
            >
              Ver todas
            </button>
          </div>
          
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-start gap-3">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-24 mb-1" />
                    <Skeleton className="h-3 w-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : recentMessages.length === 0 ? (
            <EmptyState 
              icon={MessageSquare}
              title="Sem mensagens"
              message="Nenhuma mensagem recente neste grupo."
            />
          ) : (
            <div className="space-y-3">
              {recentMessages.map((msg) => {
                const MsgIcon = getMessageIcon(msg.messageType);
                return (
                  <div key={msg.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-secondary/30 transition-colors">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <User className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-medium text-card-foreground truncate">{msg.memberName}</span>
                        <span className="text-xs text-muted-foreground">{formatDateTime(msg.createdAt)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {msg.hasMedia && (
                          <Badge variant="secondary" className="text-xs py-0 px-1.5">
                            <MsgIcon className="h-3 w-3 mr-1" />
                            {translateMessageType(msg.messageType)}
                          </Badge>
                        )}
                        <p className="text-sm text-muted-foreground truncate">
                          {msg.content || `[${translateMessageType(msg.messageType)}]`}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Members Table */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-card-foreground">Pessoas do grupo</h3>
            <button 
              onClick={() => navigate(`/group/${groupId}/members`)}
              className="text-xs text-primary hover:underline"
            >
              Ver todos
            </button>
          </div>
          
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : membersOverview.length === 0 ? (
            <EmptyState 
              icon={Users}
              title="Sem membros"
              message="Nenhum membro neste grupo."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead className="text-right">Mensagens (7d)</TableHead>
                    <TableHead>Última mensagem</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {membersOverview.slice(0, 10).map((member) => (
                    <TableRow key={member.id}>
                      <TableCell className="font-medium">
                        {member.displayName || member.name}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {member.messagesCount}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {member.lastMessageAt ? formatDateTime(member.lastMessageAt) : '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={member.isActive ? "default" : "secondary"}>
                          {member.isActive ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {membersOverview.length > 10 && (
                <p className="text-xs text-muted-foreground text-center mt-3">
                  Mostrando 10 de {membersOverview.length} membros
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
};

export default Group;
