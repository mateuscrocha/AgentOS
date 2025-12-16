import { AdminLayout } from "@/components/layout/AdminLayout";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { UserCircle, Mail, Shield, Key } from "lucide-react";

const Account = () => {
  return (
    <AdminLayout 
      title="Minha Conta" 
      subtitle="Gerencie suas informações pessoais e segurança"
    >
      <div className="space-y-6 animate-fade-in">
        {/* Profile header */}
        <div className="flex items-center gap-4 p-6 rounded-xl border border-border bg-card">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10">
            <UserCircle className="h-10 w-10 text-primary" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-card-foreground">Usuário Administrador</h2>
            <p className="text-sm text-muted-foreground">admin@example.com</p>
            <div className="flex gap-2 mt-2">
              <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
                Admin
              </span>
              <span className="px-2 py-0.5 rounded-full bg-success/10 text-success text-xs font-medium">
                Verificado
              </span>
            </div>
          </div>
          <button className="px-4 py-2 rounded-lg bg-secondary text-secondary-foreground text-sm font-medium hover:bg-secondary/80 transition-colors">
            Editar Perfil
          </button>
        </div>
        
        {/* Account sections */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Personal info */}
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-center gap-2 mb-4">
              <Mail className="h-5 w-5 text-muted-foreground" />
              <h3 className="font-semibold text-card-foreground">Informações Pessoais</h3>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-muted-foreground">Nome</span>
                <span className="text-card-foreground">Aguardando autenticação</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-muted-foreground">Email</span>
                <span className="text-card-foreground">-</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-muted-foreground">Telefone</span>
                <span className="text-card-foreground">-</span>
              </div>
            </div>
          </div>
          
          {/* Security */}
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-center gap-2 mb-4">
              <Shield className="h-5 w-5 text-muted-foreground" />
              <h3 className="font-semibold text-card-foreground">Segurança</h3>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-muted-foreground">Senha</span>
                <button className="text-primary hover:underline">Alterar</button>
              </div>
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-muted-foreground">2FA</span>
                <span className="text-warning">Desativado</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-muted-foreground">Sessões</span>
                <span className="text-card-foreground">1 ativa</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* API Keys section placeholder */}
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Key className="h-5 w-5 text-muted-foreground" />
              <h3 className="font-semibold text-card-foreground">API Keys</h3>
            </div>
            <button className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
              Nova Key
            </button>
          </div>
          <p className="text-sm text-muted-foreground">
            Nenhuma API key configurada. Crie uma para integrar com sistemas externos.
          </p>
        </div>
      </div>
    </AdminLayout>
  );
};

export default Account;
