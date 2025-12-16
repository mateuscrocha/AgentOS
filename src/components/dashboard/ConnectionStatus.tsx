import { CheckCircle, XCircle, AlertCircle, Database, Shield, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatusItem {
  label: string;
  status: "connected" | "disconnected" | "warning";
  icon: React.ElementType;
}

const statusItems: StatusItem[] = [
  { label: "Supabase Database", status: "disconnected", icon: Database },
  { label: "Row Level Security", status: "disconnected", icon: Shield },
  { label: "Realtime", status: "disconnected", icon: Zap },
];

const statusConfig = {
  connected: {
    icon: CheckCircle,
    color: "text-success",
    bg: "bg-success/10",
    label: "Conectado",
  },
  disconnected: {
    icon: XCircle,
    color: "text-destructive",
    bg: "bg-destructive/10",
    label: "Desconectado",
  },
  warning: {
    icon: AlertCircle,
    color: "text-warning",
    bg: "bg-warning/10",
    label: "Atenção",
  },
};

export function ConnectionStatus() {
  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-card animate-fade-in">
      <h3 className="text-sm font-semibold text-card-foreground mb-4">Status da Conexão</h3>
      <div className="space-y-3">
        {statusItems.map((item) => {
          const config = statusConfig[item.status];
          const StatusIcon = config.icon;
          return (
            <div
              key={item.label}
              className="flex items-center justify-between rounded-lg bg-secondary/50 px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <item.icon className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm font-medium text-card-foreground">
                  {item.label}
                </span>
              </div>
              <div className={cn("flex items-center gap-2 rounded-full px-2.5 py-1", config.bg)}>
                <StatusIcon className={cn("h-4 w-4", config.color)} />
                <span className={cn("text-xs font-medium", config.color)}>
                  {config.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-4 rounded-lg border border-warning/30 bg-warning/5 p-3">
        <p className="text-xs text-warning">
          ⚠️ Conecte seu projeto Supabase externo para habilitar todas as funcionalidades.
        </p>
      </div>
    </div>
  );
}
