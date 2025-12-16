import { AdminLayout } from "@/components/layout/AdminLayout";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { ConnectionStatus } from "@/components/dashboard/ConnectionStatus";
import { RulesCard } from "@/components/dashboard/RulesCard";
import { Users, MessageSquare, Activity, TrendingUp } from "lucide-react";

const Index = () => {
  return (
    <AdminLayout 
      title="Dashboard" 
      subtitle="Bóris Admin V4 - Visão geral do sistema"
    >
      {/* Stats Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-6">
        <StatsCard
          title="Total de Groups"
          value="—"
          description="Aguardando conexão"
          icon={Users}
        />
        <StatsCard
          title="Total de Members"
          value="—"
          description="Aguardando conexão"
          icon={Users}
        />
        <StatsCard
          title="Total de Messages"
          value="—"
          description="Aguardando conexão"
          icon={MessageSquare}
        />
        <StatsCard
          title="Atividade"
          value="—"
          description="Aguardando conexão"
          icon={Activity}
        />
      </div>

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ConnectionStatus />
        <RulesCard />
      </div>

      {/* Info Banner */}
      <div className="mt-6 rounded-xl border border-primary/20 bg-primary/5 p-6 animate-fade-in">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <TrendingUp className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Próximos Passos</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Para habilitar todas as funcionalidades do Admin V4, conecte seu projeto Supabase externo. 
              O sistema utilizará exclusivamente as tabelas e políticas RLS configuradas no seu Supabase.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="inline-flex items-center rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
                Groups
              </span>
              <span className="inline-flex items-center rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
                Members
              </span>
              <span className="inline-flex items-center rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
                Messages
              </span>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default Index;
