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
  ChevronDown,
  CreditCard,
  Mail,
  Trash2,
  Tag,
  Loader2,
  TrendingDown,
  TrendingUp,
  Minus,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FunctionsFetchError, FunctionsHttpError } from "@supabase/supabase-js";
import { useState, useEffect } from "react";
import { useUserRoles } from "@/hooks/use-user-roles";
import { useAuth } from "@/hooks/use-auth";
import AccessDenied from "./AccessDenied";
import { formatDateSimpleBR } from "@/lib/date";
import { EditOrganizationModal } from "@/components/modals/EditOrganizationModal";
import { EditOrganizationContactModal } from "@/components/modals/EditOrganizationContactModal";
import { EditGroupModal } from "@/components/modals/EditGroupModal";
import { Button } from "@/components/ui/button";
import { notify } from "@/components/ui/sonner";
import { Input } from "@/components/ui/input";
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

const PAGE_SIZE = 10;
const PANORAMA_PAGE_SIZE = 8;
const RECENT_MESSAGES_HOURS = 24;

function formatCounts(counts?: Record<string, number>): string {
  if (!counts) return "";
  const entries = Object.entries(counts)
    .filter(([, v]) => typeof v === "number" && v > 0)
    .sort((a, b) => (b[1] as number) - (a[1] as number))
    .slice(0, 6)
    .map(([k, v]) => `${k}: ${v}`);
  return entries.length ? entries.join(" • ") : "";
}

async function parseInvokeError(err: any): Promise<{ message: string; code?: string; counts?: Record<string, number> }> {
  let message = err?.message || "Algo deu errado. Tente novamente.";
  let code: string | undefined;
  let counts: Record<string, number> | undefined;

  if (err instanceof FunctionsHttpError && (err as any).context) {
    try {
      const body = await (err as any).context.json();
      if (body?.message) message = body.message;
      if (typeof body?.code === "string") code = body.code;
      if (body?.details?.counts && typeof body.details.counts === "object") counts = body.details.counts;
    } catch {
      void 0;
    }
  }

  const isFetchError =
    err instanceof FunctionsFetchError ||
    err?.name === "FunctionsFetchError" ||
    /failed to send a request to the edge function/i.test(message) ||
    /fetch failed/i.test(message) ||
    /networkerror/i.test(message);

  if (!code && isFetchError) {
    const isOffline = typeof navigator !== "undefined" && navigator?.onLine === false;
    code = "NETWORK_ERROR";
    message = isOffline
      ? "Sem conexão com a internet."
      : "Não foi possível comunicar com o servidor. Verifique sua conexão/VPN e tente novamente.";
  }

  return { message, code, counts };
}

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
    const { error } = await supabase
      .from("members")
      .upsert(rows as any, { onConflict: "group_id,provider_member_id" });
    if (error) throw error;
  }

  return { insertedOrUpdated: rows.length };
};

let orgGroupsSignalRpcAvailable: boolean | null = null;

const Org = () => {
  const { orgId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [panoramaPage, setPanoramaPage] = useState(1);
  const [recentMessagesStartISO] = useState(
    () => new Date(Date.now() - RECENT_MESSAGES_HOURS * 60 * 60 * 1000).toISOString(),
  );
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { canEditOrg, canEditGroup, isLoading: rolesLoading, isSystemAdmin } = useUserRoles();
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

  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>('7d');
  const [customRange, setCustomRange] = useState<DateRange | undefined>();

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

  const handlePeriodChange = (period: PeriodType, range: DateRange) => {
    setSelectedPeriod(period);
    setCustomRange(period === 'custom' ? range : undefined);
  };

  // Fetch organization details
  const { data: org, isLoading: orgLoading, error: orgError, refetch: refetchOrg } = useQuery({
    queryKey: ['organization-detail', orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', orgId)
        .maybeSingle();
      
      if (error) throw error;
      return data as OrganizationDetail;
    },
    enabled: !!orgId && isAuthenticated,
  });

  // Fetch owner profile if exists
  const { data: ownerProfile } = useQuery({
    queryKey: ['owner-profile', org?.owner_user_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('name')
        .eq('id', org!.owner_user_id!)
        .maybeSingle();
      return data;
    },
    enabled: !!org?.owner_user_id,
  });

  const { data: primaryContact, isLoading: contactLoading, error: contactError, refetch: refetchPrimaryContact } = useQuery({
    queryKey: ['org-primary-contact', orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organization_contacts')
        .select('*')
        .eq('organization_id', orgId)
        .eq('is_primary', true)
        .maybeSingle();
      if (error) throw error;
      return data as {
        id: string;
        organization_id: string;
        name: string;
        email: string | null;
        phone: string | null;
        role_title: string | null;
        is_primary: boolean;
        created_at: string;
        updated_at: string;
      };
    },
    enabled: !!orgId && isAuthenticated,
  });

  const contactName = primaryContact?.name || org?.contact_name || undefined;
  const contactEmail = primaryContact?.email || org?.contact_email || undefined;
  const contactPhone = primaryContact?.phone || org?.contact_phone || undefined;
  const contactRole = primaryContact?.role_title || undefined;

  const { data: orgGroupIds } = useQuery({
    queryKey: ['org-group-ids', orgId],
    queryFn: async () => {
      const { data } = await supabase
        .from('groups')
        .select('id')
        .eq('organization_id', orgId!)
        .is('deleted_at', null)
        .neq('is_archived', true);
      return (data ?? []).map((g: { id: string }) => g.id);
    },
    enabled: !!orgId && isAuthenticated,
  });

  const { data: totalMembersCount, isLoading: membersCountLoading } = useQuery({
    queryKey: ['org-total-members', orgId, orgGroupIds?.join(',')],
    queryFn: async () => {
      if (!orgGroupIds || orgGroupIds.length === 0) return 0;
      const { count } = await supabase
        .from('members')
        .select('*', { count: 'exact', head: true })
        .in('group_id', orgGroupIds)
        .is('deleted_at', null);
      return count ?? 0;
    },
    enabled: !!orgId && isAuthenticated && Array.isArray(orgGroupIds),
  });

  const { data: messagesLast7dCount, isLoading: messagesCountLoading } = useQuery({
    queryKey: ['org-messages-7d', orgId, orgGroupIds?.join(',')],
    queryFn: async () => {
      if (!orgGroupIds || orgGroupIds.length === 0) return 0;
      const fromISO = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const toISO = new Date().toISOString();
      const { count } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .in('group_id', orgGroupIds)
        .is('deleted_at', null)
        .gte('created_at', fromISO)
        .lte('created_at', toISO);
      return count ?? 0;
    },
    enabled: !!orgId && isAuthenticated && Array.isArray(orgGroupIds),
  });

  const { data: activeGroupsCount, isLoading: activeGroupsLoading } = useQuery({
    queryKey: ['org-active-groups-count', orgId],
    queryFn: async () => {
      const { count } = await supabase
        .from('groups')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', orgId!)
        .is('deleted_at', null)
        .neq('is_archived', true)
        .eq('is_active', true);
      return count ?? 0;
    },
    enabled: !!orgId && isAuthenticated,
  });

  

  

  const path = location.pathname;
  const isGroupsRoute = /^\/(?:org|organization)\/[^/]+\/groups$/.test(path);
  const isDashboardRoute = /^\/(?:org|organization)\/[^/]+\/dashboard$/.test(path);
  const isKeywordsRoute = /^\/(?:org|organization)\/[^/]+\/keywords$/.test(path);
  const isBaseOrg = /^\/(?:org|organization)\/[^/]+\/?$/.test(path);
  const isDefaultOrgHome = isBaseOrg && !isGroupsRoute && !isDashboardRoute && !isKeywordsRoute;

  const breadcrumbItems = (() => {
    const items = [
      { label: "Central de Comando", href: "/" },
      { label: org?.name || "Organização" },
    ];
    if (isGroupsRoute) items.push({ label: "Grupos" });
    if (isDashboardRoute) items.push({ label: "Painéis e métricas" });
    if (isKeywordsRoute) items.push({ label: "Palavras-chave" });
    return items;
  })();

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
    enabled: !!orgId && isAuthenticated,
  });

  // Fetch groups for this organization
  const { data: groupsData, isLoading: groupsLoading, error: groupsError, refetch: refetchGroups } = useQuery({
    queryKey: ['org-groups', orgId, page],
    queryFn: async () => {
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      
      const { data, error, count } = await supabase
        .from('v_group_overview')
        .select('group_id, group_name, created_at, organization_id, is_active, members_count, last_access_at', { count: 'exact' })
        .eq('organization_id', orgId)
        .neq('is_archived', true)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;
      const items = ((data ?? []) as any[]).map((row) => ({
        id: row.group_id,
        name: row.group_name,
        created_at: row.created_at,
        organization_id: row.organization_id,
        whatsapp_provider_id: null,
        is_active: row.is_active,
        members_count: typeof row.members_count === 'number' ? row.members_count : Number(row.members_count ?? 0),
        last_access_at: row.last_access_at,
      })) as GroupListItem[];
      return { items, count: count ?? 0 };
    },
    enabled: !!orgId && isAuthenticated,
  });

  

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
          .is('deleted_at', null)
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
    enabled: !!orgId && isAuthenticated && Array.isArray(orgGroupIds),
  });

  const signals = Array.isArray(orgGroupsSignals) ? orgGroupsSignals : [];
  const signalsWithMetrics = signals.map((row) => {
    const activity = computeActivityLevel(row);
    const trend = computeTrend(row);
    const attention = computeAttention(row);
    return { row, activity, trend, attention };
  });

  const totalGroupsCount = typeof groupsData?.count === "number" ? groupsData.count : signals.length;
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
    const ap = a.attention?.priority ?? 999;
    const bp = b.attention?.priority ?? 999;
    if (ap !== bp) return ap - bp;

    const ar = activityRank[a.activity];
    const br = activityRank[b.activity];
    if (ar !== br) return br - ar;

    const trA = trendRank[a.trend];
    const trB = trendRank[b.trend];
    if (trA !== trB) return trB - trA;

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
    enabled: !!orgId && isAuthenticated && panoramaGroupIds.length > 0,
  });

  const panoramaColumns = [
    {
      key: "name",
      header: "Grupo",
      render: (g: any) => (
        <div className="min-w-0">
          <div className="font-medium text-card-foreground truncate">{g.row.name}</div>
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
        return <span className="text-sm tabular-nums">{formatNumberBR(count)}</span>;
      },
    },
    {
      key: "actions",
      header: "",
      className: "w-10",
      render: (g: any) => (
        <Button
          variant="outline"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/groups/${g.row.id}`);
          }}
        >
          Abrir
        </Button>
      ),
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

  if (orgLoading) {
    return (
      <AdminLayout title="Organização" subtitle="Carregando...">
        <LoadingState message="Carregando detalhes da organização..." />
      </AdminLayout>
    );
  }

  // Check access - RLS will return null if no access
  if (orgError || !org) {
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
      const webhookUrl = ((import.meta as any).env.VITE_N8N_CHECK_GROUP_ENTRY_URL as string | undefined)?.trim();
      if (!webhookUrl) {
        setAttachError("Não foi possível verificar o grupo agora. Tente novamente em instantes.");
        return;
      }

      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invite_link: rawLink }),
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

      const groupsArray = (() => {
        if (Array.isArray(payload)) return payload;
        if (payload && typeof payload === "object") {
          const obj = payload as any;
          if (Array.isArray(obj?.data)) return obj.data;
          if (Array.isArray(obj?.groups)) return obj.groups;
          if (Array.isArray(obj?.items)) return obj.items;
          if (Array.isArray(obj?.result)) return obj.result;
          if (Array.isArray(obj?.participants)) return [payload];
        }
        return null;
      })();

      if (Array.isArray(groupsArray) && groupsArray.length === 0) {
        setAttachError(scenarioBMessage);
        return;
      }

      if (!Array.isArray(groupsArray) || groupsArray.length < 1) {
        setAttachError("Não foi possível verificar o grupo agora. Tente novamente em instantes.");
        return;
      }

      const item = (groupsArray.find((g) => !!g && typeof g === "object" && Array.isArray((g as any).participants)) ??
        null) as N8nCheckGroupSuccessItem | null;

      if (!item) {
        setAttachError("Não foi possível verificar o grupo agora. Tente novamente em instantes.");
        return;
      }

      const groupPhone = String(item?.phone ?? "").trim();
      const groupName = String(item?.subject ?? item?.name ?? "").trim();
      const groupDescription = String(item?.description ?? "").trim();
      const createdAtProvider = toISOFromCreation(item?.creation);
      const participants = (item as any)?.participants;

      if (!groupPhone) {
        setAttachError("Não foi possível verificar o grupo agora. Tente novamente em instantes.");
        return;
      }

      if (!Array.isArray(participants)) {
        setAttachError("Não foi possível verificar o grupo agora. Tente novamente em instantes.");
        return;
      }

      const groupPayload = {
        organization_id: orgId,
        provider: "whatsapp",
        whatsapp_provider_id: groupPhone,
        provider_phone: groupPhone,
        name: groupName || groupPhone,
        description: groupDescription || null,
        created_at_provider: createdAtProvider,
        invite_link: rawLink,
        invite_link_status: "valid",
        status: "active",
        is_active: true,
        is_archived: false,
        deleted_at: null,
        raw_provider: item as any,
      } as any;

      let groupIdToUse: string | null = null;

      const { data: inserted, error: insertError } = await supabase
        .from("groups")
        .insert(groupPayload)
        .select("id")
        .single();

      if (!insertError && inserted?.id) {
        groupIdToUse = inserted.id;
      } else {
        const insertCode = String((insertError as any)?.code ?? "");
        if (insertCode !== "23505") {
          setAttachError("Não foi possível verificar o grupo agora. Tente novamente em instantes.");
          return;
        }

        const { data: existing, error: existingError } = await supabase
          .from("groups")
          .select("id")
          .eq("whatsapp_provider_id", groupPhone)
          .maybeSingle();

        if (existingError || !existing?.id) {
          setAttachError("Não foi possível verificar o grupo agora. Tente novamente em instantes.");
          return;
        }

        const { error: updateError } = await supabase
          .from("groups")
          .update(groupPayload)
          .eq("id", existing.id);

        if (updateError) {
          setAttachError("Não foi possível verificar o grupo agora. Tente novamente em instantes.");
          return;
        }

        groupIdToUse = existing.id;
      }

      if (!groupIdToUse) {
        setAttachError("Não foi possível verificar o grupo agora. Tente novamente em instantes.");
        return;
      }

      await upsertMembersForGroup({ groupId: groupIdToUse, participants });

      notify.success("Grupo adicionado com sucesso e membros sincronizados.", "");
      setAttachGroupOpen(false);
      setAttachInviteLink("");
      await queryClient.invalidateQueries({ queryKey: ["org-groups", orgId] });
      await queryClient.invalidateQueries({ queryKey: ["org-group-ids", orgId] });
      await queryClient.invalidateQueries({ queryKey: ["org-active-groups-count", orgId] });
      await queryClient.invalidateQueries({ queryKey: ["org-total-members", orgId] });
      await queryClient.invalidateQueries({ queryKey: ["org-messages-7d", orgId] });
    } catch {
      setAttachError("Não foi possível verificar o grupo agora. Tente novamente em instantes.");
    } finally {
      setAttaching(false);
    }
  };

  const groupColumns = [
    { key: 'name', header: 'Nome' },
    {
      key: 'members_count',
      header: 'Membros',
      hideOn: 'sm',
      render: (group: GroupListItem) => (
        <span className="tabular-nums">{typeof group.members_count === 'number' ? group.members_count.toLocaleString('pt-BR') : '—'}</span>
      ),
    },
    { 
      key: 'is_active', 
      header: 'Status',
      render: (group: GroupListItem) => (
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
          group.is_active === true ? 'bg-success/10 text-success' :
          group.is_active === false ? 'bg-muted text-muted-foreground' :
          'bg-muted text-muted-foreground'
        }`}>
          {group.is_active === true ? 'Ativo' : group.is_active === false ? 'Inativo' : '—'}
        </span>
      )
    },
    { 
      key: 'created_at', 
      header: 'Criado em',
      render: (group: GroupListItem) => formatDateSimpleBR(group.created_at)
    },
    { 
      key: 'last_access_at', 
      header: 'Último acesso',
      hideOn: 'sm',
      render: (group: GroupListItem) => group.last_access_at ? formatDateSimpleBR(group.last_access_at) : '—'
    },
    {
      key: 'actions',
      header: '',
      className: 'w-10',
      render: (group: GroupListItem) => {
        const canEdit = canEditGroup(group.id, orgId);
        const canRemove = userCanEditOrg;
        const canCascade = isSystemAdmin;
        if (!canEdit && !canRemove && !canCascade) return null;
        return (
          <div className="flex items-center gap-1">
            {canEdit && (
              <Button
                variant="ghost"
                size="sm"
                onClick={async (e) => {
                  e.stopPropagation();
                  try {
                    const { data, error } = await supabase
                      .from('groups')
                      .select('id, name, organization_id, provider, whatsapp_provider_id')
                      .eq('id', group.id)
                      .maybeSingle();
                    if (error) throw error;
                    if (!data) throw new Error('Grupo não encontrado');
                    setEditGroup(data as GroupDetails);
                  } catch {
                    notify.error('Não foi possível abrir', 'Algo deu errado. Tente novamente.');
                  }
                }}
                className="h-8 w-8 p-0"
              >
                <Edit className="h-4 w-4" />
              </Button>
            )}
            {canRemove && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setRemoveGroup(group);
                }}
                className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                title="Remover grupo da organização"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
            {canCascade && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setCascadeGroup(group);
                }}
                className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                title="Excluir grupo"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        );
      }
    },
  ];

  return (
    <AdminLayout 
      title="Organização" 
      subtitle={org?.name || "Organização"}
    >
      <div className="space-y-6 animate-fade-in">
        <AdminPageHeader
          breadcrumbItems={breadcrumbItems}
          title={org?.name || "Organização"}
          description={`Criada em ${formatDateSimpleBR(org.created_at)}`}
          actions={(
            <div className="flex items-center gap-3">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                org.status === 'active' ? 'bg-success/10 text-success' :
                org.status === 'inactive' ? 'bg-muted text-muted-foreground' :
                'bg-destructive/10 text-destructive'
              }`}>
                {org.status === 'active' ? 'Ativo' : org.status === 'inactive' ? 'Inativo' : 'Suspenso'}
              </span>
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

        

        {(isDashboardRoute || isDefaultOrgHome) && (
          <div id="org-dashboard" className="space-y-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold text-card-foreground">Estado geral</div>
                    <div className="text-xs text-muted-foreground">Últimos 7 dias</div>
                  </div>
                  {signalsError ? (
                    <Button variant="outline" size="sm" onClick={() => refetchSignals()} className="shrink-0">
                      Tentar novamente
                    </Button>
                  ) : null}
                </div>

                <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <Card className="shadow-none">
                    <CardContent className="p-4">
                      <div className="text-xs text-muted-foreground">Grupos</div>
                      <div className="text-2xl font-semibold tabular-nums">{formatNumberBR(totalGroupsCount ?? 0)}</div>
                      <div className="text-xs text-muted-foreground">Total na organização</div>
                    </CardContent>
                  </Card>
                  <Card className="shadow-none">
                    <CardContent className="p-4">
                      <div className="text-xs text-muted-foreground">Ativos</div>
                      <div className="text-2xl font-semibold tabular-nums">{formatNumberBR(activeGroupsValue ?? 0)}</div>
                      <div className="text-xs text-muted-foreground">Em operação</div>
                    </CardContent>
                  </Card>
                  <Card className="shadow-none">
                    <CardContent className="p-4">
                      <div className="text-xs text-muted-foreground">Em silêncio</div>
                      <div className="text-2xl font-semibold tabular-nums">{formatNumberBR(silentGroupsCount ?? 0)}</div>
                      <div className="text-xs text-muted-foreground">Sem mensagens recentes</div>
                    </CardContent>
                  </Card>
                  <Card className="shadow-none">
                    <CardContent className="p-4">
                      <div className="text-xs text-muted-foreground">Com alerta</div>
                      <div className="text-2xl font-semibold tabular-nums">{formatNumberBR(alertGroupsCount ?? 0)}</div>
                      <div className="text-xs text-muted-foreground">Precisa de atenção</div>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold text-card-foreground">Panorama geral</div>
                    <div className="text-xs text-muted-foreground">Atividade, tendência e último sinal</div>
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
                  <div className="mt-4 text-sm text-muted-foreground">Sem dados suficientes para montar o panorama.</div>
                ) : (
                  <div className="mt-4">
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
                )}
              </CardContent>
            </Card>
          </div>
        )}


        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Section: Contato da Organização */}
          {(isDashboardRoute || isDefaultOrgHome) && (
          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Contato da Organização
              </h3>
              {userCanEditOrg && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditContactOpen(true)}
                  className="flex items-center gap-2"
                >
                  <Edit className="h-4 w-4" />
                  Editar contato
                </Button>
              )}
            </div>
            {contactLoading ? (
              <p className="text-sm text-muted-foreground">Carregando contato...</p>
            ) : contactError ? (
              <p className="text-sm text-destructive">Falha ao carregar contato</p>
            ) : (
              <div className="grid grid-cols-1 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Nome</span>
                  <p className="font-medium text-card-foreground">{contactName || '-'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Email</span>
                  <p className="font-medium text-card-foreground">{contactEmail || '-'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Telefone</span>
                  <p className="font-medium text-card-foreground">{contactPhone || '-'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Cargo</span>
                  <p className="font-medium text-card-foreground">{contactRole || '-'}</p>
                </div>
                {!primaryContact && !org?.contact_name && !org?.contact_email && !org?.contact_phone && (
                  <p className="text-xs text-muted-foreground">Nenhum contato primário cadastrado.</p>
                )}
              </div>
            )}
          </div>
          )}

          {/* Section: Plano / Billing */}
          {(isDashboardRoute || isDefaultOrgHome) && (
          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Plano / Billing
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Plano</span>
                <p className="font-medium text-card-foreground capitalize">{org.plan || '-'}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Status do Billing</span>
                <p className={`font-medium capitalize ${
                  org.billing_status === 'active' ? 'text-success' :
                  (org.billing_status === 'past_due' || org.billing_status === 'overdue') ? 'text-destructive' :
                  'text-muted-foreground'
                }`}>
                  {org.billing_status || '-'}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Início do Trial</span>
                <p className="font-medium text-card-foreground">
                  {org.trial_started_at 
                    ? new Date(org.trial_started_at).toLocaleDateString('pt-BR') 
                    : '-'}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Fim do Trial</span>
                <p className="font-medium text-card-foreground">
                  {org.trial_ends_at 
                    ? new Date(org.trial_ends_at).toLocaleDateString('pt-BR') 
                    : '-'}
                </p>
              </div>
            </div>
          </div>
          )}
        </div>

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
                      <span key={w.word} className="px-2 py-1 rounded-md bg-secondary text-secondary-foreground text-xs">
                        {w.word}
                        <span className="ml-2 text-muted-foreground">{w.count}</span>
                        {typeof w.delta === 'number' && (
                          <span className={`ml-2 ${w.delta > 0 ? 'text-success' : w.delta < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>{w.delta > 0 ? `+${w.delta}%` : w.delta < 0 ? `${w.delta}%` : '0%'}</span>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Temas recorrentes (bigramas)</p>
                  <div className="flex flex-wrap gap-2">
                    {(orgKeywords.bigrams || []).map((b: any) => (
                      <span key={b.phrase} className="px-2 py-1 rounded-md bg-secondary text-secondary-foreground text-xs">
                        {b.phrase}
                        <span className="ml-2 text-muted-foreground">{b.count}</span>
                        {typeof b.delta === 'number' && (
                          <span className={`ml-2 ${b.delta > 0 ? 'text-success' : b.delta < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>{b.delta > 0 ? `+${b.delta}%` : b.delta < 0 ? `${b.delta}%` : '0%'}</span>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        

        {(isGroupsRoute || isDefaultOrgHome) && (
        <div id="org-groups">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />
              Grupos ({groupsData?.count ?? 0})
            </h3>
            {userCanEditOrg && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setAttachError(null); setAttachGroupOpen(true); }}
              >
                Adicionar grupo
              </Button>
            )}
          </div>
          
          {groupsLoading ? (
            <LoadingState message="Carregando grupos..." />
          ) : groupsError ? (
            <ErrorState 
              message="Falha ao carregar grupos"
              retry={() => refetchGroups()}
            />
          ) : groupsData?.items.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Nenhum grupo"
              message="Esta organização ainda não possui grupos cadastrados."
            />
          ) : (
            <BorisTable
              columns={groupColumns as any}
              data={groupsData?.items ?? []}
              keyExtractor={(group) => group.id}
              onRowClick={(group) => navigate(`/groups/${group.id}`)}
              page={page}
              pageSize={PAGE_SIZE}
              totalCount={groupsData?.count}
              onPageChange={setPage}
            />
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
        onSuccess={() => refetchGroups()}
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
                  refetchGroups();
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
                  refetchGroups();
                  queryClient.invalidateQueries({ queryKey: ["org-group-ids", orgId] });
                  queryClient.invalidateQueries({ queryKey: ["org-active-groups-count", orgId] });
                  queryClient.invalidateQueries({ queryKey: ["org-total-members", orgId] });
                  queryClient.invalidateQueries({ queryKey: ["org-messages-7d", orgId] });
                } catch (err: any) {
                  const parsed = await parseInvokeError(err);
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
