import { useEffect, useMemo, useState } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { useParams, NavLink } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { useUserRoles } from "@/hooks/use-user-roles";
import AccessDenied from "./AccessDenied";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { GroupTabs } from "@/components/group-navigation/GroupTabs";
import { GroupHeader } from "@/components/group-dashboard";

type FeatureKey =
  | "WELCOME_MESSAGE"
  | "SUMMARY_HEADER"
  | "SUMMARY"
  | "SUMMARY_FOOTER"
  | "REPORT"
  | "AUDIO_TRANSCRIPTION";

interface GroupRow {
  id: string;
  name: string;
  description: string | null;
  status: string | null;
  is_archived: boolean | null;
  metadata: Record<string, any> | null;
  organization_id: string;
  invite_link: string | null;
  provider?: string;
  sync_status?: string | null;
}

const FEATURE_LABELS: Record<FeatureKey, { name: string; description: string; hasContent: boolean }> = {
  WELCOME_MESSAGE: {
    name: "Mensagem de boas-vindas",
    description: "Envia uma mensagem quando alguém entra no grupo.",
    hasContent: true,
  },
  SUMMARY_HEADER: {
    name: "Cabeçalho do resumo",
    description: "Texto exibido no topo do resumo.",
    hasContent: true,
  },
  SUMMARY: {
    name: "Resumo",
    description: "Bloco principal de conteúdo do resumo.",
    hasContent: true,
  },
  SUMMARY_FOOTER: {
    name: "Rodapé do resumo",
    description: "Complemento ao final do resumo.",
    hasContent: true,
  },
  REPORT: {
    name: "Relatório",
    description: "Texto de relatório detalhado.",
    hasContent: true,
  },
  AUDIO_TRANSCRIPTION: {
    name: "Transcrição de áudio",
    description: "Converte áudios em texto para consulta.",
    hasContent: false,
  },
};

export default function GroupEdit() {
  const { groupId } = useParams();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { isLoading: rolesLoading, canEditGroup } = useUserRoles();
  const queryClient = useQueryClient();

  const { data: group, isLoading, error, refetch } = useQuery({
    queryKey: ["group-edit", groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("groups")
        .select("id, name, description, status, is_archived, metadata, organization_id, invite_link, provider, sync_status")
        .eq("id", groupId!)
        .maybeSingle();
      if (error) throw error;
      return data as GroupRow;
    },
    enabled: !!groupId && isAuthenticated,
  });

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<"active" | "inactive">("active");
  const [archived, setArchived] = useState(false);

  const metadata = useMemo(() => (group?.metadata ? { ...group.metadata } : {}), [group]);
  const [language, setLanguage] = useState<string>("");
  const [timezone, setTimezone] = useState<string>("");

  const [summaryTime, setSummaryTime] = useState<string>("");
  const [frequency, setFrequency] = useState<string>("");
  const [privacy, setPrivacy] = useState<string>("");
  const [inviteLinkInput, setInviteLinkInput] = useState<string>("");
  const [revalidating, setRevalidating] = useState(false);

  const { data: membersCount } = useQuery({
    queryKey: ["group-members-count", groupId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("members")
        .select("id", { count: "exact" })
        .eq("group_id", groupId!)
        .is("deleted_at", null);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!groupId && isAuthenticated,
  });

  const { data: lastActivityAt } = useQuery({
    queryKey: ["group-last-activity", groupId],
    queryFn: async () => {
      const { data } = await supabase
        .from("messages")
        .select("created_at")
        .eq("group_id", groupId!)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return (data as any)?.created_at || null;
    },
    enabled: !!groupId && isAuthenticated,
  });

  const [featuresState, setFeaturesState] = useState<Record<FeatureKey, { enabled: boolean; content?: string }>>({
    WELCOME_MESSAGE: { enabled: false, content: "" },
    SUMMARY_HEADER: { enabled: false, content: "" },
    SUMMARY: { enabled: false, content: "" },
    SUMMARY_FOOTER: { enabled: false, content: "" },
    REPORT: { enabled: false, content: "" },
    AUDIO_TRANSCRIPTION: { enabled: false },
  });

  useEffect(() => {
    if (!group) return;
    setName(group.name || "");
    setDescription(group.description || "");
    setStatus((group.status as any) === "inactive" ? "inactive" : "active");
    setArchived(!!group.is_archived);

    const m = group.metadata || {};
    setLanguage((m.language as string) || "");
    setTimezone((m.timezone as string) || "");

    const ops = (m.operations || {}) as Record<string, any>;
    setSummaryTime((ops.summary_time as string) || "");
    setFrequency((ops.frequency as string) || "");
    setPrivacy((ops.privacy as string) || "");

    const feats = (m.features || {}) as Record<string, any>;
    const next = (Object.keys(FEATURE_LABELS) as FeatureKey[]).reduce((acc, key) => {
      const cfg = feats[key] || {};
      acc[key] = { enabled: !!cfg.enabled, content: cfg.content || "" };
      return acc;
    }, {} as Record<FeatureKey, { enabled: boolean; content?: string }>);
    setFeaturesState(next);
    setInviteLinkInput(group.invite_link || "");
  }, [group]);

  const updateGroupMutation = useMutation({
    mutationFn: async () => {
      const nextMeta = {
        ...(group?.metadata || {}),
        language: language || null,
        timezone: timezone || null,
        operations: {
          ...((group?.metadata?.operations as any) || {}),
          summary_time: summaryTime || null,
          frequency: frequency || null,
          privacy: privacy || null,
        },
        features: {
          ...((group?.metadata?.features as any) || {}),
          ...Object.fromEntries(
            (Object.keys(FEATURE_LABELS) as FeatureKey[]).map((k) => [
              k,
              {
                enabled: !!featuresState[k]?.enabled,
                content: featuresState[k]?.content || null,
              },
            ])
          ),
        },
      };

      const { error } = await supabase
        .from("groups")
        .update({
          name: name.trim(),
          description: description.trim() || null,
          status,
          is_archived: archived,
          metadata: nextMeta,
        })
        .eq("id", groupId!);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Configurações salvas");
      await refetch();
      queryClient.invalidateQueries({ queryKey: ["group-edit"] });
    },
    onError: (err: any) => {
      toast.error(err?.message || "Falha ao salvar");
    },
  });

  const updateFeatureContent = useMutation({
    mutationFn: async (key: FeatureKey) => {
      const nextMeta = {
        ...(group?.metadata || {}),
        features: {
          ...((group?.metadata?.features as any) || {}),
          [key]: {
            enabled: !!featuresState[key]?.enabled,
            content: featuresState[key]?.content || null,
          },
        },
      };
      const { error } = await supabase
        .from("groups")
        .update({ metadata: nextMeta })
        .eq("id", groupId!);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Conteúdo salvo");
      await refetch();
    },
    onError: (err: any) => toast.error(err?.message || "Erro ao salvar conteúdo"),
  });

  const updateStatusOnly = useMutation({
    mutationFn: async (newStatus: "active" | "inactive") => {
      const { error } = await supabase.from("groups").update({ status: newStatus }).eq("id", groupId!);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Status atualizado");
      await refetch();
    },
    onError: (err: any) => toast.error(err?.message || "Erro ao atualizar status"),
  });

  const updateInviteMutation = useMutation({
    mutationFn: async () => {
      const v = inviteLinkInput.trim();
      const value = v.length ? v : null;
      const { error } = await supabase
        .from("groups")
        .update({ invite_link: value })
        .eq("id", groupId!);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Link de convite atualizado");
      await refetch();
    },
    onError: (err: any) => toast.error(err?.message || "Erro ao atualizar link de convite"),
  });

  const normalizePhoneE164 = (phone: string): string => {
    const digits = phone.replace(/\D/g, "");
    if (!phone.startsWith("+")) {
      if (digits.startsWith("55") && digits.length > 11) {
        return "+" + digits;
      }
      return "+55" + digits;
    }
    return "+" + digits;
  };

  const handleRevalidateGroup = async () => {
    const val = inviteLinkInput.trim() || group.invite_link || "";
    if (!val) {
      toast.error("Configure o link de convite do grupo para revalidar");
      return;
    }
    setRevalidating(true);
    try {
      const response = await supabase.functions.invoke("validate-whatsapp-group", {
        body: { invite_link: val },
      });
      if (response.error) {
        throw new Error(response.error.message || "Erro ao validar grupo");
      }
      const data = response.data as any;
      if (!data?.is_valid || !data?.is_boris_in_group) {
        toast.error("Não foi possível validar o grupo agora");
        return;
      }
      const participants = Array.isArray(data.participants) ? data.participants : [];
      const adminProviderIds = participants
        .filter((p: any) => p.is_admin)
        .map((p: any) => p.provider_member_id)
        .filter(Boolean);
      const superAdminProviderIds = participants
        .filter((p: any) => p.is_super_admin)
        .map((p: any) => p.provider_member_id)
        .filter(Boolean);
      const adminPhones = participants
        .filter((p: any) => p.is_admin)
        .map((p: any) => normalizePhoneE164(p.phone))
        .filter(Boolean);
      const superAdminPhones = participants
        .filter((p: any) => p.is_super_admin)
        .map((p: any) => normalizePhoneE164(p.phone))
        .filter(Boolean);

      await supabase
        .from("members")
        .update({ is_admin: false, is_super_admin: false })
        .eq("group_id", group.id)
        .is("deleted_at", null);

      if (adminProviderIds.length > 0) {
        await supabase
          .from("members")
          .update({ is_admin: true })
          .eq("group_id", group.id)
          .is("deleted_at", null)
          .in("provider_member_id", adminProviderIds);
      }
      if (adminPhones.length > 0) {
        await supabase
          .from("members")
          .update({ is_admin: true })
          .eq("group_id", group.id)
          .is("deleted_at", null)
          .in("phone_e164", adminPhones);
      }
      if (superAdminProviderIds.length > 0) {
        await supabase
          .from("members")
          .update({ is_super_admin: true })
          .eq("group_id", group.id)
          .is("deleted_at", null)
          .in("provider_member_id", superAdminProviderIds);
      }
      if (superAdminPhones.length > 0) {
        await supabase
          .from("members")
          .update({ is_super_admin: true })
          .eq("group_id", group.id)
          .is("deleted_at", null)
          .in("phone_e164", superAdminPhones);
      }

      toast.success("Admins atualizados");
      await refetch();
      queryClient.invalidateQueries({ queryKey: ["group-dashboard-admins"] });
      queryClient.invalidateQueries({ queryKey: ["group-dashboard-previous-admins"] });
      queryClient.invalidateQueries({ queryKey: ["group-members"] });
    } catch (e: any) {
      toast.error(e.message || "Erro ao revalidar o grupo");
    } finally {
      setRevalidating(false);
    }
  };

  const deleteGroupMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("groups").update({ is_archived: true }).eq("id", groupId!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Grupo arquivado");
    },
    onError: (err: any) => toast.error(err?.message || "Erro ao arquivar grupo"),
  });

  const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  if (authLoading || rolesLoading) {
    return (
      <AdminLayout title="Editar grupo" subtitle="Verificando acesso...">
        <LoadingState message="Verificando permissões..." />
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout title="Editar grupo" subtitle="Erro">
        <ErrorState title="Falha ao carregar" message="Não foi possível carregar o grupo." retry={() => refetch()} />
      </AdminLayout>
    );
  }

  if (!group) {
    return (
      <AdminLayout title="Editar grupo" subtitle="Carregando...">
        <LoadingState message="Carregando dados do grupo..." />
      </AdminLayout>
    );
  }

  if (!canEditGroup(group.id, group.organization_id)) {
    return <AccessDenied message="Você não tem permissão para editar este grupo." />;
  }

  const breadcrumbItems = [
    { label: "Central de Comando", href: "/" },
    { label: "Grupos", href: "/system/groups" },
    { label: group.name, href: `/groups/${group.id}` },
    { label: "Editar" },
  ];

  return (
    <AdminLayout title="Editar grupo" subtitle="Ajuste as configurações e recursos deste grupo.">
      <div className="space-y-6 animate-fade-in">
        <Breadcrumbs items={breadcrumbItems} />
        {group && (
          <>
            <GroupHeader
              groupId={group.id}
              name={group.name}
              provider={group.provider || ""}
              totalMembers={membersCount || 0}
              lastMessageAt={lastActivityAt || null}
              syncStatus={group.sync_status || null}
            />
            <GroupTabs groupId={group.id} activeTab="configuracoes" />
          </>
        )}

        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Informações do grupo</h3>
              <p className="text-sm text-muted-foreground">Edite os dados básicos do grupo.</p>
            </div>
            <div className="flex items-center gap-2">
              <NavLink
                to={`/groups/${group.id}`}
                className={cn("inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground")}
              >
                Voltar ao grupo
              </NavLink>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="text-sm font-medium">Nome do grupo</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome" />
            </div>
            <div>
              <label className="text-sm font-medium">Status</label>
              <Select value={status} onValueChange={(v) => setStatus(v as any)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Ativo</SelectItem>
                  <SelectItem value="inactive">Pausado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-medium">Descrição</label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descrição do grupo" />
            </div>
            <div>
              <label className="text-sm font-medium">Idioma</label>
              <Input value={language} onChange={(e) => setLanguage(e.target.value)} placeholder="pt-BR" />
            </div>
            <div>
              <label className="text-sm font-medium">Timezone</label>
              <Input value={timezone} onChange={(e) => setTimezone(e.target.value)} placeholder="America/Sao_Paulo" />
            </div>
            <div>
              <label className="text-sm font-medium">Arquivar grupo</label>
              <div className="flex items-center gap-3 mt-1">
                <Switch checked={archived} onCheckedChange={setArchived} />
                <span className="text-sm text-muted-foreground">Marca como arquivado</span>
              </div>
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <Button onClick={() => updateGroupMutation.mutate()} disabled={updateGroupMutation.isPending}>
              Salvar alterações
            </Button>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold">Configurações operacionais</h3>
          <p className="text-sm text-muted-foreground">Defina parâmetros de operação.</p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <div>
              <label className="text-sm font-medium">Horário do resumo</label>
              <Input value={summaryTime} onChange={(e) => setSummaryTime(e.target.value)} placeholder="08:00" />
            </div>
            <div>
              <label className="text-sm font-medium">Frequência</label>
              <Input value={frequency} onChange={(e) => setFrequency(e.target.value)} placeholder="diária / semanal" />
            </div>
            <div>
              <label className="text-sm font-medium">Privacidade</label>
              <Input value={privacy} onChange={(e) => setPrivacy(e.target.value)} placeholder="pública / privada" />
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <Button onClick={() => updateGroupMutation.mutate()} disabled={updateGroupMutation.isPending}>
              Salvar configurações
            </Button>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold">Conexão do WhatsApp</h3>
          <p className="text-sm text-muted-foreground">Edite o link de convite e revalide a conexão do grupo.</p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <div className="md:col-span-2">
              <label className="text-sm font-medium">Link de convite</label>
              <Input
                value={inviteLinkInput}
                onChange={(e) => setInviteLinkInput(e.target.value)}
                placeholder="https://chat.whatsapp.com/…"
              />
            </div>
            <div className="flex items-end">
              <Button variant="secondary" onClick={() => updateInviteMutation.mutate()} disabled={updateInviteMutation.isPending}>
                Salvar link
              </Button>
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <Button onClick={handleRevalidateGroup} disabled={revalidating}>
              Revalidar grupo
            </Button>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold">Features do grupo</h3>
          <p className="text-sm text-muted-foreground">Ative ou ajuste os recursos disponíveis.</p>

          <div className="space-y-4 mt-4">
            {(Object.keys(FEATURE_LABELS) as FeatureKey[]).map((key) => {
              const info = FEATURE_LABELS[key];
              const state = featuresState[key];
              return (
                <div key={key} className="rounded-lg border border-border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{info.name}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-secondary/40 text-muted-foreground">{key}</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{info.description}</p>
                    </div>
                    <Switch
                      checked={!!state?.enabled}
                      onCheckedChange={(v) => setFeaturesState((prev) => ({ ...prev, [key]: { ...prev[key], enabled: v } }))}
                    />
                  </div>

                  {info.hasContent && state?.enabled && (
                    <div className="mt-3 space-y-2">
                      <label className="text-sm font-medium">Conteúdo</label>
                      <Textarea
                        value={state?.content || ""}
                        onChange={(e) => setFeaturesState((prev) => ({ ...prev, [key]: { ...prev[key], content: e.target.value } }))}
                        placeholder="Digite o conteúdo (placeholders permitidos)"
                      />
                      <div className="flex gap-2">
                        <Button variant="secondary" onClick={() => updateFeatureContent.mutate(key)} disabled={updateFeatureContent.isPending}>
                          Salvar conteúdo
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-4">
            <Button onClick={() => updateGroupMutation.mutate()} disabled={updateGroupMutation.isPending}>
              Salvar todas as features
            </Button>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold">Templates / textos</h3>
          <p className="text-sm text-muted-foreground">Edite conteúdos prontos para envio.</p>

          <div className="grid grid-cols-1 gap-4 mt-4">
            {(["WELCOME_MESSAGE", "SUMMARY_HEADER", "SUMMARY", "SUMMARY_FOOTER", "REPORT"] as FeatureKey[]).map((key) => (
              <div key={`tpl-${key}`} className="rounded-lg border border-border p-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{FEATURE_LABELS[key].name}</span>
                  <span className="text-xs text-muted-foreground">{FEATURE_LABELS[key].description}</span>
                </div>
                <Textarea
                  className="mt-2"
                  value={featuresState[key]?.content || ""}
                  onChange={(e) => setFeaturesState((prev) => ({ ...prev, [key]: { ...prev[key], content: e.target.value } }))}
                  placeholder="Texto..."
                />
                <div className="mt-2">
                  <Button variant="secondary" onClick={() => updateFeatureContent.mutate(key)} disabled={updateFeatureContent.isPending}>
                    Salvar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold">Ações avançadas</h3>
          <p className="text-sm text-muted-foreground">Somente para administradores com permissão.</p>

          <div className="mt-4 flex flex-wrap gap-3">
            <Button
              variant="secondary"
              onClick={() => updateStatusOnly.mutate(status === "active" ? "inactive" : "active")}
            >
              {status === "active" ? "Desativar grupo" : "Reativar grupo"}
            </Button>

            <Button variant="destructive" className="inline-flex items-center gap-2" onClick={() => setConfirmRemoveOpen(true)}>
              <Trash2 className="h-4 w-4" />
              Arquivar grupo
            </Button>
          </div>

          <AlertDialog open={confirmRemoveOpen} onOpenChange={setConfirmRemoveOpen}>
            <AlertDialogContent className="bg-card border-border">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-card-foreground">Arquivar grupo</AlertDialogTitle>
                <AlertDialogDescription className="text-muted-foreground">
                  O grupo será arquivado e deixará de aparecer nas listas. Digite <span className="font-semibold">ARQUIVAR</span> para confirmar.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="mt-2">
                <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="ARQUIVAR" />
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  disabled={deleteGroupMutation.isPending || confirmText.trim().toUpperCase() !== "ARQUIVAR"}
                  onClick={() => deleteGroupMutation.mutate()}
                >
                  Confirmar arquivamento
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </AdminLayout>
  );
}
