import { CheckCircle, XCircle, AlertCircle, Database, Shield, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface StatusItem {
  label: string;
  status: "connected" | "disconnected" | "warning";
  icon: React.ElementType;
}

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
  const [dbStatus, setDbStatus] = useState<"connected" | "disconnected" | "warning">("disconnected");
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    async function checkConnection() {
      try {
        // Simple health check - try to access auth
        const { error } = await supabase.auth.getSession();
        if (error) {
          setDbStatus("warning");
        } else {
          setDbStatus("connected");
        }
      } catch {
        setDbStatus("disconnected");
      } finally {
        setChecking(false);
      }
    }
    checkConnection();
  }, []);

  const statusItems: StatusItem[] = [
    { label: "Supabase Database", status: dbStatus, icon: Database },
    { label: "Row Level Security", status: dbStatus === "connected" ? "warning" : "disconnected", icon: Shield },
    { label: "Realtime", status: dbStatus, icon: Zap },
  ];

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
                {checking ? (
                  <span className="text-xs text-muted-foreground">Verificando...</span>
                ) : (
                  <>
                    <StatusIcon className={cn("h-4 w-4", config.color)} />
                    <span className={cn("text-xs font-medium", config.color)}>
                      {config.label}
                    </span>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {dbStatus === "connected" && !checking && (
        <div className="mt-4 rounded-lg border border-success/30 bg-success/5 p-3">
          <p className="text-xs text-success">
            ✓ Projeto Supabase conectado: Central de Comando - Bóris
          </p>
        </div>
      )}
      {dbStatus !== "connected" && !checking && (
        <div className="mt-4 rounded-lg border border-warning/30 bg-warning/5 p-3">
          <p className="text-xs text-warning">
            ⚠️ Verifique a conexão com o Supabase.
          </p>
        </div>
      )}
    </div>
  );
}
