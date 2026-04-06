import { AdminLayout } from "@/components/layout/AdminLayout";
import { Database, Shield, Key, CheckCircle, AlertCircle } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useUserRoles } from "@/hooks/use-user-roles";
import AccessDenied from "./AccessDenied";
import { LoadingState } from "@/components/ui/loading-state";
import { AdminPageHeader } from "@/components/layout/AdminPageHeader";
import { Badge } from "@/components/ui/badge";

const Settings = () => {
  const { loading: authLoading } = useAuth();
  const { isSystemAdmin, isLoading: rolesLoading } = useUserRoles();
  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
  const maskedAnonKey = SUPABASE_ANON_KEY ? `${SUPABASE_ANON_KEY.slice(0, 8)}...${SUPABASE_ANON_KEY.slice(-4)}` : "Não configurado";
  const isCorrectProject = !!SUPABASE_URL && SUPABASE_URL.includes("ceugwdfpbvziiumnxknt");

  if (authLoading || rolesLoading) {
    return (
      <AdminLayout title="Configurações" subtitle="Carregando...">
        <LoadingState message="Verificando permissões..." />
      </AdminLayout>
    );
  }
  if (!isSystemAdmin) {
    return <AccessDenied />;
  }

  return (
    <AdminLayout
      title="Configurações"
      subtitle="Configurações do sistema Admin V4"
    >
      <div className="mx-auto max-w-[1480px] space-y-6 animate-fade-in lg:space-y-7">
        <AdminPageHeader
          breadcrumbItems={[{ label: "Central de Comando", href: "/" }, { label: "Configurações" }]}
          title="Configurações"
          description="Parâmetros estruturais e informações de integração do ambiente administrativo do Bóris."
        />

        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="h-7 border-amber-200 bg-amber-50 px-2.5 text-[11px] font-medium text-amber-800">
              Visão de sistema
            </Badge>
            <Badge variant="outline" className="h-7 border-slate-200 bg-slate-50 px-2.5 text-[11px] font-medium text-slate-700">
              Ambiente administrativo
            </Badge>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-100">
              <Database className="h-5 w-5 text-amber-700" />
            </div>
            <div>
              <h3 className="font-semibold tracking-[-0.02em] text-card-foreground">Supabase</h3>
              <p className="text-sm text-muted-foreground">Conexão externa</p>
            </div>
          </div>
          <div className="space-y-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-medium text-muted-foreground mb-1">Project URL</p>
              <p className="text-sm text-card-foreground font-mono">{SUPABASE_URL ?? "Não configurado"}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-medium text-muted-foreground mb-1">Anon Key</p>
              <p className="text-sm text-card-foreground font-mono">{maskedAnonKey}</p>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="flex items-center gap-2">
                {isCorrectProject ? (
                  <CheckCircle className="h-4 w-4 text-success" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-warning" />
                )}
                <p className="text-xs font-medium text-muted-foreground">Projeto alvo</p>
              </div>
              <p className="text-xs font-mono text-card-foreground">ceugwdfpbvziiumnxknt</p>
            </div>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Configure a conexão via integração Supabase do Lovable.
          </p>
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100">
              <Shield className="h-5 w-5 text-success" />
            </div>
            <div>
              <h3 className="font-semibold tracking-[-0.02em] text-card-foreground">Segurança</h3>
              <p className="text-sm text-muted-foreground">Políticas RLS</p>
            </div>
          </div>
          <div className="space-y-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-sm text-card-foreground">
                ✓ Todas as permissões são gerenciadas via RLS no Supabase
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-sm text-card-foreground">
                ✓ O Admin não armazena dados sensíveis localmente
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-sm text-card-foreground">
                ✓ Autenticação gerenciada pelo Supabase Auth
              </p>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-100">
              <Key className="h-5 w-5 text-warning" />
            </div>
            <div>
              <h3 className="font-semibold tracking-[-0.02em] text-card-foreground">Integração de Dados</h3>
              <p className="text-sm text-muted-foreground">Regras de ingestão</p>
            </div>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm text-card-foreground">
              <strong>Importante:</strong> O Admin V4 não realiza ingestão de dados externos. 
              Todos os dados (Groups, Members, Messages) devem ser inseridos diretamente no Supabase 
              através de outros sistemas ou APIs autorizadas.
            </p>
          </div>
        </div>
      </div>
      </div>
    </AdminLayout>
  );
};

export default Settings;
