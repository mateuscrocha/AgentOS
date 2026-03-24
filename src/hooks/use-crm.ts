import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type CRMSection = "pipeline" | "companies" | "contacts" | "tasks";

export type CRMOpportunityStage =
  | "new_lead"
  | "qualification"
  | "meeting"
  | "proposal"
  | "customer"
  | "lost";

export type CRMOpportunityStatus = "open" | "won" | "lost" | "stalled";
export type CRMAccountStatus = "lead" | "prospect" | "customer" | "inactive";
export type CRMTimelineItemType = "note" | "task" | "next_step";

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
  status: CRMAccountStatus;
  quick_notes: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_subscription_status: string | null;
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

export type CRMProfileOption = {
  id: string;
  name: string | null;
};

export type CRMAccountFormValues = {
  id?: string;
  organization_id?: string | null;
  assigned_user_id?: string | null;
  name: string;
  domain?: string | null;
  phone?: string | null;
  email?: string | null;
  source?: string | null;
  status: CRMAccountStatus;
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

export const CRM_STAGE_META: Record<
  CRMOpportunityStage,
  { label: string; shortLabel: string; tone: string }
> = {
  new_lead: { label: "Novo lead", shortLabel: "Lead", tone: "bg-slate-100 text-slate-700 border-slate-200" },
  qualification: { label: "Qualificação", shortLabel: "Qualificação", tone: "bg-sky-50 text-sky-700 border-sky-200" },
  meeting: { label: "Reunião", shortLabel: "Reunião", tone: "bg-violet-50 text-violet-700 border-violet-200" },
  proposal: { label: "Proposta", shortLabel: "Proposta", tone: "bg-amber-50 text-amber-700 border-amber-200" },
  customer: { label: "Cliente", shortLabel: "Cliente", tone: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  lost: { label: "Perdido", shortLabel: "Perdido", tone: "bg-rose-50 text-rose-700 border-rose-200" },
};

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

export function getOpportunityStatusFromStage(stage: CRMOpportunityStage): CRMOpportunityStatus {
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
  const lastChargeAt = account.stripe_last_invoice_at ?? null;
  const isDelinquent =
    Boolean(account.stripe_is_delinquent) ||
    status === "past_due";

  if (!status && !nextBillingAt && !amountCents && !lastChargeAt && !org?.stripe_customer_id && !account.stripe_customer_id) {
    return null;
  }

  return {
    label: isDelinquent ? "Financeiro em risco" : status ? status.replace(/_/g, " ") : "Stripe",
    tone: isDelinquent ? "destructive" : status === "active" ? "success" : status === "trialing" ? "warning" : "muted",
    status,
    amountCents,
    lastChargeAt,
    nextBillingAt,
    isDelinquent,
  };
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

function normalizeNullable(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function useCRM(enabled: boolean) {
  const queryClient = useQueryClient();

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
    enabled,
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
    enabled,
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
    enabled,
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
    enabled,
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
    enabled,
  });

  const refreshAll = async () => {
    await queryClient.invalidateQueries({ queryKey: ["crm"] });
  };

  const saveAccountMutation = useMutation({
    mutationFn: async (values: CRMAccountFormValues) => {
      const payload = {
        organization_id: values.organization_id ?? null,
        assigned_user_id: values.assigned_user_id ?? null,
        name: values.name.trim(),
        domain: normalizeNullable(values.domain),
        phone: normalizeNullable(values.phone),
        email: normalizeNullable(values.email),
        source: normalizeNullable(values.source),
        status: values.status,
        quick_notes: normalizeNullable(values.quick_notes),
        stripe_customer_id: normalizeNullable(values.stripe_customer_id),
        stripe_subscription_id: normalizeNullable(values.stripe_subscription_id),
        updated_at: new Date().toISOString(),
      };

      if (values.id) {
        const { error } = await supabase.from("crm_accounts" as any).update(payload).eq("id", values.id);
        if (error) throw error;
        return values.id;
      }

      const { data, error } = await supabase
        .from("crm_accounts" as any)
        .insert(payload)
        .select("id")
        .single();
      if (error) throw error;
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
        stage: values.stage,
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
        return values.id;
      }

      const { data, error } = await supabase
        .from("crm_opportunities" as any)
        .insert(payload)
        .select("id")
        .single();
      if (error) throw error;
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
      const { error } = await supabase
        .from("crm_timeline_items" as any)
        .update({
          completed_at: completed ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) throw error;
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
    const openOpportunities = opportunities.filter((item) => !["customer", "lost"].includes(item.stage));
    const totalPipelineValue = openOpportunities.reduce((sum, item) => sum + Number(item.potential_value ?? 0), 0);
    const openTasks = tasks.filter((item) => !item.completed_at).length;
    const customers = accounts.filter((item) => item.status === "customer").length;

    return {
      openOpportunities: openOpportunities.length,
      totalPipelineValue,
      openTasks,
      customers,
    };
  }, [accounts, opportunities, tasks]);

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
      contactsQuery.isLoading ||
      opportunitiesQuery.isLoading ||
      timelineQuery.isLoading ||
      profilesQuery.isLoading ||
      organizationsQuery.isLoading,
    isFetching:
      accountsQuery.isFetching ||
      contactsQuery.isFetching ||
      opportunitiesQuery.isFetching ||
      timelineQuery.isFetching ||
      profilesQuery.isFetching ||
      organizationsQuery.isFetching,
    error:
      accountsQuery.error ||
      contactsQuery.error ||
      opportunitiesQuery.error ||
      timelineQuery.error ||
      profilesQuery.error ||
      organizationsQuery.error,
    saveAccountMutation,
    deleteAccountMutation,
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
