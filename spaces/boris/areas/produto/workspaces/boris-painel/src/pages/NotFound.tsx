import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Button } from "@/components/ui/button";
import { Compass, Home } from "lucide-react";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    void location.pathname;
  }, [location.pathname]);

  return (
    <PublicLayout contentClassName="max-w-2xl">
      <div className="w-full rounded-[32px] border border-amber-200/70 bg-white px-6 py-10 text-center shadow-subtle sm:px-10">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-amber-50">
          <Compass className="h-10 w-10 text-amber-700" />
        </div>

        <div className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-700">404</p>
          <h1 className="text-3xl font-semibold tracking-[-0.04em] text-slate-950">Essa página não existe no painel</h1>
          <p className="mx-auto max-w-xl text-sm leading-6 text-slate-600">
            O endereço <span className="font-medium text-slate-900">{location.pathname}</span> não está disponível ou pode ter sido movido.
          </p>
        </div>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button
            variant="outline"
            onClick={() => navigate(-1)}
            className="rounded-xl border-amber-200 bg-white text-slate-700 hover:bg-amber-50"
          >
            Voltar
          </Button>
          <Button
            onClick={() => navigate("/")}
            className="rounded-xl bg-amber-600 text-white hover:bg-amber-700"
          >
            <Home className="mr-2 h-4 w-4" />
            Ir para o início
          </Button>
        </div>
      </div>
    </PublicLayout>
  );
};

export default NotFound;
