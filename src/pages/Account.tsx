import { AdminLayout } from "@/components/layout/AdminLayout";
import { LoadingState } from "@/components/ui/loading-state";
import { useAuth } from "@/hooks/use-auth";
import { UserCircle, Mail, Shield, Key, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

const Account = () => {
  const { user, loading, signOut, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogout = async () => {
    await signOut();
    toast({
      title: "Logout realizado",
      description: "Você foi desconectado com sucesso.",
    });
    navigate('/auth');
  };

  if (loading) {
    return (
      <AdminLayout title="Minha Conta" subtitle="Carregando...">
        <LoadingState message="Carregando dados do usuário..." />
      </AdminLayout>
    );
  }

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
            <h2 className="text-xl font-semibold text-card-foreground">
              {user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Usuário'}
            </h2>
            <p className="text-sm text-muted-foreground">{user?.email || 'Não autenticado'}</p>
            <div className="flex gap-2 mt-2">
              {isAuthenticated ? (
                <>
                  <span className="px-2 py-0.5 rounded-full bg-success/10 text-success text-xs font-medium">
                    Autenticado
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
                    Admin
                  </span>
                </>
              ) : (
                <span className="px-2 py-0.5 rounded-full bg-warning/10 text-warning text-xs font-medium">
                  Não autenticado
                </span>
              )}
            </div>
          </div>
          {isAuthenticated ? (
            <button 
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-destructive/10 text-destructive text-sm font-medium hover:bg-destructive/20 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          ) : (
            <button 
              onClick={() => navigate('/auth')}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Fazer Login
            </button>
          )}
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
                <span className="text-muted-foreground">ID</span>
                <span className="text-card-foreground font-mono text-xs">
                  {user?.id ? user.id.slice(0, 8) + '...' : '-'}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-muted-foreground">Email</span>
                <span className="text-card-foreground">{user?.email || '-'}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-muted-foreground">Nome</span>
                <span className="text-card-foreground">
                  {user?.user_metadata?.full_name || '-'}
                </span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-muted-foreground">Criado em</span>
                <span className="text-card-foreground">
                  {user?.created_at ? new Date(user.created_at).toLocaleDateString('pt-BR') : '-'}
                </span>
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
                <span className="text-muted-foreground">Provider</span>
                <span className="text-card-foreground capitalize">
                  {user?.app_metadata?.provider || 'email'}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-muted-foreground">Email verificado</span>
                <span className={user?.email_confirmed_at ? 'text-success' : 'text-warning'}>
                  {user?.email_confirmed_at ? 'Sim' : 'Não'}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-muted-foreground">Último login</span>
                <span className="text-card-foreground">
                  {user?.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString('pt-BR') : '-'}
                </span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-muted-foreground">Role</span>
                <span className="text-card-foreground">
                  {user?.role || 'authenticated'}
                </span>
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
            <button 
              disabled
              className="px-3 py-1.5 rounded-lg bg-primary/50 text-primary-foreground text-sm font-medium cursor-not-allowed"
            >
              Nova Key
            </button>
          </div>
          <p className="text-sm text-muted-foreground">
            Funcionalidade de API Keys será implementada em breve.
          </p>
        </div>
      </div>
    </AdminLayout>
  );
};

export default Account;
