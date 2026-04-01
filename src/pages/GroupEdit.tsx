import { useEffect, useMemo, useRef, useState } from "react";
import { FunctionsHttpError } from "@supabase/supabase-js";
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
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
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
import { notifyValidation } from "@/lib/notify-validation";

type AutomationKey =
  | "welcome_message_enabled"
  | "audio_transcription_enabled"
  | "daily_summary_enabled"
  | "daily_topics_enabled"
  | "peak_moment_enabled"
  | "polls_enabled";

type GroupSettingsRow = {
  group_id: string;
  welcome_message_enabled: boolean;
  audio_transcription_enabled: boolean;
  daily_summary_enabled: boolean;
  daily_summary_time: string;
  daily_topics_enabled: boolean;
  peak_moment_enabled: boolean;
  polls_enabled: boolean;
  updated_at: string;
};

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
  group_settings?: GroupSettingsRow | GroupSettingsRow[] | null;
}

const normalizeWhatsAppInviteLink = (value: string): string => {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return "";

  try {
    const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const url = new URL(withScheme);
    url.search = "";
    url.hash = "";
    return `${url.origin}${url.pathname}`.replace(/\/+$/, "");
  } catch {
    return trimmed.split(/[?#]/, 1)[0]?.trim() ?? "";
  }
};

const AUTOMATION_LABELS: Record<AutomationKey, { name: string; description: string; availability: "live" | "prepared" }> = {
  welcome_message_enabled: {
    name: "Mensagem de boas-vindas",
    description: "Envia automaticamente uma saudação quando um novo participante entra no grupo.",
    availability: "live",
  },
  audio_transcription_enabled: {
    name: "Áudio do Bóris",
    description: "Reserva o grupo para automações de áudio e transcrição do Bóris.",
    availability: "prepared",
  },
  daily_summary_enabled: {
    name: "Enviar resumo no grupo",
    description: "Define se o resumo diário, gerado para todos os grupos, também será enviado no grupo no horário configurado.",
    availability: "live",
  },
  daily_topics_enabled: {
    name: "Tópicos e keywords",
    description: "Gera os tópicos mais falados e as palavras-chave do dia.",
    availability: "live",
  },
  peak_moment_enabled: {
    name: "Momento de pico",
    description: "Ativa leituras automáticas sobre os períodos de maior atividade do grupo.",
    availability: "live",
  },
  polls_enabled: {
    name: "Enquetes",
    description: "Reserva o grupo para automações ligadas a enquetes e interações futuras.",
    availability: "prepared",
  },
};

async function getEdgeFunctionAuthHeaders() {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined;
}

async function normalizeEdgeFunctionError(error: any, fallbackMessage: string) {
  let message = error?.message || fallbackMessage;

  if (error instanceof FunctionsHttpError && (error as any).context) {
    try {
      const body = await (error as any).context.json();
      if (body?.message) {
        message = String(body.message);
      }
    } catch {
      void 0;
    }
  }

  return new Error(message);
}

const AUTOMATION_PANEL_KEYS: AutomationKey[] = [
  "welcome_message_enabled",
  "audio_transcription_enabled",
  "daily_summary_enabled",
  "peak_moment_enabled",
  "polls_enabled",
];

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

function toHHmm(value?: string | null) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return raw.slice(0, 5);
}

function toDbTime(value: string) {
  const normalized = value.trim();
  if (!normalized) return "19:00:00";
  return normalized.length === 5 ? `${normalized}:00` : normalized;
}

const SUMMARY_TIME_PRESETS = Array.from({ length: 48 }, (_, index) => {
  const hours = String(Math.floor(index / 2)).padStart(2, "0");
  const minutes = index % 2 === 0 ? "00" : "30";
  const value = `${hours}:${minutes}`;
  return { value, label: value };
});

const SUMMARY_TIME_GROUPS = [
  { label: "Madrugada", values: SUMMARY_TIME_PRESETS.filter((option) => Number(option.value.slice(0, 2)) < 6) },
  { label: "Manhã", values: SUMMARY_TIME_PRESETS.filter((option) => Number(option.value.slice(0, 2)) >= 6 && Number(option.value.slice(0, 2)) < 12) },
  { label: "Tarde", values: SUMMARY_TIME_PRESETS.filter((option) => Number(option.value.slice(0, 2)) >= 12 && Number(option.value.slice(0, 2)) < 18) },
  { label: "Noite", values: SUMMARY_TIME_PRESETS.filter((option) => Number(option.value.slice(0, 2)) >= 18) },
] as const;

function truncateText(value: string, limit = 220) {
  const text = value.trim();
  if (text.length <= limit) return text;
  return `${text.slice(0, limit).trimEnd()}...`;
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
        .select("id, name, description, status, is_archived, metadata, organization_id, invite_link, provider, sync_status, group_settings(group_id,welcome_message_enabled,audio_transcription_enabled,daily_summary_enabled,daily_summary_time,daily_topics_enabled,peak_moment_enabled,polls_enabled,updated_at)")
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

  const { data: latestSummary } = useQuery({
    queryKey: ["group-latest-summary", groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("group_daily_summaries")
        .select("id, summary_date, summary_text, metadata, created_at")
        .eq("group_id", groupId!)
        .order("summary_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
    enabled: !!groupId && isAuthenticated && isSystemAdmin,
    staleTime: 15_000,
    refetchOnWindowFocus: false,
  });

  const { data: latestTopicsSnapshot } = useQuery({
    queryKey: ["group-latest-topics-snapshot", groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("group_daily_topics")
        .select("topic_date")
        .eq("group_id", groupId!)
        .order("topic_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
    enabled: !!groupId && isAuthenticated && isSystemAdmin,
    staleTime: 15_000,
    refetchOnWindowFocus: false,
  });

  const [automationsEnabled, setAutomationsEnabled] = useState<Record<AutomationKey, boolean>>({
    welcome_message_enabled: false,
    audio_transcription_enabled: false,
    daily_summary_enabled: false,
    daily_topics_enabled: false,
    peak_moment_enabled: false,
    polls_enabled: false,
  });

  useEffect(() => {
    if (!group) return;
    const settings = Array.isArray(group.group_settings) ? group.group_settings[0] : group.group_settings;

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
      setSummaryTime(toHHmm(settings?.daily_summary_time) || "19:00");
      setAutomationsEnabled({
        welcome_message_enabled: !!settings?.welcome_message_enabled,
        audio_transcription_enabled: !!settings?.audio_transcription_enabled,
        daily_summary_enabled: !!settings?.daily_summary_enabled,
        daily_topics_enabled: !!settings?.daily_topics_enabled,
        peak_moment_enabled: !!settings?.peak_moment_enabled,
        polls_enabled: !!settings?.polls_enabled,
      });

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

      const nextMeta = {
        ...baseMeta,
        language: language || null,
        timezone: timezone || null,
        operations: {
          ...baseOps,
          summary_time: summaryTime || null,
        },
      };

      const groupUpdate = supabase
        .from("groups")
        .update({
          description: description.trim() || null,
          status,
          is_archived: archived,
          invite_link: normalizeWhatsAppInviteLink(inviteLinkInput) || null,
          metadata: nextMeta,
        })
        .eq("id", groupId!);

      const settingsUpsert = supabase
        .from("group_settings")
        .upsert({
          group_id: groupId!,
          welcome_message_enabled: automationsEnabled.welcome_message_enabled,
          audio_transcription_enabled: automationsEnabled.audio_transcription_enabled,
          daily_summary_enabled: automationsEnabled.daily_summary_enabled,
          daily_summary_time: toDbTime(summaryTime),
          daily_topics_enabled: automationsEnabled.daily_topics_enabled,
          peak_moment_enabled: automationsEnabled.peak_moment_enabled,
          polls_enabled: automationsEnabled.polls_enabled,
        }, { onConflict: "group_id" });

      const [{ error: groupError }, { error: settingsError }] = await Promise.all([groupUpdate, settingsUpsert]);

      if (groupError) throw groupError;
      if (settingsError) throw settingsError;
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
      const v = normalizeWhatsAppInviteLink(inviteLinkInput);
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
    const val = normalizeWhatsAppInviteLink(inviteLinkInput) || normalizeWhatsAppInviteLink(group.invite_link || "");
    if (!val) {
      notifyValidation.custom("Convite necessário", "Configure o link do grupo e tente de novo.");
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

  const runSummaryNowMutation = useMutation({
    mutationFn: async () => {
      const headers = await getEdgeFunctionAuthHeaders();
      const { data, error } = await supabase.functions.invoke("generate-group-summary", {
        body: {
          groupId: groupId!,
          sendToGroup: false,
        },
        headers,
      });
      if (error) throw await normalizeEdgeFunctionError(error, "Algo deu errado. Tente novamente.");
      return data as any;
    },
    onSuccess: (data) => {
      const summaryType = typeof data?.summaryType === "string" ? data.summaryType : "resumo";
      notify.success("Resumo gerado", `${summaryType} processado com sucesso.`);
      queryClient.invalidateQueries({ queryKey: ["group-edit", groupId] });
      queryClient.invalidateQueries({ queryKey: ["group-latest-summary", groupId] });
    },
    onError: (error: any) => {
      notify.error("Não foi possível gerar resumo", error?.message || "Algo deu errado. Tente novamente.");
    },
  });

  const sendSummaryNowMutation = useMutation({
    mutationFn: async () => {
      const headers = await getEdgeFunctionAuthHeaders();
      const { data, error } = await supabase.functions.invoke("generate-group-summary", {
        body: {
          groupId: groupId!,
          sendToGroup: true,
        },
        headers,
      });
      if (error) throw await normalizeEdgeFunctionError(error, "Algo deu errado. Tente novamente.");
      return data as any;
    },
    onSuccess: (data) => {
      const summaryType = typeof data?.summaryType === "string" ? data.summaryType : "resumo";
      notify.success("Resumo enviado", `${summaryType} gerado e enviado no grupo.`);
      queryClient.invalidateQueries({ queryKey: ["group-edit", groupId] });
      queryClient.invalidateQueries({ queryKey: ["group-latest-summary", groupId] });
    },
    onError: (error: any) => {
      notify.error("Não foi possível enviar resumo", error?.message || "Algo deu errado. Tente novamente.");
    },
  });

  const runTopicsNowMutation = useMutation({
    mutationFn: async () => {
      const headers = await getEdgeFunctionAuthHeaders();
      const { data, error } = await supabase.functions.invoke("generate-group-topics-keywords", {
        body: {
          groupId: groupId!,
        },
        headers,
      });
      if (error) throw await normalizeEdgeFunctionError(error, "Algo deu errado. Tente novamente.");
      return data as any;
    },
    onSuccess: (data) => {
      const topicsCount = Number(data?.topicsCount || 0);
      const keywordsCount = Number(data?.keywordsCount || 0);
      notify.success("Tópicos e keywords gerados", `${topicsCount} tópicos e ${keywordsCount} keywords processados.`);
      queryClient.invalidateQueries({ queryKey: ["group-edit", groupId] });
      queryClient.invalidateQueries({ queryKey: ["group-latest-topics-snapshot", groupId] });
    },
    onError: (error: any) => {
      notify.error("Não foi possível gerar tópicos", error?.message || "Algo deu errado. Tente novamente.");
    },
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

  const timezoneError = useMemo(() => {
    if (!timezone.trim()) return null;
    return isValidIanaTimeZone(timezone) ? null : "Timezone inválido. Use um identificador IANA (ex.: America/Sao_Paulo).";
  }, [timezone]);

  const summaryTimeError = useMemo(() => {
    if (!summaryTime.trim()) return null;
    return isValidTimeHHmm(summaryTime) ? null : "Horário inválido. Use o formato HH:mm (ex.: 08:00).";
  }, [summaryTime]);

  const hasValidationErrors = !!timezoneError || !!summaryTimeError;
  const activeAutomationsCount = useMemo(
    () => AUTOMATION_PANEL_KEYS.filter((key) => Boolean(automationsEnabled[key])).length,
    [automationsEnabled]
  );
  const activeLiveAutomationsCount = useMemo(
    () =>
      AUTOMATION_PANEL_KEYS.filter(
        (key) => Boolean(automationsEnabled[key]) && AUTOMATION_LABELS[key].availability === "live"
      ).length,
    [automationsEnabled]
  );
  const activePreparedAutomationsCount = useMemo(
    () =>
      AUTOMATION_PANEL_KEYS.filter(
        (key) => Boolean(automationsEnabled[key]) && AUTOMATION_LABELS[key].availability === "prepared"
      ).length,
    [automationsEnabled]
  );

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
    if (status === "active") return { variant: "success" as const, label: "Ligado" };
    return { variant: "neutral" as const, label: "Pausado" };
  }, [status]);

  const connectionStatusHint = useMemo(() => {
    if (group?.sync_status === "error") {
      return "A sincronização mais recente falhou. Revise o link do grupo e tente verificar novamente.";
    }
    if (!lastActivityAt) {
      return "Ainda não encontramos atividade recente. Verifique o link do grupo para atualizar admins e conexão.";
    }
    const lastMsgDate = new Date(lastActivityAt);
    const hoursSinceLastMsg = (Date.now() - lastMsgDate.getTime()) / (1000 * 60 * 60);
    if (hoursSinceLastMsg > 48) {
      return "O grupo está há mais de 48h sem novas mensagens. Vale confirmar se o link e a conexão continuam válidos.";
    }
    return "Conexão e atividade recentes parecem saudáveis neste grupo.";
  }, [group?.sync_status, lastActivityAt]);

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
    { label: "Central de Comando", href: "/" },
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
          <div className="rounded-[30px] border border-slate-200/90 bg-white p-4 shadow-[0_22px_60px_-42px_rgba(15,23,42,0.35)] sm:p-6">
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

              <div className="rounded-[24px] border border-slate-200/80 bg-slate-50/80 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-card-foreground">Configurações para equipe técnica</div>
                    <div className="text-xs text-muted-foreground">Idioma e fuso horário do grupo. O horário do resumo fica na seção de automações.</div>
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

          <div className="rounded-[30px] border border-slate-200/90 bg-white p-4 shadow-[0_22px_60px_-42px_rgba(15,23,42,0.35)] sm:p-6">
            <div className="space-y-1">
              <h2 className="text-lg sm:text-xl font-semibold">Estado do grupo</h2>
              <p className="text-sm text-muted-foreground">Quando estiver ligado, o Bóris gera os dados do grupo. Quando estiver pausado, ele só registra as mensagens.</p>
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
                <div className="text-[11px] text-muted-foreground">Em "Pausado", o grupo continua recebendo mensagens, mas não gera resumo, tópicos nem palavras-chave.</div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <label className="text-xs font-medium text-muted-foreground">Arquivamento</label>
                  <StatusTag variant={archived ? "warning" : "neutral"}>{archived ? "Arquivado" : "Não arquivado"}</StatusTag>
                </div>
                <div className="rounded-[24px] border border-slate-200/80 bg-slate-50/80 px-4 py-3">
                    <div className="text-sm text-card-foreground">Arquivamento é uma ação com confirmação</div>
                  <div className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                    Use a seção "Ações sensíveis" para arquivar com confirmação. O grupo deixa de aparecer nas listas.
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[30px] border border-slate-200/90 bg-white p-4 shadow-[0_22px_60px_-42px_rgba(15,23,42,0.35)] sm:p-6">
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
              <div className="rounded-[20px] border border-border/70 bg-secondary/10 px-4 py-3 text-sm text-muted-foreground">
                {connectionStatusHint}
              </div>

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

              <div className="rounded-[24px] border border-slate-200/80 bg-slate-50/80 p-4">
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
                    <div className="mt-3 text-sm text-muted-foreground">
                      Nenhum admin foi detectado na última verificação. Revise o link e use "Verificar grupo" para atualizar esta lista.
                    </div>
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

          <div className="rounded-[30px] border border-slate-200/90 bg-white p-4 shadow-[0_22px_60px_-42px_rgba(15,23,42,0.35)] sm:p-6">
            <div className="space-y-1">
              <h2 className="text-lg sm:text-xl font-semibold">Automações do grupo</h2>
              <p className="text-sm text-muted-foreground">Escolha quais rotinas automáticas do Bóris ficam ativas neste grupo.</p>
            </div>

            <div className="mt-5 space-y-4">
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                <div className="rounded-[24px] border border-slate-200/80 bg-slate-50/60 p-4">
                  <div className="text-sm font-semibold text-card-foreground">Último resumo</div>
                  {latestSummary?.summary_text ? (
                    <>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {String(latestSummary.summary_date || "") || "Sem data"} · {String(latestSummary?.metadata?.summary_type || "Resumo")}
                      </div>
                      <div className="mt-3 text-sm leading-relaxed text-card-foreground">
                        {truncateText(String(latestSummary.summary_text || ""))}
                      </div>
                    </>
                  ) : (
                    <div className="mt-2 text-sm text-muted-foreground">Nenhum resumo gerado ainda para este grupo.</div>
                  )}
                </div>

                <div className="rounded-[24px] border border-slate-200/80 bg-slate-50/60 p-4">
                  <div className="text-sm font-semibold text-card-foreground">Última execução analítica</div>
                  <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border border-border/60 bg-secondary/20 p-3">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Resumo</div>
                      <div className="mt-1 text-sm font-medium text-card-foreground">
                        {latestSummary?.summary_date ? String(latestSummary.summary_date) : "Nunca executado"}
                      </div>
                    </div>
                    <div className="rounded-lg border border-border/60 bg-secondary/20 p-3">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Tópicos/keywords</div>
                      <div className="mt-1 text-sm font-medium text-card-foreground">
                        {latestTopicsSnapshot?.topic_date ? String(latestTopicsSnapshot.topic_date) : "Nunca executado"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-[24px] border border-slate-200/80 bg-slate-50/60 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-card-foreground">Ações manuais</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">Use estas ações para testar o grupo sem esperar o horário automático.</div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      className="rounded-xl"
                      onClick={() => runSummaryNowMutation.mutate()}
                      disabled={runSummaryNowMutation.isPending}
                    >
                      {runSummaryNowMutation.isPending ? "Gerando resumo..." : "Gerar resumo agora"}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      className="rounded-xl"
                      onClick={() => sendSummaryNowMutation.mutate()}
                      disabled={sendSummaryNowMutation.isPending}
                    >
                      {sendSummaryNowMutation.isPending ? "Enviando resumo..." : "Enviar resumo no grupo"}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      className="rounded-xl"
                      onClick={() => runTopicsNowMutation.mutate()}
                      disabled={runTopicsNowMutation.isPending}
                    >
                      {runTopicsNowMutation.isPending ? "Gerando tópicos..." : "Gerar tópicos/keywords agora"}
                    </Button>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-1 gap-2 text-[11px] text-muted-foreground sm:grid-cols-3">
                  <div className="rounded-xl border border-border/60 bg-background/70 px-3 py-2">
                    <span className="font-medium text-foreground">Gerar resumo agora</span> cria uma leitura para revisão interna sem publicar no grupo.
                  </div>
                  <div className="rounded-xl border border-border/60 bg-background/70 px-3 py-2">
                    <span className="font-medium text-foreground">Enviar resumo no grupo</span> gera e publica o resumo imediatamente, mesmo fora do horário automático.
                  </div>
                  <div className="rounded-xl border border-border/60 bg-background/70 px-3 py-2">
                    <span className="font-medium text-foreground">Gerar tópicos/keywords agora</span> atualiza a leitura analítica sem enviar mensagem no grupo.
                  </div>
                </div>
              </div>

              <div className="rounded-[24px] border border-slate-200/80 bg-slate-50/80 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-card-foreground">Central de automações</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">As opções abaixo alimentam diretamente o backend do Bóris.</div>
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/80 px-3 py-1.5 text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">{activeAutomationsCount}</span>
                    <span>{activeAutomationsCount === 1 ? "automação ativa" : "automações ativas"}</span>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div className="rounded-[20px] border border-border/70 bg-background/80 px-4 py-3">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Ativas agora</div>
                    <div className="mt-1 text-2xl font-semibold text-foreground">{activeAutomationsCount}</div>
                    <div className="mt-1 text-xs text-muted-foreground">Total de rotinas ligadas neste grupo.</div>
                  </div>
                  <div className="rounded-[20px] border border-success/20 bg-success/5 px-4 py-3">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-success">Ao vivo</div>
                    <div className="mt-1 text-2xl font-semibold text-foreground">{activeLiveAutomationsCount}</div>
                    <div className="mt-1 text-xs text-muted-foreground">Já podem rodar operacionalmente no backend.</div>
                  </div>
                  <div className="rounded-[20px] border border-warning/25 bg-warning/5 px-4 py-3">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-warning">Preparadas</div>
                    <div className="mt-1 text-2xl font-semibold text-foreground">{activePreparedAutomationsCount}</div>
                    <div className="mt-1 text-xs text-muted-foreground">Configuradas no grupo, mas ainda sem rotina conectada.</div>
                  </div>
                </div>

                <div className="mt-4 rounded-[20px] border border-border/70 bg-background/70 px-4 py-3 text-sm text-muted-foreground">
                  Ligue primeiro o que precisa rodar no dia a dia, ajuste o horário do resumo quando necessário e deixe as ações manuais para testes ou disparos pontuais.
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3">
                  {AUTOMATION_PANEL_KEYS.map((key) => {
                    const info = AUTOMATION_LABELS[key];
                    const enabled = !!automationsEnabled[key];
                    const isPreparedOnly = info.availability === "prepared";
                    return (
                      <div key={key} className="rounded-xl border border-border/70 bg-card/85 p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="text-sm font-medium text-card-foreground">{info.name}</div>
                              <span
                                className={cn(
                                  "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                                  enabled
                                    ? "border-primary/25 bg-primary/10 text-primary"
                                    : "border-border/80 bg-secondary/30 text-muted-foreground",
                                )}
                              >
                                {enabled ? "Ligado" : "Desligado"}
                              </span>
                              <span
                                className={cn(
                                  "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                                  isPreparedOnly
                                    ? "border-warning/30 bg-warning/10 text-warning"
                                    : "border-success/30 bg-success/10 text-success",
                                )}
                              >
                                {isPreparedOnly ? "Preparado" : "Ao vivo"}
                              </span>
                            </div>
                            <div className="mt-1 text-xs text-muted-foreground">{info.description}</div>
                            {isPreparedOnly ? (
                              <div className="mt-2 text-[11px] text-muted-foreground">
                                Configuração pronta no grupo. A rotina operacional ainda não foi conectada no backend.
                              </div>
                            ) : null}

                            {key === "daily_summary_enabled" ? (
                              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="space-y-2">
                                  <label htmlFor="group-summary-time" className="text-xs font-medium text-muted-foreground">Horário do resumo</label>
                                  <Select value={summaryTime} onValueChange={setSummaryTime}>
                                    <SelectTrigger
                                      id="group-summary-time"
                                      className={cn("h-11 rounded-xl", summaryTimeError ? "border-destructive focus-visible:ring-destructive/30" : "")}
                                      aria-invalid={!!summaryTimeError}
                                      aria-describedby={summaryTimeError ? "group-summary-time-error" : undefined}
                                    >
                                      <SelectValue placeholder="Selecione um horário" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-2xl border-slate-200/90 bg-white">
                                      {!SUMMARY_TIME_PRESETS.some((option) => option.value === summaryTime) && summaryTime ? (
                                        <>
                                          <SelectGroup>
                                            <SelectLabel>Atual</SelectLabel>
                                            <SelectItem value={summaryTime}>
                                              {summaryTime} (personalizado)
                                            </SelectItem>
                                          </SelectGroup>
                                          <SelectSeparator />
                                        </>
                                      ) : null}
                                      {SUMMARY_TIME_GROUPS.map((group) => (
                                        <SelectGroup key={group.label}>
                                          <SelectLabel>{group.label}</SelectLabel>
                                          {group.values.map((option) => (
                                            <SelectItem key={option.value} value={option.value}>
                                              {option.label}
                                            </SelectItem>
                                          ))}
                                        </SelectGroup>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <div className="text-[11px] text-muted-foreground">Escolha um horário em intervalos de 30 minutos. Se esta opção estiver ligada, o resumo também será enviado no grupo.</div>
                                  {summaryTimeError ? <div id="group-summary-time-error" className="text-[11px] text-destructive">{summaryTimeError}</div> : null}
                                </div>
                              </div>
                            ) : null}
                          </div>

                          <Switch
                            checked={enabled}
                            onCheckedChange={(v) => setAutomationsEnabled((prev) => ({ ...prev, [key]: v }))}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          </div>

          <div className="rounded-[30px] border border-slate-200/90 bg-white p-4 shadow-[0_22px_60px_-42px_rgba(15,23,42,0.35)] sm:p-6">
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
              <div className="mt-5 rounded-[24px] border border-destructive/30 bg-destructive/5 p-4">
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
            <div className="rounded-[24px] border border-slate-200/90 bg-white/95 backdrop-blur px-4 py-3 shadow-[0_18px_45px_-36px_rgba(15,23,42,0.34)]">
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
