import { AdminLayout } from "@/components/layout/AdminLayout";
import { Users, AlertCircle } from "lucide-react";

const Groups = () => {
  return (
    <AdminLayout 
      title="Groups" 
      subtitle="Gerenciamento de grupos do sistema"
    >
      <div className="flex flex-col items-center justify-center min-h-[400px] rounded-xl border border-border bg-card p-8 animate-fade-in">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mb-4">
          <Users className="h-8 w-8 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-semibold text-card-foreground mb-2">
          Aguardando Conexão Supabase
        </h2>
        <p className="text-center text-muted-foreground max-w-md mb-4">
          Conecte seu projeto Supabase externo para visualizar e gerenciar os grupos.
          Os dados serão carregados diretamente do seu banco de dados.
        </p>
        <div className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/5 px-4 py-2">
          <AlertCircle className="h-4 w-4 text-warning" />
          <span className="text-sm text-warning">Conexão necessária</span>
        </div>
      </div>
    </AdminLayout>
  );
};

export default Groups;
