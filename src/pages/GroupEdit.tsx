import { useEffect, useMemo, useRef, useState } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { GroupPageTop } from "@/components/group-navigation/GroupPageTop";
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
import { StatusTag } from "@/components/ui/status-tag";
import { NavLink, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { useUserRoles } from "@/hooks/use-user-roles";
import AccessDenied from "./AccessDenied";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { notify } from "@/components/ui/sonner";
import { AlertTriangle, CheckCircle2, Trash2, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";

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
    name: "Boas-vindas para novos participantes",
    description: "Envia uma mensagem quando alguém entra no grupo.",
    hasContent: true,
  },
  SUMMARY_HEADER: {
    name: "Início do resumo diário",
    description: "Texto que aparece antes do resumo.",
    hasContent: true,
  },
  SUMMARY: {
    name: "Resumo diário",
    description: "Mensagem principal com o resumo do dia.",
    hasContent: true,
  },
  SUMMARY_FOOTER: {
    name: "Final do resumo diário",
    description: "Texto que aparece no final do resumo.",
    hasContent: true,
  },
  REPORT: {
    name: "Relatório detalhado",
    description: "Texto mais completo para análises e relatórios.",
    hasContent: true,
  },
  AUDIO_TRANSCRIPTION: {
    name: "Áudio em texto",
    description: "Converte áudios em texto para facilitar a consulta.",
    hasContent: false,
  },
};

type SpecialMember = {
  id: string;
  name: string;
  display_name: string | null;
  phone_e164: string | null;
  profile_pic_url: string | null;
  is_super_admin: boolean;
  is_admin: boolean;
  last_sender_name?: string | null;
};

type MemberRoleKey = "SUPERADMIN" | "ADMIN";

const ROLE_META: Record<MemberRoleKey, { label: string; badgeClass: string }> = {
  SUPERADMIN: {
    label: "Super Admin",
    badgeClass: "border-destructive/25 bg-destructive/10 text-destructive",
  },
  ADMIN: {
    label: "Admin",
    badgeClass: "border-primary/25 bg-primary/10 text-primary",
  },
};

function formatPhoneE164BR(input?: string | null) {
  const raw = (input || "").trim();
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  const d = digits.startsWith("55") ? digits.slice(2) : digits;
  if (!d) return raw;
  const ddd = d.slice(0, 2);
  const rest = d.slice(2);
  if (rest.length === 8) {
    return `(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
  }
  if (rest.length === 9) {
    return `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
  }
  return raw;
}

function isProbablyPhone(value?: string | null) {
  const v = (value || "").trim();
  if (!v) return false;
  if (/[A-Za-zÀ-ÿ]/.test(v)) return false;
  const digits = v.replace(/\D/g, "");
  return digits.length >= 8;
}

function isValidTimeHHmm(value: string) {
  const v = value.trim();
  if (!v) return true;
  const match = /^(\d{2}):(\d{2})$/.exec(v);
  if (!match) return false;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}

function isValidIanaTimeZone(value: string) {
  const v = value.trim();
  if (!v) return true;
  try {
    new Intl.DateTimeFormat("pt-BR", { timeZone: v });
    return true;
  } catch {
    return false;
  }
}

export default function GroupEdit() {
  const { groupId } = useParams();
  const { isAuthenticated, loading: authLoading, user } = useAuth();
  const { isLoading: rolesLoading, isSystemAdmin } = useUserRoles();
  const queryClient = useQueryClient();
  const deniedAccessLoggedRef = useRef(false);
  const hydratedGroupIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (authLoading || rolesLoading) return;
    if (!isAuthenticated) return;
    if (!groupId) return;
    if (isSystemAdmin) return;
    if (deniedAccessLoggedRef.current) return;
    if (!user?.id) return;

    deniedAccessLoggedRef.current = true;

    supabase
      .from("events")
      .insert({
        event_type: "GROUP_SETTINGS_ACCESS_DENIED",
        entity_type: "group",
        entity_id: groupId,
        user_id: user.id,
        metadata: { path: typeof window !== "undefined" ? window.location.pathname : null },
      })
      .then(() => null);
  }, [authLoading, groupId, isAuthenticated, isSystemAdmin, rolesLoading, user?.id]);

  

  const { data: group, error, refetch } = useQuery({
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
    enabled: !!groupId && isAuthenticated && isSystemAdmin,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<"active" | "inactive">("active");
  const [archived, setArchived] = useState(false);

  const [language, setLanguage] = useState<string>("");
  const [timezone, setTimezone] = useState<string>("");

  const [summaryTime, setSummaryTime] = useState<string>("");
  const [inviteLinkInput, setInviteLinkInput] = useState<string>("");
  const [revalidating, setRevalidating] = useState(false);
  const [showTechnicalOptions, setShowTechnicalOptions] = useState(false);
  const [showWhatsAppAdmins, setShowWhatsAppAdmins] = useState(false);
  const [showSensitiveActions, setShowSensitiveActions] = useState(false);

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
    enabled: !!groupId && isAuthenticated && isSystemAdmin,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
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
    enabled: !!groupId && isAuthenticated && isSystemAdmin,
    staleTime: 15_000,
    refetchOnWindowFocus: false,
  });

  const [featuresEnabled, setFeaturesEnabled] = useState<Record<FeatureKey, boolean>>({
    WELCOME_MESSAGE: false,
    SUMMARY_HEADER: false,
    SUMMARY: false,
    SUMMARY_FOOTER: false,
    REPORT: false,
    AUDIO_TRANSCRIPTION: false,
  });

  const [templatesDraft, setTemplatesDraft] = useState<Record<FeatureKey, string>>({
    WELCOME_MESSAGE: "",
    SUMMARY_HEADER: "",
    SUMMARY: "",
    SUMMARY_FOOTER: "",
    REPORT: "",
    AUDIO_TRANSCRIPTION: "",
  });

  useEffect(() => {
    if (!group) return;

    // Hydrate form once per group to avoid wiping unsaved drafts after partial refetches.
    if (hydratedGroupIdRef.current !== group.id) {
      hydratedGroupIdRef.current = group.id;
      setName(group.name || "");
      setDescription(group.description || "");
      setStatus((group.status as any) === "inactive" ? "inactive" : "active");
      setArchived(!!group.is_archived);

      const m = group.metadata || {};
      setLanguage((m.language as string) || "");
      setTimezone((m.timezone as string) || "");

      const ops = (m.operations || {}) as Record<string, any>;
      setSummaryTime((ops.summary_time as string) || "");

      const feats = (m.features || {}) as Record<string, any>;
      const nextEnabled = (Object.keys(FEATURE_LABELS) as FeatureKey[]).reduce((acc, key) => {
        const cfg = feats[key] || {};
        acc[key] = !!cfg.enabled;
        return acc;
      }, {} as Record<FeatureKey, boolean>);
      setFeaturesEnabled(nextEnabled);

      const nextTemplates = (Object.keys(FEATURE_LABELS) as FeatureKey[]).reduce((acc, key) => {
        const cfg = feats[key] || {};
        acc[key] = (cfg.content as string) || "";
        return acc;
      }, {} as Record<FeatureKey, string>);
      setTemplatesDraft(nextTemplates);
      setInviteLinkInput(group.invite_link || "");
      return;
    }

    // Keep readonly/display values synchronized without resetting user-edited drafts.
    setName(group.name || "");
  }, [group]);

  const saveAllMutation = useMutation({
    mutationFn: async () => {
      const baseMeta = group?.metadata || {};
      const baseOps = ((baseMeta as any).operations || {}) as Record<string, any>;
      const baseFeatures = ((baseMeta as any).features || {}) as Record<string, any>;

      const nextFeatures = { ...baseFeatures } as Record<string, any>;
      (Object.keys(FEATURE_LABELS) as FeatureKey[]).forEach((k) => {
        const current = (baseFeatures[k] || {}) as Record<string, any>;
        nextFeatures[k] = {
          ...current,
          enabled: !!featuresEnabled[k],
          ...(FEATURE_LABELS[k].hasContent ? { content: templatesDraft[k] || null } : {}),
        };
      });

      const nextMeta = {
        ...baseMeta,
        language: language || null,
        timezone: timezone || null,
        operations: {
          ...baseOps,
          summary_time: summaryTime || null,
        },
        features: nextFeatures,
      };

      const { error } = await supabase
        .from("groups")
        .update({
          description: description.trim() || null,
          status,
          is_archived: archived,
          invite_link: inviteLinkInput.trim() || null,
          metadata: nextMeta,
        })
        .eq("id", groupId!);

      if (error) throw error;
    },
    onSuccess: async () => {
      notify.success("Alterações salvas", "Tudo certo.");
      await refetch();
      queryClient.invalidateQueries({ queryKey: ["group-edit"] });
    },
    onError: () => {
      notify.error("Não foi possível salvar", "Algo deu errado. Tente novamente.");
    },
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
      notify.success("Convite atualizado", "Tudo certo.");
      queryClient.invalidateQueries({ queryKey: ["group-edit", groupId] });
    },
    onError: () => notify.error("Não foi possível atualizar convite", "Algo deu errado. Tente novamente."),
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
      notify.warning("Convite necessário", "Configure o link do grupo e tente de novo.");
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
        notify.warning("Não foi possível validar", "Tente novamente mais tarde.");
        return;
      }
      const participants = Array.isArray(data.participants) ? data.participants : [];
      const adminProviderIds = participants
        .filter((p: any) => p.is_admin)
        .map((p: any) => p.whatsapp_provider_id)
        .filter(Boolean);
      const superAdminProviderIds = participants
        .filter((p: any) => p.is_super_admin)
        .map((p: any) => p.whatsapp_provider_id)
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
          .in("whatsapp_provider_id", adminProviderIds);
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
          .in("whatsapp_provider_id", superAdminProviderIds);
      }
      if (superAdminPhones.length > 0) {
        await supabase
          .from("members")
          .update({ is_super_admin: true })
          .eq("group_id", group.id)
          .is("deleted_at", null)
          .in("phone_e164", superAdminPhones);
      }

      notify.success("Admins atualizados", "Tudo certo.");
      queryClient.invalidateQueries({ queryKey: ["group-edit", groupId] });
      queryClient.invalidateQueries({ queryKey: ["group-dashboard-admins"] });
      queryClient.invalidateQueries({ queryKey: ["group-dashboard-previous-admins"] });
      queryClient.invalidateQueries({ queryKey: ["group-members"] });
    } catch (e: any) {
      notify.error("Não foi possível revalidar", "Algo deu errado. Tente novamente.");
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
      setArchived(true);
      setConfirmRemoveOpen(false);
      setConfirmText("");
      notify.success("Grupo arquivado", "Tudo certo.");
      queryClient.invalidateQueries({ queryKey: ["group-edit", groupId] });
    },
    onError: () => notify.error("Não foi possível arquivar", "Algo deu errado. Tente novamente."),
  });

  const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const { data: specialMembers } = useQuery({
    queryKey: ["group-special-members", groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("members")
        .select("id, name, display_name, phone_e164, profile_pic_url, is_super_admin, is_admin")
        .eq("group_id", groupId!)
        .is("deleted_at", null)
        .or("is_super_admin.eq.true,is_admin.eq.true");
      if (error) throw error;

      const members = (data ?? []) as SpecialMember[];
      const ids = members.map((m) => m.id).filter(Boolean);
      if (ids.length === 0) return members;

      const { data: msgs } = await supabase
        .from("messages")
        .select("member_id, sender_name, created_at")
        .eq("group_id", groupId!)
        .in("member_id", ids)
        .is("deleted_at", null)
        .not("sender_name", "is", null)
        .order("created_at", { ascending: false })
        .limit(200);

      const latestByMemberId: Record<string, string> = {};
      (msgs ?? []).forEach((m: any) => {
        const memberId = String(m.member_id || "");
        if (!memberId || latestByMemberId[memberId]) return;
        const senderName = String(m.sender_name || "").trim();
        if (!senderName || isProbablyPhone(senderName)) return;
        latestByMemberId[memberId] = senderName;
      });

      return members.map((m) => ({ ...m, last_sender_name: latestByMemberId[m.id] || null }));
    },
    enabled: !!groupId && isAuthenticated && isSystemAdmin,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const orderedSpecialMembers = useMemo(() => {
    const list = (specialMembers ?? []).map((m) => {
      const roleKey: MemberRoleKey = m.is_super_admin ? "SUPERADMIN" : "ADMIN";
      const rawName = (m.name || "").trim();
      const rawDisplayName = (m.display_name || "").trim();
      const whatsapp = formatPhoneE164BR(m.phone_e164) || "-";

      const rawLastSenderName = (m.last_sender_name || "").trim();
      const candidateLastSenderName = rawLastSenderName && !isProbablyPhone(rawLastSenderName) ? rawLastSenderName : "";
      const candidateName = rawName && !isProbablyPhone(rawName) ? rawName : "";
      const candidateDisplayName = rawDisplayName && !isProbablyPhone(rawDisplayName) ? rawDisplayName : "";

      const fullName = candidateName || candidateLastSenderName || candidateDisplayName || whatsapp || "Membro";
      const username = rawDisplayName && rawDisplayName !== fullName && !isProbablyPhone(rawDisplayName) ? rawDisplayName : null;
      const displayLabel = fullName || username || whatsapp || "Membro";

      return {
        ...m,
        roleKey,
        fullName,
        username,
        whatsapp,
        displayLabel,
      };
    });

    const order: Record<MemberRoleKey, number> = { SUPERADMIN: 0, ADMIN: 1 };
    return list.sort((a, b) => {
      const d = order[a.roleKey] - order[b.roleKey];
      if (d !== 0) return d;
      return a.displayLabel.localeCompare(b.displayLabel, "pt-BR");
    });
  }, [specialMembers]);

  const inviteLinkDirty = useMemo(() => {
    const current = (group?.invite_link || "").trim();
    const draft = inviteLinkInput.trim();
    return current !== draft;
  }, [group?.invite_link, inviteLinkInput]);

  const templateKeys = useMemo(() => {
    return (Object.keys(FEATURE_LABELS) as FeatureKey[]).filter((k) => FEATURE_LABELS[k].hasContent);
  }, []);

  const timezoneError = useMemo(() => {
    if (!timezone.trim()) return null;
    return isValidIanaTimeZone(timezone) ? null : "Timezone inválido. Use um identificador IANA (ex.: America/Sao_Paulo).";
  }, [timezone]);

  const summaryTimeError = useMemo(() => {
    if (!summaryTime.trim()) return null;
    return isValidTimeHHmm(summaryTime) ? null : "Horário inválido. Use o formato HH:mm (ex.: 08:00).";
  }, [summaryTime]);

  const hasValidationErrors = !!timezoneError || !!summaryTimeError;

  useEffect(() => {
    if (timezoneError || summaryTimeError) {
      setShowTechnicalOptions(true);
    }
  }, [summaryTimeError, timezoneError]);

  const connectionStatus = useMemo(() => {
    if (group?.sync_status === "error") {
      return { variant: "error" as const, label: "Erro", Icon: WifiOff };
    }
    if (!lastActivityAt) {
      return { variant: "warning" as const, label: "Atenção", Icon: AlertTriangle };
    }
    const lastMsgDate = new Date(lastActivityAt);
    const hoursSinceLastMsg = (Date.now() - lastMsgDate.getTime()) / (1000 * 60 * 60);
    if (hoursSinceLastMsg > 48) {
      return { variant: "warning" as const, label: "Atenção", Icon: AlertTriangle };
    }
    return { variant: "success" as const, label: "OK", Icon: CheckCircle2 };
  }, [group?.sync_status, lastActivityAt]);

  const statusTag = useMemo(() => {
    if (status === "active") return { variant: "success" as const, label: "Ativo" };
    return { variant: "neutral" as const, label: "Inativo" };
  }, [status]);

  if (authLoading || rolesLoading) {
    return (
      <AdminLayout title="Editar grupo" subtitle="Verificando acesso...">
        <LoadingState message="Verificando permissões..." />
      </AdminLayout>
    );
  }

  if (!isSystemAdmin) {
    return <AccessDenied message="Apenas usuários SYSTEM_ADMIN podem acessar as configurações do grupo." />;
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

  const breadcrumbItems = [
    { label: "Central do Bóris", href: "/" },
    { label: "Grupos", href: "/system/groups" },
    { label: group.name, href: `/groups/${group.id}` },
    { label: "Editar", href: `/groups/${group.id}/edit` },
    { label: "Configurações" },
  ];
  const isSaving = saveAllMutation.isPending || updateInviteMutation.isPending;

  return (
    <AdminLayout title="Configurações do grupo" subtitle="Ajustes simples para o funcionamento do grupo no Bóris.">
      <div className="animate-fade-in -mx-4 sm:-mx-6 -mt-4 sm:-mt-6 px-4 sm:px-6 pt-4 sm:pt-6 pb-8 sm:pb-10 bg-gradient-to-b from-background via-background to-primary/5 space-y-4">
        <GroupPageTop
          breadcrumbItems={breadcrumbItems}
          group={{
            groupId: group.id,
            organizationId: group.organization_id,
            name: group.name,
            provider: group.provider || "",
            totalMembers: membersCount || 0,
            lastMessageAt: lastActivityAt || null,
            syncStatus: group.sync_status || null,
          }}
          rightActions={(
            <NavLink
              to={`/groups/${group.id}`}
              className={cn("inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground")}
            >
              Voltar ao grupo
            </NavLink>
          )}
        />

        <div className="w-full space-y-8">
          <div className="rounded-2xl border border-border/80 bg-card/90 p-4 sm:p-6 shadow-sm">
            <div className="space-y-1">
              <h2 className="text-lg sm:text-xl font-semibold">Identidade do grupo</h2>
              <p className="text-sm text-muted-foreground">Informações básicas do grupo. As mudanças só valem depois de salvar.</p>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <label htmlFor="group-name" className="text-xs font-medium text-muted-foreground">Nome do grupo</label>
                <Input id="group-name" value={name} readOnly className="h-11 rounded-xl bg-muted/30" />
              </div>

              <div className="space-y-2">
                <label htmlFor="group-description" className="text-xs font-medium text-muted-foreground">Descrição</label>
                <Textarea id="group-description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descrição do grupo" />
                <div className="text-[11px] text-muted-foreground">Ajuda a contextualizar análises e relatórios.</div>
              </div>

              <div className="rounded-xl border border-border/70 bg-secondary/15 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-card-foreground">Configurações para equipe técnica</div>
                    <div className="text-xs text-muted-foreground">Idioma, fuso horário e horário do resumo.</div>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    className="h-9 rounded-xl"
                    onClick={() => setShowTechnicalOptions((v) => !v)}
                  >
                    {showTechnicalOptions ? "Ocultar" : "Mostrar"}
                  </Button>
                </div>

                {showTechnicalOptions ? (
                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label htmlFor="group-language" className="text-xs font-medium text-muted-foreground">Idioma</label>
                      <Input id="group-language" value={language} onChange={(e) => setLanguage(e.target.value)} placeholder="pt-BR" className="h-11 rounded-xl" />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="group-timezone" className="text-xs font-medium text-muted-foreground">Fuso horário</label>
                      <Input
                        id="group-timezone"
                        value={timezone}
                        onChange={(e) => setTimezone(e.target.value)}
                        placeholder="America/Sao_Paulo"
                        className={cn("h-11 rounded-xl", timezoneError ? "border-destructive focus-visible:ring-destructive/30" : "")}
                        aria-invalid={!!timezoneError}
                        aria-describedby={timezoneError ? "group-timezone-error" : undefined}
                      />
                      {timezoneError ? <div id="group-timezone-error" className="text-[11px] text-destructive">{timezoneError}</div> : null}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border/80 bg-card/90 p-4 sm:p-6 shadow-sm">
            <div className="space-y-1">
              <h2 className="text-lg sm:text-xl font-semibold">Estado do grupo</h2>
              <p className="text-sm text-muted-foreground">Ligue ou pause o grupo. Isso não apaga nenhum dado.</p>
            </div>

            <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <label htmlFor="group-status" className="text-xs font-medium text-muted-foreground">Funcionamento</label>
                  <StatusTag variant={statusTag.variant}>{statusTag.label}</StatusTag>
                </div>
                <Select value={status} onValueChange={(v) => setStatus(v as any)}>
                  <SelectTrigger id="group-status" className="h-11 rounded-xl">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Ligado (normal)</SelectItem>
                    <SelectItem value="inactive">Pausado</SelectItem>
                  </SelectContent>
                </Select>
                <div className="text-[11px] text-muted-foreground">Use "Pausado" se quiser interromper temporariamente o funcionamento.</div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <label className="text-xs font-medium text-muted-foreground">Arquivamento</label>
                  <StatusTag variant={archived ? "warning" : "neutral"}>{archived ? "Arquivado" : "Não arquivado"}</StatusTag>
                </div>
                <div className="rounded-xl border border-border/70 bg-secondary/15 px-4 py-3">
                    <div className="text-sm text-card-foreground">Arquivamento é uma ação com confirmação</div>
                  <div className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                    Use a seção "Ações sensíveis" para arquivar com confirmação. O grupo deixa de aparecer nas listas.
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border/80 bg-card/90 p-4 sm:p-6 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <h2 className="text-lg sm:text-xl font-semibold">WhatsApp</h2>
                <p className="text-sm text-muted-foreground">Link do grupo, verificação e administradores detectados.</p>
              </div>

              <div
                className={cn(
                  "inline-flex items-center gap-2 rounded-full px-3 py-1",
                  connectionStatus.variant === "success"
                    ? "bg-success/10"
                    : connectionStatus.variant === "warning"
                    ? "bg-warning/10"
                    : "bg-destructive/10",
                )}
              >
                <connectionStatus.Icon
                  className={cn(
                    "h-4 w-4",
                    connectionStatus.variant === "success"
                      ? "text-success"
                      : connectionStatus.variant === "warning"
                      ? "text-warning"
                      : "text-destructive",
                  )}
                />
                <span
                  className={cn(
                    "text-xs font-medium",
                    connectionStatus.variant === "success"
                      ? "text-success"
                      : connectionStatus.variant === "warning"
                      ? "text-warning"
                      : "text-destructive",
                  )}
                >
                  {connectionStatus.label}
                </span>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3">
                <div className="space-y-2">
                  <label htmlFor="group-invite-link" className="text-xs font-medium text-muted-foreground">Link de convite</label>
                  <Input
                    id="group-invite-link"
                    value={inviteLinkInput}
                    onChange={(e) => setInviteLinkInput(e.target.value)}
                    placeholder="https://chat.whatsapp.com/…"
                    className="h-11 rounded-xl"
                  />
                </div>

                <div className="flex items-end justify-end gap-2">
                  {inviteLinkDirty ? (
                    <Button
                      className="h-11 rounded-xl"
                      variant="secondary"
                      onClick={() => updateInviteMutation.mutate()}
                      disabled={updateInviteMutation.isPending}
                    >
                      Salvar link
                    </Button>
                  ) : null}
                  <Button className="h-11 rounded-xl" onClick={handleRevalidateGroup} disabled={revalidating}>
                    Verificar grupo
                  </Button>
                </div>
              </div>

              <div className="rounded-xl border border-border/70 bg-secondary/15 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-card-foreground">Administradores do grupo</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">Lista atualizada na última verificação.</div>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    className="h-9 rounded-xl"
                    onClick={() => setShowWhatsAppAdmins((v) => !v)}
                  >
                    {showWhatsAppAdmins ? "Ocultar" : "Ver lista"}
                  </Button>
                </div>

                {showWhatsAppAdmins ? (
                  orderedSpecialMembers.length === 0 ? (
                    <div className="mt-3 text-sm text-muted-foreground">Sem funções especiais configuradas.</div>
                  ) : (
                    <div className="mt-3 space-y-2">
                      {orderedSpecialMembers.map((m) => {
                        const role = ROLE_META[m.roleKey];
                        return (
                          <div key={m.id} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-border/70 bg-card/85">
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-card-foreground truncate">{m.fullName}</div>
                              <div className="text-xs text-muted-foreground truncate">{m.username || m.whatsapp}</div>
                            </div>
                            <span
                              className={cn(
                                "inline-flex items-center h-5 px-2 rounded-full border text-[10px] font-semibold leading-none",
                                role.badgeClass,
                              )}
                            >
                              {role.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )
                ) : (
                  <div className="mt-3 text-sm text-muted-foreground">
                    Clique em "Ver lista" para visualizar os administradores detectados.
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border/80 bg-card/90 p-4 sm:p-6 shadow-sm">
            <div className="space-y-1">
              <h2 className="text-lg sm:text-xl font-semibold">Mensagens automáticas</h2>
              <p className="text-sm text-muted-foreground">Escolha o que o Bóris pode enviar no grupo.</p>
            </div>

            <div className="mt-5 space-y-4">
              <div className="rounded-xl border border-border/70 bg-secondary/15 p-4">
                <div className="text-sm font-semibold text-card-foreground">O que o Bóris pode fazer</div>
                <div className="mt-0.5 text-xs text-muted-foreground">Ative somente o que você deseja usar no grupo.</div>

                <div className="mt-4 space-y-3">
                  {(Object.keys(FEATURE_LABELS) as FeatureKey[]).map((key) => {
                    const info = FEATURE_LABELS[key];
                    return (
                      <div key={key} className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-card-foreground">{info.name}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">{info.description}</div>

                          {key === "SUMMARY" && showTechnicalOptions ? (
                            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div className="space-y-2">
                                <label htmlFor="group-summary-time" className="text-xs font-medium text-muted-foreground">Horário do resumo (aprox.)</label>
                                <Input
                                  id="group-summary-time"
                                  value={summaryTime}
                                  onChange={(e) => setSummaryTime(e.target.value)}
                                  placeholder="08:00"
                                  className={cn("h-11 rounded-xl", summaryTimeError ? "border-destructive focus-visible:ring-destructive/30" : "")}
                                  aria-invalid={!!summaryTimeError}
                                  aria-describedby={summaryTimeError ? "group-summary-time-error" : undefined}
                                />
                                <div className="text-[11px] text-muted-foreground">Define o horário aproximado de envio do resumo diário.</div>
                                {summaryTimeError ? <div id="group-summary-time-error" className="text-[11px] text-destructive">{summaryTimeError}</div> : null}
                              </div>
                            </div>
                          ) : null}
                        </div>

                        <Switch
                          checked={!!featuresEnabled[key]}
                          onCheckedChange={(v) => setFeaturesEnabled((prev) => ({ ...prev, [key]: v }))}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-xl border border-border/70 bg-secondary/15 p-4">
                <div className="text-sm font-semibold text-card-foreground">Textos personalizados (opcional)</div>
                <div className="mt-0.5 text-xs text-muted-foreground">Se preferir, você pode trocar os textos que o Bóris envia.</div>

                {showTechnicalOptions ? (
                  <div className="mt-4 space-y-4">
                    {templateKeys.map((key) => {
                    const title = FEATURE_LABELS[key].name;
                    const desc = FEATURE_LABELS[key].description;
                    const value = templatesDraft[key] || "";
                    const count = value.length;
                    const enabled = !!featuresEnabled[key];
                    return (
                      <div key={key} className="rounded-2xl border border-border/80 bg-card/90 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-card-foreground">{title}</div>
                            <div className="text-xs text-muted-foreground mt-0.5">{desc}</div>
                          </div>
                          <div className="text-xs text-muted-foreground whitespace-nowrap">{count} caracteres</div>
                        </div>

                        <div className="mt-3 space-y-2">
                          <Textarea
                            value={value}
                            onChange={(e) => setTemplatesDraft((prev) => ({ ...prev, [key]: e.target.value }))}
                            placeholder={enabled ? "Texto..." : "Ative o recurso acima para usar este template"}
                            disabled={!enabled}
                          />
                        </div>

                        <div className={cn("mt-4 rounded-xl border border-border/70 p-3", enabled ? "bg-muted/15" : "bg-muted/10 opacity-70")}>
                          <div className="text-xs font-medium text-muted-foreground">Preview</div>
                          <div className="mt-2 flex justify-start">
                            <div
                              className={cn(
                                "max-w-[520px] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap break-words",
                                enabled
                                  ? "bg-success/10 text-card-foreground"
                                  : "bg-muted/30 text-muted-foreground",
                              )}
                            >
                              {!enabled
                                ? "Recurso desativado. Ative acima para usar este template."
                                : value.trim().length
                                ? value
                                : "(vazio)"}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                    })}
                  </div>
                ) : (
                  <div className="mt-4 rounded-xl border border-border/70 bg-secondary/10 px-4 py-3 text-sm text-muted-foreground">
                    O Bóris vai usar os textos padrão. Para editar esses textos, abra "Configurações para equipe técnica".
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border/80 bg-card/90 p-4 sm:p-6 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <h2 className="text-lg sm:text-xl font-semibold">Mais opções</h2>
                <p className="text-sm text-muted-foreground">Opções menos usadas e ações que pedem confirmação.</p>
              </div>
              <Button
                type="button"
                variant="secondary"
                className="h-10 rounded-xl"
                onClick={() => setShowSensitiveActions((v) => !v)}
              >
                {showSensitiveActions ? "Ocultar" : "Mostrar"}
              </Button>
            </div>

            {showSensitiveActions ? (
              <div className="mt-5 rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
                <div className="space-y-1">
                  <h3 className="text-base font-semibold text-destructive">Ações sensíveis</h3>
                  <p className="text-sm text-muted-foreground">Use somente quando tiver certeza. Será pedido uma confirmação.</p>
                </div>

                <div className="mt-4 flex flex-wrap gap-3">
                  <Button
                    variant="destructive"
                    className="h-11 rounded-xl inline-flex items-center gap-2"
                    onClick={() => setConfirmRemoveOpen(true)}
                  >
                    <Trash2 className="h-4 w-4" />
                    Arquivar grupo
                  </Button>
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-border/70 bg-secondary/10 px-4 py-3 text-sm text-muted-foreground">
                A maioria das pessoas não precisa mexer nessas opções no dia a dia.
              </div>
            )}
          </div>

          <div className="sm:mt-2" />
        </div>

        <div className="sm:mt-6 sm:static sticky bottom-0 z-20 -mx-4 sm:-mx-6 px-4 sm:px-6 pb-4 sm:pb-6 pt-3 bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
          <div className="w-full">
            <div className="rounded-2xl border border-border/80 bg-card/90 backdrop-blur px-4 py-3 shadow-sm">
              <div className={cn("text-[11px]", hasValidationErrors ? "text-destructive" : "text-muted-foreground")}>
                {hasValidationErrors
                  ? "Corrija os campos inválidos antes de salvar."
                  : "Clique em salvar para aplicar as mudanças. Ações sensíveis têm confirmação separada."}
              </div>
              <div className="mt-2 flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2">
                <Button className="h-12 sm:h-11 sm:px-6 rounded-xl" onClick={() => saveAllMutation.mutate()} disabled={isSaving || hasValidationErrors}>
                  Salvar alterações
                </Button>
              </div>
            </div>
          </div>
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
    </AdminLayout>
  );
}
