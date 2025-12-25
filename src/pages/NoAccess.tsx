import { AdminLayout } from "@/components/layout/AdminLayout";
import { ShieldAlert, LogOut, HelpCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

const NoAccess = () => {
  const navigate = useNavigate();
  const { signOut, user } = useAuth();

  const handleLogout = async () => {
    await signOut();
    toast.success("Logout realizado com sucesso");
    window.location.assign('/auth');
  };

  return (
    <AdminLayout title="Sem Acesso" subtitle="Configuração necessária">
      <div className="flex flex-col items-center justify-center py-16 animate-fade-in">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-warning/10 mb-6">
          <ShieldAlert className="h-10 w-10 text-warning" />
        </div>
        
        <h2 className="text-2xl font-semibold text-foreground mb-2">
          Sem Acesso Configurado
        </h2>
        
        <p className="text-muted-foreground text-center max-w-md mb-2">
          Sua conta foi criada com sucesso, mas você ainda não tem acesso a nenhuma organização ou grupo.
        </p>
        
        <p className="text-sm text-muted-foreground text-center max-w-md mb-8">
          O acesso ao sistema é concedido através de uma organização. Entre em contato com um administrador para solicitar acesso.
        </p>

        {/* User info card */}
        <div className="rounded-xl border border-border bg-card p-4 mb-6 w-full max-w-sm">
          <p className="text-sm text-muted-foreground mb-1">Logado como:</p>
          <p className="text-sm font-medium text-card-foreground">{user?.email}</p>
        </div>
        
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => navigate('/account')}
            className="flex items-center gap-2"
          >
            <HelpCircle className="h-4 w-4" />
            Minha Conta
          </Button>
          
          <Button
            variant="destructive"
            onClick={handleLogout}
            className="flex items-center gap-2"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </Button>
        </div>
      </div>
    </AdminLayout>
  );
};

export default NoAccess;
