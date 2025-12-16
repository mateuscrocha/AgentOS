import { AdminLayout } from "@/components/layout/AdminLayout";
import { ShieldX, ArrowLeft, Home } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

interface AccessDeniedProps {
  message?: string;
  showBackButton?: boolean;
}

const AccessDenied = ({ 
  message = "Você não tem permissão para acessar este recurso.",
  showBackButton = true
}: AccessDeniedProps) => {
  const navigate = useNavigate();

  return (
    <AdminLayout title="Acesso Negado" subtitle="403 - Sem permissão">
      <div className="flex flex-col items-center justify-center py-16 animate-fade-in">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10 mb-6">
          <ShieldX className="h-10 w-10 text-destructive" />
        </div>
        
        <h2 className="text-2xl font-semibold text-foreground mb-2">
          Acesso Negado
        </h2>
        
        <p className="text-muted-foreground text-center max-w-md mb-8">
          {message}
        </p>
        
        <div className="flex gap-3">
          {showBackButton && (
            <Button
              variant="outline"
              onClick={() => navigate(-1)}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
          )}
          
          <Button
            onClick={() => navigate('/')}
            className="flex items-center gap-2"
          >
            <Home className="h-4 w-4" />
            Página Inicial
          </Button>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AccessDenied;
