import { useEffect, useMemo, useRef, useState } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { GroupPageTop } from "@/components/group-navigation/GroupPageTop";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { StatusTag } from "@/components/ui/status-tag";
import { useParams, NavLink } from "react-router-dom";
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

type EditSectionKey = "geral" | "resumo" | "whatsapp" | "templates" | "avancado";

const SECTION_META: Record<EditSectionKey, { label: string; description: string; mobileLabel: string }> = {
  geral: {
    label: "Geral",
    mobileLabel: "Geral",
    description: "Identidade e preferências do grupo.",
  },
  resumo: {
    label: "Resumo & Relatórios",
    mobileLabel: "Resumo",
    description: "Ative recursos e ajuste parâmetros operacionais.",
  },
  whatsapp: {
    label: "WhatsApp & Conexão",
    mobileLabel: "WhatsApp",
    description: "Convite do grupo e status de conexão.",
  },
  templates: {
    label: "Mensagens & Templates",
    mobileLabel: "Templates",
    description: "Conteúdos enviados pelo Bóris.",
  },
  avancado: {
    label: "Avançado",
    mobileLabel: "Avançado",
    description: "Ações destrutivas com confirmação.",
  },
};

const SECTION_ORDER: EditSectionKey[] = ["geral", "resumo", "whatsapp", "templates", "avancado"];

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
    badgeClass: "border-violet-200/70 bg-violet-100/55 text-violet-950",
  },
  ADMIN: {
    label: "Admin",
    badgeClass: "border-sky-200/70 bg-sky-100/55 text-sky-950",
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

export default function GroupEdit() {
  const { groupId } = useParams();
  const { isAuthenticated, loading: authLoading, user } = useAuth();
  const { isLoading: rolesLoading, isSystemAdmin } = useUserRoles();
  const queryClient = useQueryClient();

  const [section, setSection] = useState<EditSectionKey>("geral");
  const [tabsOrientation, setTabsOrientation] = useState<"horizontal" | "vertical">("horizontal");

  const touchStartRef = useRef<{ x: number; y: number; t: number } | null>(null);
  const touchEligibleRef = useRef(false);
  const deniedAccessLoggedRef = useRef(false);

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

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mql = window.matchMedia("(min-width: 1024px)");
    const sync = () => setTabsOrientation(mql.matches ? "vertical" : "horizontal");
    sync();
    mql.addEventListener("change", sync);
    return () => mql.removeEventListener("change", sync);
  }, []);

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

  const [featureConfigOpen, setFeatureConfigOpen] = useState(false);
  const [selectedFeatureKey, setSelectedFeatureKey] = useState<FeatureKey | null>(null);
  const [openTemplateKey, setOpenTemplateKey] = useState<string>("");

  const [adminsModalOpen, setAdminsModalOpen] = useState(false);

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
  }, [group]);

  const saveGeneralMutation = useMutation({
    mutationFn: async () => {
      const nextMeta = {
        ...(group?.metadata || {}),
        language: language || null,
        timezone: timezone || null,
      };

      const { error } = await supabase
        .from("groups")
        .update({
          description: description.trim() || null,
          status,
          is_archived: archived,
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

  const saveSummaryMutation = useMutation({
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
        };
      });

      const nextMeta = {
        ...baseMeta,
        operations: {
          ...baseOps,
          summary_time: summaryTime || null,
        },
        features: nextFeatures,
      };

      const { error } = await supabase.from("groups").update({ metadata: nextMeta }).eq("id", groupId!);
      if (error) throw error;
    },
    onSuccess: async () => {
      notify.success("Configurações salvas", "Tudo certo.");
      await refetch();
      queryClient.invalidateQueries({ queryKey: ["group-edit"] });
    },
    onError: () => notify.error("Não foi possível salvar", "Algo deu errado. Tente novamente."),
  });

  const saveTemplatesMutation = useMutation({
    mutationFn: async () => {
      const baseMeta = group?.metadata || {};
      const baseFeatures = ((baseMeta as any).features || {}) as Record<string, any>;
      const nextFeatures = { ...baseFeatures } as Record<string, any>;

      (Object.keys(FEATURE_LABELS) as FeatureKey[]).forEach((k) => {
        if (!FEATURE_LABELS[k].hasContent) return;
        const current = (baseFeatures[k] || {}) as Record<string, any>;
        nextFeatures[k] = {
          ...current,
          content: templatesDraft[k] || null,
        };
      });

      const nextMeta = {
        ...baseMeta,
        features: nextFeatures,
      };

      const { error } = await supabase.from("groups").update({ metadata: nextMeta }).eq("id", groupId!);
      if (error) throw error;
    },
    onSuccess: async () => {
      notify.success("Templates salvos", "Tudo certo.");
      await refetch();
      queryClient.invalidateQueries({ queryKey: ["group-edit"] });
    },
    onError: () => notify.error("Não foi possível salvar templates", "Algo deu errado. Tente novamente."),
  });

  const updateStatusOnly = useMutation({
    mutationFn: async (newStatus: "active" | "inactive") => {
      const { error } = await supabase.from("groups").update({ status: newStatus }).eq("id", groupId!);
      if (error) throw error;
    },
    onSuccess: async () => {
      notify.success("Status atualizado", "Tudo certo.");
      await refetch();
    },
    onError: () => notify.error("Não foi possível atualizar status", "Algo deu errado. Tente novamente."),
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
      await refetch();
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
      await refetch();
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
      notify.success("Grupo arquivado", "Tudo certo.");
    },
    onError: () => notify.error("Não foi possível arquivar", "Algo deu errado. Tente novamente."),
  });

  const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const [confirmStatusOpen, setConfirmStatusOpen] = useState(false);
  const [confirmStatusText, setConfirmStatusText] = useState("");

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

  const activeTemplateKeys = useMemo(() => {
    const persisted = (group?.metadata?.features || {}) as Record<string, any>;
    const keys = ["WELCOME_MESSAGE", "SUMMARY_HEADER", "SUMMARY", "SUMMARY_FOOTER", "REPORT"] as FeatureKey[];
    return keys.filter((k) => !!persisted?.[k]?.enabled);
  }, [group?.metadata]);

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

  const sectionLabel = SECTION_META[section].label;

  const breadcrumbItems = [
    { label: "Central de Comando", href: "/" },
    { label: "Grupos", href: "/system/groups" },
    { label: group.name, href: `/groups/${group.id}` },
    { label: "Editar", href: `/groups/${group.id}/edit` },
    { label: sectionLabel },
  ];

  const handleTouchStart: React.TouchEventHandler<HTMLDivElement> = (e) => {
    if (typeof window === "undefined" || window.innerWidth >= 768) return;
    const path = typeof e.nativeEvent.composedPath === "function" ? (e.nativeEvent.composedPath() as EventTarget[]) : [];
    const hasInteractive = path.some((node) => {
      if (!(node instanceof HTMLElement)) return false;
      const tag = node.tagName;
      return tag === "TEXTAREA" || tag === "INPUT" || tag === "SELECT" || tag === "BUTTON" || tag === "A";
    });
    if (hasInteractive) {
      touchEligibleRef.current = false;
      touchStartRef.current = null;
      return;
    }
    const t = e.touches?.[0];
    if (!t) return;
    touchEligibleRef.current = true;
    touchStartRef.current = { x: t.clientX, y: t.clientY, t: Date.now() };
  };

  const handleTouchEnd: React.TouchEventHandler<HTMLDivElement> = (e) => {
    if (typeof window === "undefined" || window.innerWidth >= 768) return;
    if (!touchEligibleRef.current || !touchStartRef.current) return;
    const t = e.changedTouches?.[0];
    if (!t) return;

    const dt = Date.now() - touchStartRef.current.t;
    const dx = t.clientX - touchStartRef.current.x;
    const dy = t.clientY - touchStartRef.current.y;

    touchEligibleRef.current = false;
    touchStartRef.current = null;

    if (dt > 650) return;
    if (Math.abs(dy) > 28) return;
    if (Math.abs(dx) < 55) return;

    const idx = SECTION_ORDER.indexOf(section);
    if (idx === -1) return;
    if (dx < 0 && idx < SECTION_ORDER.length - 1) {
      setSection(SECTION_ORDER[idx + 1]);
    }
    if (dx > 0 && idx > 0) {
      setSection(SECTION_ORDER[idx - 1]);
    }
  };

  return (
    <AdminLayout title="Editar grupo" subtitle="Ajuste as configurações e recursos deste grupo.">
      <div className="space-y-3 animate-fade-in">
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

        <Tabs
          value={section}
          onValueChange={(v) => setSection(v as EditSectionKey)}
          orientation={tabsOrientation}
        >
          <div className="grid gap-3 lg:gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
            <div className="hidden lg:block lg:sticky lg:top-4 lg:self-start">
              <div className="rounded-xl border border-border bg-card p-2">
                <div className="text-xs font-medium text-muted-foreground px-2 py-1">Seções</div>
                <TabsList className="mt-1 w-full h-auto flex-col items-stretch justify-start gap-1 bg-transparent border-0 p-0">
                  {SECTION_ORDER.map((k) => (
                    <TabsTrigger
                      key={k}
                      value={k}
                      className="w-full h-auto justify-start rounded-lg px-3 py-2.5 border border-transparent data-[state=active]:border-primary/30 data-[state=active]:bg-primary/10"
                    >
                      <div className="min-w-0 text-left">
                        <div className="text-sm font-medium text-card-foreground truncate">{SECTION_META[k].label}</div>
                        <div className="text-xs text-muted-foreground truncate">{SECTION_META[k].description}</div>
                      </div>
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>
            </div>

            <div
              className="min-w-0 touch-pan-y"
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
            >
              <div className="sticky top-0 z-10 -mx-1 px-1 pb-2 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 lg:static lg:p-0 lg:pb-0 lg:bg-transparent lg:backdrop-blur-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs text-muted-foreground">
                    <span className="text-foreground font-medium">Configurações</span>
                    <span className="mx-1 text-muted-foreground/60">/</span>
                    <span className="text-muted-foreground">{sectionLabel}</span>
                  </div>

                  <div className="flex sm:hidden text-[11px] text-muted-foreground">
                    Deslize para trocar
                  </div>
                </div>

                <div className="mt-2 lg:hidden">
                  <TabsList
                    aria-label="Seções de configuração"
                    className="w-full justify-start overflow-x-auto h-11 rounded-xl bg-card border border-border px-1 gap-1"
                  >
                    {SECTION_ORDER.map((k) => (
                      <TabsTrigger
                        key={k}
                        value={k}
                        className="h-9 px-3 text-xs sm:text-sm border border-transparent data-[state=active]:border-primary/30"
                      >
                        {SECTION_META[k].mobileLabel}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </div>
              </div>

              <TabsContent value="geral" className="mt-0">
                <div className="rounded-xl border border-border bg-card p-3 sm:p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <h3 className="text-base sm:text-lg font-semibold">Geral</h3>
                      <p className="text-sm text-muted-foreground">Identidade e preferências do grupo.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3 mt-3">
                <div className="md:col-span-7">
                  <label className="text-sm font-medium">Nome do grupo</label>
                  <Input value={name} readOnly className="bg-muted/40" />
                </div>

                <div className="md:col-span-5">
                  <div className="flex items-center justify-between gap-3">
                    <label className="text-sm font-medium">Status</label>
                    <StatusTag variant={statusTag.variant}>{statusTag.label}</StatusTag>
                  </div>
                  <Select value={status} onValueChange={(v) => setStatus(v as any)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Ativo</SelectItem>
                      <SelectItem value="inactive">Inativo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="md:col-span-4">
                  <label className="text-sm font-medium">Idioma</label>
                  <Input value={language} onChange={(e) => setLanguage(e.target.value)} placeholder="pt-BR" />
                </div>

                <div className="md:col-span-4">
                  <label className="text-sm font-medium">Timezone</label>
                  <Input value={timezone} onChange={(e) => setTimezone(e.target.value)} placeholder="America/Sao_Paulo" />
                </div>

                <div className="md:col-span-4">
                  <label className="text-sm font-medium">Grupo arquivado</label>
                  <div className="flex items-center gap-3 mt-2">
                    <Switch checked={archived} onCheckedChange={setArchived} />
                    <span className="text-sm text-muted-foreground">Arquivar este grupo</span>
                  </div>
                </div>

                <div className="md:col-span-12">
                  <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="descricao" className="border-border/60">
                      <AccordionTrigger className="text-sm text-muted-foreground hover:text-foreground">
                        Descrição (opcional)
                      </AccordionTrigger>
                      <AccordionContent>
                        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descrição do grupo" />
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </div>
              </div>

                  <div className="mt-3 flex items-center justify-between gap-3">
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="h-auto px-0 py-0 text-xs text-muted-foreground"
                  onClick={() => setAdminsModalOpen(true)}
                >
                  Ver administradores ({orderedSpecialMembers.length})
                </Button>
                <Button
                  className="h-12 sm:h-10"
                  onClick={() => saveGeneralMutation.mutate()}
                  disabled={saveGeneralMutation.isPending}
                >
                  Salvar alterações
                </Button>
              </div>
            </div>
          </TabsContent>

              <TabsContent value="resumo" className="mt-0">
                <div className="rounded-xl border border-border bg-card p-3 sm:p-4">
                  <div className="space-y-1">
                    <h3 className="text-base sm:text-lg font-semibold">Resumo & Relatórios</h3>
                    <p className="text-sm text-muted-foreground">Ative recursos e ajuste parâmetros operacionais.</p>
                  </div>

                  <div className="mt-3 rounded-lg border border-border divide-y divide-border">
                    {(Object.keys(FEATURE_LABELS) as FeatureKey[]).map((key) => {
                      const info = FEATURE_LABELS[key];
                      return (
                        <div key={key} className="flex items-start justify-between gap-4 p-3">
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium text-card-foreground">{info.name}</div>
                            <div className="text-xs text-muted-foreground mt-0.5">{info.description}</div>
                            <div className="mt-2">
                              <Button
                                type="button"
                                variant="link"
                                size="sm"
                                className="h-auto px-0 py-0 text-xs"
                                onClick={() => {
                                  setSelectedFeatureKey(key);
                                  setFeatureConfigOpen(true);
                                }}
                              >
                                Configurar
                              </Button>
                            </div>
                          </div>
                          <Switch
                            checked={!!featuresEnabled[key]}
                            onCheckedChange={(v) => setFeaturesEnabled((prev) => ({ ...prev, [key]: v }))}
                          />
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-3 flex justify-end">
                    <Button
                      className="h-12 sm:h-10"
                      onClick={() => saveSummaryMutation.mutate()}
                      disabled={saveSummaryMutation.isPending}
                    >
                      Salvar configurações
                    </Button>
                  </div>
            </div>
          </TabsContent>

              <TabsContent value="whatsapp" className="mt-0">
                <div className="rounded-xl border border-border bg-card p-3 sm:p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <h3 className="text-base sm:text-lg font-semibold">WhatsApp & Conexão</h3>
                      <p className="text-sm text-muted-foreground">Ajuste o convite e monitore a conexão.</p>
                    </div>
                    <div className={cn("inline-flex items-center gap-2 rounded-full px-3 py-1", connectionStatus.variant === "success" ? "bg-success/10" : connectionStatus.variant === "warning" ? "bg-warning/10" : "bg-destructive/10")}>
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

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3 mt-3">
                    <div className="md:col-span-9">
                      <label className="text-sm font-medium">Link de convite do grupo</label>
                      <Input
                        value={inviteLinkInput}
                        onChange={(e) => setInviteLinkInput(e.target.value)}
                        placeholder="https://chat.whatsapp.com/…"
                      />
                    </div>
                    <div className="md:col-span-3 flex items-end justify-end">
                      {inviteLinkDirty ? (
                        <Button
                          className="h-12 sm:h-10"
                          variant="secondary"
                          onClick={() => updateInviteMutation.mutate()}
                          disabled={updateInviteMutation.isPending}
                        >
                          Salvar link
                        </Button>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-3 flex justify-end">
                    <Button className="h-12 sm:h-10" onClick={handleRevalidateGroup} disabled={revalidating}>
                      Revalidar conexão
                    </Button>
                  </div>
            </div>
          </TabsContent>

              <TabsContent value="templates" className="mt-0">
                <div className="rounded-xl border border-border bg-card p-3 sm:p-4">
                  <div className="space-y-1">
                    <h3 className="text-base sm:text-lg font-semibold">Mensagens & Templates</h3>
                    <p className="text-sm text-muted-foreground">Edite o conteúdo enviado pelo Bóris.</p>
                  </div>

                  {activeTemplateKeys.length === 0 ? (
                    <div className="mt-3 rounded-lg border border-border bg-muted/20 p-4">
                      <div className="text-sm font-medium text-card-foreground">Nenhum template ativo</div>
                      <div className="text-sm text-muted-foreground mt-1">Ative uma feature em “Resumo & Relatórios” para editar seus templates.</div>
                    </div>
                  ) : (
                    <div className="mt-3">
                      <Accordion
                        type="single"
                        collapsible
                        value={openTemplateKey}
                        onValueChange={(v) => setOpenTemplateKey(v)}
                        className="w-full"
                      >
                        {activeTemplateKeys.map((key) => {
                          const title = FEATURE_LABELS[key].name;
                          const desc = FEATURE_LABELS[key].description;
                          const value = templatesDraft[key] || "";
                          const count = value.length;
                          return (
                            <AccordionItem key={key} value={key} className="border-border">
                              <AccordionTrigger className="text-sm">
                                <div className="flex items-center justify-between w-full gap-3">
                                  <div className="min-w-0">
                                    <div className="text-sm font-medium text-card-foreground truncate">{title}</div>
                                    <div className="text-xs text-muted-foreground truncate">{desc}</div>
                                  </div>
                                  <div className="text-xs text-muted-foreground">{count} caracteres</div>
                                </div>
                              </AccordionTrigger>
                              <AccordionContent>
                                <div className="space-y-3">
                                  <div>
                                    <Textarea
                                      value={value}
                                      onChange={(e) => setTemplatesDraft((prev) => ({ ...prev, [key]: e.target.value }))}
                                      placeholder="Texto..."
                                    />
                                    <div className="mt-1 text-xs text-muted-foreground">{count} caracteres</div>
                                  </div>

                                  <div className="rounded-xl border border-border bg-muted/20 p-3">
                                    <div className="text-xs font-medium text-muted-foreground">Preview</div>
                                    <div className="mt-2 flex justify-start">
                                      <div className="max-w-[520px] rounded-2xl bg-success/10 px-4 py-3 text-sm text-card-foreground whitespace-pre-wrap break-words">
                                        {value.trim().length ? value : "(vazio)"}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </AccordionContent>
                            </AccordionItem>
                          );
                        })}
                      </Accordion>
                    </div>
                  )}

                  <div className="mt-3 flex justify-end">
                    <Button
                      className="h-12 sm:h-10"
                      onClick={() => saveTemplatesMutation.mutate()}
                      disabled={saveTemplatesMutation.isPending || activeTemplateKeys.length === 0}
                    >
                      Salvar templates
                    </Button>
                  </div>
            </div>
          </TabsContent>

              <TabsContent value="avancado" className="mt-0">
                <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 sm:p-4">
                  <div className="space-y-1">
                    <h3 className="text-base sm:text-lg font-semibold text-destructive">Avançado</h3>
                    <p className="text-sm text-muted-foreground">Ações destrutivas. Exigem confirmação.</p>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-3">
                    <Button
                      className="h-12 sm:h-10"
                      variant={status === "active" ? "destructive" : "secondary"}
                      onClick={() => setConfirmStatusOpen(true)}
                    >
                      {status === "active" ? "Desativar grupo" : "Reativar grupo"}
                    </Button>

                    <Button
                      variant="destructive"
                      className="h-12 sm:h-10 inline-flex items-center gap-2"
                      onClick={() => setConfirmRemoveOpen(true)}
                    >
                      <Trash2 className="h-4 w-4" />
                      Arquivar grupo
                    </Button>
                  </div>

              <AlertDialog open={confirmStatusOpen} onOpenChange={setConfirmStatusOpen}>
                <AlertDialogContent className="bg-card border-border">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-card-foreground">
                      {status === "active" ? "Desativar grupo" : "Reativar grupo"}
                    </AlertDialogTitle>
                    <AlertDialogDescription className="text-muted-foreground">
                      Digite <span className="font-semibold">CONFIRMAR</span> para continuar.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <div className="mt-2">
                    <Input value={confirmStatusText} onChange={(e) => setConfirmStatusText(e.target.value)} placeholder="CONFIRMAR" />
                  </div>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      disabled={updateStatusOnly.isPending || confirmStatusText.trim().toUpperCase() !== "CONFIRMAR"}
                      onClick={() => {
                        updateStatusOnly.mutate(status === "active" ? "inactive" : "active");
                        setConfirmStatusText("");
                      }}
                    >
                      Confirmar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

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
              </TabsContent>
            </div>
          </div>
        </Tabs>

        <Sheet open={featureConfigOpen} onOpenChange={setFeatureConfigOpen}>
          <SheetContent side="right" className="bg-card border-border w-full sm:max-w-md">
            <SheetHeader>
              <SheetTitle>{selectedFeatureKey ? FEATURE_LABELS[selectedFeatureKey].name : "Configurar"}</SheetTitle>
              <SheetDescription>
                {selectedFeatureKey ? FEATURE_LABELS[selectedFeatureKey].description : ""}
              </SheetDescription>
            </SheetHeader>

            <div className="mt-4 space-y-4">
              {selectedFeatureKey === "SUMMARY" ? (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Horário do resumo</label>
                  <Input value={summaryTime} onChange={(e) => setSummaryTime(e.target.value)} placeholder="08:00" />
                  <div className="text-xs text-muted-foreground">Define o horário aproximado de envio do resumo diário.</div>
                </div>
              ) : (
                <div className="rounded-lg border border-border bg-muted/20 p-3">
                  <div className="text-sm font-medium text-card-foreground">Configuração operacional</div>
                  <div className="text-sm text-muted-foreground mt-1">Sem ajustes adicionais aqui. Para editar o texto, use “Mensagens & Templates”.</div>
                </div>
              )}

              {selectedFeatureKey && FEATURE_LABELS[selectedFeatureKey].hasContent ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setFeatureConfigOpen(false);
                    setSection("templates");
                    setOpenTemplateKey(selectedFeatureKey);
                  }}
                >
                  Ir para template
                </Button>
              ) : null}
            </div>
          </SheetContent>
        </Sheet>

        <Dialog open={adminsModalOpen} onOpenChange={setAdminsModalOpen}>
          <DialogContent className="bg-card border-border max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-card-foreground">Administração do grupo</DialogTitle>
            </DialogHeader>

            {orderedSpecialMembers.length === 0 ? (
              <div className="text-sm text-muted-foreground">Sem funções especiais configuradas.</div>
            ) : (
              <div className="space-y-2">
                {orderedSpecialMembers.map((m) => {
                  const role = ROLE_META[m.roleKey];
                  return (
                    <div key={m.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border bg-secondary/30">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-card-foreground truncate">{m.fullName}</div>
                        <div className="text-xs text-muted-foreground truncate">{m.username || m.whatsapp}</div>
                      </div>
                      <span className={cn("inline-flex items-center h-5 px-2 rounded-full border text-[10px] font-semibold leading-none", role.badgeClass)}>
                        {role.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
