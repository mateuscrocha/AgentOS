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

  const overviewTiles = [
    {
      label: "Base monitorada",
      value: overview.totalGroups.toLocaleString("pt-BR"),
      detail: "grupos conectados",
    },
    {
      label: "Sync ativo",
      value: overview.activeGroups.toLocaleString("pt-BR"),
      detail: "com status ativo",
    },
    {
      label: "Pendentes + erros",
      value: (overview.pendingGroups + overview.errorGroups).toLocaleString("pt-BR"),
      detail: "pedindo atenção",
    },
  ];

  return (
    <div className="overflow-hidden rounded-[32px] border border-border/80 bg-card/95 shadow-card animate-fade-in">
      <div className="bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.12),transparent_36%),linear-gradient(135deg,hsl(var(--secondary)/0.3),transparent_72%)] px-6 py-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-2xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Status de sincronização</p>
            <h3 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-card-foreground sm:text-2xl">
              Saúde operacional da ingestão e do sync dos grupos
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Use este bloco para descobrir rápido se o sistema está capturando sinais com cobertura suficiente ou se há filas pedindo intervenção.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[480px]">
            {overviewTiles.map((tile) => (
              <div key={tile.label} className="rounded-2xl border border-border/70 bg-background/85 p-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{tile.label}</div>
                <div className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-card-foreground">{tile.value}</div>
                <div className="mt-1 text-xs text-muted-foreground">{tile.detail}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-3 border-t border-border/70 p-5 sm:p-6 xl:grid-cols-2">
        {statusItems.map((item) => {
          const config = statusConfig[item.status];
          const StatusIcon = config.icon;
          return (
            <div
              key={item.label}
              className="flex items-center justify-between rounded-2xl border border-border/70 bg-background/80 px-4 py-4"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-border/70 bg-card shadow-subtle">
                  <item.icon className="h-4.5 w-4.5 text-muted-foreground" />
                </div>
                <div>
                  <span className="text-sm font-semibold text-card-foreground">
                    {item.label}
                  </span>
                  <p className="mt-1 text-xs text-muted-foreground">{item.detail}</p>
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

      <div className="px-5 pb-5 sm:px-6 sm:pb-6">
        <div className={cn("rounded-2xl border p-4", summaryClassName)}>
          <p className="text-sm font-medium">{summaryText}</p>
        </div>
      </div>
    </div>
  );
}
