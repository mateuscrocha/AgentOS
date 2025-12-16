import { AdminLayout } from "@/components/layout/AdminLayout";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { Layers } from "lucide-react";

const System = () => {
  return (
    <AdminLayout 
      title="Sistema" 
      subtitle="Configurações globais e visão geral do sistema"
    >
      <div className="space-y-6 animate-fade-in">
        {/* Page header */}
        <div className="flex items-center gap-3 p-4 rounded-xl border border-border bg-card">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <Layers className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-card-foreground">Visão do Sistema</h2>
            <p className="text-sm text-muted-foreground">Gerencie organizações, configurações globais e métricas</p>
          </div>
        </div>
        
        {/* Skeleton placeholder */}
        <PageSkeleton variant="cards" />
      </div>
    </AdminLayout>
  );
};

export default System;
