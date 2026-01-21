import { AdminLayout } from "@/components/layout/AdminLayout";
import { BorisTable } from "@/components/ui/boris-table";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { AdminPageHeader } from "@/components/layout/AdminPageHeader";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Users, Edit, ChevronDown, CreditCard, Mail, Trash2, Activity, Tag, Loader2 } from "lucide-react";
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
import { KpiCard } from "@/components/group-dashboard/KpiCard";
import { notify } from "@/components/ui/sonner";
import { Input } from "@/components/ui/input";
import { PeriodFilter } from "@/components/group-dashboard/PeriodFilter";
import {
  getDateRange,
  type PeriodType,
  type DateRange,
  parseStoredPeriod,
  buildStoredPeriod,
} from "@/components/group-dashboard/period-utils";
import { countWordsFromRows, extractBigramsFromRows } from "@/utils/keywords";
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
} from "@/components/ui/dialog";

const PAGE_SIZE = 10;

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
  owner?: unknown;
  creation?: unknown;
  participants?: unknown;
  communityId?: unknown;
  adminOnlyMessage?: unknown;
  adminOnlySettings?: unknown;
  requireAdminApproval?: unknown;
  isGroupAnnouncement?: unknown;
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

type NormalizedParticipant = {
  phone_e164: string;
  whatsapp_provider_id: string;
  name: string;
  display_name: string | null;
  is_admin: boolean;
  is_super_admin: boolean;
  is_owner: boolean;
  profile_pic_url: string | null;
  raw_provider: unknown;
};

const normalizeParticipantsFromWebhook = (
  participants: unknown,
  opts?: {
    groupOwner?: unknown;
  },
) => {
  const invalid: Array<{ index: number; reason: string }> = [];
  if (!Array.isArray(participants) || participants.length === 0) {
    return { normalized: [] as NormalizedParticipant[], invalid };
  }

  const ownerE164 = toE164(opts?.groupOwner);
  const ownerDigits = ownerE164 ? toDigits(ownerE164) : "";

  const normalized: NormalizedParticipant[] = [];
  const seen = new Set<string>();

  participants.forEach((p: any, index: number) => {
    const phoneRaw = String(p?.phone ?? p?.sender ?? p?.number ?? "").trim();
    const providerIdRaw = String(p?.whatsapp_provider_id ?? p?.whatsappProviderId ?? p?.lid ?? p?.id ?? "").trim();
    const providerDigits = toDigits(providerIdRaw);

    const phoneE164 = toE164(phoneRaw) ?? (providerDigits.length >= 10 ? toE164(providerDigits) : null);
    if (!phoneE164) {
      invalid.push({ index, reason: "PHONE_INVALID" });
      return;
    }

    const digits = toDigits(phoneE164);
    const providerId = providerIdRaw || digits;
    if (!providerId) {
      invalid.push({ index, reason: "PROVIDER_ID_MISSING" });
      return;
    }

    const rawIsSuperAdmin = p?.is_super_admin ?? p?.isSuperAdmin;
    const rawIsAdmin = p?.is_admin ?? p?.isAdmin;
    const isOwner =
      !!ownerDigits &&
      (toDigits(phoneE164) === ownerDigits || providerDigits === ownerDigits || toDigits(providerId) === ownerDigits);
    const isSuperAdmin = !!rawIsSuperAdmin || isOwner;
    const isAdmin = !!rawIsAdmin || isSuperAdmin;

    const name = String(p?.name ?? p?.pushname ?? p?.display_name ?? p?.displayName ?? "").trim() || phoneE164;
    const displayName = String(p?.display_name ?? p?.displayName ?? "").trim() || null;
    const profilePicUrl = String(p?.profile_pic_url ?? p?.profilePicUrl ?? "").trim() || null;

    const key = digits || toDigits(providerId) || providerId.trim() || phoneE164;
    if (!key) {
      invalid.push({ index, reason: "KEY_MISSING" });
      return;
    }
    if (seen.has(key)) return;
    seen.add(key);

    normalized.push({
      phone_e164: phoneE164,
      whatsapp_provider_id: providerId,
      name,
      display_name: displayName,
      is_admin: isAdmin,
      is_super_admin: isSuperAdmin,
      is_owner: isOwner,
      profile_pic_url: profilePicUrl,
      raw_provider: p,
    });
  });

  return { normalized, invalid };
};

const isUniqueViolation = (error: unknown): boolean => {
  const anyErr = error as any;
  return String(anyErr?.code ?? "") === "23505";
};

const isUnknownColumnError = (error: unknown): boolean => {
  const anyErr = error as any;
  const code = String(anyErr?.code ?? "");
  const msg = String(anyErr?.message ?? "").toLowerCase();
  return (
    code === "42703" ||
    code === "PGRST204" ||
    msg.includes("schema cache") ||
    msg.includes("could not find") ||
    (msg.includes("column") && msg.includes("does not exist"))
  );
};

const getMembersImportErrorMessage = (error: unknown): string => {
  const anyErr = error as any;
  const code = String(anyErr?.code ?? "");
  const msg = String(anyErr?.message ?? "");
  const lower = msg.toLowerCase();

  const isAccessDenied =
    code === "PGRST301" ||
    code === "42501" ||
    code === "401" ||
    code === "403" ||
    lower.includes("permission") ||
    lower.includes("not authorized") ||
    lower.includes("jwt") ||
    lower.includes("unauthorized") ||
    lower.includes("policy");

  if (isAccessDenied) {
    return "Você não tem permissão para importar os membros deste grupo.";
  }

  const isSchema =
    code === "42P01" ||
    code === "42703" ||
    code === "PGRST204" ||
    lower.includes("does not exist") ||
    lower.includes("relation") ||
    lower.includes("column") ||
    lower.includes("schema");

  if (isSchema) {
    return "O servidor ainda não está atualizado para importar membros. Tente novamente em instantes.";
  }

  const isNetwork =
    lower.includes("failed to fetch") ||
    lower.includes("networkerror") ||
    lower.includes("fetch failed") ||
    lower.includes("load failed");

  if (isNetwork) {
    return "Falha de conexão ao importar membros. Verifique sua internet e tente novamente.";
  }

  return `Falhou ao importar os membros do grupo. Tente novamente.${code ? ` (código: ${code})` : ""}`;
};

const upsertMembersForGroup = async (args: {
  groupId: string;
  participants: unknown;
  groupOwner?: unknown;
}) => {
  const { normalized, invalid } = normalizeParticipantsFromWebhook(args.participants, {
    groupOwner: args.groupOwner,
  });
  if (normalized.length === 0) {
    return { insertedOrUpdated: 0, invalidCount: invalid.length, total: 0 };
  }

  const nowIso = new Date().toISOString();

  const buildRows = (variantIndex: number) =>
    normalized.map((p) => {
      if (variantIndex === 0) {
        return {
          group_id: args.groupId,
          name: p.name,
          display_name: p.display_name,
          phone_e164: p.phone_e164,
          whatsapp_provider_id: p.whatsapp_provider_id,
          is_admin: p.is_admin,
          is_super_admin: p.is_super_admin,
          is_owner: p.is_owner,
          provider: "whatsapp",
          joined_at: nowIso,
          status: "active",
          profile_pic_url: p.profile_pic_url,
          raw_provider: p.raw_provider as any,
        };
      }

      if (variantIndex === 1) {
        return {
          group_id: args.groupId,
          name: p.name,
          display_name: p.display_name,
          phone_e164: p.phone_e164,
          whatsapp_provider_id: p.whatsapp_provider_id,
          is_admin: p.is_admin,
          is_super_admin: p.is_super_admin,
          is_owner: p.is_owner,
          provider: "whatsapp",
          joined_at: nowIso,
          status: "active",
          profile_pic_url: p.profile_pic_url,
        };
      }

      if (variantIndex === 2) {
        return {
          group_id: args.groupId,
          name: p.name,
          display_name: p.display_name,
          phone_e164: p.phone_e164,
          is_admin: p.is_admin,
          is_super_admin: p.is_super_admin,
          is_owner: p.is_owner,
          joined_at: nowIso,
          status: "active",
          profile_pic_url: p.profile_pic_url,
        };
      }

      if (variantIndex === 3) {
        return {
          group_id: args.groupId,
          name: p.name,
          phone_e164: p.phone_e164,
          is_admin: p.is_admin,
          is_super_admin: p.is_super_admin,
          is_owner: p.is_owner,
        };
      }

      if (variantIndex === 4) {
        return {
          group_id: args.groupId,
          name: p.name,
          phone: p.phone_e164,
          is_admin: p.is_admin,
        };
      }

      if (variantIndex === 5) {
        return {
          group_id: args.groupId,
          name: p.name,
          phone: p.phone_e164,
        };
      }

      return {
        group_id: args.groupId,
        name: p.name,
        phone_e164: p.phone_e164,
      };
    });

  const variantsCount = 6;

  let inserted = 0;
  let skippedUnique = 0;

  let lastError: unknown = null;
  for (let variantIndex = 0; variantIndex < variantsCount; variantIndex += 1) {
    inserted = 0;
    skippedUnique = 0;
    lastError = null;

    const rows = buildRows(variantIndex);
    let hadUnknownColumn = false;

    for (const row of rows) {
      const { error } = await supabase.from("members").insert([row as any]);
      if (!error) {
        inserted += 1;
        continue;
      }

      if (isUniqueViolation(error)) {
        skippedUnique += 1;
        continue;
      }

      if (isUnknownColumnError(error)) {
        hadUnknownColumn = true;
        break;
      }

      lastError = error;
      break;
    }

    if (!hadUnknownColumn && !lastError) {
      const insertedOrUpdated = inserted + skippedUnique;
      return {
        insertedOrUpdated,
        invalidCount: invalid.length,
        total: Array.isArray(args.participants) ? args.participants.length : rows.length,
      };
    }

    if (lastError) {
      throw lastError;
    }
  }

  throw lastError || new Error("Não foi possível importar os membros.");
};

const Org = () => {
  const { orgId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
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
    if (!rawLink) {
      setAttachError("Link de convite é obrigatório.");
      return;
    }
    if (!rawLink.includes("chat.whatsapp.com")) {
      setAttachError("Informe um link de convite válido do WhatsApp (chat.whatsapp.com).");
      return;
    }

    const url = String(import.meta.env.VITE_N8N_CHECK_GROUP_ENTRY_URL ?? "").trim();
    if (!url) {
      setAttachError("Configuração ausente: VITE_N8N_CHECK_GROUP_ENTRY_URL.");
      return;
    }

    setAttaching(true);
    setAttachError(null);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ invite_link: rawLink }),
      });

      const rawText = await res.text().catch(() => "");
      let payload: unknown = null;
      try {
        payload = rawText ? JSON.parse(rawText) : null;
      } catch {
        payload = null;
      }

      if (!res.ok) {
        setAttachError("Falha ao verificar o grupo. Tente novamente.");
        return;
      }

      if (isBotNotEnabledResponse(payload)) {
        setAttachError(
          "Não foi possível verificar o grupo. Você precisa incluir o Bóris no grupo antes de continuar.",
        );
        notify.warning("Ação necessária", "Inclua o Bóris no grupo antes de continuar.");
        return;
      }

      if (!Array.isArray(payload) || payload.length === 0) {
        setAttachError("Não foi possível identificar o grupo a partir desse link.");
        return;
      }

      const first = payload[0] as N8nCheckGroupSuccessItem;
      const whatsappProviderId = String(first?.phone ?? "").trim();
      const groupName = String(first?.subject ?? first?.name ?? "").trim();
      if (!whatsappProviderId || !groupName) {
        setAttachError("Não foi possível identificar o grupo a partir desse link.");
        return;
      }

      const participantsRaw = first?.participants;
      const { normalized: normalizedParticipants } = normalizeParticipantsFromWebhook(participantsRaw, {
        groupOwner: first?.owner,
      });
      if (normalizedParticipants.length === 0) {
        setAttachError("Não foi possível identificar os membros do grupo a partir desse link.");
        return;
      }
      if (!normalizedParticipants.some((p) => p.is_super_admin)) {
        notify.warning(
          "Aviso",
          "Não foi possível validar os níveis de permissão do grupo a partir do link. Vou importar os membros mesmo assim.",
        );
      }
      if (String(first?.owner ?? "").trim() && !normalizedParticipants.some((p) => p.is_owner)) {
        notify.warning(
          "Aviso",
          "Não foi possível validar o dono do grupo a partir do link. Vou importar os membros mesmo assim.",
        );
      }

      const { data: existing, error: existingError } = await supabase
        .from("groups")
        .select("id, name, organization_id, is_archived, deleted_at, organizations(name)")
        .eq("whatsapp_provider_id", whatsappProviderId)
        .maybeSingle();

      if (existingError) {
        setAttachError("Não foi possível verificar se o grupo já existe. Tente novamente.");
        return;
      }

      if (existing) {
        if (existing.organization_id === orgId) {
          if (existing.is_archived || existing.deleted_at) {
            const { error: reviveError } = await supabase
              .from("groups")
              .update({
                is_archived: false,
                deleted_at: null,
                invite_link: rawLink,
                invite_link_status: "valid",
                name: groupName,
                raw_provider: first as any,
              })
              .eq("id", existing.id);
            if (reviveError) {
              setAttachError("Não foi possível reativar o grupo. Tente novamente.");
              return;
            }

            try {
              const membersResult = await upsertMembersForGroup({
                groupId: existing.id,
                participants: participantsRaw,
                groupOwner: first?.owner,
              });
              if (membersResult.invalidCount > 0) {
                notify.warning(
                  "Membros importados com avisos",
                  `${membersResult.invalidCount} participante(s) foram ignorados por dados inválidos.`,
                );
              }
            } catch (err) {
              setAttachError(`Grupo reativado, mas ${getMembersImportErrorMessage(err).toLowerCase()}`);
              return;
            }

            notify.success("Grupo atrelado com sucesso.", "");
            setAttachGroupOpen(false);
            setAttachInviteLink("");
            await queryClient.invalidateQueries({ queryKey: ["org-groups", orgId] });
            await queryClient.invalidateQueries({ queryKey: ["org-group-ids", orgId] });
            await queryClient.invalidateQueries({ queryKey: ["org-active-groups-count", orgId] });
            await queryClient.invalidateQueries({ queryKey: ["org-total-members", orgId] });
            await queryClient.invalidateQueries({ queryKey: ["org-messages-7d", orgId] });
            return;
          }

          notify.warning("Nada a fazer", "Este grupo já está atrelado a esta organização.");
          setAttachGroupOpen(false);
          setAttachInviteLink("");
          return;
        }

        const otherOrgName = (existing as any)?.organizations?.name as string | undefined;
        setAttachError(
          `Este grupo já está atrelado a outra organização${otherOrgName ? ` (${otherOrgName})` : ""}. Não é possível mover automaticamente.`,
        );
        notify.warning("Grupo já atrelado", "Este grupo já está em outra organização.");
        return;
      }

      const { data: insertedGroup, error: insertError } = await supabase
        .from("groups")
        .insert({
          name: groupName,
          organization_id: orgId,
          provider: "whatsapp",
          whatsapp_provider_id: whatsappProviderId,
          invite_link: rawLink,
          invite_link_status: "valid",
          status: "active",
          is_active: true,
          is_archived: false,
          raw_provider: first as any,
        })
        .select("id")
        .single();

      if (insertError) {
        if (String((insertError as any)?.code || "") === "23505") {
          setAttachError("Este grupo já existe no sistema. Atualize a página e tente novamente.");
        } else if (String((insertError as any)?.code || "") === "42501" || String(insertError.message || "").includes("policy")) {
          setAttachError("Você não tem permissão para atrelar grupos a esta organização.");
        } else {
          setAttachError("Não foi possível atrelar o grupo. Tente novamente.");
        }
        return;
      }

      if (!insertedGroup?.id) {
        setAttachError("Não foi possível atrelar o grupo. Tente novamente.");
        return;
      }

      try {
        const membersResult = await upsertMembersForGroup({
          groupId: insertedGroup.id,
          participants: participantsRaw,
          groupOwner: first?.owner,
        });
        if (membersResult.invalidCount > 0) {
          notify.warning(
            "Membros importados com avisos",
            `${membersResult.invalidCount} participante(s) foram ignorados por dados inválidos.`,
          );
        }
      } catch (err) {
        await supabase
          .from("groups")
          .update({ is_archived: true })
          .eq("id", insertedGroup.id);

        setAttachError(getMembersImportErrorMessage(err));
        return;
      }

      notify.success("Grupo atrelado com sucesso.", "");
      setAttachGroupOpen(false);
      setAttachInviteLink("");
      await queryClient.invalidateQueries({ queryKey: ["org-groups", orgId] });
      await queryClient.invalidateQueries({ queryKey: ["org-group-ids", orgId] });
      await queryClient.invalidateQueries({ queryKey: ["org-active-groups-count", orgId] });
      await queryClient.invalidateQueries({ queryKey: ["org-total-members", orgId] });
      await queryClient.invalidateQueries({ queryKey: ["org-messages-7d", orgId] });
    } catch {
      setAttachError("Falha ao verificar o grupo. Tente novamente.");
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
          <div id="org-dashboard" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              title="Grupos"
              value={groupsData?.count ?? 0}
              subtitle="Total na organização"
              icon={Users}
              helpText="Quantidade de grupos vinculados"
              isLoading={groupsLoading}
            />
            <KpiCard
              title="Membros"
              value={totalMembersCount ?? 0}
              subtitle="Total em todos os grupos"
              icon={Users}
              helpText="Soma de membros em grupos"
              isLoading={membersCountLoading}
            />
            <KpiCard
              title="Mensagens (7d)"
              value={messagesLast7dCount ?? 0}
              subtitle="Últimos 7 dias"
              icon={Mail}
              helpText="Volume recente de mensagens"
              isLoading={messagesCountLoading}
            />
            <KpiCard
              title="Grupos ativos"
              value={activeGroupsCount ?? 0}
              subtitle="Com status ativo"
              icon={Activity}
              helpText="Grupos marcados como ativos"
              isLoading={activeGroupsLoading}
            />
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
                Atrelar grupo
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
            <DialogTitle className="text-card-foreground">Atrelar grupo por convite</DialogTitle>
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
            <Button onClick={handleAttachGroup} disabled={attaching}>
              {attaching ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Verificando...
                </span>
              ) : (
                "Verificar e atrelar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
