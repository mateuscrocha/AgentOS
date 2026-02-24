import { AdminLayout } from "@/components/layout/AdminLayout";
import { BorisTable } from "@/components/ui/boris-table";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { AdminPageHeader } from "@/components/layout/AdminPageHeader";
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
  Loader2,
  TrendingDown,
  TrendingUp,
  Minus,
  Plus,
  HelpCircle,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect, useRef } from "react";
import { useUserRoles } from "@/hooks/use-user-roles";
import { useAuth } from "@/hooks/use-auth";
import { useOrgCounts } from "@/hooks/use-org-counts";
import { useOrgCoreData } from "@/hooks/use-org-core-data";
import AccessDenied from "./AccessDenied";
import { formatDateSimpleBR } from "@/lib/date";
import { EditOrganizationModal } from "@/components/modals/EditOrganizationModal";
import { EditOrganizationContactModal } from "@/components/modals/EditOrganizationContactModal";
import { EditGroupModal } from "@/components/modals/EditGroupModal";
import { Button } from "@/components/ui/button";
import { notify } from "@/components/ui/sonner";
import { Input } from "@/components/ui/input";
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
import {
  getDateRange,
  type PeriodType,
  type DateRange,
  parseStoredPeriod,
  buildStoredPeriod,
} from "@/components/group-dashboard/period-utils";
import { countWordsFromRows, extractBigramsFromRows } from "@/utils/keywords";
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
import { logEvent } from "@/lib/audit";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { parseSupabaseFunctionInvokeError } from "@/lib/supabase-function-invoke-error";

const PANORAMA_PAGE_SIZE = 20;
const RECENT_MESSAGES_HOURS = 24;

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
  created_at: string;
  organization_id: string;
  whatsapp_provider_id: string | null;
  is_active: boolean | null;
  members_count?: number;
  last_access_at?: string | null;
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

  const [profileSearch, setProfileSearch] = useState("");
  const [profileStatusFilter, setProfileStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [profileLeaderFilter, setProfileLeaderFilter] = useState<string>("");
  const [profileOrderBy, setProfileOrderBy] = useState<"name" | "members" | "status">("name");
  const [profileOrderDir, setProfileOrderDir] = useState<"asc" | "desc">("asc");

  const [collaboratorSearch, setCollaboratorSearch] = useState("");

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

  const {
    org,
    orgLoading,
    orgError,
    refetchOrg,
    ownerProfile,
    primaryContact,
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

  const breadcrumbItems = (() => {
    const items = [
      { label: "Central do Bóris", href: "/" },
      { label: org?.name || "Organização" },
    ];
    if (isGroupsRoute) items.push({ label: "Grupos" });
    if (isDashboardRoute) items.push({ label: "Painel" });
    if (isKeywordsRoute) items.push({ label: "Palavras-chave" });
    if (isProfileRoute) items.push({ label: "Perfil" });
    return items;
  })();

  const { data: profileGroupsOverview, isLoading: profileGroupsLoading, error: profileGroupsError } = useQuery({
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
        members: typeof g.members_count === "number" ? g.members_count : null,
        status: g.is_active ? "Ativo" : "Inativo",
      }));
    },
    enabled: !!orgId && isAuthenticated && hasAccess && (isGroupsRoute || isProfileRoute),
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
    enabled: !!orgId && isAuthenticated && hasAccess && Array.isArray(orgGroupIds) && (isGroupsRoute || isProfileRoute),
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

  const {
    data: collaboratorTeamKpis,
    isLoading: collaboratorTeamKpisLoading,
    error: collaboratorTeamKpisError,
    refetch: refetchCollaboratorTeamKpis,
  } = useQuery({
    queryKey: ["org-team-collaborator-kpis", orgId, decisionStartISO, decisionEndISO],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("org_team_collaborator_kpis", {
        _org_id: orgId!,
        _start: decisionStartISO,
        _end: decisionEndISO,
      });
      if (error) throw error;
      return data?.[0] ?? null;
    },
    enabled: !!orgId && isAuthenticated && hasAccess && (isDashboardRoute || isDefaultOrgHome || isProfileRoute),
  });

  const {
    data: orgCollaborators,
    isLoading: orgCollaboratorsLoading,
    error: orgCollaboratorsError,
    refetch: refetchOrgCollaborators,
  } = useQuery({
    queryKey: ["org-collaborators", orgId, decisionStartISO, decisionEndISO],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("org_collaborator_kpis", {
        _org_id: orgId!,
        _start: decisionStartISO,
        _end: decisionEndISO,
      });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!orgId && isAuthenticated && hasAccess && (isDashboardRoute || isDefaultOrgHome),
  });

  const updateCollaboratorClassification = useMutation({
    mutationFn: async (args: { phone_e164: string | null; provider_member_id: string | null; classification: "active" | "external" }) => {
      if (!orgId) throw new Error("ORG_ID_REQUIRED");
      if (!args.phone_e164 && !args.provider_member_id) throw new Error("COLLABORATOR_IDENTITY_REQUIRED");

      const collaboratorKey = args.phone_e164 ?? args.provider_member_id;
      if (!collaboratorKey) throw new Error("COLLABORATOR_IDENTITY_REQUIRED");

      if (args.classification === "external") {
        const { error } = await supabase
          .from("org_collaborator_overrides")
          .upsert({ organization_id: orgId, collaborator_key: collaboratorKey, status: "external" } as any, {
            onConflict: "organization_id,collaborator_key",
          });
        if (error) throw error;
        return;
      }

      const { error } = await supabase
        .from("org_collaborator_overrides")
        .delete()
        .eq("organization_id", orgId)
        .eq("collaborator_key", collaboratorKey);
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["org-team-collaborator-kpis", orgId, decisionStartISO, decisionEndISO] });
      await queryClient.invalidateQueries({ queryKey: ["org-collaborators", orgId, decisionStartISO, decisionEndISO] });
    },
    onError: (err: any) => {
      notify.error("Falha ao atualizar colaborador", err?.message ? String(err.message) : "Tente novamente.");
    },
  });

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

    return (
      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1">
            <h4 className="text-sm font-semibold text-foreground">Grupos da organização</h4>
            <p className="text-xs text-muted-foreground">Lista interativa com filtros e exportação</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExportCsv}>Exportar CSV</Button>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4">
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

          {groupsLoading ? (
            <div className="mt-4"><LoadingState message="Carregando grupos..." /></div>
          ) : groupsError ? (
            <div className="mt-4"><ErrorState message="Falha ao carregar grupos" /></div>
          ) : sorted.length === 0 ? (
            <div className="mt-2"><EmptyState title="Nenhum grupo" message="Nada por aqui." /></div>
          ) : (
            <div className="mt-4">
              <div className="space-y-3">
                {sorted.map((g: any) => (
                  <div
                    key={g.id}
                    className="rounded-xl border border-border bg-card p-4 hover:bg-secondary/30 transition-colors cursor-pointer"
                    onClick={() => navigate(`/groups/${g.id}`)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-card-foreground truncate">{g.name}</div>
                        <div className="mt-1 text-xs text-muted-foreground truncate">{g.description || ""}</div>
                        <div className="mt-2 text-xs text-muted-foreground">Líder: {g.leader || "-"}</div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-sm font-semibold tabular-nums text-card-foreground">{typeof g.members === "number" ? g.members.toLocaleString("pt-BR") : "-"}</div>
                        <div className="text-[11px] text-muted-foreground">Integrantes</div>
                        <div className="mt-1 text-[11px]">{g.status}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    );
  })();

  const safeRatio = (curr: number, prev: number): number | null => {
    if (!Number.isFinite(curr) || !Number.isFinite(prev)) return null;
    if (prev <= 0) return curr > 0 ? 999 : 0;
    return curr / prev;
  };

  const computeActivityLevel = (row: OrgGroupSignalRow): ActivityLevel => {
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
  };

  const computeTrend = (row: OrgGroupSignalRow): TrendLevel => {
    const curr = typeof row.messagesCurrent === "number" ? row.messagesCurrent : null;
    const prev = typeof row.messagesPrevious === "number" ? row.messagesPrevious : null;
    if (curr === null || prev === null) return "sem_dados";
    if (prev < 10 && curr < 10) return "estavel";
    const ratio = safeRatio(curr, prev);
    if (ratio === null) return "sem_dados";
    if (ratio >= 1.25) return "subindo";
    if (ratio <= 0.75) return "caindo";
    return "estavel";
  };

  const computeAttention = (row: OrgGroupSignalRow) => {
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
  };

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
    enabled: !!orgId && isAuthenticated && hasAccess,
  });

  // Fetch groups for this organization
  

  const { data: orgKeywords, isLoading: keywordsLoading, error: keywordsError, refetch: refetchKeywords } = useQuery({
    queryKey: ['org-keywords', orgId, orgGroupIds?.join(','), currentStartISO, currentEndISO, previousStartISO, previousEndISO],
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

      const currCounts = countWordsFromRows(currRows);
      const prevCounts = countWordsFromRows(prevRows);
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

      const currBigrams = extractBigramsFromRows(currRows);
      const prevBigrams = extractBigramsFromRows(prevRows);
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
    enabled: !!orgId && isAuthenticated && hasAccess && Array.isArray(orgGroupIds),
  });

  const signals = Array.isArray(orgGroupsSignals) ? orgGroupsSignals : [];
  const signalsWithMetrics = signals.map((row) => {
    const activity = computeActivityLevel(row);
    const trend = computeTrend(row);
    const attention = computeAttention(row);
    return { row, activity, trend, attention };
  });

  const totalGroupsCount = typeof orgGroupIds?.length === "number" ? orgGroupIds.length : signals.length;
  const activeGroupsValue =
    typeof activeGroupsCount === "number" ? activeGroupsCount : signals.filter((g) => g.isActive === true).length;
  const silentGroupsCount = signalsWithMetrics.filter((g) => g.activity === "silencio").length;

  const attentionGroups = signalsWithMetrics
    .filter((g) => !!g.attention)
    .sort((a, b) => {
      const ap = a.attention?.priority ?? 999;
      const bp = b.attention?.priority ?? 999;
      if (ap !== bp) return ap - bp;

      const aAt = a.row.lastMessageAt ? new Date(a.row.lastMessageAt).getTime() : 0;
      const bAt = b.row.lastMessageAt ? new Date(b.row.lastMessageAt).getTime() : 0;
      return aAt - bAt;
    });

  const alertGroupsCount = attentionGroups.length;

  const activityRank: Record<ActivityLevel, number> = {
    silencio: 0,
    baixo: 1,
    medio: 2,
    alto: 3,
  };

  const trendRank: Record<TrendLevel, number> = {
    caindo: 0,
    estavel: 1,
    sem_dados: 1,
    subindo: 2,
  };

  const panoramaSorted = [...signalsWithMetrics].sort((a, b) => {
    const ar = activityRank[a.activity];
    const br = activityRank[b.activity];
    if (ar !== br) return br - ar;

    const aCount = typeof a.row.messagesCurrent === "number" ? a.row.messagesCurrent : -1;
    const bCount = typeof b.row.messagesCurrent === "number" ? b.row.messagesCurrent : -1;
    if (aCount !== bCount) return bCount - aCount;

    const aAt = a.row.lastMessageAt ? new Date(a.row.lastMessageAt).getTime() : 0;
    const bAt = b.row.lastMessageAt ? new Date(b.row.lastMessageAt).getTime() : 0;
    return bAt - aAt;
  });

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
    enabled: !!orgId && isAuthenticated && hasAccess && panoramaGroupIds.length > 0,
  });

  const panoramaColumns = [
    {
      key: "name",
      header: "Grupo",
      render: (g: any) => (
        <div className="min-w-0">
          <div className="font-semibold text-card-foreground truncate">{g.row.name}</div>
          {g.row.lastSummaryText ? (
            <div className="text-xs text-muted-foreground truncate">{toPreview(g.row.lastSummaryText, 120)}</div>
          ) : g.row.lastMessagePreview ? (
            <div className="text-xs text-muted-foreground truncate">{toPreview(g.row.lastMessagePreview, 120)}</div>
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
      render: (g: any) => {
        const variant = g.activity === "silencio" ? "error" : g.activity === "alto" ? "success" : "neutral";
        const label =
          g.activity === "silencio" ? "Silêncio" : g.activity === "baixo" ? "Baixa" : g.activity === "medio" ? "Média" : "Alta";
        return <StatusTag variant={variant}>{label}</StatusTag>;
      },
    },
    {
      key: "trend",
      header: "Tendência",
      hideOn: "sm",
      render: (g: any) => {
        if (g.trend === "subindo") {
          return (
            <div className="inline-flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-success" />
              <span className="text-sm text-card-foreground">Subindo</span>
            </div>
          );
        }
        if (g.trend === "caindo") {
          return (
            <div className="inline-flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-warning" />
              <span className="text-sm text-card-foreground">Caindo</span>
            </div>
          );
        }
        if (g.trend === "estavel") {
          return (
            <div className="inline-flex items-center gap-2">
              <Minus className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-card-foreground">Estável</span>
            </div>
          );
        }
        return <span className="text-sm text-muted-foreground">Sem dados</span>;
      },
    },
    {
      key: "recentMessages",
      header: `Msgs (${RECENT_MESSAGES_HOURS}h)`,
      hideOn: "sm",
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
      render: (g: any) => {
        const canEdit = canEditGroup(g.row.id, orgId);
        const canRemove = userCanEditOrg;
        const canCascade = isSystemAdmin;
        return (
          <div className="flex items-center gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
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
            {canEdit && (
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  try {
                    const { data, error } = await supabase
                      .from("groups")
                      .select("id, name, organization_id, provider, whatsapp_provider_id")
                      .eq("id", g.row.id)
                      .maybeSingle();
                    if (error) throw error;
                    if (!data) throw new Error("Grupo não encontrado");
                    setEditGroup(data as GroupDetails);
                  } catch {
                    notify.error("Não foi possível abrir", "Algo deu errado. Tente novamente.");
                  }
                }}
                className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                title="Editar grupo"
                aria-label="Editar grupo"
              >
                <Edit className="h-4 w-4" />
              </Button>
            )}
            {(canCascade || canRemove) && (
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
                className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                title={canCascade ? "Excluir grupo" : "Remover grupo da organização"}
                aria-label={canCascade ? "Excluir grupo" : "Remover grupo da organização"}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        );
      },
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
    if (!rawLink) return;
    if (!rawLink.includes("chat.whatsapp.com/")) {
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
          invite_link: rawLink,
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
          inviteLink: rawLink,
          item: groupItem,
        });
        attachedGroupId = ensuredGroup.groupId;
      } else {
        const { data: existingGroupByInvite, error: existingGroupByInviteError } = await supabase
          .from("groups")
          .select("id")
          .eq("organization_id", orgId)
          .eq("invite_link", rawLink)
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

      notify.success("Grupo adicionado com sucesso.", "");
      setAttachGroupOpen(false);
      setAttachInviteLink("");
      await queryClient.invalidateQueries({ queryKey: ["org-profile-groups", orgId] });
      await queryClient.invalidateQueries({ queryKey: ["org-groups-signals", orgId] });
      await queryClient.invalidateQueries({ queryKey: ["org-groups", orgId] });
      await queryClient.invalidateQueries({ queryKey: ["org-group-ids", orgId] });
      await queryClient.invalidateQueries({ queryKey: ["org-active-groups-count", orgId] });
      await queryClient.invalidateQueries({ queryKey: ["org-total-members", orgId] });
      await queryClient.invalidateQueries({ queryKey: ["org-messages-7d", orgId] });
      await queryClient.invalidateQueries({ queryKey: ["org-collaborators", orgId] });
      await queryClient.invalidateQueries({ queryKey: ["org-team-collaborator-kpis", orgId] });
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
  const hasCollaborators = Array.isArray(orgCollaborators) && orgCollaborators.length > 0;
  const hasGroups = totalGroupsCount > 0;
  const allHealthKpisZero = [totalGroupsCount, activeGroupsValue, silentGroupsCount, alertGroupsCount].every((v) => (v ?? 0) === 0);
  const showOrgOnboarding = (isDashboardRoute || isDefaultOrgHome) && !hasGroups;
  const addGroupLabel = hasGroups ? "Adicionar grupo" : "Criar primeiro grupo";

  const headerSummaryParts = [
    `${formatNumberBR(activeGroupsValue ?? 0)} grupos em operação`,
    `${formatNumberBR(Number((collaboratorTeamKpis as any)?.collaborators_active ?? 0))} colaboradores`,
    org.plan ? `Plano ${String(org.plan).toUpperCase()}` : "Plano não definido",
  ];
  const headerDescription = `${formatDateSimpleBR(org.created_at)} • ${headerSummaryParts.join(" • ")} • Atualizada em ${formatDateSimpleBR(org.updated_at)}`;

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
              {userCanEditOrg && (
                <Button variant="outline" size="sm" onClick={() => setEditContactOpen(true)}>
                  {hasPrimaryContactData ? "Editar contato" : "Cadastrar contato"}
                </Button>
              )}
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Nome</span>
                  <p className="font-medium text-card-foreground">{contactName || "-"}</p>
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
      <div className="space-y-8 animate-fade-in">
        <AdminPageHeader
          breadcrumbItems={breadcrumbItems}
          title={
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              <span className="truncate">{org?.name || "Organização"}</span>
              <span className={
                `px-2.5 py-0.5 rounded-full text-xs font-medium ${orgStatusClassName}`
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
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Colaboradores</div>
                  <div className="mt-1 text-lg font-semibold tabular-nums text-card-foreground">
                    {formatNumberBR(Number((collaboratorTeamKpis as any)?.collaborators_active ?? 0))}
                  </div>
                </div>
                <div className="rounded-xl border border-border bg-card p-3">
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Alertas</div>
                  <div className={`mt-1 text-lg font-semibold tabular-nums ${(alertGroupsCount ?? 0) > 0 ? "text-warning" : "text-success"}`}>
                    {formatNumberBR(alertGroupsCount ?? 0)}
                  </div>
                </div>
                <div className="rounded-xl border border-border bg-card p-3">
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Plano</div>
                  <div className="mt-1 text-lg font-semibold text-card-foreground capitalize">{org.plan || "-"}</div>
                </div>
                <div className="rounded-xl border border-border bg-card p-3">
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Cobrança</div>
                  <div className="mt-1 text-lg font-semibold text-card-foreground capitalize">{org.billing_status || "-"}</div>
                </div>
              </>
            ) : null
          }
          actions={(
            <div className="flex items-center gap-2">
              {userCanEditOrg && (
                <Button
                  size="sm"
                  onClick={() => setAttachGroupOpen(true)}
                  className="flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  {addGroupLabel}
                </Button>
              )}
              {userCanEditOrg && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditOrgOpen(true)}
                  className="flex items-center gap-2"
                >
                  <Edit className="h-4 w-4" />
                  Editar
                </Button>
              )}
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
                <section className="rounded-2xl overflow-hidden border border-border bg-card">
                  <div className="h-32 sm:h-44 w-full bg-center bg-cover" style={{ backgroundImage: `url(${cover})` }} />
                  <div className="p-4 sm:p-6 flex items-start gap-4">
                    <img src={logo} alt="Logo" className="h-16 w-16 rounded-lg border border-border bg-background object-cover" />
                    <div className="min-w-0">
                      <h3 className="text-lg sm:text-xl font-semibold text-card-foreground">{org?.name}</h3>
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
              <section className="rounded-2xl border border-border bg-card p-6 space-y-4">
                <h4 className="text-sm font-semibold text-foreground">Dados da Organização</h4>
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
                          <div key={s.label} className="rounded-xl bg-secondary/30 p-4">
                            <div className="text-xl font-semibold tabular-nums text-card-foreground">
                              {typeof s.value === "number" ? s.value.toLocaleString("pt-BR") : "-"}
                            </div>
                            <div className="text-xs text-muted-foreground flex items-center gap-1">
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

              <section className="rounded-2xl border border-border bg-card p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-foreground">Contato</h4>
                  {userCanEditOrg && (
                    <Button variant="outline" size="sm" onClick={() => setEditContactOpen(true)}>Editar contato</Button>
                  )}
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
                          <a href={md.socials.facebook} target="_blank" rel="noreferrer" className="px-2.5 py-1.5 rounded-md bg-secondary/50 text-xs">Facebook</a>
                        )}
                        {md?.socials?.instagram && (
                          <a href={md.socials.instagram} target="_blank" rel="noreferrer" className="px-2.5 py-1.5 rounded-md bg-secondary/50 text-xs">Instagram</a>
                        )}
                        {md?.socials?.linkedin && (
                          <a href={md.socials.linkedin} target="_blank" rel="noreferrer" className="px-2.5 py-1.5 rounded-md bg-secondary/50 text-xs">LinkedIn</a>
                        )}
                      </div>
                      <div>
                        <a href={contactEmail ? `mailto:${contactEmail}` : undefined} className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-primary text-primary-foreground text-sm disabled:opacity-50" aria-disabled={!contactEmail}>
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
            {showOrgOnboarding && (
              <Card className="border-0 shadow-none">
                <CardContent className="p-6">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                      <div className="text-sm font-semibold text-card-foreground">Organização pronta para começar</div>
                      <p className="text-sm text-muted-foreground max-w-2xl">
                        Esta organização ainda não tem grupos ativos. Para começar a operação, crie o primeiro grupo, cadastre um contato e sincronize atividade.
                      </p>
                      <div className="grid gap-2 text-sm mt-3">
                        <div className="rounded-lg bg-secondary/20 px-3 py-2">1. Criar o primeiro grupo para iniciar a coleta de atividade.</div>
                        <div className="rounded-lg bg-secondary/20 px-3 py-2">2. Cadastrar contato principal para atendimento e billing.</div>
                        <div className="rounded-lg bg-secondary/20 px-3 py-2">3. Acompanhar atividade dos grupos após as primeiras mensagens.</div>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row lg:flex-col gap-2 shrink-0">
                      {userCanEditOrg && (
                        <Button onClick={() => setAttachGroupOpen(true)} className="gap-2">
                          <Plus className="h-4 w-4" />
                          Criar primeiro grupo
                        </Button>
                      )}
                      {userCanEditOrg && (
                        <Button variant="outline" onClick={() => setEditContactOpen(true)}>
                          {hasPrimaryContactData ? "Editar contato" : "Cadastrar contato"}
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            <Card className="border-0 shadow-none">
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold text-card-foreground">Saúde da organização</div>
                    <div className="text-xs text-muted-foreground">Últimos 7 dias</div>
                  </div>
                  {signalsError ? (
                    <Button variant="outline" size="sm" onClick={() => refetchSignals()} className="shrink-0">
                      Tentar novamente
                    </Button>
                  ) : null}
                </div>

                <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className={`rounded-xl ${allHealthKpisZero ? "bg-secondary/20 p-3" : "bg-secondary/30 p-4"}`}>
                    <div className="text-2xl sm:text-3xl font-semibold tabular-nums text-card-foreground">
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
                    <div className="text-xs text-muted-foreground">Vinculados e não arquivados</div>
                  </div>

                  <div className={`rounded-xl ${allHealthKpisZero ? "bg-secondary/20 p-3" : "bg-secondary/30 p-4"}`}>
                    <div className="text-2xl sm:text-3xl font-semibold tabular-nums text-success">
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
                    <div className="text-xs text-muted-foreground">Mensagens no período</div>
                  </div>

                  <div className={`rounded-xl ${allHealthKpisZero ? "bg-secondary/20 p-3" : "bg-secondary/30 p-4"}`}>
                    <div
                      className={
                        `text-2xl sm:text-3xl font-semibold tabular-nums ${
                          (silentGroupsCount ?? 0) === 0 ? "text-success" : "text-warning"
                        }`
                      }
                    >
                      {formatNumberBR(silentGroupsCount ?? 0)}
                    </div>
                    <div className="mt-1 text-sm font-medium text-card-foreground flex items-center gap-1">
                      <span>Sem atividade</span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button aria-label="Ajuda" className="text-muted-foreground hover:text-foreground">
                            <HelpCircle className="h-3.5 w-3.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          Grupos sem mensagens recentes no período analisado.
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <div className="text-xs text-muted-foreground">Sem mensagens no período</div>
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
                        `text-2xl sm:text-3xl font-semibold tabular-nums ${
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

            <Card className="border-0 shadow-none">
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold text-card-foreground">Colaboradores</div>
                    <div className="text-xs text-muted-foreground">Últimos 7 dias</div>
                  </div>
                </div>

                {collaboratorTeamKpisLoading ? (
                  <div className="mt-4">
                    <LoadingState message="Carregando colaboradores..." />
                  </div>
                ) : collaboratorTeamKpisError ? (
                  <div className="mt-4">
                    <ErrorState
                      title="Não foi possível carregar o time"
                      message="Tente novamente em alguns instantes."
                      retry={() => refetchCollaboratorTeamKpis()}
                    />
                  </div>
                ) : collaboratorTeamKpis ? (
                  <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="rounded-xl bg-secondary/30 p-4">
                      <div className="text-2xl sm:text-3xl font-semibold tabular-nums text-card-foreground">
                        {formatNumberBR(Number((collaboratorTeamKpis as any).collaborators_active ?? 0))}
                      </div>
                      <div className="mt-1 text-sm font-medium text-card-foreground">Ativos</div>
                      <div className="text-xs text-muted-foreground">Administradores internos</div>
                    </div>
                    <div className="rounded-xl bg-secondary/30 p-4">
                      <div className="text-2xl sm:text-3xl font-semibold tabular-nums text-muted-foreground">
                        {formatNumberBR(Number((collaboratorTeamKpis as any).collaborators_external ?? 0))}
                      </div>
                      <div className="mt-1 text-sm font-medium text-card-foreground">Externos</div>
                      <div className="text-xs text-muted-foreground">Marcados como cliente</div>
                    </div>
                    <div className="rounded-xl bg-secondary/30 p-4">
                      <div className="text-2xl sm:text-3xl font-semibold tabular-nums text-card-foreground">
                        {formatNumberBR(Number((collaboratorTeamKpis as any).collaborators_active_in_period ?? 0))}
                      </div>
                      <div className="mt-1 text-sm font-medium text-card-foreground">Ativos no período</div>
                      <div className="text-xs text-muted-foreground">Enviaram mensagem</div>
                    </div>
                    <div className="rounded-xl bg-secondary/30 p-4">
                      {(() => {
                        const messagesTotal = Number((collaboratorTeamKpis as any).messages_total ?? 0);
                        const fromCollabs = Number((collaboratorTeamKpis as any).messages_from_collaborators ?? 0);
                        const rate = messagesTotal > 0 ? Math.round((fromCollabs / messagesTotal) * 100) : 0;
                        return (
                          <>
                            <div className="text-2xl sm:text-3xl font-semibold tabular-nums text-card-foreground">{rate}%</div>
                            <div className="mt-1 text-sm font-medium text-card-foreground">Participação</div>
                            <div className="text-xs text-muted-foreground">Msgs do time / total</div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 text-sm text-muted-foreground">Sem dados de colaboradores.</div>
                )}
              </CardContent>
            </Card>

            <Card className="border-0 shadow-none">
              <CardContent className="p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-card-foreground">Lista de colaboradores</div>
                    <div className="text-xs text-muted-foreground">Administradores do WhatsApp consolidados</div>
                  </div>
                  <div className="w-full sm:max-w-xs">
                    <Input
                      value={collaboratorSearch}
                      onChange={(e) => setCollaboratorSearch(e.target.value)}
                      placeholder="Buscar por nome ou telefone"
                    />
                  </div>
                </div>

                {orgCollaboratorsLoading ? (
                  <div className="mt-4">
                    <LoadingState message="Carregando lista..." />
                  </div>
                ) : orgCollaboratorsError ? (
                  <div className="mt-4">
                    <ErrorState
                      title="Não foi possível carregar o time"
                      message="Tente novamente em alguns instantes."
                      retry={() => refetchOrgCollaborators()}
                    />
                  </div>
                ) : !orgCollaborators || orgCollaborators.length === 0 ? (
                  <div className="mt-4">
                    <EmptyState
                      icon={Users}
                      title="Nenhum colaborador identificado ainda"
                      message="Os colaboradores aparecem quando há grupos vinculados com administradores e mensagens recentes."
                      action={userCanEditOrg ? { label: addGroupLabel, onClick: () => setAttachGroupOpen(true) } : undefined}
                    />
                  </div>
                ) : (
                  (() => {
                    const q = collaboratorSearch.trim().toLowerCase();
                    const filtered = (orgCollaborators as any[])
                      .filter((c) => {
                        if (!q) return true;
                        const hay = [c.display_name, c.phone_e164, c.provider_member_id]
                          .map((v) => String(v ?? "").toLowerCase())
                          .join(" ");
                        return hay.includes(q);
                      })
                      .sort((a, b) => Number(b.messages_total ?? 0) - Number(a.messages_total ?? 0));

                    const rows = filtered.slice(0, 60);

                    if (rows.length === 0) {
                      return (
                        <div className="mt-4">
                          <EmptyState
                            icon={Users}
                            title="Nenhum colaborador encontrado"
                            message="Ajuste a busca por nome ou telefone para encontrar um colaborador."
                          />
                        </div>
                      );
                    }

                    return (
                      <>
                        <div className="mt-4 hidden md:block">
                          <div className="overflow-hidden rounded-xl border border-border">
                            <table className="w-full text-sm">
                              <thead className="bg-secondary/20">
                                <tr>
                                  <th className="px-4 py-3 text-left text-[13px] font-semibold text-foreground/75">Colaborador</th>
                                  <th className="px-4 py-3 text-left text-[13px] font-semibold text-foreground/75">Tipo</th>
                                  <th className="px-4 py-3 text-right text-[13px] font-semibold text-foreground/75">Grupos</th>
                                  <th className="px-4 py-3 text-right text-[13px] font-semibold text-foreground/75">Grupos (período)</th>
                                  <th className="px-4 py-3 text-right text-[13px] font-semibold text-foreground/75">Msgs (7d)</th>
                                  <th className="px-4 py-3 text-right text-[13px] font-semibold text-foreground/75">Ação</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border">
                                {rows.map((c) => {
                                  const isExternal = String(c.classification) === "external";
                                  const label = String(c.display_name || c.provider_member_id || c.phone_e164 || "Colaborador");
                                  const phone = (c.phone_e164 ?? null) as string | null;
                                  const providerMemberId = (c.provider_member_id ?? null) as string | null;

                                  return (
                                    <tr key={String(c.collaborator_ref)} className="h-11">
                                      <td className="px-4 py-2 text-[14px] align-middle">
                                        <div className="font-medium text-card-foreground">{label}</div>
                                        <div className="text-xs text-muted-foreground">{phone || providerMemberId || "—"}</div>
                                      </td>
                                      <td className="px-4 py-2 text-[14px] align-middle">
                                        <StatusTag variant={isExternal ? "neutral" : "success"}>
                                          {isExternal ? "Externo/Cliente" : "Colaborador"}
                                        </StatusTag>
                                      </td>
                                      <td className="px-4 py-2 text-[14px] text-right tabular-nums align-middle">{formatNumberBR(Number(c.groups_count ?? 0))}</td>
                                      <td className="px-4 py-2 text-[14px] text-right tabular-nums align-middle">{formatNumberBR(Number(c.groups_active ?? 0))}</td>
                                      <td className="px-4 py-2 text-[14px] text-right tabular-nums align-middle">{formatNumberBR(Number(c.messages_total ?? 0))}</td>
                                      <td className="px-4 py-2 text-right align-middle">
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          disabled={!userCanEditOrg || updateCollaboratorClassification.isPending}
                                          onClick={() =>
                                            updateCollaboratorClassification.mutate({
                                              phone_e164: phone,
                                              provider_member_id: providerMemberId,
                                              classification: isExternal ? "active" : "external",
                                            })
                                          }
                                          className="gap-2"
                                        >
                                          {updateCollaboratorClassification.isPending ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                          ) : null}
                                          {isExternal ? "Marcar como colaborador" : "Marcar como externo"}
                                        </Button>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        <div className="mt-4 space-y-3 md:hidden">
                          {rows.slice(0, 20).map((c) => {
                            const isExternal = String(c.classification) === "external";
                            const label = String(c.display_name || c.provider_member_id || c.phone_e164 || "Colaborador");
                            const phone = (c.phone_e164 ?? null) as string | null;
                            const providerMemberId = (c.provider_member_id ?? null) as string | null;
                            return (
                              <div key={String(c.collaborator_ref)} className="rounded-2xl bg-secondary/30 p-4">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="font-medium text-card-foreground truncate">{label}</div>
                                    <div className="text-xs text-muted-foreground truncate">{phone || providerMemberId || "—"}</div>
                                  </div>
                                  <StatusTag variant={isExternal ? "neutral" : "success"}>
                                    {isExternal ? "Externo" : "Ativo"}
                                  </StatusTag>
                                </div>
                                <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                                  <div className="rounded-lg bg-background/40 p-2">
                                    <div className="text-[10px]">Grupos</div>
                                    <div className="text-sm font-medium tabular-nums text-card-foreground">{formatNumberBR(Number(c.groups_count ?? 0))}</div>
                                  </div>
                                  <div className="rounded-lg bg-background/40 p-2">
                                    <div className="text-[10px]">Grupos (7d)</div>
                                    <div className="text-sm font-medium tabular-nums text-card-foreground">{formatNumberBR(Number(c.groups_active ?? 0))}</div>
                                  </div>
                                  <div className="rounded-lg bg-background/40 p-2">
                                    <div className="text-[10px]">Msgs (7d)</div>
                                    <div className="text-sm font-medium tabular-nums text-card-foreground">{formatNumberBR(Number(c.messages_total ?? 0))}</div>
                                  </div>
                                </div>
                                <div className="mt-3">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={!userCanEditOrg || updateCollaboratorClassification.isPending}
                                    onClick={() =>
                                      updateCollaboratorClassification.mutate({
                                        phone_e164: phone,
                                        provider_member_id: providerMemberId,
                                        classification: isExternal ? "active" : "external",
                                      })
                                    }
                                    className="w-full gap-2"
                                  >
                                    {updateCollaboratorClassification.isPending ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : null}
                                    {isExternal ? "Marcar como colaborador" : "Marcar como externo"}
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    );
                  })()
                )}
              </CardContent>
            </Card>

            <Card className="border-0 shadow-none">
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold text-card-foreground">Atividade dos grupos</div>
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
                      action={userCanEditOrg ? { label: addGroupLabel, onClick: () => setAttachGroupOpen(true) } : undefined}
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
                            className="rounded-2xl bg-secondary/30 p-4 transition-colors cursor-pointer hover:bg-secondary/40"
                            onClick={() => navigate(`/groups/${g.row.id}`)}
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="min-w-0">
                                <div className="font-semibold text-card-foreground truncate">{g.row.name}</div>
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
                              {canEdit && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={async () => {
                                    try {
                                      const { data, error } = await supabase
                                        .from("groups")
                                        .select("id, name, organization_id, provider, whatsapp_provider_id")
                                        .eq("id", g.row.id)
                                        .maybeSingle();
                                      if (error) throw error;
                                      if (!data) throw new Error("Grupo não encontrado");
                                      setEditGroup(data as GroupDetails);
                                    } catch {
                                      notify.error("Não foi possível abrir", "Algo deu errado. Tente novamente.");
                                    }
                                  }}
                                  className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                                  title="Editar grupo"
                                  aria-label="Editar grupo"
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                              )}
                              {(canCascade || canRemove) && (
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
                                  className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                  title={canCascade ? "Excluir grupo" : "Remover grupo da organização"}
                                  aria-label={canCascade ? "Excluir grupo" : "Remover grupo da organização"}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
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
        contact={primaryContact ?? null}
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
                    notify.error("Falha de conexão", parsed.message);
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
                  notify.error("Não foi possível excluir", parsed.message);
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

      
    </AdminLayout>
  );
};

export default Org;
