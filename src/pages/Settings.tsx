import { AdminLayout } from "@/components/layout/AdminLayout";
import { Settings as SettingsIcon, Database, Shield, Key } from "lucide-react";

const Settings = () => {
  return (
    <AdminLayout 
      title="Configurações" 
      subtitle="Configurações do sistema Admin V4"
    >
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Supabase Config */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-card animate-fade-in">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Database className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-card-foreground">Supabase</h3>
              <p className="text-sm text-muted-foreground">Conexão externa</p>
            </div>
          </div>
          <div className="space-y-3">
            <div className="rounded-lg bg-secondary/50 px-4 py-3">
              <p className="text-xs font-medium text-muted-foreground mb-1">Project URL</p>
              <p className="text-sm text-card-foreground font-mono">Não configurado</p>
            </div>
            <div className="rounded-lg bg-secondary/50 px-4 py-3">
              <p className="text-xs font-medium text-muted-foreground mb-1">Anon Key</p>
              <p className="text-sm text-card-foreground font-mono">Não configurado</p>
            </div>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Configure a conexão via integração Supabase do Lovable.
          </p>
        </div>

        {/* Security Info */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-card animate-fade-in">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/10">
              <Shield className="h-5 w-5 text-success" />
            </div>
            <div>
              <h3 className="font-semibold text-card-foreground">Segurança</h3>
              <p className="text-sm text-muted-foreground">Políticas RLS</p>
            </div>
          </div>
          <div className="space-y-3">
            <div className="rounded-lg bg-secondary/50 px-4 py-3">
              <p className="text-sm text-card-foreground">
                ✓ Todas as permissões são gerenciadas via RLS no Supabase
              </p>
            </div>
            <div className="rounded-lg bg-secondary/50 px-4 py-3">
              <p className="text-sm text-card-foreground">
                ✓ O Admin não armazena dados sensíveis localmente
              </p>
            </div>
            <div className="rounded-lg bg-secondary/50 px-4 py-3">
              <p className="text-sm text-card-foreground">
                ✓ Autenticação gerenciada pelo Supabase Auth
              </p>
            </div>
          </div>
        </div>

        {/* API Info */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-card animate-fade-in lg:col-span-2">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-warning/10">
              <Key className="h-5 w-5 text-warning" />
            </div>
            <div>
              <h3 className="font-semibold text-card-foreground">Integração de Dados</h3>
              <p className="text-sm text-muted-foreground">Regras de ingestão</p>
            </div>
          </div>
          <div className="rounded-lg border border-warning/30 bg-warning/5 p-4">
            <p className="text-sm text-card-foreground">
              <strong>Importante:</strong> O Admin V4 não realiza ingestão de dados externos. 
              Todos os dados (Groups, Members, Messages) devem ser inseridos diretamente no Supabase 
              através de outros sistemas ou APIs autorizadas.
            </p>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default Settings;
