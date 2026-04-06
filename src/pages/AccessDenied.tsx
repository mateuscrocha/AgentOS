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
      <div className="mx-auto flex max-w-3xl animate-fade-in flex-col items-center justify-center py-16">
        <div className="w-full rounded-[32px] border border-amber-200/70 bg-white px-6 py-10 text-center shadow-subtle sm:px-10">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-amber-50">
            <ShieldX className="h-10 w-10 text-amber-700" />
          </div>

          <div className="mx-auto max-w-xl space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-700">Acesso restrito</p>
            <h2 className="text-2xl font-semibold tracking-[-0.03em] text-slate-950">Você não pode abrir esta área agora</h2>
            <p className="text-sm leading-6 text-slate-600">
              {message}
            </p>
          </div>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
          {showBackButton && (
            <Button
              variant="outline"
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 rounded-xl border-amber-200 bg-white text-slate-700 hover:bg-amber-50"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
          )}
          
          <Button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 rounded-xl bg-amber-600 text-white hover:bg-amber-700"
          >
            <Home className="h-4 w-4" />
            Página Inicial
          </Button>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AccessDenied;
