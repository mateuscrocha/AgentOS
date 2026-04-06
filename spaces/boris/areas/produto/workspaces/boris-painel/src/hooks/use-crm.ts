import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type CRMSection = "pipeline" | "companies" | "contacts" | "tasks";

export type CRMOpportunityStage =
  | "new_lead"
  | "qualification"
  | "meeting"
  | "proposal"
  | "approval_pending"
  | "customer"
  | "lost";

export type CRMOpportunityStatus = "open" | "won" | "lost" | "stalled";
export type CRMAccountStatus = "lead" | "prospect" | "customer" | "inactive";
export type CRMTimelineItemType = "note" | "task" | "next_step";
export type CRMLeadSourceCategory = "site" | "whatsapp" | "instagram" | "referral" | "outbound" | "other";
export type CRMDealContactRole = "decision_maker" | "operator" | "champion" | "financial_buyer" | "influencer" | "unknown";

export type CRMOrganizationBilling = {
  id: string;
  name: string;
  relationship_type: string | null;
  billing_plan: string | null;
  billing_status: string | null;
  current_period_end: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
};

export type CRMAccount = {
  id: string;
  organization_id: string | null;
  relationship_type: string | null;
  assigned_user_id: string | null;
  name: string;
  domain: string | null;
  phone: string | null;
  email: string | null;
  source: string | null;
  lead_source_category: CRMLeadSourceCategory | null;
  lead_source_detail: string | null;
  inbound_channel: string | null;
  handoff_summary: string | null;
  status: CRMAccountStatus;
  stage: CRMOpportunityStage;
  potential_value: number | null;
  target_date: string | null;
  need: string | null;
  next_step: string | null;
  last_contact_at: string | null;
  next_action_at: string | null;
  stage_position: number;
  quick_notes: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_subscription_status: string | null;
  stripe_monthly_amount_cents: number | null;
  stripe_last_invoice_at: string | null;
  stripe_last_invoice_amount_cents: number | null;
  stripe_next_billing_at: string | null;
  stripe_is_delinquent: boolean | null;
  financial_context_updated_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  organization?: CRMOrganizationBilling | null;
};

export type CRMContact = {
  id: string;
  account_id: string;
  organization_contact_id: string | null;
  first_name: string;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  title: string | null;
  city: string | null;
  role_in_deal: CRMDealContactRole | null;
  is_primary: boolean;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type CRMOpportunity = {
  id: string;
  account_id: string;
  contact_id: string | null;
  owner_user_id: string | null;
  name: string;
  stage: CRMOpportunityStage;
  status: CRMOpportunityStatus;
  potential_value: number | null;
  target_date: string | null;
  source: string | null;
  need: string | null;
  next_step: string | null;
  notes: string | null;
  last_contact_at: string | null;
  next_action_at: string | null;
  stage_position: number;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type CRMTimelineItem = {
  id: string;
  account_id: string | null;
  opportunity_id: string | null;
  item_type: CRMTimelineItemType;
  title: string | null;
  content: string;
  due_at: string | null;
  follow_up_at: string | null;
  completed_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

type UseCRMArgs = {
  enabled: boolean;
  section: CRMSection;
  loadDrawerRelations?: boolean;
  loadReferenceData?: boolean;
};

export type CRMProfileOption = {
  id: string;
  name: string | null;
};

export type CRMAccountFormValues = {
  id?: string;
  organization_id?: string | null;
  assigned_user_id?: string | null;
  name: string;
  primary_contact_name?: string | null;
  domain?: string | null;
  phone?: string | null;
  email?: string | null;
  source?: string | null;
  lead_source_category?: CRMLeadSourceCategory | null;
  lead_source_detail?: string | null;
  inbound_channel?: string | null;
  handoff_summary?: string | null;
  status: CRMAccountStatus;
  stage: CRMOpportunityStage;
  potential_value?: number | null;
  target_date?: string | null;
  need?: string | null;
  next_step?: string | null;
  last_contact_at?: string | null;
  next_action_at?: string | null;
  stage_position?: number;
  quick_notes?: string | null;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
};

export type CRMContactFormValues = {
  id?: string;
  account_id: string;
  first_name: string;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  title?: string | null;
  city?: string | null;
  role_in_deal?: CRMDealContactRole | null;
  is_primary?: boolean;
};

export type CRMOpportunityFormValues = {
  id?: string;
  account_id: string;
  contact_id?: string | null;
  owner_user_id?: string | null;
  name: string;
  stage: CRMOpportunityStage;
  potential_value?: number | null;
  target_date?: string | null;
  source?: string | null;
  need?: string | null;
  next_step?: string | null;
  notes?: string | null;
  last_contact_at?: string | null;
  next_action_at?: string | null;
  stage_position?: number;
};

export type CRMTimelineItemFormValues = {
  id?: string;
  account_id?: string | null;
  opportunity_id?: string | null;
  item_type: CRMTimelineItemType;
  title?: string | null;
  content: string;
  due_at?: string | null;
  follow_up_at?: string | null;
  completed_at?: string | null;
};

export type CRMFinanceSummary = {
  label: string;
  tone: "success" | "warning" | "destructive" | "muted";
  status: string | null;
  monthlyAmountCents: number | null;
  amountCents: number | null;
  lastChargeAt: string | null;
  nextBillingAt: string | null;
  isDelinquent: boolean;
};

export type CRMStripeSyncState = {
  canSync: boolean;
  hasDirectIds: boolean;
  hasOrganizationIds: boolean;
  sourceLabel: string;
  missingReason: string | null;
  lastSyncedAt: string | null;
};

const NON_PAYING_RELATIONSHIP_TYPES = new Set(["partner", "courtesy", "internal", "trial", "demo"]);

export const CRM_STAGE_META: Record<
  CRMOpportunityStage,
  { label: string; shortLabel: string; tone: string }
> = {
  new_lead: { label: "Novo lead", shortLabel: "Lead", tone: "bg-slate-100 text-slate-700 border-slate-200" },
  qualification: { label: "Qualificação", shortLabel: "Qualificação", tone: "bg-sky-50 text-sky-700 border-sky-200" },
  meeting: { label: "Reunião", shortLabel: "Reunião", tone: "bg-cyan-50 text-cyan-700 border-cyan-200" },
  proposal: { label: "Proposta", shortLabel: "Proposta", tone: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  approval_pending: { label: "Aguardando aprovação", shortLabel: "Aprovação", tone: "bg-amber-50 text-amber-800 border-amber-200" },
  customer: { label: "Cliente", shortLabel: "Cliente", tone: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  lost: { label: "Perdido", shortLabel: "Perdido", tone: "bg-rose-50 text-rose-700 border-rose-200" },
};

export const CRM_PIPELINE_STAGES: CRMOpportunityStage[] = [
  "new_lead",
  "meeting",
  "proposal",
  "approval_pending",
  "customer",
  "lost",
];

export function normalizePipelineStage(stage: CRMOpportunityStage): CRMOpportunityStage {
  if (stage === "qualification") return "meeting";
  return stage;
}

export function deriveAccountCommercialClassification(input: {
  status: CRMAccountStatus;
  stage: CRMOpportunityStage;
  hasStripeLink: boolean;
  relationshipType?: string | null;
}) {
  const normalizedStage = normalizePipelineStage(input.stage);
  const isPayingRelationship = isBillableRelationshipType(input.relationshipType);

  // Comercial e billing nao sao a mesma coisa:
  // contas vinculadas a uma organizacao marcada como paying_customer
  // precisam continuar como cliente no pipeline mesmo sem IDs Stripe preenchidos.
  if (isPayingRelationship) {
    if (input.status === "inactive" || normalizedStage === "lost") {
      return {
        status: "inactive" as CRMAccountStatus,
        stage: "lost" as CRMOpportunityStage,
      };
    }

    return {
      status: "customer" as CRMAccountStatus,
      stage: "customer" as CRMOpportunityStage,
    };
  }

  if (input.hasStripeLink) {
    return {
      status: "customer" as CRMAccountStatus,
      stage: "customer" as CRMOpportunityStage,
    };
  }

  if (input.status === "customer") {
    return {
      status: "prospect" as CRMAccountStatus,
      stage: normalizedStage === "customer" ? "meeting" as CRMOpportunityStage : normalizedStage,
    };
  }

  return {
    status: input.status,
    stage: normalizedStage,
  };
}

export const CRM_ACCOUNT_STATUS_META: Record<CRMAccountStatus, { label: string; tone: string }> = {
  lead: { label: "Lead", tone: "bg-slate-100 text-slate-700 border-slate-200" },
  prospect: { label: "Prospect", tone: "bg-sky-50 text-sky-700 border-sky-200" },
  customer: { label: "Cliente", tone: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  inactive: { label: "Inativo", tone: "bg-zinc-100 text-zinc-700 border-zinc-200" },
};

export const CRM_TASK_TYPE_META: Record<CRMTimelineItemType, { label: string; tone: string }> = {
  note: { label: "Nota", tone: "bg-slate-100 text-slate-700 border-slate-200" },
  task: { label: "Tarefa", tone: "bg-orange-50 text-orange-700 border-orange-200" },
  next_step: { label: "Próximo passo", tone: "bg-blue-50 text-blue-700 border-blue-200" },
};

export const CRM_LEAD_SOURCE_CATEGORY_META: Record<CRMLeadSourceCategory, { label: string }> = {
  site: { label: "Site" },
  whatsapp: { label: "WhatsApp" },
  instagram: { label: "Instagram" },
  referral: { label: "Indicação" },
  outbound: { label: "Outbound" },
  other: { label: "Outro" },
};

export const CRM_DEAL_CONTACT_ROLE_META: Record<CRMDealContactRole, { label: string; tone: string }> = {
  decision_maker: { label: "Decisor", tone: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  operator: { label: "Operacional", tone: "bg-sky-50 text-sky-700 border-sky-200" },
  champion: { label: "Sponsor", tone: "bg-violet-50 text-violet-700 border-violet-200" },
  financial_buyer: { label: "Financeiro", tone: "bg-amber-50 text-amber-700 border-amber-200" },
  influencer: { label: "Influenciador", tone: "bg-slate-100 text-slate-700 border-slate-200" },
  unknown: { label: "Sem papel", tone: "bg-zinc-100 text-zinc-700 border-zinc-200" },
};

export function getOpportunityStatusFromStage(stage: CRMOpportunityStage): CRMOpportunityStatus {
  stage = normalizePipelineStage(stage);
  if (stage === "customer") return "won";
  if (stage === "lost") return "lost";
  return "open";
}

export function getContactFullName(contact: Pick<CRMContact, "first_name" | "last_name"> | null | undefined) {
  if (!contact) return "Sem contato";
  return [contact.first_name, contact.last_name].filter(Boolean).join(" ").trim() || "Sem contato";
}

export function getAccountFinanceSummary(account: CRMAccount): CRMFinanceSummary | null {
  const org = account.organization ?? null;
  const status = account.stripe_subscription_status || org?.billing_status || null;
  const nextBillingAt = account.stripe_next_billing_at || org?.current_period_end || null;
  const amountCents = account.stripe_last_invoice_amount_cents ?? null;
  const monthlyAmountCents = account.stripe_monthly_amount_cents ?? amountCents;
  const lastChargeAt = account.stripe_last_invoice_at ?? null;
  const isCanceled = status === "canceled";
  const isDelinquent =
    !isCanceled &&
    (Boolean(account.stripe_is_delinquent) ||
      status === "past_due" ||
      status === "unpaid" ||
      status === "incomplete_expired");
  const isActiveLike = status === "active" || status === "trialing";

  if (!status && !nextBillingAt && !amountCents && !lastChargeAt && !org?.stripe_customer_id && !account.stripe_customer_id) {
    return null;
  }

  return {
    label: isCanceled ? "Cancelado" : isDelinquent ? "Crédito vencido" : isActiveLike ? "Crédito ativo" : status ? status.replace(/_/g, " ") : "Stripe",
    tone: isCanceled ? "muted" : isDelinquent ? "destructive" : status === "active" ? "success" : status === "trialing" ? "warning" : "muted",
    status,
    monthlyAmountCents,
    amountCents,
    lastChargeAt,
    nextBillingAt,
    isDelinquent,
  };
}

export function getAccountMonthlyValue(account: CRMAccount): number | null {
  const finance = getAccountFinanceSummary(account);
  if (finance?.monthlyAmountCents != null) return finance.monthlyAmountCents / 100;
  return account.potential_value ?? null;
}

export function getAccountStripeSyncState(account: CRMAccount): CRMStripeSyncState {
  const hasDirectIds = Boolean(account.stripe_customer_id || account.stripe_subscription_id);
  const hasOrganizationIds = Boolean(
    account.organization?.stripe_customer_id || account.organization?.stripe_subscription_id,
  );

  return {
    canSync: hasDirectIds || hasOrganizationIds,
    hasDirectIds,
    hasOrganizationIds,
    sourceLabel: hasDirectIds
      ? "IDs Stripe definidos na conta CRM"
      : hasOrganizationIds
        ? "Usando IDs Stripe da organização vinculada"
        : "Sem vínculo Stripe configurado",
    missingReason: hasDirectIds || hasOrganizationIds
      ? null
      : "Defina `stripe_customer_id`, `stripe_subscription_id` ou vincule a conta a uma organização com billing preenchido.",
    lastSyncedAt: account.financial_context_updated_at,
  };
}

export function isNonPayingRelationshipType(relationshipType: string | null | undefined) {
  return NON_PAYING_RELATIONSHIP_TYPES.has((relationshipType || "").trim());
}

export function isBillableRelationshipType(relationshipType: string | null | undefined) {
  return (relationshipType || "").trim() === "paying_customer";
}

export function hasStripeBillingLink(account: CRMAccount) {
  return Boolean(
    account.stripe_customer_id ||
    account.stripe_subscription_id ||
    account.organization?.stripe_customer_id ||
    account.organization?.stripe_subscription_id,
  );
}

export function isPayingCustomerAccount(account: CRMAccount) {
  return isBillableRelationshipType(account.relationship_type);
}

export function isNonPayingCustomerAccount(account: CRMAccount) {
  return !isBillableRelationshipType(account.relationship_type);
}

function normalizeNullable(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

const AUTO_NEXT_STEP_TASK_TITLE = "Próximo passo";

async function syncAutoNextStepTask(params: {
  accountId: string;
  opportunityId?: string | null;
  nextStep?: string | null;
  nextActionAt?: string | null;
}) {
  const nextStep = normalizeNullable(params.nextStep);
  const nextActionAt = params.nextActionAt || null;

  let query = supabase
    .from("crm_timeline_items" as any)
    .select("id")
    .eq("account_id", params.accountId)
    .eq("item_type", "task")
    .eq("title", AUTO_NEXT_STEP_TASK_TITLE)
    .is("completed_at", null);

  query = params.opportunityId
    ? query.eq("opportunity_id", params.opportunityId)
    : query.is("opportunity_id", null);

  const { data: existingTask, error: existingTaskError } = await query.maybeSingle();
  if (existingTaskError) throw existingTaskError;

  if (!nextStep) {
    if (existingTask?.id) {
      const { error } = await supabase.from("crm_timeline_items" as any).delete().eq("id", existingTask.id);
      if (error) throw error;
    }
    return;
  }

  const payload = {
    account_id: params.accountId,
    opportunity_id: params.opportunityId ?? null,
    item_type: "task" as const,
    title: AUTO_NEXT_STEP_TASK_TITLE,
    content: nextStep,
    due_at: nextActionAt,
    follow_up_at: nextActionAt,
    completed_at: null,
    updated_at: new Date().toISOString(),
  };

  if (existingTask?.id) {
    const { error } = await supabase.from("crm_timeline_items" as any).update(payload).eq("id", existingTask.id);
    if (error) throw error;
    return;
  }

  const { error } = await supabase.from("crm_timeline_items" as any).insert(payload);
  if (error) throw error;
}

export function useCRM({
  enabled,
  section,
  loadDrawerRelations = false,
  loadReferenceData = false,
}: UseCRMArgs) {
  const queryClient = useQueryClient();
  const loadContacts = section === "pipeline" || section === "companies" || section === "contacts" || loadDrawerRelations;
  const loadOpportunities = section === "tasks" || loadDrawerRelations;
  const loadTimeline = section === "tasks" || loadDrawerRelations;
  const loadOrganizations = loadReferenceData;
  const loadProfiles = loadReferenceData;

  const accountsQuery = useQuery({
    queryKey: ["crm", "accounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_accounts" as any)
        .select(`
          *,
          organization:organizations (
            id,
            name,
            relationship_type,
            billing_plan,
            billing_status,
            current_period_end,
            stripe_customer_id,
            stripe_subscription_id
          )
        `)
        .order("updated_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as CRMAccount[];
    },
    enabled,
  });

  const contactsQuery = useQuery({
    queryKey: ["crm", "contacts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_contacts" as any)
        .select("*")
        .order("updated_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as CRMContact[];
    },
    enabled: enabled && loadContacts,
  });

  const opportunitiesQuery = useQuery({
    queryKey: ["crm", "opportunities"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_opportunities" as any)
        .select("*")
        .order("updated_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as CRMOpportunity[];
    },
    enabled: enabled && loadOpportunities,
  });

  const timelineQuery = useQuery({
    queryKey: ["crm", "timeline"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_timeline_items" as any)
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as CRMTimelineItem[];
    },
    enabled: enabled && loadTimeline,
  });

  const organizationsQuery = useQuery({
    queryKey: ["crm", "organizations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organizations")
        .select("id, name, billing_status, billing_plan, current_period_end, stripe_customer_id, stripe_subscription_id")
        .order("name");

      if (error) throw error;
      return (data ?? []) as CRMOrganizationBilling[];
    },
    enabled: enabled && loadOrganizations,
  });

  const profilesQuery = useQuery({
    queryKey: ["crm", "profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, name")
        .is("deleted_at", null)
        .order("name");

      if (error) throw error;
      return (data ?? []) as CRMProfileOption[];
    },
    enabled: enabled && loadProfiles,
  });

  const refreshAll = async () => {
    await queryClient.invalidateQueries({ queryKey: ["crm"] });
  };

  const saveAccountMutation = useMutation({
    mutationFn: async (values: CRMAccountFormValues) => {
      const linkedOrganization = organizations.find((organization) => organization.id === (values.organization_id ?? null)) ?? null;
      const hasStripeLink = Boolean(
        normalizeNullable(values.stripe_customer_id) ||
        normalizeNullable(values.stripe_subscription_id) ||
        linkedOrganization?.stripe_customer_id ||
        linkedOrganization?.stripe_subscription_id,
      );
      const commercialClassification = deriveAccountCommercialClassification({
        status: values.status,
        stage: values.stage,
        hasStripeLink,
        relationshipType: linkedOrganization?.relationship_type ?? null,
      });
      const payload = {
        organization_id: values.organization_id ?? null,
        assigned_user_id: values.assigned_user_id ?? null,
        name: values.name.trim(),
        domain: normalizeNullable(values.domain),
        phone: normalizeNullable(values.phone),
        email: normalizeNullable(values.email),
        source: normalizeNullable(values.source),
        lead_source_category: values.lead_source_category ?? null,
        lead_source_detail: normalizeNullable(values.lead_source_detail),
        inbound_channel: normalizeNullable(values.inbound_channel),
        handoff_summary: normalizeNullable(values.handoff_summary),
        status: commercialClassification.status,
        stage: commercialClassification.stage,
        potential_value: values.potential_value ?? null,
        target_date: values.target_date || null,
        need: normalizeNullable(values.need),
        next_step: normalizeNullable(values.next_step),
        last_contact_at: values.last_contact_at || null,
        next_action_at: values.next_action_at || null,
        stage_position: values.stage_position ?? 0,
        quick_notes: normalizeNullable(values.quick_notes),
        stripe_customer_id: normalizeNullable(values.stripe_customer_id),
        stripe_subscription_id: normalizeNullable(values.stripe_subscription_id),
        updated_at: new Date().toISOString(),
      };

      if (values.id) {
        const { error } = await supabase.from("crm_accounts" as any).update(payload).eq("id", values.id);
        if (error) throw error;
        await syncAutoNextStepTask({
          accountId: values.id,
          nextStep: payload.next_step,
          nextActionAt: payload.next_action_at,
        });
        return values.id;
      }

      const { data, error } = await supabase
        .from("crm_accounts" as any)
        .insert(payload)
        .select("id")
        .single();
      if (error) throw error;
      await syncAutoNextStepTask({
        accountId: data.id as string,
        nextStep: payload.next_step,
        nextActionAt: payload.next_action_at,
      });
      return data.id as string;
    },
    onSuccess: refreshAll,
  });

  const deleteAccountMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("crm_accounts" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: refreshAll,
  });

  const moveAccountStageMutation = useMutation({
    mutationFn: async ({
      id,
      stage,
      stagePosition,
    }: {
      id: string;
      stage: CRMOpportunityStage;
      stagePosition: number;
    }) => {
      const { error } = await supabase
        .from("crm_accounts" as any)
        .update({
          stage: normalizePipelineStage(stage),
          stage_position: stagePosition,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: refreshAll,
  });

  const syncAccountMutation = useMutation({
    mutationFn: async (crmAccountId: string) => {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      const { data, error } = await supabase.functions.invoke("crm-sync-stripe", {
        body: { crm_account_id: crmAccountId },
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      });

      if (error) throw error;
      if (!data?.success) {
        const err = new Error(data?.message || "Falha ao sincronizar com Stripe") as Error & { code?: string };
        err.code = data?.code;
        throw err;
      }
      return data;
    },
    onSuccess: refreshAll,
  });

  const saveContactMutation = useMutation({
    mutationFn: async (values: CRMContactFormValues) => {
      const payload = {
        account_id: values.account_id,
        first_name: values.first_name.trim(),
        last_name: normalizeNullable(values.last_name),
        email: normalizeNullable(values.email),
        phone: normalizeNullable(values.phone),
        title: normalizeNullable(values.title),
        city: normalizeNullable(values.city),
        role_in_deal: values.role_in_deal ?? null,
        is_primary: Boolean(values.is_primary),
        updated_at: new Date().toISOString(),
      };

      if (values.id) {
        const { error } = await supabase.from("crm_contacts" as any).update(payload).eq("id", values.id);
        if (error) throw error;
        return values.id;
      }

      const { data, error } = await supabase
        .from("crm_contacts" as any)
        .insert(payload)
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: refreshAll,
  });

  const deleteContactMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("crm_contacts" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: refreshAll,
  });

  const saveOpportunityMutation = useMutation({
    mutationFn: async (values: CRMOpportunityFormValues) => {
      const payload = {
        account_id: values.account_id,
        contact_id: values.contact_id ?? null,
        owner_user_id: values.owner_user_id ?? null,
        name: values.name.trim(),
        stage: normalizePipelineStage(values.stage),
        status: getOpportunityStatusFromStage(values.stage),
        potential_value: values.potential_value ?? null,
        target_date: values.target_date || null,
        source: normalizeNullable(values.source),
        need: normalizeNullable(values.need),
        next_step: normalizeNullable(values.next_step),
        notes: normalizeNullable(values.notes),
        last_contact_at: values.last_contact_at || null,
        next_action_at: values.next_action_at || null,
        stage_position: values.stage_position ?? 0,
        updated_at: new Date().toISOString(),
      };

      if (values.id) {
        const { error } = await supabase.from("crm_opportunities" as any).update(payload).eq("id", values.id);
        if (error) throw error;
        await syncAutoNextStepTask({
          accountId: values.account_id,
          opportunityId: values.id,
          nextStep: payload.next_step,
          nextActionAt: payload.next_action_at,
        });
        return values.id;
      }

      const { data, error } = await supabase
        .from("crm_opportunities" as any)
        .insert(payload)
        .select("id")
        .single();
      if (error) throw error;
      await syncAutoNextStepTask({
        accountId: values.account_id,
        opportunityId: data.id as string,
        nextStep: payload.next_step,
        nextActionAt: payload.next_action_at,
      });
      return data.id as string;
    },
    onSuccess: refreshAll,
  });

  const moveOpportunityMutation = useMutation({
    mutationFn: async ({
      id,
      stage,
      stagePosition,
    }: {
      id: string;
      stage: CRMOpportunityStage;
      stagePosition: number;
    }) => {
      const { error } = await supabase
        .from("crm_opportunities" as any)
        .update({
          stage,
          stage_position: stagePosition,
          status: getOpportunityStatusFromStage(stage),
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: refreshAll,
  });

  const deleteOpportunityMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("crm_opportunities" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: refreshAll,
  });

  const saveTimelineItemMutation = useMutation({
    mutationFn: async (values: CRMTimelineItemFormValues) => {
      const payload = {
        account_id: values.account_id ?? null,
        opportunity_id: values.opportunity_id ?? null,
        item_type: values.item_type,
        title: normalizeNullable(values.title),
        content: values.content.trim(),
        due_at: values.due_at || null,
        follow_up_at: values.follow_up_at || null,
        completed_at: values.completed_at || null,
        updated_at: new Date().toISOString(),
      };

      if (values.id) {
        const { error } = await supabase.from("crm_timeline_items" as any).update(payload).eq("id", values.id);
        if (error) throw error;
        return values.id;
      }

      const { data, error } = await supabase
        .from("crm_timeline_items" as any)
        .insert(payload)
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: refreshAll,
  });

  const deleteTimelineItemMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("crm_timeline_items" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: refreshAll,
  });

  const completeTaskMutation = useMutation({
    mutationFn: async ({ id, completed }: { id: string; completed: boolean }) => {
      const { data: task, error: taskError } = await supabase
        .from("crm_timeline_items" as any)
        .select("id, account_id, opportunity_id, title")
        .eq("id", id)
        .maybeSingle();

      if (taskError) throw taskError;

      const { error } = await supabase
        .from("crm_timeline_items" as any)
        .update({
          completed_at: completed ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) throw error;

      if (!completed || task?.title !== AUTO_NEXT_STEP_TASK_TITLE) return;

      if (task.opportunity_id) {
        const { error: clearOpportunityError } = await supabase
          .from("crm_opportunities" as any)
          .update({
            next_step: null,
            next_action_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", task.opportunity_id);

        if (clearOpportunityError) throw clearOpportunityError;
      }

      if (task.account_id) {
        const { error: clearAccountError } = await supabase
          .from("crm_accounts" as any)
          .update({
            next_step: null,
            next_action_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", task.account_id);

        if (clearAccountError) throw clearAccountError;
      }
    },
    onSuccess: refreshAll,
  });

  const accounts = useMemo(() => accountsQuery.data ?? [], [accountsQuery.data]);
  const contacts = useMemo(() => contactsQuery.data ?? [], [contactsQuery.data]);
  const opportunities = useMemo(() => opportunitiesQuery.data ?? [], [opportunitiesQuery.data]);
  const timelineItems = useMemo(() => timelineQuery.data ?? [], [timelineQuery.data]);
  const organizations = useMemo(() => organizationsQuery.data ?? [], [organizationsQuery.data]);
  const profiles = useMemo(() => profilesQuery.data ?? [], [profilesQuery.data]);

  const contactById = useMemo(
    () => new Map(contacts.map((contact) => [contact.id, contact])),
    [contacts],
  );
  const accountById = useMemo(
    () => new Map(accounts.map((account) => [account.id, account])),
    [accounts],
  );
  const profileById = useMemo(
    () => new Map(profiles.map((profile) => [profile.id, profile])),
    [profiles],
  );

  const contactsByAccountId = useMemo(() => {
    const map = new Map<string, CRMContact[]>();
    for (const contact of contacts) {
      const bucket = map.get(contact.account_id) ?? [];
      bucket.push(contact);
      map.set(contact.account_id, bucket);
    }
    return map;
  }, [contacts]);

  const timelineByEntity = useMemo(() => {
    const accountMap = new Map<string, CRMTimelineItem[]>();
    const opportunityMap = new Map<string, CRMTimelineItem[]>();

    for (const item of timelineItems) {
      if (item.account_id) {
        const bucket = accountMap.get(item.account_id) ?? [];
        bucket.push(item);
        accountMap.set(item.account_id, bucket);
      }
      if (item.opportunity_id) {
        const bucket = opportunityMap.get(item.opportunity_id) ?? [];
        bucket.push(item);
        opportunityMap.set(item.opportunity_id, bucket);
      }
    }

    return { accountMap, opportunityMap };
  }, [timelineItems]);

  const tasks = useMemo(
    () =>
      timelineItems
        .filter((item) => item.item_type === "task")
        .sort((a, b) => {
          const left = a.completed_at ? 1 : 0;
          const right = b.completed_at ? 1 : 0;
          if (left !== right) return left - right;
          return (a.due_at ?? a.follow_up_at ?? a.created_at).localeCompare(b.due_at ?? b.follow_up_at ?? b.created_at);
        }),
    [timelineItems],
  );

  const metrics = useMemo(() => {
    const activeAccounts = accounts.filter((item) => !["customer", "lost"].includes(item.stage));
    const totalPipelineValue = activeAccounts.reduce((sum, item) => sum + Number(item.potential_value ?? 0), 0);
    const openTasks = tasks.filter((item) => !item.completed_at).length;
    const customers = accounts.filter((item) => item.status === "customer").length;
    const payingCustomers = accounts.filter(isPayingCustomerAccount).length;
    const nonPayingRelationships = accounts.filter(isNonPayingCustomerAccount).length;
    const accountsWithContacts = accounts.filter((item) => (contactsByAccountId.get(item.id) ?? []).length > 0).length;
    const accountsWithoutContacts = accounts.length - accountsWithContacts;

    return {
      openOpportunities: activeAccounts.length,
      totalPipelineValue,
      openTasks,
      customers,
      payingCustomers,
      nonPayingRelationships,
      accountsWithContacts,
      accountsWithoutContacts,
    };
  }, [accounts, contactsByAccountId, tasks]);

  return {
    accounts,
    contacts,
    opportunities,
    timelineItems,
    tasks,
    organizations,
    profiles,
    accountById,
    contactById,
    profileById,
    contactsByAccountId,
    timelineByEntity,
    metrics,
    isLoading:
      accountsQuery.isLoading ||
      (loadOrganizations && organizationsQuery.isLoading) ||
      (loadProfiles && profilesQuery.isLoading) ||
      (loadContacts && contactsQuery.isLoading) ||
      (section === "tasks" && opportunitiesQuery.isLoading) ||
      (section === "tasks" && timelineQuery.isLoading),
    isFetching:
      accountsQuery.isFetching ||
      (loadOrganizations && organizationsQuery.isFetching) ||
      (loadProfiles && profilesQuery.isFetching) ||
      (loadContacts && contactsQuery.isFetching) ||
      ((section === "tasks" || loadDrawerRelations) && opportunitiesQuery.isFetching) ||
      ((section === "tasks" || loadDrawerRelations) && timelineQuery.isFetching),
    error:
      accountsQuery.error ||
      (loadOrganizations ? organizationsQuery.error : null) ||
      (loadProfiles ? profilesQuery.error : null) ||
      (loadContacts ? contactsQuery.error : null) ||
      ((section === "tasks" || loadDrawerRelations) ? opportunitiesQuery.error : null) ||
      ((section === "tasks" || loadDrawerRelations) ? timelineQuery.error : null),
    drawerDataLoading:
      loadDrawerRelations && (
        (loadOpportunities && opportunitiesQuery.isLoading) ||
        (loadTimeline && timelineQuery.isLoading)
      ),
    saveAccountMutation,
    deleteAccountMutation,
    moveAccountStageMutation,
    syncAccountMutation,
    saveContactMutation,
    deleteContactMutation,
    saveOpportunityMutation,
    moveOpportunityMutation,
    deleteOpportunityMutation,
    saveTimelineItemMutation,
    deleteTimelineItemMutation,
    completeTaskMutation,
    refreshAll,
  };
}
