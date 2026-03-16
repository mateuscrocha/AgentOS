import { AdminLayout } from "@/components/layout/AdminLayout";
import { BorisTable, RowActions } from "@/components/ui/boris-table";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { AdminPageHeader } from "@/components/layout/AdminPageHeader";
import { ListSectionHeader } from "@/components/dashboard/ListSectionHeader";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import {
  Users,
  Edit,
  FolderOpen,
  ChevronDown,
  CreditCard,
  Mail,
  Trash2,
  Tag,
  Plus,
  HelpCircle,
  Loader2,
  Ban,
  X,
  CheckCircle2,
  CircleDashed,
  Sparkles,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useUserRoles } from "@/hooks/use-user-roles";
import { useAuth } from "@/hooks/use-auth";
import { useOrgCounts } from "@/hooks/use-org-counts";
import { useOrgCoreData } from "@/hooks/use-org-core-data";
import { useUserOnboarding } from "@/hooks/use-user-onboarding";
import AccessDenied from "./AccessDenied";
import { formatDateSimpleBR } from "@/lib/date";
import { EditOrganizationModal } from "@/components/modals/EditOrganizationModal";
import { EditOrganizationContactModal } from "@/components/modals/EditOrganizationContactModal";
import { EditGroupModal } from "@/components/modals/EditGroupModal";
import { Button } from "@/components/ui/button";
import { notify } from "@/components/ui/sonner";
import { Input } from "@/components/ui/input";
import { notifyActionError } from "@/lib/notify-action-error";
import { SendGroupMessageDialog } from "@/components/modals/SendGroupMessageDialog";
import { sendGroupMessageWebhook } from "@/lib/group-message-webhook";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PeriodFilter } from "@/components/group-dashboard/PeriodFilter";
import { StatusTag } from "@/components/ui/status-tag";
import { Card, CardContent } from "@/components/ui/card";
import { UserInline } from "@/components/ui/UserInline";
import {
  getDateRange,
  type PeriodType,
  type DateRange,
  parseStoredPeriod,
  buildStoredPeriod,
} from "@/components/group-dashboard/period-utils";
import { countWordsFromRows, extractBigramsFromRows } from "@/utils/keywords";
import { useKeywordBlacklist } from "@/hooks/use-keyword-blacklist";
import { subDays } from "date-fns";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { logEvent } from "@/lib/audit";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { parseSupabaseFunctionInvokeError } from "@/lib/supabase-function-invoke-error";

const PANORAMA_PAGE_SIZE = 20;
const RECENT_MESSAGES_HOURS = 24;
const ORG_PAGE_STALE_TIME_MS = 30_000;
const ORG_PAGE_GC_TIME_MS = 5 * 60_000;

const hasTrackedSessionEvent = (key: string) => {
  try {
    return globalThis.sessionStorage?.getItem(key) === "1";
  } catch {
    return false;
  }
};

const markSessionEventTracked = (key: string) => {
  try {
    globalThis.sessionStorage?.setItem(key, "1");
  } catch {
    void 0;
  }
};

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

interface OrganizationDetail {
  id: string;
  name: string;
  slug: string | null;
  status: string;
  owner_user_id: string | null;
  plan: string | null;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  billing_status: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  settings: Record<string, any> | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  metadata: Record<string, any> | null;
}

interface GroupListItem {
  id: string;
  name: string;
  created_at?: string;
  organization_id?: string;
  is_active?: boolean | null;
  members_count?: number;
  last_access_at?: string | null;
  description?: string | null;
}

interface OrgProfileMetadata {
  cnpj?: string;
  address?: string;
  founded_at?: string;
  area?: string;
  website?: string;
  logo_url?: string;
  cover_url?: string;
  socials?: {
    facebook?: string;
    instagram?: string;
    linkedin?: string;
  };
}

type OrgGroupSignalRow = {
  id: string;
  name: string;
  isActive: boolean | null;
  syncStatus: string | null;
  lastSyncAt: string | null;
  messagesCurrent: number | null;
  messagesPrevious: number | null;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  lastSummaryDate: string | null;
  lastSummaryText: string | null;
};

type ActivityLevel = "silencio" | "baixo" | "medio" | "alto";
type TrendLevel = "subindo" | "estavel" | "caindo" | "sem_dados";

interface GroupDetails {
  id: string;
  name: string;
  organization_id: string;
  provider: string;
  whatsapp_provider_id: string | null;
}

type N8nCheckGroupNotEnabledResponse = {
  checkBotEnabled: false;
};

type N8nCheckGroupSuccessItem = {
  phone?: unknown;
  provider_phone?: unknown;
  subject?: unknown;
  name?: unknown;
  description?: unknown;
  creation?: unknown;
  participants?: unknown;
  [key: string]: unknown;
};

const isBotNotEnabledResponse = (payload: unknown): payload is N8nCheckGroupNotEnabledResponse => {
  if (!payload || typeof payload !== "object") return false;
  return (payload as any).checkBotEnabled === false;
};

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

const extractGroupAddedFlag = (payload: unknown): boolean | null => {
  if (isObjectRecord(payload) && typeof payload.groupAdded === "boolean") {
    return payload.groupAdded;
  }

  if (Array.isArray(payload)) {
    for (const item of payload) {
      const nested = extractGroupAddedFlag(item);
      if (nested !== null) return nested;
    }
  }

  if (isObjectRecord(payload)) {
    for (const value of Object.values(payload)) {
      const nested = extractGroupAddedFlag(value);
      if (nested !== null) return nested;
    }
  }

  return null;
};

const extractN8nGroupItem = (payload: unknown): N8nCheckGroupSuccessItem | null => {
  if (Array.isArray(payload)) {
    const candidate = payload.find((item) => isObjectRecord(item) && Array.isArray((item as any).participants));
    return (candidate as N8nCheckGroupSuccessItem | undefined) ?? null;
  }

  if (isObjectRecord(payload)) {
    if (Array.isArray(payload.data)) {
      return extractN8nGroupItem(payload.data);
    }
    if (Array.isArray(payload.result)) {
      return extractN8nGroupItem(payload.result);
    }
    for (const value of Object.values(payload)) {
      const nested = extractN8nGroupItem(value);
      if (nested) return nested;
    }
  }

  return null;
};

const toDigits = (raw: unknown): string => String(raw ?? "").replace(/\D/g, "");

const toE164 = (raw: unknown): string | null => {
  const s = String(raw ?? "").trim();
  if (!s) return null;

  if (s.startsWith("+")) {
    const digits = s.replace(/\D/g, "");
    if (!digits) return null;
    if (digits.startsWith("55") && digits.length >= 10) return "+" + digits;
    return "+55" + digits;
  }

  const digits = s.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("55") && digits.length >= 10) return "+" + digits;
  if (digits.length === 10 || digits.length === 11) return "+55" + digits;
  return "+" + digits;
};

const toISOFromCreation = (raw: unknown): string | null => {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    const ms = raw < 1e12 ? raw * 1000 : raw;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  if (typeof raw === "string") {
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  return null;
};

const upsertMembersForGroup = async (args: {
  groupId: string;
  participants: unknown;
}) => {
  if (!Array.isArray(args.participants)) {
    throw new Error("PARTICIPANTS_INVALID");
  }

  const rows = args.participants
    .map((p: any) => {
      const phoneRaw = String(p?.phone ?? "").trim();
      const lidRaw = typeof p?.lid === "string" ? p.lid.trim() : null;
      const phoneDigits = toDigits(phoneRaw);
      const phoneE164 = toE164(phoneRaw);

      const isSuperAdmin = !!(p?.isSuperAdmin ?? p?.is_super_admin);
      const isAdmin = !!(p?.isAdmin ?? p?.is_admin) || isSuperAdmin;

      const name = String(p?.name ?? "").trim() || phoneE164 || lidRaw || "Membro";

      return {
        group_id: args.groupId,
        name,
        phone_e164: phoneE164,
        whatsapp_provider_id: phoneDigits || null,
        lid: lidRaw,
        is_admin: isAdmin,
        is_super_admin: isSuperAdmin,
        provider: "whatsapp",
        status: "active",
        deleted_at: null,
      };
    })
    .filter((r) => !!r.whatsapp_provider_id || !!r.lid);

  if (rows.length > 0) {
    const CHUNK_SIZE = 200;
    for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
      const chunk = rows.slice(i, i + CHUNK_SIZE);
      const { error } = await supabase
        .from("members")
        .upsert(chunk as any, { onConflict: "group_id,provider_member_id" });
      if (error) throw error;
    }
  }

  return { insertedOrUpdated: rows.length };
};

const ensureGroupFromN8nPayload = async (args: {
  orgId: string;
  inviteLink: string;
  item: N8nCheckGroupSuccessItem;
}) => {
  const providerPhoneRaw = String(args.item.provider_phone ?? args.item.phone ?? "").trim();
  const whatsappProviderId = providerPhoneRaw || null;
  if (!whatsappProviderId) {
    throw new Error("GROUP_PROVIDER_ID_MISSING");
  }

  const groupName = String(args.item.name ?? args.item.subject ?? "").trim() || "Grupo WhatsApp";
  const description =
    typeof args.item.description === "string" && args.item.description.trim()
      ? args.item.description.trim()
      : null;
  const createdAtProvider = toISOFromCreation(args.item.creation);

  const { data: existingGroup, error: existingError } = await supabase
    .from("groups")
    .select("id")
    .eq("organization_id", args.orgId)
    .eq("whatsapp_provider_id", whatsappProviderId)
    .maybeSingle();
  if (existingError) throw existingError;

  const groupPayload = {
    organization_id: args.orgId,
    name: groupName,
    description,
    provider: "whatsapp",
    provider_phone: providerPhoneRaw || null,
    whatsapp_provider_id: whatsappProviderId,
    invite_link: args.inviteLink,
    invite_link_status: "valid",
    is_active: true,
    is_archived: false,
    status: "active",
    created_at_provider: createdAtProvider,
    raw_provider: args.item as any,
  };

  let groupId = existingGroup?.id as string | undefined;
  if (groupId) {
    const { error: updateError } = await supabase
      .from("groups")
      .update(groupPayload as any)
      .eq("id", groupId);
    if (updateError) throw updateError;
  } else {
    const { data: insertedGroup, error: insertError } = await supabase
      .from("groups")
      .insert(groupPayload as any)
      .select("id")
      .single();
    if (insertError) throw insertError;
    groupId = insertedGroup.id;
  }

  if (!groupId) {
    throw new Error("GROUP_ID_NOT_RESOLVED");
  }

  const membersResult = await upsertMembersForGroup({
    groupId,
    participants: args.item.participants,
  });

  return {
    groupId,
    groupName,
    membersUpserted: membersResult.insertedOrUpdated,
    existed: !!existingGroup?.id,
  };
};

let orgGroupsSignalRpcAvailable: boolean | null = null;

const Org = () => {
  const { orgId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [panoramaPage, setPanoramaPage] = useState(1);
  const [recentMessagesStartISO] = useState(
    () => new Date(Date.now() - RECENT_MESSAGES_HOURS * 60 * 60 * 1000).toISOString(),
  );
  const { isAuthenticated, loading: authLoading, user } = useAuth();
  const { isOrgActivationDismissed, dismissOrgActivation, reopenOrgActivation, isSaving: onboardingSaving } = useUserOnboarding(user?.id);
  const { canEditOrg, canEditGroup, hasOrgAccess, isLoading: rolesLoading, isSystemAdmin } = useUserRoles();
  const [editOrgOpen, setEditOrgOpen] = useState(false);
  const [editGroup, setEditGroup] = useState<GroupDetails | null>(null);
  const [removeGroup, setRemoveGroup] = useState<GroupListItem | null>(null);
  const [removing, setRemoving] = useState(false);
  const [cascadeGroup, setCascadeGroup] = useState<GroupListItem | null>(null);
  const [deletingCascade, setDeletingCascade] = useState(false);
  const [editContactOpen, setEditContactOpen] = useState(false);
  const [attachGroupOpen, setAttachGroupOpen] = useState(false);
  const [attachInviteLink, setAttachInviteLink] = useState("");
  const [attachError, setAttachError] = useState<string | null>(null);
  const [attaching, setAttaching] = useState(false);
  const [sendMessageGroup, setSendMessageGroup] = useState<GroupListItem | null>(null);
  const [isSendingGroupMessage, setIsSendingGroupMessage] = useState(false);

  const [profileSearch, setProfileSearch] = useState("");
  const [profileStatusFilter, setProfileStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [profileLeaderFilter, setProfileLeaderFilter] = useState<string>("");
  const [profileOrderBy, setProfileOrderBy] = useState<"name" | "members" | "status">("name");
  const [profileOrderDir, setProfileOrderDir] = useState<"asc" | "desc">("asc");

  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>('7d');
  const [customRange, setCustomRange] = useState<DateRange | undefined>();

  const accessGrantedLoggedRef = useRef(false);
  const accessDeniedLoggedRef = useRef(false);
  const loadFailedLoggedRef = useRef(false);

  const hasAccess = !!orgId && (isSystemAdmin || hasOrgAccess(orgId));

  useEffect(() => {
    try {
      const raw = localStorage.getItem(`org-period:${orgId}`);
      if (raw) {
        const saved = JSON.parse(raw);
        const { period, range, isValid } = parseStoredPeriod(saved, "7d");
        if (!isValid) {
          localStorage.removeItem(`org-period:${orgId}`);
        }
        setSelectedPeriod(period);
        setCustomRange(range);
      }
    } catch { void 0; }
  }, [orgId]);

  useEffect(() => {
    if (!orgId) return;

    const payload = buildStoredPeriod(selectedPeriod, customRange);
    try {
      localStorage.setItem(`org-period:${orgId}`, JSON.stringify(payload));
    } catch { void 0; }
  }, [orgId, selectedPeriod, customRange]);

  useEffect(() => {
    if (!orgId || !isAuthenticated) return;

    const channel = supabase
      .channel(`realtime:org:${orgId}:events`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "events", filter: `entity_id=eq.${orgId}` },
        (payload) => {
          const row = (payload as any)?.new as any;
          if (!row || row.entity_type !== "organization") return;

          if (row.event_type === "ORG_GROUP_CASCADE_DELETED") {
            notify.success(
              "Grupo excluído",
              row?.metadata?.group_name ? `“${row.metadata.group_name}” foi excluído.` : "Tudo certo.",
            );
            queryClient.invalidateQueries({ queryKey: ["org-groups", orgId] });
            queryClient.invalidateQueries({ queryKey: ["org-group-ids", orgId] });
            queryClient.invalidateQueries({ queryKey: ["org-active-groups-count", orgId] });
            queryClient.invalidateQueries({ queryKey: ["org-total-members", orgId] });
            queryClient.invalidateQueries({ queryKey: ["org-messages-7d", orgId] });
            return;
          }

          if (row.event_type === "ORG_GROUP_CASCADE_DELETE_FAILED") {
            notify.error(
              "Falha ao excluir grupo",
              row?.metadata?.group_name ? `Não foi possível excluir “${row.metadata.group_name}”.` : "Algo deu errado.",
            );
            return;
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orgId, isAuthenticated, queryClient]);

  useEffect(() => {
    if (authLoading || rolesLoading) return;
    if (!isAuthenticated || !orgId || !user?.id) return;

    if (hasAccess) {
      if (accessGrantedLoggedRef.current) return;
      accessGrantedLoggedRef.current = true;
      logEvent({
        eventType: "ORG_ACCESS_GRANTED",
        entityType: "organization",
        entityId: orgId,
        userId: user.id,
        metadata: { path: typeof window !== "undefined" ? window.location.pathname : null },
      });
      return;
    }

    if (accessDeniedLoggedRef.current) return;
    accessDeniedLoggedRef.current = true;
    logEvent({
      eventType: "ORG_ACCESS_DENIED",
      entityType: "organization",
      entityId: orgId,
      userId: user.id,
      metadata: { path: typeof window !== "undefined" ? window.location.pathname : null },
    });
  }, [authLoading, rolesLoading, isAuthenticated, hasAccess, orgId, user?.id]);

  const handlePeriodChange = (period: PeriodType, range: DateRange) => {
    setSelectedPeriod(period);
    setCustomRange(period === 'custom' ? range : undefined);
  };

  const openGroupForEdit = async (groupId: string) => {
    try {
      const { data, error } = await supabase
        .from("groups")
        .select("id, name, organization_id, provider, whatsapp_provider_id")
        .eq("id", groupId)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Grupo não encontrado");
      setEditGroup(data as GroupDetails);
    } catch {
      notify.error("Não foi possível abrir", "Algo deu errado. Tente novamente.");
    }
  };

  const handleSendGroupMessage = async (group: GroupListItem, message: string) => {
    setIsSendingGroupMessage(true);
    try {
      await sendGroupMessageWebhook({
        groupId: group.id,
        groupName: group.name || "Grupo",
        message,
      });
      notify.success("Mensagem enviada", "Tudo certo.");
      setSendMessageGroup(null);
    } catch (err: any) {
      notifyActionError("Não foi possível enviar mensagem", err, "Tente novamente.");
    } finally {
      setIsSendingGroupMessage(false);
    }
  };

  const {
    org,
    orgLoading,
    orgError,
    refetchOrg,
    ownerProfile,
    primaryContact,
    contactUser,
    isFallbackContact,
    contactLoading,
    contactError,
    refetchPrimaryContact,
    contactName,
    contactEmail,
    contactPhone,
    contactRole,
  } = useOrgCoreData({
    orgId,
    isAuthenticated,
    hasAccess,
  });

  const {
    orgGroupIds,
    totalMembersCount,
    membersCountLoading,
    messagesLast7dCount,
    messagesCountLoading,
    activeGroupsCount,
    activeGroupsLoading,
  } = useOrgCounts({
    orgId,
    isAuthenticated,
    hasAccess,
  });

  

  

  const path = location.pathname;
  const isGroupsRoute = /^\/(?:org|organization)\/[^/]+\/groups$/.test(path);
  const isDashboardRoute = /^\/(?:org|organization)\/[^/]+\/dashboard$/.test(path);
  const isKeywordsRoute = /^\/(?:org|organization)\/[^/]+\/keywords$/.test(path);
  const isBaseOrg = /^\/(?:org|organization)\/[^/]+\/?$/.test(path);
  const isProfileRoute = /^\/(?:org|organization)\/[^/]+\/profile$/.test(path);
  const isDefaultOrgHome = isBaseOrg && !isGroupsRoute && !isDashboardRoute && !isKeywordsRoute;
  const shouldLoadProfileGroups = isGroupsRoute || isProfileRoute;
  const shouldLoadDashboardSignals = isDashboardRoute || isDefaultOrgHome;
  const shouldLoadKeywords = isKeywordsRoute;

  const breadcrumbItems = (() => {
    const items = [
      { label: "Central de Comando", href: "/" },
      { label: org?.name || "Organização" },
    ];
    if (isGroupsRoute) items.push({ label: "Grupos" });
    if (isDashboardRoute) items.push({ label: "Painel" });
    if (isKeywordsRoute) items.push({ label: "Palavras-chave" });
    if (isProfileRoute) items.push({ label: "Perfil" });
    return items;
  })();

  const {
    data: profileGroupsOverview,
    isLoading: profileGroupsLoading,
    error: profileGroupsError,
    refetch: refetchProfileGroups,
  } = useQuery({
    queryKey: ["org-profile-groups", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("v_group_overview")
        .select("group_id,group_name,description,members_count,is_active,organization_id")
        .eq("organization_id", orgId!)
        .neq("is_archived", true);
      if (error) throw error;
      return (data || []).map((g: any) => ({
        id: g.group_id as string,
        name: g.group_name as string,
        description: (g as any).description || null,
        organization_id: g.organization_id as string,
        members: typeof g.members_count === "number" ? g.members_count : null,
        status: g.is_active ? "Ativo" : "Inativo",
      }));
    },
    enabled: !!orgId && isAuthenticated && hasAccess && shouldLoadProfileGroups,
    staleTime: ORG_PAGE_STALE_TIME_MS,
    gcTime: ORG_PAGE_GC_TIME_MS,
  });

  const { data: profileLeaders } = useQuery({
    queryKey: ["org-profile-leaders", orgId, orgGroupIds?.join(",")],
    queryFn: async () => {
      if (!orgGroupIds || orgGroupIds.length === 0) return {} as Record<string, string>;
      const { data, error } = await supabase
        .from("members")
        .select("group_id,name,is_super_admin,is_admin")
        .in("group_id", orgGroupIds)
        .or("is_super_admin.eq.true,is_admin.eq.true");
      if (error) throw error;
      const map: Record<string, string> = {};
      (data || []).forEach((m: any) => {
        const gid = m.group_id as string;
        const name = String(m.name || "");
        if (!map[gid]) map[gid] = name;
        if (m.is_super_admin) map[gid] = name;
      });
      return map;
    },
    enabled: !!orgId && isAuthenticated && hasAccess && Array.isArray(orgGroupIds) && shouldLoadProfileGroups,
    staleTime: ORG_PAGE_STALE_TIME_MS,
    gcTime: ORG_PAGE_GC_TIME_MS,
  });

  const currentRange = getDateRange(selectedPeriod, customRange);
  const lengthMs = Math.max(0, currentRange.to.getTime() - currentRange.from.getTime());
  const previousPeriodEnd = new Date(currentRange.from.getTime() - 1);
  const previousPeriodStart = new Date(previousPeriodEnd.getTime() - lengthMs);
  const currentStartISO = currentRange.from.toISOString();
  const currentEndISO = currentRange.to.toISOString();
  const previousStartISO = previousPeriodStart.toISOString();
  const previousEndISO = previousPeriodEnd.toISOString();

  const decisionRange = getDateRange("7d", undefined);
  const decisionLengthMs = Math.max(0, decisionRange.to.getTime() - decisionRange.from.getTime());
  const decisionPrevEnd = new Date(decisionRange.from.getTime() - 1);
  const decisionPrevStart = new Date(decisionPrevEnd.getTime() - decisionLengthMs);
  const decisionStartISO = decisionRange.from.toISOString();
  const decisionEndISO = decisionRange.to.toISOString();
  const decisionPrevStartISO = decisionPrevStart.toISOString();
  const decisionPrevEndISO = decisionPrevEnd.toISOString();

  useEffect(() => {
    if (!orgId || !isAuthenticated || !hasAccess) return;
    if (typeof (supabase as any).channel !== "function") return;

    let refreshTimer: number | null = null;
    const groupIdSet = new Set(orgGroupIds ?? []);

    const scheduleOrgRefresh = () => {
      if (refreshTimer !== null) return;
      refreshTimer = globalThis.setTimeout(() => {
        refreshTimer = null;
        void Promise.all([
          queryClient.invalidateQueries({ queryKey: ["org-profile-groups", orgId] }),
          queryClient.invalidateQueries({ queryKey: ["org-profile-leaders", orgId] }),
          queryClient.invalidateQueries({ queryKey: ["org-groups-signals", orgId] }),
          queryClient.invalidateQueries({ queryKey: ["org-keywords", orgId] }),
          queryClient.invalidateQueries({ queryKey: ["org-panorama-recent-messages", orgId] }),
          queryClient.invalidateQueries({ queryKey: ["org-group-ids", orgId] }),
          queryClient.invalidateQueries({ queryKey: ["org-active-groups-count", orgId] }),
          queryClient.invalidateQueries({ queryKey: ["org-total-members", orgId] }),
          queryClient.invalidateQueries({ queryKey: ["org-messages-7d", orgId] }),
        ]);
      }, 400);
    };

    const affectsCurrentOrgByGroup = (payload: any) => {
      if (!groupIdSet.size) return false;
      const row = (payload?.new ?? payload?.old ?? {}) as any;
      const groupId = row?.group_id;
      return typeof groupId === "string" && groupIdSet.has(groupId);
    };

    const channel = supabase
      .channel(`realtime:org:${orgId}:dashboard`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "groups", filter: `organization_id=eq.${orgId}` },
        scheduleOrgRefresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "members" },
        (payload) => {
          if (affectsCurrentOrgByGroup(payload)) scheduleOrgRefresh();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "member_events" },
        (payload) => {
          if (affectsCurrentOrgByGroup(payload)) scheduleOrgRefresh();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        (payload) => {
          if (affectsCurrentOrgByGroup(payload)) scheduleOrgRefresh();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "message_reactions" },
        (payload) => {
          if (affectsCurrentOrgByGroup(payload)) scheduleOrgRefresh();
        },
      )
      .subscribe();

    return () => {
      if (refreshTimer !== null) globalThis.clearTimeout(refreshTimer);
      supabase.removeChannel(channel);
    };
  }, [orgId, isAuthenticated, hasAccess, orgGroupIds, queryClient]);

  const formatNumberBR = (value: number) => new Intl.NumberFormat("pt-BR").format(value);

  const toPreview = (raw: string | null | undefined, max = 140): string => {
    const text = String(raw ?? "")
      .replace(/```[\s\S]*?```/g, " ")
      .replace(/https?:\/\/[^\s)\]}>,]+/gi, " ")
      .replace(/[*_~`]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!text) return "";
    if (text.length <= max) return text;
    const sliced = text.slice(0, max);
    return sliced.replace(/\s+\S*$/, "").trimEnd() + "…";
  };

  const buildOrgGroupsCsv = (rows: Array<{ id: string; name: string; description: string | null; leader: string | null; members: number | null; status: string }>): string => {
    const headers = ["Grupo","Descrição","Líder","Integrantes","Status"]; 
    const escape = (v: any) => {
      const s = String(v ?? "");
      const needs = /[",\n]/.test(s);
      const escaped = s.replace(/"/g, '""');
      return needs ? `"${escaped}"` : escaped;
    };
    const lines = [headers.join(",")];
    for (const r of rows) {
      lines.push([escape(r.name), escape(r.description ?? ""), escape(r.leader ?? ""), String(r.members ?? 0), r.status].join(","));
    }
    return lines.join("\n");
  };

  const orgGroupsListSection = (() => {
    const groupsOverview = profileGroupsOverview;
    const groupsLoading = profileGroupsLoading;
    const groupsError = profileGroupsError;
    const leaders = profileLeaders;

    const list = (groupsOverview || []).map((g: any) => ({ ...g, leader: leaders?.[g.id] || null }));
    const filtered = list.filter((g: any) => {
      const s = profileSearch.trim().toLowerCase();
      if (s && !(`${g.name}`.toLowerCase().includes(s) || `${g.description || ""}`.toLowerCase().includes(s))) return false;
      if (profileStatusFilter !== "all") {
        if (profileStatusFilter === "active" && g.status !== "Ativo") return false;
        if (profileStatusFilter === "inactive" && g.status !== "Inativo") return false;
      }
      if (profileLeaderFilter.trim()) {
        const l = profileLeaderFilter.trim().toLowerCase();
        if (!(`${g.leader || ""}`.toLowerCase().includes(l))) return false;
      }
      return true;
    });
    const sorted = filtered.sort((a: any, b: any) => {
      const dir = profileOrderDir === "asc" ? 1 : -1;
      if (profileOrderBy === "name") return a.name.localeCompare(b.name, "pt-BR") * dir;
      if (profileOrderBy === "members") return ((a.members || 0) - (b.members || 0)) * dir;
      if (profileOrderBy === "status") return a.status.localeCompare(b.status, "pt-BR") * dir;
      return 0;
    });

    const hasActiveFilters =
      profileSearch.trim().length > 0 ||
      profileStatusFilter !== "all" ||
      profileLeaderFilter.trim().length > 0 ||
      profileOrderBy !== "name" ||
      profileOrderDir !== "asc";

    const clearFilters = () => {
      setProfileSearch("");
      setProfileStatusFilter("all");
      setProfileLeaderFilter("");
      setProfileOrderBy("name");
      setProfileOrderDir("asc");
    };

    const handleExportCsv = () => {
      const csv = buildOrgGroupsCsv(
        sorted.map((g: any) => ({
          id: g.id,
          name: g.name,
          description: g.description,
          leader: g.leader,
          members: g.members,
          status: g.status,
        })),
      );
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${org?.name || "organizacao"}-grupos.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    };

    const columns = [
      {
        key: "name",
        header: "Grupo",
        sortable: true,
        render: (g: any) => (
          <div className="min-w-0">
            <div className="font-semibold text-card-foreground truncate">{g.name}</div>
            <div className="text-xs text-muted-foreground truncate">{g.description || "Sem descrição"}</div>
          </div>
        ),
      },
      {
        key: "leader",
        header: "Líder",
        hideOn: "sm" as const,
        render: (g: any) => <span className="text-sm text-card-foreground">{g.leader || "-"}</span>,
      },
      {
        key: "members",
        header: "Integrantes",
        align: "right" as const,
        sortable: true,
        render: (g: any) => (
          <span className="tabular-nums text-sm font-medium text-card-foreground">
            {typeof g.members === "number" ? g.members.toLocaleString("pt-BR") : "-"}
          </span>
        ),
      },
      {
        key: "status",
        header: "Status",
        align: "center" as const,
        sortable: true,
        render: (g: any) => (
          <StatusTag variant={g.status === "Ativo" ? "success" : "neutral"}>
            {g.status}
          </StatusTag>
        ),
      },
      {
        key: "actions",
        header: "",
        align: "right" as const,
        render: (g: GroupListItem & { members?: number | null; status: string; leader?: string | null }) => {
          const canSend = canEditGroup(g.id, orgId);
          if (!canSend) return null;
          return (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setSendMessageGroup(g);
              }}
            >
              Enviar mensagem
            </Button>
          );
        },
      },
    ];

    return (
      <section className="rounded-2xl border border-border bg-card p-4 sm:p-6 space-y-4">
        <div className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-1">
              <h4 className="text-sm font-semibold text-foreground">Grupos da organização</h4>
              <p className="text-xs text-muted-foreground">Padrão de listagem administrativa com filtros e exportação</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleExportCsv}>
                Exportar CSV
              </Button>
            </div>
          </div>

          <ListSectionHeader
            title="Grupos"
            count={sorted.length}
            statusLabel={`${list.length} no total`}
            isLoading={groupsLoading}
          />
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-4">
            <Input
              type="text"
              placeholder="Buscar por nome ou descrição"
              value={profileSearch}
              onChange={(e) => setProfileSearch(e.target.value)}
              className="h-9"
            />
            <Select value={profileStatusFilter} onValueChange={(v) => setProfileStatusFilter(v as any)}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Status</SelectItem>
                <SelectItem value="active">Ativos</SelectItem>
                <SelectItem value="inactive">Inativos</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="text"
              placeholder="Filtrar por líder"
              value={profileLeaderFilter}
              onChange={(e) => setProfileLeaderFilter(e.target.value)}
              className="h-9"
            />
            <div className="grid grid-cols-2 gap-2">
              <Select value={profileOrderBy} onValueChange={(v) => setProfileOrderBy(v as any)}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Ordenar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Ordenar: nome</SelectItem>
                  <SelectItem value="members">Ordenar: integrantes</SelectItem>
                  <SelectItem value="status">Ordenar: status</SelectItem>
                </SelectContent>
              </Select>
              <Select value={profileOrderDir} onValueChange={(v) => setProfileOrderDir(v as any)}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Direção" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="asc">Asc</SelectItem>
                  <SelectItem value="desc">Desc</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {hasActiveFilters ? (
            <div className="flex justify-end">
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Limpar filtros
              </Button>
            </div>
          ) : null}

          <BorisTable
            columns={columns}
            data={sorted as any}
            keyExtractor={(g: any) => g.id}
            onRowClick={(g: any) => navigate(`/groups/${g.id}`)}
            loading={groupsLoading}
            error={groupsError ? "erro" : false}
            sortMode="manual"
            sortState={{ key: profileOrderBy, direction: profileOrderDir }}
            onSortChange={(sort) => {
              if (!sort || !["name", "members", "status"].includes(sort.key)) return;
              setProfileOrderBy(sort.key as "name" | "members" | "status");
              setProfileOrderDir(sort.direction);
            }}
            onRetry={() => {
              void refetchProfileGroups();
            }}
            emptyMessage="Nenhum grupo encontrado com os filtros atuais."
          />
        </div>
      </section>
    );
  })();

  const safeRatio = (curr: number, prev: number): number | null => {
    if (!Number.isFinite(curr) || !Number.isFinite(prev)) return null;
    if (prev <= 0) return curr > 0 ? 999 : 0;
    return curr / prev;
  };

  const computeActivityLevel = useCallback((row: OrgGroupSignalRow): ActivityLevel => {
    const curr = typeof row.messagesCurrent === "number" ? row.messagesCurrent : null;
    if (curr === null) {
      const lastAt = row.lastMessageAt ? new Date(row.lastMessageAt) : null;
      if (!lastAt) return "silencio";
      const silentCutoff = subDays(new Date(), 7);
      if (lastAt.getTime() < silentCutoff.getTime()) return "silencio";
      return "baixo";
    }
    if (curr <= 0) return "silencio";
    if (curr >= 120) return "alto";
    if (curr >= 40) return "medio";
    return "baixo";
  }, []);

  const computeTrend = useCallback((row: OrgGroupSignalRow): TrendLevel => {
    const curr = typeof row.messagesCurrent === "number" ? row.messagesCurrent : null;
    const prev = typeof row.messagesPrevious === "number" ? row.messagesPrevious : null;
    if (curr === null || prev === null) return "sem_dados";
    if (prev < 10 && curr < 10) return "estavel";
    const ratio = safeRatio(curr, prev);
    if (ratio === null) return "sem_dados";
    if (ratio >= 1.25) return "subindo";
    if (ratio <= 0.75) return "caindo";
    return "estavel";
  }, []);

  const computeAttention = useCallback((row: OrgGroupSignalRow) => {
    const now = new Date();
    const silentCutoff = subDays(now, 7);
    const lastAt = row.lastMessageAt ? new Date(row.lastMessageAt) : null;
    const silent = !lastAt || lastAt.getTime() < silentCutoff.getTime();
    const curr = typeof row.messagesCurrent === "number" ? row.messagesCurrent : null;
    const prev = typeof row.messagesPrevious === "number" ? row.messagesPrevious : null;
    const syncStatus = String(row.syncStatus ?? "").toLowerCase();
    const syncError = syncStatus === "error" || syncStatus === "failed";
    const ratio = curr !== null && prev !== null ? safeRatio(curr, prev) : null;

    if (silent) {
      return { priority: 1, variant: "error" as const, label: "Grupo em silêncio" };
    }

    if (syncError) {
      return { priority: 2, variant: "warning" as const, label: "Falha de sincronização" };
    }

    if (ratio !== null && prev !== null && prev >= 20) {
      if (ratio <= 0.45) {
        return { priority: 3, variant: "warning" as const, label: "Queda brusca de atividade" };
      }
      if (ratio >= 2.5) {
        return { priority: 4, variant: "warning" as const, label: "Pico atípico de mensagens" };
      }
    }

    return null;
  }, []);

  const { data: orgGroupsSignals, isLoading: signalsLoading, error: signalsError, refetch: refetchSignals } = useQuery({
    queryKey: ["org-groups-signals", orgId, decisionStartISO, decisionEndISO, decisionPrevStartISO, decisionPrevEndISO],
    queryFn: async () => {
      const runFallback = async () => {
        const fallback = await supabase
          .from("v_group_overview")
          .select("group_id, group_name, is_active, sync_status, last_sync_at, last_message_at, last_message_preview")
          .eq("organization_id", orgId)
          .neq("is_archived", true)
          .range(0, 1999);
        if (fallback.error) throw fallback.error;

        return ((fallback.data ?? []) as any[])
          .map((row) => ({
            id: String(row.group_id),
            name: String(row.group_name),
            isActive: row.is_active,
            syncStatus: row.sync_status ?? null,
            lastSyncAt: row.last_sync_at ?? null,
            messagesCurrent: null,
            messagesPrevious: null,
            lastMessageAt: row.last_message_at ?? null,
            lastMessagePreview: row.last_message_preview ?? null,
            lastSummaryDate: null,
            lastSummaryText: null,
          })) as OrgGroupSignalRow[];
      };

      if (orgGroupsSignalRpcAvailable === false) {
        return runFallback();
      }

      const { data, error } = await (supabase as any).rpc("get_org_groups_signal_overview", {
        p_organization_id: orgId,
        p_start: decisionStartISO,
        p_end: decisionEndISO,
        p_prev_start: decisionPrevStartISO,
        p_prev_end: decisionPrevEndISO,
      });

      if (!error) {
        orgGroupsSignalRpcAvailable = true;
        const rows = Array.isArray(data) ? data : Array.isArray((data as any)?.items) ? (data as any).items : data;
        if (!Array.isArray(rows)) return [] as OrgGroupSignalRow[];
        return rows
          .map((r: any) => ({
            id: String(r.id ?? ""),
            name: String(r.name ?? ""),
            isActive: r.isActive ?? r.is_active ?? null,
            syncStatus: (r.syncStatus ?? r.sync_status ?? null) as any,
            lastSyncAt: (r.lastSyncAt ?? r.last_sync_at ?? null) as any,
            messagesCurrent: typeof r.messagesCurrent === "number" ? r.messagesCurrent : typeof r.messages_current === "number" ? r.messages_current : typeof r.messagesCurrent === "string" ? Number(r.messagesCurrent) : typeof r.messages_current === "string" ? Number(r.messages_current) : null,
            messagesPrevious: typeof r.messagesPrevious === "number" ? r.messagesPrevious : typeof r.messages_previous === "number" ? r.messages_previous : typeof r.messagesPrevious === "string" ? Number(r.messagesPrevious) : typeof r.messages_previous === "string" ? Number(r.messages_previous) : null,
            lastMessageAt: (r.lastMessageAt ?? r.last_message_at ?? null) as any,
            lastMessagePreview: (r.lastMessagePreview ?? r.last_message_preview ?? null) as any,
            lastSummaryDate: (r.lastSummaryDate ?? r.last_summary_date ?? null) as any,
            lastSummaryText: (r.lastSummaryText ?? r.last_summary_text ?? null) as any,
          }))
          .filter((r: OrgGroupSignalRow) => r.id && r.name);
      }

      const lower = String((error as any)?.message ?? "").toLowerCase();
      const code = String((error as any)?.code ?? "");
      const isMissingFunction =
        code === "PGRST202" ||
        lower.includes("could not find the function") ||
        lower.includes("function") && lower.includes("does not exist");

      if (!isMissingFunction) {
        throw error;
      }

      orgGroupsSignalRpcAvailable = false;
      return runFallback();
    },
    enabled: !!orgId && isAuthenticated && hasAccess && shouldLoadDashboardSignals,
    staleTime: ORG_PAGE_STALE_TIME_MS,
    gcTime: ORG_PAGE_GC_TIME_MS,
  });

  // Fetch groups for this organization
  
  const {
    items: keywordBlacklist,
    blacklistSet,
    add: addKeywordToBlacklist,
    remove: removeKeywordFromBlacklist,
  } = useKeywordBlacklist();

  const { data: orgKeywords, isLoading: keywordsLoading, error: keywordsError, refetch: refetchKeywords } = useQuery({
    queryKey: ['org-keywords', orgId, orgGroupIds?.join(','), currentStartISO, currentEndISO, previousStartISO, previousEndISO, keywordBlacklist.join(',')],
    queryFn: async () => {
      if (!orgGroupIds || orgGroupIds.length === 0) return { words: [], bigrams: [] } as any;

      const buildRows = async (startISO: string, endISO: string): Promise<string[]> => {
        const q1 = await supabase
          .from('v_messages_feed')
          .select('content_preview,message_type,created_at,group_id')
          .in('group_id', orgGroupIds)
          .eq('message_type', 'text')
          .gte('created_at', startISO)
          .lte('created_at', endISO)
          .limit(2000);
        let rows: string[] = [];
        if (!q1.error) {
          rows = (q1.data || []).map((d: any) => d.content_preview || "");
        } else {
          const q2 = await supabase
            .from('messages')
            .select('content,message_type,created_at,group_id')
            .in('group_id', orgGroupIds)
            .eq('message_type', 'text')
            .is('deleted_at', null)
            .gte('created_at', startISO)
            .lte('created_at', endISO)
            .limit(2000);
          if (q2.error) throw q2.error;
          rows = (q2.data || []).map((d: any) => d.content || "");
        }
        return rows;
      };

      const currRows = await buildRows(currentStartISO, currentEndISO);
      const prevRows = await buildRows(previousStartISO, previousEndISO);

      const currCounts = countWordsFromRows(currRows, { blacklist: blacklistSet });
      const prevCounts = countWordsFromRows(prevRows, { blacklist: blacklistSet });
      const prevMap: Record<string, number> = {};
      (prevCounts || []).forEach((w) => { prevMap[w.word] = Number(w.count || 0); });
      const words = (currCounts || [])
        .map((w) => {
          const prev = prevMap[w.word] || 0;
          const delta = prev ? Math.round(((Number(w.count || 0) - prev) / prev) * 100) : (w.count ? 100 : 0);
          return { word: w.word, count: Number(w.count || 0), delta };
        })
        .sort((a, b) => b.count - a.count)
        .slice(0, 12);

      const currBigrams = extractBigramsFromRows(currRows, 2, { blacklist: blacklistSet });
      const prevBigrams = extractBigramsFromRows(prevRows, 2, { blacklist: blacklistSet });
      const prevBigramMap: Record<string, number> = {};
      (prevBigrams || []).forEach((b) => { prevBigramMap[b.phrase] = Number(b.count || 0); });
      const bigrams = (currBigrams || [])
        .map((b) => {
          const prev = prevBigramMap[b.phrase] || 0;
          const delta = prev ? Math.round(((Number(b.count || 0) - prev) / prev) * 100) : (b.count ? 100 : 0);
          return { phrase: b.phrase, count: Number(b.count || 0), delta };
        })
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      return { words, bigrams } as any;
    },
    enabled: !!orgId && isAuthenticated && hasAccess && Array.isArray(orgGroupIds) && shouldLoadKeywords,
    staleTime: ORG_PAGE_STALE_TIME_MS,
    gcTime: ORG_PAGE_GC_TIME_MS,
  });

  const handleAddKeywordToBlacklist = (word: string) => {
    addKeywordToBlacklist(word);
    notify.success("Palavra adicionada à blacklist", `"${word}" não aparecerá mais nos rankings desta sessão local.`);
  };

  const handleRemoveKeywordFromBlacklist = (word: string) => {
    removeKeywordFromBlacklist(word);
    notify.success("Palavra removida da blacklist", `"${word}" voltou a ser considerada nos rankings.`);
  };

  const signals = useMemo(
    () => (Array.isArray(orgGroupsSignals) ? orgGroupsSignals : []),
    [orgGroupsSignals],
  );
  const signalsWithMetrics = useMemo(
    () =>
      signals.map((row) => {
        const activity = computeActivityLevel(row);
        const trend = computeTrend(row);
        const attention = computeAttention(row);
        return { row, activity, trend, attention };
      }),
    [computeAttention, computeActivityLevel, computeTrend, signals],
  );

  const totalGroupsCount = typeof orgGroupIds?.length === "number" ? orgGroupIds.length : signals.length;
  const activeGroupsValue =
    typeof activeGroupsCount === "number" ? activeGroupsCount : signals.filter((g) => g.isActive === true).length;
  const attentionGroups = useMemo(
    () =>
      signalsWithMetrics
        .filter((g) => !!g.attention)
        .sort((a, b) => {
          const ap = a.attention?.priority ?? 999;
          const bp = b.attention?.priority ?? 999;
          if (ap !== bp) return ap - bp;

          const aAt = a.row.lastMessageAt ? new Date(a.row.lastMessageAt).getTime() : 0;
          const bAt = b.row.lastMessageAt ? new Date(b.row.lastMessageAt).getTime() : 0;
          return aAt - bAt;
        }),
    [signalsWithMetrics],
  );

  const alertGroupsCount = attentionGroups.length;

  const activityRank = useMemo<Record<ActivityLevel, number>>(
    () => ({
      silencio: 0,
      baixo: 1,
      medio: 2,
      alto: 3,
    }),
    [],
  );

  const trendRank: Record<TrendLevel, number> = {
    caindo: 0,
    estavel: 1,
    sem_dados: 1,
    subindo: 2,
  };

  const panoramaSorted = useMemo(
    () =>
      [...signalsWithMetrics].sort((a, b) => {
        const ar = activityRank[a.activity];
        const br = activityRank[b.activity];
        if (ar !== br) return br - ar;

        const aCount = typeof a.row.messagesCurrent === "number" ? a.row.messagesCurrent : -1;
        const bCount = typeof b.row.messagesCurrent === "number" ? b.row.messagesCurrent : -1;
        if (aCount !== bCount) return bCount - aCount;

        const aAt = a.row.lastMessageAt ? new Date(a.row.lastMessageAt).getTime() : 0;
        const bAt = b.row.lastMessageAt ? new Date(b.row.lastMessageAt).getTime() : 0;
        return bAt - aAt;
      }),
    [activityRank, signalsWithMetrics],
  );

  const panoramaTotal = panoramaSorted.length;
  const panoramaFrom = (panoramaPage - 1) * PANORAMA_PAGE_SIZE;
  const panoramaItems = panoramaSorted.slice(panoramaFrom, panoramaFrom + PANORAMA_PAGE_SIZE);

  const panoramaGroupIds = panoramaItems.map((g) => g.row.id);
  const { data: panoramaRecentMessages, isLoading: panoramaRecentMessagesLoading } = useQuery({
    queryKey: [
      "org-panorama-recent-messages",
      orgId,
      recentMessagesStartISO,
      panoramaPage,
      panoramaGroupIds.join(","),
    ],
    queryFn: async () => {
      const results = await Promise.all(
        panoramaGroupIds.map(async (groupId) => {
          const { count, error } = await supabase
            .from("messages")
            .select("*", { count: "exact", head: true })
            .eq("group_id", groupId)
            .is("deleted_at", null)
            .gte("created_at", recentMessagesStartISO);
          if (error) return [groupId, null] as const;
          return [groupId, count ?? 0] as const;
        }),
      );

      const map: Record<string, number> = {};
      for (const [groupId, count] of results) {
        if (typeof count === "number") map[groupId] = count;
      }
      return map;
    },
    enabled: !!orgId && isAuthenticated && hasAccess && shouldLoadDashboardSignals && panoramaGroupIds.length > 0,
    staleTime: ORG_PAGE_STALE_TIME_MS,
    gcTime: ORG_PAGE_GC_TIME_MS,
  });

  const renderPanoramaActions = (g: any) => {
    const canEdit = canEditGroup(g.row.id, orgId);
    const canRemove = userCanEditOrg;
    const canCascade = isSystemAdmin;
    const canDeleteAction = canCascade || canRemove;

    return (
      <RowActions>
        <DropdownMenuItem
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/groups/${g.row.id}`);
          }}
        >
          Abrir grupo
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={(e) => {
            e.stopPropagation();
            void openGroupForEdit(g.row.id);
          }}
          disabled={!canEdit}
        >
          Editar grupo
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={(e) => {
            e.stopPropagation();
            const payload: GroupListItem = {
              id: g.row.id,
              name: g.row.name,
              created_at: g.row.created_at ?? "",
              organization_id: orgId ?? "",
              whatsapp_provider_id: null,
              is_active: g.row.isActive ?? null,
            };
            if (canCascade) {
              setCascadeGroup(payload);
              return;
            }
            setRemoveGroup(payload);
          }}
          disabled={!canDeleteAction}
          className="text-destructive focus:text-destructive"
        >
          {canCascade ? "Excluir grupo" : "Remover grupo"}
        </DropdownMenuItem>
      </RowActions>
    );
  };

  const panoramaColumns = [
    {
      key: "name",
      header: "Grupo",
      sortable: true,
      sortValue: (g: any) => g.row.name,
      render: (g: any) => (
        <div className="min-w-0">
          <div className="font-semibold text-card-foreground truncate">{g.row.name}</div>
          {g.row.lastSummaryText ? (
            <div className="text-xs text-muted-foreground truncate">{toPreview(g.row.lastSummaryText, 72)}</div>
          ) : g.row.lastMessagePreview ? (
            <div className="text-xs text-muted-foreground truncate">{toPreview(g.row.lastMessagePreview, 72)}</div>
          ) : g.row.lastMessageAt ? (
            <div className="text-xs text-muted-foreground truncate">Última mensagem em {formatDateSimpleBR(g.row.lastMessageAt)}</div>
          ) : (
            <div className="text-xs text-muted-foreground truncate">Sem histórico recente</div>
          )}
        </div>
      ),
    },
    {
      key: "activity",
      header: "Atividade",
      hideOn: "sm",
      sortable: true,
      sortValue: (g: any) => g.activity,
      render: (g: any) => {
        const variant = g.activity === "silencio" ? "error" : g.activity === "alto" ? "success" : "neutral";
        const label =
          g.activity === "silencio" ? "Silêncio" : g.activity === "baixo" ? "Baixa" : g.activity === "medio" ? "Média" : "Alta";
        return <StatusTag variant={variant}>{label}</StatusTag>;
      },
    },
    {
      key: "recentMessages",
      header: `${RECENT_MESSAGES_HOURS}h`,
      align: "right" as const,
      sortable: true,
      sortValue: (g: any) => panoramaRecentMessages?.[g.row.id] ?? -1,
      render: (g: any) => {
        if (panoramaRecentMessagesLoading) {
          return <span className="text-sm text-muted-foreground">…</span>;
        }
        const count = panoramaRecentMessages?.[g.row.id];
        if (typeof count !== "number") return <span className="text-sm text-muted-foreground">—</span>;
        return <span className="text-sm font-semibold tabular-nums">{formatNumberBR(count)}</span>;
      },
    },
    {
      key: "actions",
      header: "",
      className: "w-10",
      render: (g: any) => renderPanoramaActions(g),
    },
  ];

  // Loading state while checking auth/roles
  if (authLoading || rolesLoading) {
    return (
      <AdminLayout title="Organização" subtitle="Verificando acesso...">
        <LoadingState message="Verificando permissões..." />
      </AdminLayout>
    );
  }

  if (!hasAccess) {
    return (
      <AccessDenied
        message="Você não tem permissão para acessar esta organização."
      />
    );
  }

  if (orgLoading) {
    return (
      <AdminLayout title="Organização" subtitle="Carregando...">
        <LoadingState message="Carregando detalhes da organização..." />
      </AdminLayout>
    );
  }

  // Check access - RLS will return null if no access
  if (orgError || !org) {
    if (orgError && !loadFailedLoggedRef.current && user?.id && orgId) {
      loadFailedLoggedRef.current = true;
      logEvent({
        eventType: "ORG_DASHBOARD_LOAD_FAILED",
        entityType: "organization",
        entityId: orgId,
        userId: user.id,
        metadata: {
          path: typeof window !== "undefined" ? window.location.pathname : null,
          error: String((orgError as any)?.message ?? "unknown"),
          code: (orgError as any)?.code ?? null,
        },
      });
    }
    // Distinguish between "not found" and "no access"
    const errorCode = (orgError as any)?.code;
    if (orgError?.message?.includes('permission') || errorCode === 'PGRST301') {
      return (
        <AccessDenied 
          message="Você não tem permissão para acessar esta organização."
        />
      );
    }
    return (
      <AdminLayout title="Organização" subtitle="Erro">
          <ErrorState 
          title="Organização não encontrada"
          message="Não foi possível carregar os detalhes desta organização. Você pode não ter acesso."
          retry={() => navigate('/')}
        />
      </AdminLayout>
    );
  }

  const userCanEditOrg = canEditOrg(orgId!);

  const handleAttachGroup = async () => {
    if (!orgId) return;
    if (!userCanEditOrg) {
      notify.error("Sem permissão", "Você não pode editar esta organização.");
      return;
    }

    const rawLink = attachInviteLink.trim();
    const normalizedLink = normalizeWhatsAppInviteLink(rawLink);
    if (!normalizedLink) return;
    if (!normalizedLink.includes("chat.whatsapp.com/")) {
      setAttachError("Cole um link de convite válido do WhatsApp.");
      return;
    }

    setAttaching(true);
    setAttachError(null);
    try {
      let attachedGroupId: string | null = null;
      const webhookUrl = ((import.meta as any).env.VITE_N8N_CHECK_GROUP_ENTRY_URL as string | undefined)?.trim();
      if (!webhookUrl) {
        setAttachError("Não foi possível verificar o grupo agora. Tente novamente em instantes.");
        return;
      }

      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invite_link: normalizedLink,
          organization_id: orgId,
        }),
      });

      if (!res.ok) {
        setAttachError("Não foi possível verificar o grupo agora. Tente novamente em instantes.");
        return;
      }

      const payload = (await res.json().catch(() => null)) as unknown;

      const scenarioBMessage =
        "Não foi possível adicionar esse grupo. O Bóris não está no grupo ou o link está inválido. Inclua o Bóris no grupo e tente novamente.";

      if (isBotNotEnabledResponse(payload)) {
        setAttachError(scenarioBMessage);
        return;
      }

      const groupAdded = extractGroupAddedFlag(payload);
      if (groupAdded === false) {
        setAttachError(scenarioBMessage);
        return;
      }

      const groupItem = extractN8nGroupItem(payload);

      if (groupAdded === null && !groupItem) {
        setAttachError("Resposta inesperada do verificador. Tente novamente em instantes.");
        return;
      }

      if (groupItem) {
        const ensuredGroup = await ensureGroupFromN8nPayload({
          orgId,
          inviteLink: normalizedLink,
          item: groupItem,
        });
        attachedGroupId = ensuredGroup.groupId;
      } else {
        const { data: existingGroupByInvite, error: existingGroupByInviteError } = await supabase
          .from("groups")
          .select("id")
          .eq("organization_id", orgId)
          .eq("invite_link", normalizedLink)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (existingGroupByInviteError) throw existingGroupByInviteError;
        attachedGroupId = existingGroupByInvite?.id ?? null;
      }

      if (groupAdded === null && !attachedGroupId) {
          setAttachError("Resposta inesperada do verificador. Tente novamente em instantes.");
          return;
      }

      notify.success("Grupo adicionado com sucesso.");
      if (!hasGroups && user?.id) {
        void logEvent({
          eventType: "ORG_ACTIVATION_COMPLETED",
          entityType: "organization",
          entityId: orgId,
          userId: user.id,
          metadata: {
            completed_via: "group_connected",
            had_primary_contact: hasPrimaryContactData,
            group_id: attachedGroupId,
          },
        });
      }
      setAttachGroupOpen(false);
      setAttachInviteLink("");
      await queryClient.invalidateQueries({ queryKey: ["org-profile-groups", orgId] });
      await queryClient.invalidateQueries({ queryKey: ["org-groups-signals", orgId] });
      await queryClient.invalidateQueries({ queryKey: ["org-groups", orgId] });
      await queryClient.invalidateQueries({ queryKey: ["org-group-ids", orgId] });
      await queryClient.invalidateQueries({ queryKey: ["org-active-groups-count", orgId] });
      await queryClient.invalidateQueries({ queryKey: ["org-total-members", orgId] });
      await queryClient.invalidateQueries({ queryKey: ["org-messages-7d", orgId] });
      if (attachedGroupId) {
        navigate(`/groups/${attachedGroupId}`);
      }
    } catch {
      setAttachError("Não foi possível verificar o grupo agora. Tente novamente em instantes.");
    } finally {
      setAttaching(false);
    }
  };

  const orgStatusLabel = org.status === "active" ? "Ativo" : org.status === "inactive" ? "Inativo" : "Suspenso";
  const orgStatusClassName =
    org.status === "active"
      ? "bg-success/10 text-success"
      : org.status === "inactive"
        ? "bg-muted text-muted-foreground"
        : "bg-destructive/10 text-destructive";

  const hasPrimaryContactData = !!(contactName || contactEmail || contactPhone || contactRole);
  const hasGroups = totalGroupsCount > 0;
  const allHealthKpisZero = [totalGroupsCount, activeGroupsValue, alertGroupsCount].every((v) => (v ?? 0) === 0);
  const orgActivationDismissed = isOrgActivationDismissed(orgId ?? null);
  const showOrgOnboarding = (isDashboardRoute || isDefaultOrgHome) && !hasGroups;
  const showOrgActivationCard = showOrgOnboarding && !orgActivationDismissed;
  const orgActivationSteps = [
    {
      id: "group",
      title: hasGroups ? "Primeiro grupo conectado" : "Conectar o primeiro grupo",
      description: hasGroups
        ? "Seu ambiente ja tem um grupo ativo para iniciar a coleta."
        : "Adicione o link do grupo para começar a captar atividade, mensagens e sinais.",
      done: hasGroups,
    },
    {
      id: "contact",
      title: hasPrimaryContactData ? "Contato principal revisado" : "Revisar contato principal",
      description: hasPrimaryContactData
        ? "A organizacao ja tem um contato de referencia para suporte e billing."
        : "Cadastre um contato oficial para centralizar suporte e comunicacao comercial.",
      done: hasPrimaryContactData,
    },
    {
      id: "monitoring",
      title: "Acompanhar as primeiras interacoes",
      description: hasGroups
        ? "Assim que o grupo começar a conversar, o Boris preenche painel, diario e sinais automaticamente."
        : "Depois de conectar um grupo, volte aqui para acompanhar a primeira atividade.",
      done: hasGroups && !allHealthKpisZero,
    },
  ];
  const completedOrgActivationSteps = orgActivationSteps.filter((step) => step.done).length;
  const addGroupLabel = hasGroups ? "Adicionar grupo" : "Criar primeiro grupo";
  const modalContact =
    primaryContact ??
    (isFallbackContact && orgId
      ? {
          organization_id: orgId,
          user_id: contactUser?.id ?? null,
          name: contactName || "Usuário da organização",
          email: contactEmail || null,
          phone: contactPhone || null,
          role_title: contactRole || null,
          contact_role: "primary",
          is_primary: true,
        }
      : null);

  const headerSummaryParts = [
    `${formatNumberBR(activeGroupsValue ?? 0)} grupos em operação`,
    `${formatNumberBR(totalMembersCount ?? 0)} membros`,
    org.plan ? `Plano ${String(org.plan).toUpperCase()}` : "Plano não definido",
  ];
  const headerDescription = `${formatDateSimpleBR(org.created_at)} • ${headerSummaryParts.join(" • ")} • Atualizada em ${formatDateSimpleBR(org.updated_at)}`;

  const handleDismissOrgActivation = useCallback(async () => {
    if (!orgId) return;
    await dismissOrgActivation(orgId);
    if (user?.id) {
      void logEvent({
        eventType: "ORG_ACTIVATION_DISMISSED",
        entityType: "organization",
        entityId: orgId,
        userId: user.id,
        metadata: {
          completed_steps: completedOrgActivationSteps,
          has_primary_contact: hasPrimaryContactData,
          has_groups: hasGroups,
        },
      });
    }
  }, [completedOrgActivationSteps, dismissOrgActivation, hasGroups, hasPrimaryContactData, orgId, user?.id]);

  const handleReopenOrgActivation = useCallback(async () => {
    if (!orgId) return;
    await reopenOrgActivation(orgId);
    if (user?.id) {
      void logEvent({
        eventType: "ORG_ACTIVATION_RESUMED",
        entityType: "organization",
        entityId: orgId,
        userId: user.id,
        metadata: {
          completed_steps: completedOrgActivationSteps,
        },
      });
    }
  }, [completedOrgActivationSteps, orgId, reopenOrgActivation, user?.id]);

  useEffect(() => {
    if (authLoading || rolesLoading) return;
    if (!isAuthenticated || !user?.id || !orgId) return;
    if (!showOrgActivationCard) return;

    const key = `onboarding-event:org-activation-started:${user.id}:${orgId}`;
    if (hasTrackedSessionEvent(key)) return;

    markSessionEventTracked(key);
    void logEvent({
      eventType: "ORG_ACTIVATION_STARTED",
      entityType: "organization",
      entityId: orgId,
      userId: user.id,
      metadata: {
        completed_steps: completedOrgActivationSteps,
        has_primary_contact: hasPrimaryContactData,
        has_groups: hasGroups,
        path: typeof window !== "undefined" ? window.location.pathname : null,
      },
    });
  }, [
    authLoading,
    completedOrgActivationSteps,
    hasGroups,
    hasPrimaryContactData,
    isAuthenticated,
    orgId,
    rolesLoading,
    showOrgActivationCard,
    user?.id,
  ]);

  const adminSummarySection = (isDashboardRoute || isDefaultOrgHome) ? (
    <Card className="border-0 shadow-none">
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm font-semibold text-card-foreground">Resumo administrativo</div>
            <div className="text-xs text-muted-foreground">Contato principal e situação de billing</div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-xl bg-secondary/20 p-4 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-medium text-card-foreground flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                Contato da organização
              </h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditContactOpen(true)}
                disabled={!userCanEditOrg}
                title={userCanEditOrg ? undefined : "Somente perfis com permissão de edição podem alterar dados da organização."}
              >
                {hasPrimaryContactData ? "Editar contato" : "Cadastrar contato"}
              </Button>
            </div>

            {contactLoading ? (
              <p className="text-sm text-muted-foreground">Carregando contato...</p>
            ) : contactError ? (
              <p className="text-sm text-destructive">Falha ao carregar contato.</p>
            ) : !hasPrimaryContactData ? (
              <div className="rounded-lg border border-dashed border-border bg-background/40 p-3">
                <p className="text-sm text-card-foreground">Nenhum contato primário cadastrado.</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Cadastre um contato para facilitar comunicação comercial e suporte.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {isFallbackContact ? (
                  <div className="rounded-lg border border-dashed border-border bg-background/40 p-3">
                    <p className="text-xs text-muted-foreground">
                      Contato preenchido automaticamente com um usuário da organização. Edite para definir o contato oficial.
                    </p>
                  </div>
                ) : null}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Nome</span>
                    <p className="font-medium text-card-foreground">{contactName || "-"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Usuário vinculado</span>
                    {contactUser?.id ? (
                      <div className="pt-1">
                        <UserInline
                          name={contactUser?.name || contactName || "Usuário vinculado"}
                          avatarUrl={contactUser?.avatar_url || null}
                          size="xs"
                        />
                      </div>
                    ) : (
                      <p className="font-medium text-card-foreground">-</p>
                    )}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Cargo</span>
                    <p className="font-medium text-card-foreground">{contactRole || "-"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Email</span>
                    <p className="font-medium text-card-foreground">{contactEmail || "-"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Telefone</span>
                    <p className="font-medium text-card-foreground">{contactPhone || "-"}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-xl bg-secondary/20 p-4 space-y-4">
            <h3 className="text-sm font-medium text-card-foreground flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              Plano / Cobrança
            </h3>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">Plano</span>
                <p className="font-medium text-card-foreground capitalize">{org.plan || "-"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Status do billing</span>
                <p
                  className={`font-medium capitalize ${
                    org.billing_status === "active"
                      ? "text-success"
                      : org.billing_status === "past_due" || org.billing_status === "overdue"
                        ? "text-destructive"
                        : "text-muted-foreground"
                  }`}
                >
                  {org.billing_status || "-"}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Início do trial</span>
                <p className="font-medium text-card-foreground">
                  {org.trial_started_at ? formatDateSimpleBR(org.trial_started_at) : "-"}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Fim do trial</span>
                <p className="font-medium text-card-foreground">
                  {org.trial_ends_at ? formatDateSimpleBR(org.trial_ends_at) : "-"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  ) : null;

  return (
    <AdminLayout 
      title="Organização" 
      subtitle={org?.name || "Organização"}
    >
      <div className="mx-auto max-w-[1480px] space-y-8 animate-fade-in">
        <AdminPageHeader
          breadcrumbItems={breadcrumbItems}
          title={
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              <span className="truncate">{org?.name || "Organização"}</span>
              <span className={
                `inline-flex h-6 items-center rounded-full px-2.5 text-[11px] font-medium uppercase tracking-[0.06em] ${orgStatusClassName}`
              }>
                {orgStatusLabel}
              </span>
            </div>
          }
          description={headerDescription}
          generalKpis={
            (isDashboardRoute || isDefaultOrgHome) ? (
              <>
                <div className="rounded-xl border border-border bg-card p-3">
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Grupos</div>
                  <div className="mt-1 text-lg font-semibold tabular-nums text-card-foreground">{formatNumberBR(totalGroupsCount)}</div>
                </div>
                <div className="rounded-xl border border-border bg-card p-3">
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Membros</div>
                  <div className="mt-1 text-lg font-semibold tabular-nums text-card-foreground">
                    {formatNumberBR(totalMembersCount ?? 0)}
                  </div>
                </div>
                <div className="rounded-xl border border-border bg-card p-3">
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Alertas</div>
                  <div className={`mt-1 text-lg font-semibold tabular-nums ${(alertGroupsCount ?? 0) > 0 ? "text-warning" : "text-success"}`}>
                    {formatNumberBR(alertGroupsCount ?? 0)}
                  </div>
                </div>
                <div className="rounded-xl border border-border bg-card p-3">
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Cobrança</div>
                  <div
                    className={`mt-1 text-lg font-semibold capitalize ${
                      org.billing_status === "active"
                        ? "text-success"
                        : org.billing_status === "past_due" || org.billing_status === "overdue"
                          ? "text-destructive"
                          : "text-card-foreground"
                    }`}
                  >
                    {org.billing_status || "-"}
                  </div>
                </div>
              </>
            ) : null
          }
          actions={(
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={() => setAttachGroupOpen(true)}
                className="flex items-center gap-2"
                disabled={!userCanEditOrg}
                title={userCanEditOrg ? undefined : "Somente perfis com permissão de edição podem adicionar grupos."}
              >
                <Plus className="h-4 w-4" />
                {addGroupLabel}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditOrgOpen(true)}
                className="flex items-center gap-2"
                disabled={!userCanEditOrg}
                title={userCanEditOrg ? undefined : "Somente perfis com permissão de edição podem alterar a organização."}
              >
                <Edit className="h-4 w-4" />
                Editar
              </Button>
            </div>
          )}
          filters={(
            isKeywordsRoute ? (
              <div className="flex flex-wrap items-center gap-2">
                <PeriodFilter
                  value={selectedPeriod}
                  customRange={customRange}
                  onChange={handlePeriodChange}
                />
              </div>
            ) : null
          )}
          showClearFilters={isKeywordsRoute && (selectedPeriod !== '7d' || !!customRange)}
          onClearFilters={() => { setSelectedPeriod('7d'); setCustomRange(undefined); }}
        />

        {isProfileRoute && (
          <div id="org-profile" className="space-y-8">
            {(() => {
              const md = (org?.metadata || {}) as OrgProfileMetadata;
              const cover = md.cover_url || "/org-cover-placeholder.jpg";
              const logo = md.logo_url || "/org-logo-placeholder.png";
              return (
                <section className="overflow-hidden rounded-[var(--radius-xl)] border border-border/80 bg-card/95 shadow-subtle">
                  <div className="h-32 sm:h-44 w-full bg-center bg-cover" style={{ backgroundImage: `url(${cover})` }} />
                  <div className="p-4 sm:p-6 flex items-start gap-4">
                    <img src={logo} alt="Logo" className="h-16 w-16 rounded-[var(--radius-md)] border border-border bg-background object-cover shadow-subtle" />
                    <div className="min-w-0">
                      <h3 className="text-lg sm:text-xl font-semibold tracking-[-0.02em] text-card-foreground">{org?.name}</h3>
                      <p className="text-sm text-muted-foreground truncate">{md?.area || ""}</p>
                      {md?.area && md?.founded_at && (
                        <p className="text-xs text-muted-foreground">Fundada em {formatDateSimpleBR(md.founded_at)}</p>
                      )}
                    </div>
                  </div>
                </section>
              );
            })()}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <section className="rounded-[var(--radius-xl)] border border-border/80 bg-card/95 p-6 shadow-subtle space-y-4">
                <h4 className="text-sm font-semibold uppercase tracking-[0.08em] text-foreground">Dados da Organização</h4>
                {(() => {
                  const md = (org?.metadata || {}) as OrgProfileMetadata;
                  const stats = [
                    {
                      label: "Grupos ativos",
                      value: activeGroupsCount,
                      help: "Quantidade de grupos ativos vinculados à organização.",
                    },
                    {
                      label: "Membros",
                      value: totalMembersCount,
                      help: "Total de membros únicos somando todos os grupos da organização.",
                    },
                    {
                      label: "Mensagens (7d)",
                      value: messagesLast7dCount,
                      help: "Mensagens enviadas nos últimos 7 dias em todos os grupos da organização.",
                    },
                  ];
                  return (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">CNPJ</span>
                          <p className="font-medium text-card-foreground">{md?.cnpj || "-"}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Área de atuação</span>
                          <p className="font-medium text-card-foreground">{md?.area || "-"}</p>
                        </div>
                        <div className="sm:col-span-2">
                          <span className="text-muted-foreground">Endereço</span>
                          <p className="font-medium text-card-foreground">{md?.address || "-"}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Fundação</span>
                          <p className="font-medium text-card-foreground">{md?.founded_at ? formatDateSimpleBR(md.founded_at) : "-"}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        {stats.map((s) => (
                          <div key={s.label} className="rounded-[var(--radius-lg)] border border-border/60 bg-background/80 p-4 shadow-subtle">
                            <div className="text-xl font-semibold tracking-[-0.03em] tabular-nums text-card-foreground">
                              {typeof s.value === "number" ? s.value.toLocaleString("pt-BR") : "-"}
                            </div>
                            <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                              <span>{s.label}</span>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button aria-label="Ajuda" className="text-muted-foreground hover:text-foreground">
                                    <HelpCircle className="h-3.5 w-3.5" />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                  {s.help}
                                </TooltipContent>
                              </Tooltip>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </section>

              <section className="rounded-[var(--radius-xl)] border border-border/80 bg-card/95 p-6 shadow-subtle space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold uppercase tracking-[0.08em] text-foreground">Contato</h4>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditContactOpen(true)}
                    disabled={!userCanEditOrg}
                    title={userCanEditOrg ? undefined : "Somente perfis com permissão de edição podem alterar contato."}
                  >
                    Editar contato
                  </Button>
                </div>
                {(() => {
                  const md = (org?.metadata || {}) as OrgProfileMetadata;
                  return (
                    <div className="space-y-3 text-sm">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <span className="text-muted-foreground">Telefone</span>
                          <p className="font-medium text-card-foreground">{contactPhone || "-"}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">E-mail</span>
                          <p className="font-medium text-card-foreground">{contactEmail || "-"}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Site</span>
                          <p className="font-medium text-card-foreground">{md?.website || "-"}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {md?.socials?.facebook && (
                          <a href={md.socials.facebook} target="_blank" rel="noreferrer" className="rounded-[var(--radius-md)] border border-border/60 bg-secondary/50 px-2.5 py-1.5 text-xs">Facebook</a>
                        )}
                        {md?.socials?.instagram && (
                          <a href={md.socials.instagram} target="_blank" rel="noreferrer" className="rounded-[var(--radius-md)] border border-border/60 bg-secondary/50 px-2.5 py-1.5 text-xs">Instagram</a>
                        )}
                        {md?.socials?.linkedin && (
                          <a href={md.socials.linkedin} target="_blank" rel="noreferrer" className="rounded-[var(--radius-md)] border border-border/60 bg-secondary/50 px-2.5 py-1.5 text-xs">LinkedIn</a>
                        )}
                      </div>
                      <div>
                        <a href={contactEmail ? `mailto:${contactEmail}` : undefined} className="inline-flex items-center gap-2 rounded-[var(--radius-md)] bg-primary px-3 py-2 text-sm text-primary-foreground shadow-subtle disabled:opacity-50" aria-disabled={!contactEmail}>
                          Enviar mensagem
                        </a>
                      </div>
                    </div>
                  );
                })()}
              </section>
            </div>

            {orgGroupsListSection}
          </div>
        )}

        {isGroupsRoute && (
          <div id="org-groups" className="space-y-8">
            {orgGroupsListSection}
          </div>
        )}

        

        {(isDashboardRoute || isDefaultOrgHome) && (
          <div id="org-dashboard" className="space-y-6">
            {showOrgActivationCard && (
              <Card className="border-border/80 shadow-subtle">
                <CardContent className="p-6">
                  <div className="flex flex-col gap-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-3">
                        <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">
                          <Sparkles className="h-3.5 w-3.5" />
                          Primeira ativacao
                        </div>
                        <div className="space-y-2">
                          <div className="text-lg font-semibold tracking-[-0.02em] text-card-foreground">Vamos colocar sua operacao no ar</div>
                          <p className="text-sm text-muted-foreground max-w-2xl">
                            Sua organizacao ja esta pronta no Boris. O proximo passo e conectar o primeiro grupo para
                            acompanhar atividade, mensagens e sinais sem precisar configurar o resto agora.
                          </p>
                        </div>
                        <div className="inline-flex items-center gap-2 rounded-[var(--radius-md)] bg-secondary/40 px-3 py-2 text-sm text-card-foreground">
                          <span className="font-semibold">{completedOrgActivationSteps}/3 passos concluídos</span>
                          <span className="text-muted-foreground">Foque no essencial e avance quando fizer sentido.</span>
                        </div>
                      </div>
                      <div className="flex items-start justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => void handleDismissOrgActivation()}
                          disabled={!orgId || onboardingSaving}
                        >
                          Fazer isso depois
                        </Button>
                      </div>
                    </div>
                    <div className="grid gap-3">
                      {orgActivationSteps.map((step, index) => (
                        <div
                          key={step.id}
                          className="flex items-start gap-3 rounded-[var(--radius-lg)] border border-border/60 bg-secondary/20 px-4 py-3"
                        >
                          <div className="mt-0.5 shrink-0">
                            {step.done ? (
                              <CheckCircle2 className="h-5 w-5 text-success" />
                            ) : (
                              <CircleDashed className="h-5 w-5 text-primary" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-card-foreground">{index + 1}. {step.title}</div>
                            <p className="mt-1 text-sm text-muted-foreground">{step.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row lg:flex-row">
                      <Button
                        onClick={() => setAttachGroupOpen(true)}
                        className="gap-2"
                        disabled={!userCanEditOrg}
                        title={userCanEditOrg ? undefined : "Somente perfis com permissão de edição podem criar grupos."}
                      >
                        <Plus className="h-4 w-4" />
                        Conectar primeiro grupo
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setEditContactOpen(true)}
                        disabled={!userCanEditOrg}
                        title={userCanEditOrg ? undefined : "Somente perfis com permissão de edição podem alterar contato."}
                      >
                        {hasPrimaryContactData ? "Revisar contato" : "Cadastrar contato"}
                      </Button>
                      {hasGroups ? (
                        <Button
                          variant="ghost"
                          onClick={() => void handleDismissOrgActivation()}
                          disabled={!orgId || onboardingSaving}
                        >
                          Continuar explorando
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            {showOrgOnboarding && orgActivationDismissed && (
              <Card className="border-dashed border-border/80 shadow-none">
                <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-sm font-medium text-card-foreground">Ativacao inicial pausada</div>
                    <p className="text-sm text-muted-foreground">
                      Você pode retomar a checklist quando quiser para conectar o primeiro grupo e revisar o contato.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void handleReopenOrgActivation()}
                    disabled={!orgId || onboardingSaving}
                  >
                    Retomar ativacao
                  </Button>
                </CardContent>
              </Card>
            )}
            <Card className="border-border/80 shadow-subtle">
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold uppercase tracking-[0.08em] text-card-foreground">KPIs executivos</div>
                    <div className="text-xs text-muted-foreground">Últimos 7 dias</div>
                  </div>
                  {signalsError ? (
                    <Button variant="outline" size="sm" onClick={() => refetchSignals()} className="shrink-0">
                      Tentar novamente
                    </Button>
                  ) : null}
                </div>

                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div className={`rounded-xl ${allHealthKpisZero ? "bg-secondary/20 p-3" : "bg-secondary/30 p-4"}`}>
                    <div className="text-2xl sm:text-3xl font-semibold tracking-[-0.03em] tabular-nums text-card-foreground">
                      {formatNumberBR(totalGroupsCount ?? 0)}
                    </div>
                    <div className="mt-1 text-sm font-medium text-card-foreground flex items-center gap-1">
                      <span>Grupos ativos</span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button aria-label="Ajuda" className="text-muted-foreground hover:text-foreground">
                            <HelpCircle className="h-3.5 w-3.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          Total de grupos com status ativo na organização.
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <div className="text-xs text-muted-foreground">Base operacional ativa</div>
                  </div>

                  <div className={`rounded-xl ${allHealthKpisZero ? "bg-secondary/20 p-3" : "bg-secondary/30 p-4"}`}>
                    <div className="text-2xl sm:text-3xl font-semibold tracking-[-0.03em] tabular-nums text-success">
                      {formatNumberBR(activeGroupsValue ?? 0)}
                    </div>
                    <div className="mt-1 text-sm font-medium text-card-foreground flex items-center gap-1">
                      <span>Com atividade recente</span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button aria-label="Ajuda" className="text-muted-foreground hover:text-foreground">
                            <HelpCircle className="h-3.5 w-3.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          Grupos ativos com sinais de atividade no período analisado.
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <div className="text-xs text-muted-foreground">Engajamento da base ativa</div>
                  </div>

                  <div
                    className={
                      `rounded-xl ${allHealthKpisZero ? "bg-secondary/20 p-3" : "bg-secondary/30 p-4"} ${
                        (alertGroupsCount ?? 0) > 0 ? "ring-1 ring-warning/25" : "ring-1 ring-success/10"
                      }`
                    }
                  >
                    <div
                      className={
                        `text-2xl sm:text-3xl font-semibold tracking-[-0.03em] tabular-nums ${
                          (alertGroupsCount ?? 0) === 0 ? "text-success" : "text-warning"
                        }`
                      }
                    >
                      {formatNumberBR(alertGroupsCount ?? 0)}
                    </div>
                    <div className="mt-1 text-sm font-medium text-card-foreground flex items-center gap-1">
                      <span>Grupos com alerta</span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button aria-label="Ajuda" className="text-muted-foreground hover:text-foreground">
                            <HelpCircle className="h-3.5 w-3.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          Grupos com alertas de queda ou ausência de atividade relevante.
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <div className="text-xs text-muted-foreground">Risco de queda/inatividade</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {adminSummarySection}

            <Card className="border-border/80 shadow-subtle">
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold uppercase tracking-[0.08em] text-card-foreground">Atividade dos grupos</div>
                    <div className="text-xs text-muted-foreground">Últimas {RECENT_MESSAGES_HOURS} horas</div>
                  </div>
                </div>

                {signalsLoading ? (
                  <div className="mt-4">
                    <LoadingState message="Carregando panorama..." />
                  </div>
                ) : signalsError ? (
                  <div className="mt-4">
                    <ErrorState message="Falha ao carregar panorama" retry={() => refetchSignals()} />
                  </div>
                ) : panoramaTotal === 0 ? (
                  <div className="mt-4">
                    <EmptyState
                      icon={FolderOpen}
                      title="Ainda não há atividade suficiente para gerar o panorama"
                      message={hasGroups
                        ? "Quando os grupos enviarem mensagens, este resumo aparecerá aqui."
                        : "Crie o primeiro grupo para começar a acompanhar atividade."}
                      action={{ label: addGroupLabel, onClick: () => setAttachGroupOpen(true) }}
                    />
                  </div>
                ) : (
                  <div className="mt-4">
                    <div className="space-y-3 md:hidden">
                      {panoramaItems.map((g: any) => {
                        const activityVariant = g.activity === "silencio" ? "error" : g.activity === "alto" ? "success" : "neutral";
                        const activityLabel =
                          g.activity === "silencio" ? "Silêncio" : g.activity === "baixo" ? "Baixa" : g.activity === "medio" ? "Média" : "Alta";
                        const recentCount = panoramaRecentMessagesLoading ? null : panoramaRecentMessages?.[g.row.id];
                        const canEdit = canEditGroup(g.row.id, orgId);
                        const canRemove = userCanEditOrg;
                        const canCascade = isSystemAdmin;
                        const canDeleteAction = canCascade || canRemove;
                        const contextText = g.row.lastSummaryText
                          ? toPreview(g.row.lastSummaryText, 120)
                          : g.row.lastMessagePreview
                            ? toPreview(g.row.lastMessagePreview, 120)
                            : g.row.lastMessageAt
                              ? `Última mensagem em ${formatDateSimpleBR(g.row.lastMessageAt)}`
                              : "Sem histórico recente";

                        return (
                          <div
                            key={g.row.id}
                            className="cursor-pointer rounded-[var(--radius-lg)] border border-border/70 bg-card/95 p-4 shadow-subtle transition-colors hover:bg-secondary/20"
                            onClick={() => navigate(`/groups/${g.row.id}`)}
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="min-w-0">
                                <div className="truncate font-semibold tracking-[-0.02em] text-card-foreground">{g.row.name}</div>
                                <div className="mt-1 text-xs text-muted-foreground truncate">{contextText}</div>
                              </div>

                              <div className="shrink-0 flex flex-col items-end gap-2">
                                <StatusTag variant={activityVariant}>{activityLabel}</StatusTag>
                                <div className="text-right">
                                  <div className="text-lg font-semibold tabular-nums text-card-foreground">
                                    {panoramaRecentMessagesLoading ? "…" : typeof recentCount === "number" ? formatNumberBR(recentCount) : "—"}
                                  </div>
                                  <div className="text-[11px] text-muted-foreground">Msgs (24h)</div>
                                </div>
                              </div>
                            </div>

                            <div className="mt-3 flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => navigate(`/groups/${g.row.id}`)}
                                className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                                title="Abrir grupo"
                                aria-label="Abrir grupo"
                              >
                                <FolderOpen className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  void openGroupForEdit(g.row.id);
                                }}
                                disabled={!canEdit}
                                className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground disabled:opacity-40"
                                title={canEdit ? "Editar grupo" : "Sem permissão para editar este grupo"}
                                aria-label="Editar grupo"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  const payload: GroupListItem = {
                                    id: g.row.id,
                                    name: g.row.name,
                                    created_at: g.row.created_at ?? "",
                                    organization_id: orgId ?? "",
                                    whatsapp_provider_id: null,
                                    is_active: g.row.isActive ?? null,
                                  };
                                  if (canCascade) {
                                    setCascadeGroup(payload);
                                    return;
                                  }
                                  setRemoveGroup(payload);
                                }}
                                disabled={!canDeleteAction}
                                className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10 disabled:opacity-40"
                                title={
                                  canDeleteAction
                                    ? canCascade
                                      ? "Excluir grupo"
                                      : "Remover grupo da organização"
                                    : "Sem permissão para remover/excluir este grupo"
                                }
                                aria-label={canCascade ? "Excluir grupo" : "Remover grupo da organização"}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}

                      {panoramaTotal > PANORAMA_PAGE_SIZE && (
                        <div className="flex items-center justify-between rounded-xl bg-secondary/20 px-4 py-3">
                          <p className="text-xs text-muted-foreground">
                            Página {panoramaPage} de {Math.ceil(panoramaTotal / PANORAMA_PAGE_SIZE)} • {panoramaTotal} grupos
                          </p>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setPanoramaPage(Math.max(1, panoramaPage - 1))}
                              disabled={panoramaPage <= 1}
                            >
                              Anterior
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setPanoramaPage(Math.min(Math.ceil(panoramaTotal / PANORAMA_PAGE_SIZE), panoramaPage + 1))}
                              disabled={panoramaPage >= Math.ceil(panoramaTotal / PANORAMA_PAGE_SIZE)}
                            >
                              Próxima
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="hidden md:block">
                      <BorisTable
                        columns={panoramaColumns as any}
                        data={panoramaItems as any}
                        keyExtractor={(g: any) => g.row.id}
                        onRowClick={(g: any) => navigate(`/groups/${g.row.id}`)}
                        page={panoramaPage}
                        pageSize={PANORAMA_PAGE_SIZE}
                        totalCount={panoramaTotal}
                        onPageChange={setPanoramaPage}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
        {/* Collapsible sections for JSON data */}
        <div className="space-y-4">
          {/* Metadata */}
          {org.metadata && Object.keys(org.metadata).length > 0 && (
            <Collapsible className="rounded-xl border border-border bg-card">
              <CollapsibleTrigger className="flex items-center justify-between w-full p-4 hover:bg-secondary/30 transition-colors">
                <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Metadados</span>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </CollapsibleTrigger>
              <CollapsibleContent className="px-4 pb-4">
                <pre className="p-4 rounded-lg bg-secondary/30 text-xs overflow-auto max-h-48 text-card-foreground">
                  {JSON.stringify(org.metadata, null, 2)}
                </pre>
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>

        {isKeywordsRoute && (
          <div id="org-keywords" className="rounded-xl border border-border bg-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Tag className="h-4 w-4" />
                Palavras-chave e temas do período
              </h3>
              <div className="text-xs text-muted-foreground">Amostra até 2000 mensagens de texto</div>
            </div>
            {keywordBlacklist.length > 0 && (
              <div className="rounded-lg border border-border/70 bg-secondary/20 p-3 space-y-2">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <Ban className="h-3.5 w-3.5" />
                  Blacklist ativa
                </div>
                <div className="flex flex-wrap gap-2">
                  {keywordBlacklist.map((word) => (
                    <button
                      key={word}
                      type="button"
                      onClick={() => handleRemoveKeywordFromBlacklist(word)}
                      className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-card px-2 py-1 text-[12px] font-medium text-card-foreground transition-colors hover:bg-secondary"
                    >
                      <span>{word}</span>
                      <X className="h-3 w-3 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              </div>
            )}
            {keywordsLoading ? (
              <LoadingState message="Processando mensagens..." />
            ) : keywordsError ? (
              <ErrorState message="Falha ao extrair palavras-chave" retry={() => refetchKeywords()} />
            ) : !orgKeywords || ((orgKeywords.words || []).length === 0 && (orgKeywords.bigrams || []).length === 0) ? (
              <EmptyState icon={Tag} title="Nada relevante" message="Nenhuma palavra-chave ou tema recorrente neste período." />
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Palavras mais presentes</p>
                  <div className="flex flex-wrap gap-2">
                    {(orgKeywords.words || []).map((w: any) => (
                      <span
                        key={w.word}
                        className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-secondary/60 text-foreground text-[12px] font-semibold border border-border/60"
                      >
                        <span className="text-[13px] font-semibold tracking-tight">{w.word}</span>
                        <span className="text-[11px] text-muted-foreground tabular-nums">{w.count}</span>
                        {typeof w.delta === 'number' && (
                          <span className={`text-[11px] tabular-nums ${w.delta > 0 ? 'text-success' : w.delta < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                            {w.delta > 0 ? `+${w.delta}%` : w.delta < 0 ? `${w.delta}%` : '0%'}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => handleAddKeywordToBlacklist(w.word)}
                          className="inline-flex items-center rounded-sm p-0.5 text-muted-foreground transition-colors hover:text-foreground"
                          aria-label={`Adicionar ${w.word} à blacklist`}
                          title="Adicionar à blacklist"
                        >
                          <Ban className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Temas recorrentes (bigramas)</p>
                  <div className="flex flex-wrap gap-2">
                    {(orgKeywords.bigrams || []).map((b: any) => (
                      <span
                        key={b.phrase}
                        className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-secondary/60 text-foreground text-[12px] font-semibold border border-border/60"
                      >
                        <span className="text-[13px] font-semibold italic tracking-tight">{b.phrase}</span>
                        <span className="text-[11px] text-muted-foreground tabular-nums">{b.count}</span>
                        {typeof b.delta === 'number' && (
                          <span className={`text-[11px] tabular-nums ${b.delta > 0 ? 'text-success' : b.delta < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                            {b.delta > 0 ? `+${b.delta}%` : b.delta < 0 ? `${b.delta}%` : '0%'}
                          </span>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        

        
      </div>

      {/* Edit organization modal */}
      <EditOrganizationModal
        organization={org}
        open={editOrgOpen}
        onOpenChange={setEditOrgOpen}
        onSuccess={() => refetchOrg()}
      />

      <EditOrganizationContactModal
        organizationId={orgId!}
        contact={modalContact}
        open={editContactOpen}
        onOpenChange={setEditContactOpen}
        onSuccess={() => refetchPrimaryContact()}
      />

      {/* Edit group modal */}
      <EditGroupModal
        group={editGroup}
        open={!!editGroup}
        onOpenChange={(open) => !open && setEditGroup(null)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["org-groups-signals", orgId] });
          queryClient.invalidateQueries({ queryKey: ["org-profile-groups", orgId] });
          queryClient.invalidateQueries({ queryKey: ["org-group-ids", orgId] });
          queryClient.invalidateQueries({ queryKey: ["org-active-groups-count", orgId] });
          queryClient.invalidateQueries({ queryKey: ["org-total-members", orgId] });
          queryClient.invalidateQueries({ queryKey: ["org-messages-7d", orgId] });
        }}
      />

      <Dialog
        open={attachGroupOpen}
        onOpenChange={(open) => {
          setAttachGroupOpen(open);
          if (!open) {
            setAttachError(null);
            setAttaching(false);
            setAttachInviteLink("");
          }
        }}
      >
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-card-foreground">Adicionar grupo</DialogTitle>
            <DialogDescription>Cole aqui o link de convite do grupo</DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <label className="text-sm font-medium text-card-foreground">Link de convite do WhatsApp</label>
            <Input
              value={attachInviteLink}
              onChange={(e) => setAttachInviteLink(e.target.value)}
              placeholder="https://chat.whatsapp.com/…"
              disabled={attaching}
            />
            {attachError && (
              <div className="text-sm text-destructive">{attachError}</div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAttachGroupOpen(false)}
              disabled={attaching}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleAttachGroup}
              disabled={attaching || !attachInviteLink.trim()}
            >
              {attaching ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Verificando...
                </span>
              ) : (
                "Verificar e adicionar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove group confirmation */}

      {/* Remove group confirmation */}
      <AlertDialog open={!!removeGroup} onOpenChange={(open) => !open && setRemoveGroup(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-card-foreground">Remover grupo da organização</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Esta ação desvincula o grupo da organização e não apaga dados históricos. 
              O grupo deixará de aparecer nesta organização.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="mr-2">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!removeGroup) return;
                setRemoving(true);
                try {
                  const { error } = await supabase
                    .from('groups')
                    .update({ is_archived: true })
                    .eq('id', removeGroup.id);
                  if (error) throw error;
                  notify.success('Grupo removido', 'Dados salvos com sucesso.');
                  setRemoveGroup(null);
                  queryClient.invalidateQueries({ queryKey: ["org-profile-groups", orgId] });
                  queryClient.invalidateQueries({ queryKey: ["org-group-ids", orgId] });
                  queryClient.invalidateQueries({ queryKey: ["org-active-groups-count", orgId] });
                  queryClient.invalidateQueries({ queryKey: ["org-total-members", orgId] });
                  queryClient.invalidateQueries({ queryKey: ["org-messages-7d", orgId] });
                  queryClient.invalidateQueries({ queryKey: ["org-groups-signals", orgId] });
                } catch (err: any) {
                  notify.error('Não foi possível concluir', 'Algo deu errado. Tente novamente.');
                } finally {
                  setRemoving(false);
                }
              }}
              disabled={removing}
            >
              Confirmar remoção
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!cascadeGroup} onOpenChange={(open) => !open && setCascadeGroup(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-card-foreground">Excluir grupo</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Esta ação é irreversível e removerá o grupo e todos os dados associados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3">
            {deletingCascade && (
              <div className="text-xs text-muted-foreground">Excluindo…</div>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel className="mr-2" onClick={() => setCascadeGroup(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!cascadeGroup) return;
                setDeletingCascade(true);
                try {
                  const { error } = await supabase.functions.invoke("delete-resource-cascade", {
                    body: {
                      resourceType: "group",
                      resourceId: cascadeGroup.id,
                    },
                  });
                  if (error) throw error;
                  notify.success("Grupo excluído", "Tudo certo.");
                  setCascadeGroup(null);
                  queryClient.invalidateQueries({ queryKey: ["org-profile-groups", orgId] });
                  queryClient.invalidateQueries({ queryKey: ["org-groups-signals", orgId] });
                  queryClient.invalidateQueries({ queryKey: ["org-group-ids", orgId] });
                  queryClient.invalidateQueries({ queryKey: ["org-active-groups-count", orgId] });
                  queryClient.invalidateQueries({ queryKey: ["org-total-members", orgId] });
                  queryClient.invalidateQueries({ queryKey: ["org-messages-7d", orgId] });
                } catch (err: any) {
                  const parsed = await parseSupabaseFunctionInvokeError(err);
                  if (parsed.code === "NETWORK_ERROR") {
                    notifyActionError("Falha de conexão", parsed, "Tente novamente.");
                    return;
                  }
                  if (parsed.code === "DEPENDENCIES_EXIST") {
                    notify.warning("Dependências existentes", "Ainda há registros vinculados a este grupo.");
                    return;
                  }
                  if (parsed.code === "FORBIDDEN" || /forbidden/i.test(parsed.message)) {
                    notify.error("Acesso negado", "Apenas admins do sistema podem excluir grupos.");
                    return;
                  }
                  if (parsed.code === "UNAUTHORIZED" || /unauthorized/i.test(parsed.message)) {
                    notify.error("Sessão expirada", "Faça login novamente.");
                    return;
                  }
                  notifyActionError("Não foi possível excluir", parsed, "Tente novamente.");
                } finally {
                  setDeletingCascade(false);
                }
              }}
              disabled={deletingCascade}
            >
              Confirmar exclusão
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <SendGroupMessageDialog
        open={!!sendMessageGroup}
        onOpenChange={(open) => !open && setSendMessageGroup(null)}
        groupName={sendMessageGroup?.name || "Grupo"}
        isSubmitting={isSendingGroupMessage}
        onSubmit={async (message) => {
          if (!sendMessageGroup) return;
          await handleSendGroupMessage(sendMessageGroup, message);
        }}
      />

      
    </AdminLayout>
  );
};

export default Org;
