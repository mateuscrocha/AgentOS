import { AdminLayout } from "@/components/layout/AdminLayout";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { useParams } from "react-router-dom";
import { Building2 } from "lucide-react";

const Org = () => {
  const { orgId } = useParams();
  
  return (
    <AdminLayout 
      title="Organização" 
      subtitle={`Detalhes da organização: ${orgId}`}
    >
      <div className="space-y-6 animate-fade-in">
        {/* Page header */}
        <div className="flex items-center gap-3 p-4 rounded-xl border border-border bg-card">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <Building2 className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-card-foreground">Organização: {orgId}</h2>
            <p className="text-sm text-muted-foreground">Grupos e configurações da organização</p>
          </div>
          <div className="px-3 py-1 rounded-full bg-warning/10 text-warning text-xs font-medium">
            Aguardando dados
          </div>
        </div>
        
        {/* Skeleton placeholder */}
        <PageSkeleton variant="detail" />
      </div>
    </AdminLayout>
  );
};

export default Org;
