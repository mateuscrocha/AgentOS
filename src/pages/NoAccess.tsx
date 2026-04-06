import { AdminLayout } from "@/components/layout/AdminLayout";
import { ShieldAlert, LogOut, HelpCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { notify } from "@/components/ui/sonner";

const NoAccess = () => {
  const navigate = useNavigate();
  const { signOut, user } = useAuth();

  const handleLogout = async () => {
    await signOut();
    notify.success("Logout realizado", "Até logo!");
    window.location.assign('/auth');
  };

  return (
    <AdminLayout title="Sem Acesso" subtitle="Configuração necessária">
      <div className="mx-auto flex max-w-3xl animate-fade-in flex-col items-center justify-center py-16">
        <div className="w-full rounded-[32px] border border-amber-200/70 bg-white px-6 py-10 text-center shadow-subtle sm:px-10">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-amber-50">
            <ShieldAlert className="h-10 w-10 text-amber-700" />
          </div>

          <div className="mx-auto max-w-xl space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-700">Configuração pendente</p>
            <h2 className="text-2xl font-semibold tracking-[-0.03em] text-slate-950">Sua conta ainda não tem acesso configurado</h2>
            <p className="text-sm leading-6 text-slate-600">
              Sua conta foi criada com sucesso, mas ela ainda não está vinculada a nenhuma organização ou grupo dentro do Bóris.
            </p>
            <p className="text-sm leading-6 text-slate-600">
              O acesso é liberado por uma organização. Entre em contato com um administrador para concluir essa etapa.
            </p>
          </div>

          <div className="mx-auto mt-8 w-full max-w-sm rounded-2xl border border-slate-200 bg-slate-50/80 p-4 text-left">
            <p className="mb-1 text-sm text-slate-500">Logado como</p>
            <p className="text-sm font-medium text-slate-950">{user?.email}</p>
          </div>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button
            variant="outline"
            onClick={() => navigate('/account')}
            className="flex items-center gap-2 rounded-xl border-amber-200 bg-white text-slate-700 hover:bg-amber-50"
          >
            <HelpCircle className="h-4 w-4" />
            Minha Conta
          </Button>
          
          <Button
            onClick={handleLogout}
            className="flex items-center gap-2 rounded-xl bg-amber-600 text-white hover:bg-amber-700"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </Button>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default NoAccess;
