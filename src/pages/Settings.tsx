import { AdminLayout } from "@/components/layout/AdminLayout";
import { Database, Shield, Key, CheckCircle, AlertCircle, Eye, EyeOff, RefreshCw } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useUserRoles } from "@/hooks/use-user-roles";
import AccessDenied from "./AccessDenied";
import { LoadingState } from "@/components/ui/loading-state";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { notify } from "@/components/ui/sonner";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { useMemo, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatDateTimeBR } from "@/lib/date";

const Settings = () => {
  const { loading: authLoading } = useAuth();
  const { isSystemAdmin, isLoading: rolesLoading } = useUserRoles();
  const queryClient = useQueryClient();
  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
  const maskedAnonKey = SUPABASE_ANON_KEY ? `${SUPABASE_ANON_KEY.slice(0, 8)}...${SUPABASE_ANON_KEY.slice(-4)}` : "Não configurado";
  const isCorrectProject = !!SUPABASE_URL && SUPABASE_URL.includes("ceugwdfpbvziiumnxknt");

  const [showStripeKey, setShowStripeKey] = useState(true);
  const [newStripeKey, setNewStripeKey] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");

  const stripeKeyFormatOk = useMemo(() => {
    const k = (newStripeKey || "").trim();
    if (!k) return false;
    return /^sk_(live|test)_[0-9A-Za-z]+$/.test(k);
  }, [newStripeKey]);

  const stripeInfoQuery = useQuery({
    queryKey: ["stripe-key-info"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("stripe-key-management", {
        body: { action: "get" },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.message || "Falha ao carregar configuração");
      return data as { has_key: boolean; masked_key: string; updated_at: string | null };
    },
    enabled: isSystemAdmin,
  });

  const stripeAuditQuery = useQuery({
    queryKey: ["stripe-key-audit"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("stripe-key-management", {
        body: { action: "audit" },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.message || "Falha ao carregar auditoria");
      return data as {
        items: Array<{
          id: string;
          created_at: string;
          user_id: string | null;
          user_name: string | null;
          status: "success" | "failed" | null;
          message: string | null;
        }>;
      };
    },
    enabled: isSystemAdmin,
  });

  const updateStripeKeyMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("stripe-key-management", {
        body: { action: "update", newKey: newStripeKey, password: confirmPassword },
      });
      if (!error && data?.success) return data;

      let message = error?.message || data?.message || "Falha ao atualizar chave";
      if (error instanceof FunctionsHttpError && (error as any).context) {
        try {
          const body = await (error as any).context.json();
          if (body?.message) message = body.message;
        } catch (e) {
          void 0;
        }
      }
      throw new Error(message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stripe-key-info"] });
      queryClient.invalidateQueries({ queryKey: ["stripe-key-audit"] });
      notify.success("Chave da Stripe atualizada", "Conectividade verificada com sucesso.");
      setConfirmOpen(false);
      setConfirmPassword("");
      setNewStripeKey("");
    },
    onError: (err: any) => {
      const msg = (err?.message || "").toLowerCase();
      if (msg.includes("senha") || msg.includes("reautent")) {
        notify.error("Senha inválida", "Confirme sua senha para salvar alterações.");
        return;
      }
      if (msg.includes("formato") || msg.includes("inválid")) {
        notify.error("Chave inválida", "Verifique o formato (sk_live_ / sk_test_ + alfanumérico).");
        return;
      }
      if (msg.includes("stripe")) {
        notify.error("Falha ao validar na Stripe", err?.message || "Não foi possível verificar conectividade.");
        return;
      }
      notify.error("Não foi possível concluir", err?.message || "Algo deu errado. Tente novamente.");
    },
  });
  if (authLoading || rolesLoading) {
    return (
      <AdminLayout title="Configurações" subtitle="Carregando...">
        <LoadingState message="Verificando permissões..." />
      </AdminLayout>
    );
  }
  if (!isSystemAdmin) {
    return <AccessDenied />;
  }

  const currentMaskedKey = stripeInfoQuery.data?.masked_key || "Não configurado";
  const currentKeyLabel = showStripeKey ? currentMaskedKey : "••••••••••••••••";
  const stripeUpdatedAt = stripeInfoQuery.data?.updated_at;

  return (
    <AdminLayout 
      title="Configurações" 
      subtitle="Configurações do sistema Admin V4"
    >
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Supabase Config */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-card animate-fade-in">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Database className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-card-foreground">Supabase</h3>
              <p className="text-sm text-muted-foreground">Conexão externa</p>
            </div>
          </div>
          <div className="space-y-3">
            <div className="rounded-lg bg-secondary/50 px-4 py-3">
              <p className="text-xs font-medium text-muted-foreground mb-1">Project URL</p>
              <p className="text-sm text-card-foreground font-mono">{SUPABASE_URL ?? "Não configurado"}</p>
            </div>
            <div className="rounded-lg bg-secondary/50 px-4 py-3">
              <p className="text-xs font-medium text-muted-foreground mb-1">Anon Key</p>
              <p className="text-sm text-card-foreground font-mono">{maskedAnonKey}</p>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/50 px-4 py-3">
              <div className="flex items-center gap-2">
                {isCorrectProject ? (
                  <CheckCircle className="h-4 w-4 text-success" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-warning" />
                )}
                <p className="text-xs font-medium text-muted-foreground">Projeto alvo</p>
              </div>
              <p className="text-xs font-mono text-card-foreground">ceugwdfpbvziiumnxknt</p>
            </div>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Configure a conexão via integração Supabase do Lovable.
          </p>
        </div>

        {/* Security Info */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-card animate-fade-in">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/10">
              <Shield className="h-5 w-5 text-success" />
            </div>
            <div>
              <h3 className="font-semibold text-card-foreground">Segurança</h3>
              <p className="text-sm text-muted-foreground">Políticas RLS</p>
            </div>
          </div>
          <div className="space-y-3">
            <div className="rounded-lg bg-secondary/50 px-4 py-3">
              <p className="text-sm text-card-foreground">
                ✓ Todas as permissões são gerenciadas via RLS no Supabase
              </p>
            </div>
            <div className="rounded-lg bg-secondary/50 px-4 py-3">
              <p className="text-sm text-card-foreground">
                ✓ O Admin não armazena dados sensíveis localmente
              </p>
            </div>
            <div className="rounded-lg bg-secondary/50 px-4 py-3">
              <p className="text-sm text-card-foreground">
                ✓ Autenticação gerenciada pelo Supabase Auth
              </p>
            </div>
          </div>
        </div>

        {/* Stripe Key */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-card animate-fade-in lg:col-span-2">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-warning/10">
              <Key className="h-5 w-5 text-warning" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-card-foreground">Stripe</h3>
              <p className="text-sm text-muted-foreground">Chave secreta e auditoria</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                stripeInfoQuery.refetch();
                stripeAuditQuery.refetch();
              }}
              disabled={stripeInfoQuery.isFetching || stripeAuditQuery.isFetching}
              className="gap-2"
            >
              <RefreshCw className={"h-4 w-4"} />
              Atualizar
            </Button>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg bg-secondary/50 px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Chave atual</p>
                  <p className="text-sm text-card-foreground font-mono break-all">
                    {stripeInfoQuery.isLoading ? "Carregando..." : currentKeyLabel}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {stripeUpdatedAt ? `Atualizada em ${formatDateTimeBR(stripeUpdatedAt)}` : "Ainda não configurada"}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0 gap-2"
                  onClick={() => setShowStripeKey((v) => !v)}
                >
                  {showStripeKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  {showStripeKey ? "Ocultar" : "Mostrar"}
                </Button>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-secondary/20 p-4">
              <p className="text-xs font-medium text-muted-foreground mb-2">Atualizar chave</p>
              <div className="grid gap-2">
                <Input
                  value={newStripeKey}
                  onChange={(e) => setNewStripeKey(e.target.value)}
                  placeholder="sk_live_... ou sk_test_..."
                  type="password"
                />
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">
                    {newStripeKey.trim()
                      ? stripeKeyFormatOk
                        ? "Formato válido"
                        : "Formato inválido"
                      : ""}
                  </p>
                  <Button
                    onClick={() => setConfirmOpen(true)}
                    disabled={!stripeKeyFormatOk || updateStripeKeyMutation.isPending}
                  >
                    Confirmar e salvar
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6">
            <p className="text-sm font-semibold text-card-foreground mb-2">Histórico de alterações</p>
            <div className="rounded-lg border border-border overflow-hidden">
              <div className="grid grid-cols-12 bg-secondary/40 px-4 py-2 text-xs font-medium text-muted-foreground">
                <div className="col-span-4">Data/Hora</div>
                <div className="col-span-4">Usuário</div>
                <div className="col-span-2">Status</div>
                <div className="col-span-2">Detalhe</div>
              </div>
              <div className="divide-y divide-border">
                {stripeAuditQuery.isLoading ? (
                  <div className="px-4 py-3 text-sm text-muted-foreground">Carregando...</div>
                ) : (stripeAuditQuery.data?.items || []).length === 0 ? (
                  <div className="px-4 py-3 text-sm text-muted-foreground">Nenhuma alteração registrada.</div>
                ) : (
                  (stripeAuditQuery.data?.items || []).map((it) => (
                    <div key={it.id} className="grid grid-cols-12 px-4 py-3 text-sm">
                      <div className="col-span-4 text-muted-foreground">{formatDateTimeBR(it.created_at)}</div>
                      <div className="col-span-4 text-card-foreground">{it.user_name || it.user_id || "-"}</div>
                      <div className="col-span-2">
                        <span
                          className={
                            it.status === "success"
                              ? "text-success"
                              : it.status === "failed"
                                ? "text-destructive"
                                : "text-muted-foreground"
                          }
                        >
                          {it.status === "success" ? "Sucesso" : it.status === "failed" ? "Falha" : "-"}
                        </span>
                      </div>
                      <div className="col-span-2 text-muted-foreground truncate">{it.message || "-"}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* API Info */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-card animate-fade-in lg:col-span-2">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-warning/10">
              <Key className="h-5 w-5 text-warning" />
            </div>
            <div>
              <h3 className="font-semibold text-card-foreground">Integração de Dados</h3>
              <p className="text-sm text-muted-foreground">Regras de ingestão</p>
            </div>
          </div>
          <div className="rounded-lg border border-warning/30 bg-warning/5 p-4">
            <p className="text-sm text-card-foreground">
              <strong>Importante:</strong> O Admin V4 não realiza ingestão de dados externos. 
              Todos os dados (Groups, Members, Messages) devem ser inseridos diretamente no Supabase 
              através de outros sistemas ou APIs autorizadas.
            </p>
          </div>
        </div>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={(open) => {
        if (!open) setConfirmPassword("");
        setConfirmOpen(open);
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar atualização da chave</AlertDialogTitle>
            <AlertDialogDescription>
              Para salvar alterações, confirme sua senha. A conectividade com a Stripe será verificada antes de persistir.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid gap-2">
            <Input
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Senha"
              type="password"
              autoComplete="current-password"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={updateStripeKeyMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (!confirmPassword.trim()) {
                  notify.error("Senha obrigatória", "Confirme sua senha para continuar.");
                  return;
                }
                updateStripeKeyMutation.mutate();
              }}
              disabled={updateStripeKeyMutation.isPending}
            >
              {updateStripeKeyMutation.isPending ? "Salvando..." : "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
};

export default Settings;
