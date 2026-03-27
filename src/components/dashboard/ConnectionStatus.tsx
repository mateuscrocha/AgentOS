import { useQuery } from "@tanstack/react-query";
import { AlertCircle, CheckCircle, Database, RefreshCcw, TriangleAlert, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

interface StatusItem {
  label: string;
  status: "connected" | "disconnected" | "warning";
  icon: React.ElementType;
  detail: string;
}

type SyncOverview = {
  dbStatus: "connected" | "disconnected" | "warning";
  totalGroups: number;
  activeGroups: number;
  pendingGroups: number;
  errorGroups: number;
  synced24h: number;
};

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

const FALLBACK_OVERVIEW: SyncOverview = {
  dbStatus: "disconnected",
  totalGroups: 0,
  activeGroups: 0,
  pendingGroups: 0,
  errorGroups: 0,
  synced24h: 0,
};

export function ConnectionStatus() {
  const { data, isLoading } = useQuery({
    queryKey: ["connection-status-overview"],
    queryFn: async (): Promise<SyncOverview> => {
      try {
        const { error: sessionError } = await supabase.auth.getSession();
        const dbStatus = sessionError ? "warning" : "connected";

        const { data: groups, error: groupsError } = await supabase
          .from("groups")
          .select("id, sync_status, last_sync_at, sync_error")
          .is("deleted_at", null);

        if (groupsError) throw groupsError;

        const rows = groups ?? [];
        const now = Date.now();
        const dayMs = 24 * 60 * 60 * 1000;

        const synced24h = rows.filter((row) => {
          if (!row.last_sync_at) return false;
          const lastSyncMs = new Date(row.last_sync_at).getTime();
          return Number.isFinite(lastSyncMs) && now - lastSyncMs <= dayMs;
        }).length;

        const activeGroups = rows.filter((row) => row.sync_status === "active").length;
        const errorGroups = rows.filter((row) => row.sync_status === "error" || !!String(row.sync_error ?? "").trim()).length;
        const pendingGroups = rows.length - activeGroups - errorGroups;

        return {
          dbStatus,
          totalGroups: rows.length,
          activeGroups,
          pendingGroups,
          errorGroups,
          synced24h,
        };
      } catch {
        return FALLBACK_OVERVIEW;
      }
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const overview = data ?? FALLBACK_OVERVIEW;
  const checking = isLoading && !data;

  const ingestionStatus: StatusItem["status"] =
    overview.dbStatus === "disconnected"
      ? "disconnected"
      : overview.errorGroups > 0
        ? "disconnected"
        : overview.synced24h > 0
          ? "connected"
          : "warning";

  const coverageStatus: StatusItem["status"] =
    overview.dbStatus === "disconnected"
      ? "disconnected"
      : overview.pendingGroups > 0
        ? "warning"
        : "connected";

  const failuresStatus: StatusItem["status"] =
    overview.dbStatus === "disconnected"
      ? "disconnected"
      : overview.errorGroups > 0
        ? "disconnected"
        : "connected";

  const statusItems: StatusItem[] = [
    {
      label: "Supabase",
      status: overview.dbStatus,
      icon: Database,
      detail: overview.dbStatus === "connected" ? "Base acessível" : "Verificar conexão",
    },
    {
      label: "Ingestão 24h",
      status: ingestionStatus,
      icon: RefreshCcw,
      detail: `${overview.synced24h} grupo(s) tocaram sync nas últimas 24h`,
    },
    {
      label: "Cobertura de Sync",
      status: coverageStatus,
      icon: TriangleAlert,
      detail: `${overview.activeGroups}/${overview.totalGroups} grupo(s) com status ativo`,
    },
    {
      label: "Falhas Registradas",
      status: failuresStatus,
      icon: XCircle,
      detail: overview.errorGroups > 0 ? `${overview.errorGroups} grupo(s) com erro` : "Nenhum erro salvo",
    },
  ];

  const summaryClassName =
    overview.dbStatus === "disconnected"
      ? "border-warning/30 bg-warning/5 text-warning"
      : overview.errorGroups > 0 || overview.pendingGroups > 0
        ? "border-warning/30 bg-warning/5 text-warning"
        : "border-success/30 bg-success/5 text-success";

  const summaryText =
    overview.dbStatus === "disconnected"
      ? "Nao foi possivel validar a saude da sincronizacao agora."
      : overview.errorGroups > 0
        ? `${overview.errorGroups} grupo(s) com falha registrada e ${overview.pendingGroups} pendente(s).`
        : overview.pendingGroups > 0
          ? `${overview.pendingGroups} grupo(s) ainda pendente(s) de sincronizacao.`
          : "Todos os grupos monitorados estao com sync ativo.";

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-card animate-fade-in">
      <h3 className="mb-1 text-sm font-semibold text-card-foreground">Status da Sincronizacao</h3>
      <p className="mb-4 text-xs text-muted-foreground">
        Saude operacional da ingestao e do status de sync dos grupos.
      </p>
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
                <div>
                  <span className="text-sm font-medium text-card-foreground">
                    {item.label}
                  </span>
                  <p className="text-xs text-muted-foreground">{item.detail}</p>
                </div>
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
      <div className={cn("mt-4 rounded-lg border p-3", summaryClassName)}>
        <p className="text-xs">{summaryText}</p>
      </div>
    </div>
  );
}
