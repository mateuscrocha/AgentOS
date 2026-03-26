import { useMemo, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { AdminPageHeader } from "@/components/layout/AdminPageHeader";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { BorisTable } from "@/components/ui/boris-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { notify } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import { getBillingStatusMeta, getRelationshipTypeMeta } from "@/lib/crm-tag-meta";
import { useAuth } from "@/hooks/use-auth";
import { useUserRoles } from "@/hooks/use-user-roles";
import {
  CRM_ACCOUNT_STATUS_META,
  CRM_PIPELINE_STAGES,
  CRM_STAGE_META,
  CRM_TASK_TYPE_META,
  getAccountFinanceSummary,
  getAccountMonthlyValue,
  getAccountStripeSyncState,
  getContactFullName,
  hasStripeBillingLink,
  isBillableRelationshipType,
  isNonPayingCustomerAccount,
  isNonPayingRelationshipType,
  isPayingCustomerAccount,
  type CRMAccount,
  type CRMContact,
  type CRMContactFormValues,
  type CRMTimelineItem,
  useCRM,
} from "@/hooks/use-crm";
import { CRMAccountDialog, CRMContactDialog, CRMTimelineItemDialog } from "@/components/crm/CRMDialogs";
import { CRMEntityDrawer } from "@/components/crm/CRMEntityDrawer";
import AccessDenied from "./AccessDenied";
import {
  ArrowRightLeft,
  BriefcaseBusiness,
  Building2,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleDollarSign,
  Coins,
  ContactRound,
  FileText,
  GripVertical,
  ListTodo,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  UserCircle2,
} from "lucide-react";

type Section = "pipeline" | "companies" | "contacts" | "tasks";
type DrawerTarget = { type: "account"; account: CRMAccount } | null;

const sectionMeta: Array<{ id: Section; label: string; href: string }> = [
  { id: "pipeline", label: "Pipeline", href: "/system/crm/pipeline" },
  { id: "companies", label: "Contas", href: "/system/crm/companies" },
  { id: "contacts", label: "Contatos", href: "/system/crm/contacts" },
  { id: "tasks", label: "Tarefas", href: "/system/crm/tasks" },
];

const crmKpiCardClassName =
  "border-sky-200/80 bg-gradient-to-b from-white to-sky-50/50 shadow-sm";
const crmKpiTitleClassName = "text-sky-700/80";
const crmKpiValueClassName = "text-sky-950";
const crmKpiIconContainerClassName = "border-sky-200 bg-sky-50/80 shadow-sm";
const crmKpiIconClassName = "text-sky-700";
const crmIconButtonClassName =
  "text-sky-700 hover:bg-sky-50 hover:text-sky-900 disabled:text-slate-400 disabled:hover:bg-transparent";
const crmIconClassName = "h-4 w-4 text-sky-700";
const crmTableBadgeClassName =
  "inline-flex min-h-6 items-center rounded-full px-2.5 py-1 text-[10.5px] font-semibold leading-none tracking-[-0.01em] whitespace-nowrap shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]";
const crmMiniBadgeClassName =
  "inline-flex min-h-5 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold leading-none tracking-[-0.01em] whitespace-nowrap shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]";

function formatCurrency(value?: number | null) {
  if (value == null) return "Sem valor";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatDateTime(value?: string | null) {
  if (!value) return "Sem data";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatDate(value?: string | null) {
  if (!value) return "Sem data";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date(value));
}

function getAccountTypeMeta(account: CRMAccount) {
  if (!account.organization_id) {
    return {
      label: "Lead do CRM",
      shortLabel: "Lead",
      description: "Lead do CRM",
      className: "border-slate-200/80 bg-slate-50/90 text-slate-700",
    };
  }
  const meta = getRelationshipTypeMeta(account.relationship_type);
  return {
    label: meta.label === "Cliente pagante" ? "Cliente pagante" : "Sem pagamento",
    shortLabel: meta.shortLabel,
    description: meta.label,
    className: meta.className,
  };
}

function getAccountBillingMeta(account: CRMAccount) {
  if (!account.organization_id) {
    return {
      label: "Sem pagamento",
      shortLabel: "Sem cobrança",
      className: "border-slate-200/80 bg-slate-50/90 text-slate-700",
    };
  }

  if (isNonPayingRelationshipType(account.relationship_type)) {
    return {
      label: "Sem pagamento",
      shortLabel: "Sem cobrança",
      className: "border-zinc-200/80 bg-zinc-100/90 text-zinc-700",
    };
  }

  if (!hasStripeBillingLink(account)) {
    return {
      label: "Sem vinculo Stripe",
      shortLabel: "Sem Stripe",
      className: "border-orange-200/80 bg-orange-50/90 text-orange-700",
    };
  }

  if (account.stripe_is_delinquent || ["past_due", "unpaid", "incomplete_expired"].includes(account.stripe_subscription_status || "")) {
    return {
      label: "Inadimplente",
      shortLabel: "Inadimplente",
      className: "border-rose-200/80 bg-rose-50/90 text-rose-700",
    };
  }

  if (account.stripe_subscription_status === "active" || account.stripe_subscription_status === "trialing") {
    return getBillingStatusMeta(account.stripe_subscription_status);
  }

  if (account.stripe_subscription_status === "canceled" || account.status === "inactive") {
    return getBillingStatusMeta("canceled");
  }

  return null;
}

function shouldShowFinancialContext(account: CRMAccount) {
  return Boolean(account.organization_id) && isPayingCustomerAccount(account);
}

function getSectionFromPath(pathname: string): Section {
  const match = pathname.match(/^\/system\/crm\/([^/]+)/);
  const section = match?.[1];
  if (section === "companies" || section === "contacts" || section === "tasks") return section;
  return "pipeline";
}

function getErrorMessage(error: unknown) {
  const message = (error as { message?: string } | null)?.message;
  return message || "Não foi possível concluir a ação.";
}

function getStripeSyncErrorDetails(error: unknown) {
  const typed = error as { message?: string; code?: string } | null;
  if (typed?.code === "STRIPE_NOT_CONFIGURED") {
    return "A Edge Function está pronta, mas o secret `STRIPE_SECRET_KEY` ainda não foi configurado no Supabase.";
  }
  if (typed?.code === "STRIPE_IDS_MISSING") {
    return "Essa conta ainda não tem IDs Stripe nem vínculo com uma organização que já tenha billing configurado.";
  }
  if (typed?.code === "SUBSCRIPTION_NOT_FOUND") {
    return "O cliente Stripe foi encontrado, mas não há assinatura disponível para sincronizar.";
  }
  return getErrorMessage(error);
}

export default function SystemCRM() {
  const location = useLocation();
  const navigate = useNavigate();
  const section = getSectionFromPath(location.pathname);
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { isSystemAdmin, isLoading: rolesLoading } = useUserRoles();
  const crm = useCRM(isAuthenticated && isSystemAdmin);

  const [search, setSearch] = useState("");
  const [billingFilter, setBillingFilter] = useState<
    "all" | "paying" | "nonpaying" | "attention"
  >("all");
  const [draggedAccountId, setDraggedAccountId] = useState<string | null>(null);

  const [accountDialogOpen, setAccountDialogOpen] = useState(false);
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [timelineDialogOpen, setTimelineDialogOpen] = useState(false);

  const [editingAccount, setEditingAccount] = useState<CRMAccount | null>(null);
  const [editingContact, setEditingContact] = useState<CRMContact | null>(null);
  const [editingTimelineItem, setEditingTimelineItem] = useState<CRMTimelineItem | null>(null);
  const [contactDefaults, setContactDefaults] = useState<Partial<CRMContactFormValues>>({});
  const [timelineDefaults, setTimelineDefaults] = useState<Partial<CRMTimelineItem>>({});

  const [drawerTarget, setDrawerTarget] = useState<DrawerTarget>(null);
  const [bulkStripeSyncPending, setBulkStripeSyncPending] = useState(false);
  const [expandedPipelineAccountId, setExpandedPipelineAccountId] = useState<string | null>(null);

  const accountOptions = useMemo(
    () => crm.accounts.map((account) => ({ id: account.id, label: account.name })),
    [crm.accounts],
  );
  const organizationOptions = useMemo(
    () => crm.organizations.map((org) => ({ id: org.id, label: org.name })),
    [crm.organizations],
  );
  const filteredContactsForDrawer = drawerTarget?.type === "account"
    ? crm.contacts.filter((contact) => contact.account_id === drawerTarget.account.id)
    : [];
  const filteredOpportunitiesForDrawer = drawerTarget?.type === "account"
    ? crm.opportunities.filter((opportunity) => opportunity.account_id === drawerTarget.account.id)
    : [];
  const timelineItemsForDrawer = drawerTarget?.type === "account"
    ? crm.timelineByEntity.accountMap.get(drawerTarget.account.id) ?? []
    : [];

  const normalizedSearch = search.trim().toLocaleLowerCase("pt-BR");

  const searchedAccounts = useMemo(() => {
    if (!normalizedSearch) return crm.accounts;
    return crm.accounts.filter((account) => {
      const contacts = crm.contactsByAccountId.get(account.id) ?? [];
      return [
        account.name,
        account.domain,
        account.email,
        account.phone,
        account.source,
        account.need,
        account.next_step,
        account.quick_notes,
        ...contacts.flatMap((contact) => [
          contact.first_name,
          contact.last_name,
          contact.email,
          contact.phone,
        ]),
      ]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase("pt-BR").includes(normalizedSearch));
    });
  }, [crm.accounts, crm.contactsByAccountId, normalizedSearch]);

  const filteredAccounts = useMemo(() => {
    return searchedAccounts.filter((account) => {
      const finance = getAccountFinanceSummary(account);

      if (billingFilter === "paying") {
        return isPayingCustomerAccount(account);
      }

      if (billingFilter === "nonpaying") {
        return isNonPayingCustomerAccount(account);
      }

      if (billingFilter === "attention") {
        return (
          crm.metrics.accountsWithoutContacts > 0 && !(crm.contactsByAccountId.get(account.id) ?? []).length
        ) || (
          isBillableRelationshipType(account.relationship_type) &&
          (!hasStripeBillingLink(account) || Boolean(finance?.isDelinquent))
        );
      }

      return true;
    });
  }, [billingFilter, searchedAccounts]);

  const filteredContacts = useMemo(() => {
    if (!normalizedSearch) return crm.contacts;
    return crm.contacts.filter((contact) => {
      const account = crm.accountById.get(contact.account_id);
      return [
        contact.first_name,
        contact.last_name,
        contact.email,
        contact.phone,
        contact.title,
        contact.city,
        account?.name,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase("pt-BR").includes(normalizedSearch));
    });
  }, [crm.accountById, crm.contacts, normalizedSearch]);

  const filteredTasks = useMemo(() => {
    if (!normalizedSearch) return crm.tasks;
    return crm.tasks.filter((task) => {
      const account = task.account_id ? crm.accountById.get(task.account_id) : null;
      const opportunity = task.opportunity_id ? crm.opportunities.find((item) => item.id === task.opportunity_id) : null;
      return [
        task.title,
        task.content,
        account?.name,
        opportunity?.name,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase("pt-BR").includes(normalizedSearch));
    });
  }, [crm.accountById, crm.opportunities, crm.tasks, normalizedSearch]);

  const pipelineColumns = useMemo(
    () =>
      CRM_PIPELINE_STAGES.map((stage) => ({
        stage,
        items: filteredAccounts
          .filter((item) => item.stage === stage)
          .sort((left, right) => left.stage_position - right.stage_position || left.updated_at.localeCompare(right.updated_at)),
      })),
    [filteredAccounts],
  );
  const billableWithoutStripeCount = useMemo(
    () => crm.accounts.filter((account) => isBillableRelationshipType(account.relationship_type) && !hasStripeBillingLink(account)).length,
    [crm.accounts],
  );
  const billingSegments = useMemo(
    () => ({
      all: crm.accounts.length,
      paying: crm.accounts.filter(isPayingCustomerAccount).length,
      nonpaying: crm.accounts.filter(isNonPayingCustomerAccount).length,
      delinquent: crm.accounts.filter(
        (account) =>
          isBillableRelationshipType(account.relationship_type) &&
          hasStripeBillingLink(account) &&
          account.stripe_subscription_status !== "canceled" &&
          Boolean(getAccountFinanceSummary(account)?.isDelinquent),
      ).length,
      canceled: crm.accounts.filter(
        (account) => isBillableRelationshipType(account.relationship_type) && hasStripeBillingLink(account) && (
          account.stripe_subscription_status === "canceled" || account.status === "inactive"
        ),
      ).length,
      active: crm.accounts.filter(
        (account) => isBillableRelationshipType(account.relationship_type) && hasStripeBillingLink(account) && (
          account.stripe_subscription_status === "active" || account.stripe_subscription_status === "trialing"
        ),
      ).length,
    }),
    [crm.accounts],
  );
  const isPipelineSection = section === "pipeline";

  if (authLoading || rolesLoading) {
    return (
      <AdminLayout title="CRM" subtitle="Carregando CRM...">
        <LoadingState message="Verificando permissões..." />
      </AdminLayout>
    );
  }

  if (!isSystemAdmin) {
    return <AccessDenied message="O módulo de CRM é restrito a usuários com perfil system admin." />;
  }

  const handleMutation = async (fn: () => Promise<unknown>, successTitle: string, successMessage: string) => {
    try {
      await fn();
      notify.success(successTitle, successMessage);
    } catch (error) {
      notify.error("Não foi possível concluir", getStripeSyncErrorDetails(error));
    }
  };

  const openAccountDrawer = (account: CRMAccount) => setDrawerTarget({ type: "account", account });

  const openTimelineDialogForCurrentEntity = (itemType: "note" | "task" | "next_step" = "note") => {
    if (!drawerTarget) return;
    setEditingTimelineItem(null);
    setTimelineDefaults({ account_id: drawerTarget.account.id, item_type: itemType });
    setTimelineDialogOpen(true);
  };

  const openContactDialogForAccount = (account: CRMAccount) => {
    setEditingContact(null);
    setContactDefaults({ account_id: account.id, is_primary: (crm.contactsByAccountId.get(account.id) ?? []).length === 0 });
    setContactDialogOpen(true);
  };

  const handleBulkStripeSync = async () => {
    const syncableAccounts = filteredAccounts.filter((account) => getAccountStripeSyncState(account).canSync);
    if (syncableAccounts.length === 0) {
      notify.warning("Nada para sincronizar", "Nenhuma conta filtrada possui vínculo Stripe configurado.");
      return;
    }

    setBulkStripeSyncPending(true);
    let successCount = 0;

    try {
      for (const account of syncableAccounts) {
        try {
          await crm.syncAccountMutation.mutateAsync(account.id);
          successCount += 1;
        } catch (error) {
          console.error("Falha ao sincronizar conta CRM", account.id, error);
        }
      }

      if (successCount === 0) {
        notify.error("Sync Stripe não concluída", "Nenhuma conta conseguiu atualizar a mensalidade.");
        return;
      }

      notify.success(
        "Mensalidades atualizadas",
        `${successCount} conta(s) tiveram o contexto Stripe sincronizado.`,
      );
    } finally {
      setBulkStripeSyncPending(false);
    }
  };

  const pageActions = (
    <div className="flex flex-wrap gap-2">
      {section === "pipeline" ? (
        <>
          <Button
            variant="outline"
            className="border-sky-200 bg-white/90 text-sky-900 hover:border-sky-400 hover:bg-sky-50"
            onClick={() => void handleBulkStripeSync()}
            disabled={bulkStripeSyncPending}
          >
            <RefreshCw className={cn("mr-2 h-4 w-4", bulkStripeSyncPending && "animate-spin")} />
            Atualizar mensalidades
          </Button>
          <Button
            className="border border-sky-600 bg-sky-600 text-white shadow-none hover:bg-sky-700"
            onClick={() => { setEditingAccount(null); setAccountDialogOpen(true); }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Nova conta
          </Button>
        </>
      ) : null}
      {section === "companies" ? (
        <>
          <Button
            variant="outline"
            className="border-sky-200 bg-white/90 text-sky-900 hover:border-sky-400 hover:bg-sky-50"
            onClick={() => void handleBulkStripeSync()}
            disabled={bulkStripeSyncPending}
          >
            <RefreshCw className={cn("mr-2 h-4 w-4", bulkStripeSyncPending && "animate-spin")} />
            Atualizar mensalidades
          </Button>
          <Button
            className="border border-sky-600 bg-sky-600 text-white shadow-none hover:bg-sky-700"
            onClick={() => { setEditingAccount(null); setAccountDialogOpen(true); }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Nova conta
          </Button>
        </>
      ) : null}
      {section === "contacts" ? (
        <Button
          className="border border-sky-600 bg-sky-600 text-white shadow-none hover:bg-sky-700"
          onClick={() => { setEditingContact(null); setContactDefaults({}); setContactDialogOpen(true); }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Novo contato
        </Button>
      ) : null}
      {section === "tasks" ? (
        <Button
          className="border border-sky-600 bg-sky-600 text-white shadow-none hover:bg-sky-700"
          onClick={() => {
            setEditingTimelineItem(null);
            setTimelineDefaults({ item_type: "task" });
            setTimelineDialogOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Nova tarefa
        </Button>
      ) : null}
    </div>
  );

  const breadcrumbTitle = sectionMeta.find((item) => item.id === section)?.label ?? "Pipeline";
  const pageDescription =
    section === "pipeline"
      ? "Operação comercial com visão rápida por etapa, próxima ação e contexto financeiro."
      : section === "companies"
        ? "Carteira comercial unificada: leads do CRM e clientes reais espelhados a partir das organizations."
        : section === "contacts"
          ? "Contatos vinculados às contas com foco em follow-up e contexto comercial."
      : "Fila de follow-ups e tarefas abertas para tocar a operação sem atrito.";

  const companiesColumns = [
    {
      key: "name",
      header: "Conta",
      render: (account: CRMAccount) => (
        <div className="min-w-0">
          <p className="truncate font-semibold text-card-foreground">{account.name}</p>
          <p className="mt-1 truncate text-xs text-muted-foreground">{account.domain || account.email || "Sem domínio"}</p>
        </div>
      ),
    },
    {
      key: "type",
      header: "Tipo",
      render: (account: CRMAccount) => {
        const type = getAccountTypeMeta(account);
        return (
          <Badge variant="outline" className={cn("border", crmTableBadgeClassName, type.className)}>
            {type.shortLabel}
          </Badge>
        );
      },
    },
    {
      key: "billing",
      header: "Cobrança",
      render: (account: CRMAccount) => {
        const billing = getAccountBillingMeta(account);
        return billing ? (
          <Badge variant="outline" className={cn("border", crmTableBadgeClassName, billing.className)}>
            {billing.shortLabel}
          </Badge>
        ) : (
          <span className="text-sm text-muted-foreground">Sem cobrança</span>
        );
      },
    },
    {
      key: "contact",
      header: "Contato principal",
      render: (account: CRMAccount) => {
        const primaryContact = (crm.contactsByAccountId.get(account.id) ?? []).find((contact) => contact.is_primary) ?? (crm.contactsByAccountId.get(account.id) ?? [])[0];
        return (
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-card-foreground">{primaryContact ? getContactFullName(primaryContact) : "Sem contato"}</p>
            <p className="truncate text-xs text-muted-foreground">{primaryContact?.email || primaryContact?.phone || "Sem contato direto"}</p>
          </div>
        );
      },
    },
    {
      key: "status",
      header: "Etapa",
      render: (account: CRMAccount) => (
        <Badge variant="outline" className={cn("border", crmTableBadgeClassName, CRM_STAGE_META[account.stage].tone)}>
          {CRM_STAGE_META[account.stage].shortLabel}
        </Badge>
      ),
    },
    {
      key: "next_action",
      header: "Próxima ação",
      hideOn: "md" as const,
      render: (account: CRMAccount) => <span className="text-sm text-muted-foreground">{formatDateTime(account.next_action_at)}</span>,
    },
    {
      key: "financial",
      header: "Mensalidade",
      hideOn: "lg" as const,
      render: (account: CRMAccount) => {
        const shouldShowFinancial = shouldShowFinancialContext(account);
        const finance = getAccountFinanceSummary(account);
        const monthlyValue = getAccountMonthlyValue(account);

        if (!shouldShowFinancial) {
          return (
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-400">--</p>
              <p className="truncate text-xs text-muted-foreground">Sem cobranca</p>
            </div>
          );
        }

        return (
          <div className="min-w-0">
            <p className="text-sm font-medium text-card-foreground">{formatCurrency(monthlyValue)}</p>
            <p className="truncate text-xs text-muted-foreground">{finance?.label || "Sem contexto financeiro"}</p>
          </div>
        );
      },
    },
    {
      key: "actions",
      header: "Ações",
      align: "right" as const,
      render: (account: CRMAccount) => (
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="icon" className={crmIconButtonClassName} onClick={() => openAccountDrawer(account)}>
            <FileText className={crmIconClassName} />
          </Button>
          <Button variant="ghost" size="icon" className={crmIconButtonClassName} onClick={() => { setEditingAccount(account); setAccountDialogOpen(true); }}>
            <Pencil className={crmIconClassName} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={crmIconButtonClassName}
            onClick={() => {
              const syncState = getAccountStripeSyncState(account);
              if (!syncState.canSync) {
                notify.warning("Vínculo Stripe ausente", syncState.missingReason || "Configure os IDs Stripe antes de sincronizar.");
                return;
              }
              void handleMutation(
                () => crm.syncAccountMutation.mutateAsync(account.id),
                "Stripe sincronizada",
                "O contexto financeiro da conta foi atualizado.",
              );
            }}
          >
            <RefreshCw className={crmIconClassName} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              if (!window.confirm(`Excluir ${account.name}?`)) return;
              void handleMutation(
                () => crm.deleteAccountMutation.mutateAsync(account.id),
                "Conta excluída",
                "A conta e seus vínculos foram removidos.",
              );
            }}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  const contactsColumns = [
    {
      key: "name",
      header: "Contato",
      render: (contact: CRMContact) => (
        <div className="min-w-0">
          <p className="truncate font-semibold text-card-foreground">{getContactFullName(contact)}</p>
          <p className="truncate text-xs text-muted-foreground">{contact.title || "Sem cargo"}</p>
        </div>
      ),
    },
    {
      key: "company",
      header: "Conta",
      render: (contact: CRMContact) => {
        const account = crm.accountById.get(contact.account_id);
        if (!account) return <span className="text-sm text-card-foreground">Conta removida</span>;
        const type = getAccountTypeMeta(account);
        const billing = getAccountBillingMeta(account);
        return (
          <div className="min-w-0">
            <p className="truncate text-sm text-card-foreground">{account.name}</p>
            <div className="mt-1 flex flex-wrap gap-1">
              <Badge variant="outline" className={cn("border", crmMiniBadgeClassName, type.className)}>
                {type.shortLabel}
              </Badge>
              {billing ? (
                <Badge variant="outline" className={cn("border", crmMiniBadgeClassName, billing.className)}>
                  {billing.shortLabel}
                </Badge>
              ) : null}
            </div>
          </div>
        );
      },
    },
    {
      key: "email",
      header: "Email",
      hideOn: "md" as const,
      render: (contact: CRMContact) => <span className="text-sm text-muted-foreground">{contact.email || "Sem email"}</span>,
    },
    {
      key: "phone",
      header: "Telefone",
      hideOn: "lg" as const,
      render: (contact: CRMContact) => <span className="text-sm text-muted-foreground">{contact.phone || "Sem telefone"}</span>,
    },
    {
      key: "city",
      header: "Cidade",
      hideOn: "lg" as const,
      render: (contact: CRMContact) => <span className="text-sm text-muted-foreground">{contact.city || "Sem cidade"}</span>,
    },
    {
      key: "actions",
      header: "Ações",
      align: "right" as const,
      render: (contact: CRMContact) => (
        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            size="icon"
            className={crmIconButtonClassName}
            onClick={() => openAccountDrawer(crm.accountById.get(contact.account_id)!)}
            disabled={!crm.accountById.get(contact.account_id)}
          >
            <FileText className={crmIconClassName} />
          </Button>
          <Button variant="ghost" size="icon" className={crmIconButtonClassName} onClick={() => { setEditingContact(contact); setContactDialogOpen(true); }}>
            <Pencil className={crmIconClassName} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              if (!window.confirm(`Excluir ${getContactFullName(contact)}?`)) return;
              void handleMutation(
                () => crm.deleteContactMutation.mutateAsync(contact.id),
                "Contato excluído",
                "O contato foi removido.",
              );
            }}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  const tasksColumns = [
    {
      key: "title",
      header: "Tarefa",
      render: (item: CRMTimelineItem) => (
        <div className="min-w-0">
          <p className="truncate font-semibold text-card-foreground">{item.title || item.content}</p>
          <p className="truncate text-xs text-muted-foreground">{item.title ? item.content : CRM_TASK_TYPE_META[item.item_type].label}</p>
        </div>
      ),
    },
    {
      key: "entity",
      header: "Conta / oportunidade",
      render: (item: CRMTimelineItem) => {
        const account = item.account_id ? crm.accountById.get(item.account_id) : null;
        const opportunity = item.opportunity_id ? crm.opportunities.find((candidate) => candidate.id === item.opportunity_id) : null;
        return (
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-card-foreground">{opportunity?.name || account?.name || "Sem vínculo"}</p>
            <p className="truncate text-xs text-muted-foreground">{account?.name && opportunity ? account.name : item.follow_up_at ? `Follow-up ${formatDateTime(item.follow_up_at)}` : "Sem detalhe"}</p>
          </div>
        );
      },
    },
    {
      key: "due",
      header: "Prazo",
      render: (item: CRMTimelineItem) => <span className="text-sm text-muted-foreground">{formatDateTime(item.due_at || item.follow_up_at)}</span>,
    },
    {
      key: "status",
      header: "Status",
      render: (item: CRMTimelineItem) => (
        <Badge variant="outline" className={cn("border", item.completed_at ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700")}>
          {item.completed_at ? "Concluída" : "Aberta"}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: "Ações",
      align: "right" as const,
      render: (item: CRMTimelineItem) => (
        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            size="icon"
            className={crmIconButtonClassName}
            onClick={() => {
              const account = item.account_id ? crm.accountById.get(item.account_id) ?? null : null;
              if (account) openAccountDrawer(account);
            }}
          >
            <FileText className={crmIconClassName} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={crmIconButtonClassName}
            onClick={() => void handleMutation(
              () => crm.completeTaskMutation.mutateAsync({ id: item.id, completed: !item.completed_at }),
              item.completed_at ? "Tarefa reaberta" : "Tarefa concluída",
              item.completed_at ? "A tarefa voltou para a fila." : "A tarefa foi marcada como concluída.",
            )}
          >
            {item.completed_at ? <ArrowRightLeft className={crmIconClassName} /> : <CheckCircle2 className={crmIconClassName} />}
          </Button>
          <Button variant="ghost" size="icon" className={crmIconButtonClassName} onClick={() => { setEditingTimelineItem(item); setTimelineDefaults({}); setTimelineDialogOpen(true); }}>
            <Pencil className={crmIconClassName} />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <AdminLayout title="CRM" subtitle="Operação comercial interna do Bóris">
      <AdminPageHeader
        className="crm-page-header"
        breadcrumbItems={[
          { label: "Painel", href: "/system" },
          { label: "CRM", href: "/system/crm/pipeline" },
          { label: breadcrumbTitle },
        ]}
        title="CRM"
        description={pageDescription}
        actions={pageActions}
        generalKpis={
          <>
            <StatsCard
              title="Contas em negociação"
              value={crm.metrics.openOpportunities}
              icon={BriefcaseBusiness}
              variant={isPipelineSection ? "compact" : "kpi"}
              className={crmKpiCardClassName}
              titleClassName={crmKpiTitleClassName}
              valueClassName={crmKpiValueClassName}
              iconContainerClassName={crmKpiIconContainerClassName}
              iconClassName={crmKpiIconClassName}
            />
            <StatsCard
              title="Clientes pagos"
              value={billingSegments.active}
              icon={Coins}
              variant={isPipelineSection ? "compact" : "kpi"}
              className={crmKpiCardClassName}
              titleClassName={crmKpiTitleClassName}
              valueClassName={crmKpiValueClassName}
              iconContainerClassName={crmKpiIconContainerClassName}
              iconClassName={crmKpiIconClassName}
            />
            <StatsCard
              title="Sem vínculo Stripe"
              value={billableWithoutStripeCount}
              icon={CircleDollarSign}
              variant={isPipelineSection ? "compact" : "kpi"}
              className={crmKpiCardClassName}
              titleClassName={crmKpiTitleClassName}
              valueClassName={crmKpiValueClassName}
              iconContainerClassName={crmKpiIconContainerClassName}
              iconClassName={crmKpiIconClassName}
            />
            <StatsCard
              title="Tarefas abertas"
              value={crm.metrics.openTasks}
              icon={ListTodo}
              variant={isPipelineSection ? "compact" : "kpi"}
              className={crmKpiCardClassName}
              titleClassName={crmKpiTitleClassName}
              valueClassName={crmKpiValueClassName}
              iconContainerClassName={crmKpiIconContainerClassName}
              iconClassName={crmKpiIconClassName}
            />
          </>
        }
        filters={
          <>
            <div className="relative min-w-[280px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sky-600/70" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por conta, contato, email, domínio, telefone..."
                className="border-sky-200 bg-white/95 pl-9 shadow-sm placeholder:text-slate-400 focus-visible:border-sky-400 focus-visible:ring-sky-400/30"
              />
            </div>
            <div className="flex flex-wrap gap-2">
                {[
                  { value: "all", label: "Todas", count: billingSegments.all },
                  { value: "paying", label: "Pagantes", count: billingSegments.paying },
                  { value: "nonpaying", label: "Sem pagamento", count: billingSegments.nonpaying },
                  {
                    value: "attention",
                    label: "Pendências",
                    count: billableWithoutStripeCount + billingSegments.delinquent + crm.metrics.accountsWithoutContacts,
                  },
              ].map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  variant="outline"
                  size="sm"
                  className={cn(
                    "h-9 border-sky-200 bg-white/90 text-sky-800 hover:border-sky-400 hover:bg-sky-50",
                    billingFilter === option.value &&
                      "border-sky-600 bg-sky-600 text-white hover:border-sky-700 hover:bg-sky-700",
                  )}
                  onClick={() => setBillingFilter(option.value as typeof billingFilter)}
                >
                  {option.label}
                  <span className="ml-2 rounded-full bg-black/5 px-1.5 py-0.5 text-[11px] leading-none">
                    {option.count}
                  </span>
                </Button>
              ))}
            </div>
          </>
        }
      />

      {(billableWithoutStripeCount > 0 || crm.metrics.accountsWithoutContacts > 0) ? (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-[var(--radius-lg)] border border-slate-200 bg-white px-4 py-3 text-xs shadow-sm">
          <span className="font-medium text-slate-500">Atenção:</span>
          {billableWithoutStripeCount > 0 ? (
            <Badge variant="outline" className="border-orange-200 bg-orange-50 text-orange-900">
              {billableWithoutStripeCount} sem vínculo Stripe
            </Badge>
          ) : null}
          {crm.metrics.accountsWithoutContacts > 0 ? (
            <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-900">
              {crm.metrics.accountsWithoutContacts} sem contato
            </Badge>
          ) : null}
        </div>
      ) : null}

      <div className="mb-6 flex flex-wrap gap-2">
        {sectionMeta.map((item) => (
          <NavLink
            key={item.id}
            to={item.href}
            className={({ isActive }) =>
              cn(
                "inline-flex items-center rounded-full border px-4 py-2 text-sm font-medium transition-all",
                isActive
                  ? "border-sky-600 bg-sky-600 text-white shadow-sm"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900",
              )
            }
          >
            {item.label}
          </NavLink>
        ))}
      </div>

      {crm.isLoading ? (
        <LoadingState message="Carregando dados do CRM..." />
      ) : crm.error ? (
        <ErrorState
          title="Não foi possível carregar o CRM"
          message={getErrorMessage(crm.error)}
          retry={() => void crm.refreshAll()}
        />
      ) : (
        <>
          {section === "pipeline" ? (
            <div className="rounded-[var(--radius-lg)] border border-slate-200 bg-white p-3 shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-3 px-1">
                <div>
                  <p className="text-sm font-semibold text-sky-950">Pipeline</p>
                  <p className="text-xs text-sky-700/70">Leitura rápida por etapa.</p>
                </div>
                {billingFilter !== "all" ? (
                  <Badge variant="outline" className="border-sky-200 bg-white/90 text-sky-900">
                    Filtro ativo
                  </Badge>
                ) : null}
              </div>
              <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
                  {pipelineColumns.map((column) => (
                    <section
                      key={column.stage}
                      className="flex min-w-0 h-[calc(100vh-24rem)] min-h-[26rem] max-h-[44rem] flex-col rounded-[var(--radius-lg)] border border-slate-200 bg-slate-50/60 shadow-sm"
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={() => {
                        if (!draggedAccountId) return;
                        const nextPosition = (crm.accounts.filter((item) => item.stage === column.stage).length + 1) * 1000;
                        void handleMutation(
                          () => crm.moveAccountStageMutation.mutateAsync({ id: draggedAccountId, stage: column.stage, stagePosition: nextPosition }),
                          "Etapa atualizada",
                          `Conta movida para ${CRM_STAGE_META[column.stage].label}.`,
                        );
                        setDraggedAccountId(null);
                      }}
                    >
                      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-3.5 py-2.5">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{CRM_STAGE_META[column.stage].label}</p>
                          <p className="text-[11px] text-slate-500">{column.items.length} contas</p>
                        </div>
                        <span className="text-[11px] font-medium text-slate-400">{CRM_STAGE_META[column.stage].shortLabel}</span>
                      </div>

                      <ScrollArea className="min-w-0 flex-1">
                        <div className="flex min-w-0 flex-col gap-2.5 p-2.5">
                          {column.items.length === 0 ? (
                            <div className="flex min-h-[160px] items-center justify-center rounded-[var(--radius-md)] border border-dashed border-slate-200 bg-white p-4 text-center text-sm text-slate-500">
                              Nenhuma conta nesta etapa.
                            </div>
                          ) : (
                            column.items.map((account) => {
                              const contact = (crm.contactsByAccountId.get(account.id) ?? []).find((item) => item.is_primary) ?? (crm.contactsByAccountId.get(account.id) ?? [])[0] ?? null;
                              const finance = getAccountFinanceSummary(account);
                              const monthlyValue = getAccountMonthlyValue(account);
                              const type = getAccountTypeMeta(account);
                              const billing = getAccountBillingMeta(account);
                              const shouldShowFinancial = shouldShowFinancialContext(account);
                              const isExpanded = expandedPipelineAccountId === account.id;
                              return (
                                <article
                                  key={account.id}
                                  draggable
                                  onDragStart={() => setDraggedAccountId(account.id)}
                                  onDragEnd={() => setDraggedAccountId(null)}
                                  onClick={() =>
                                    setExpandedPipelineAccountId((current) => (current === account.id ? null : account.id))
                                  }
                                  className="w-full min-w-0 max-w-full overflow-hidden rounded-[18px] border border-slate-200 bg-white p-2.5 shadow-sm transition-all hover:border-sky-300 hover:shadow-md"
                                >
                                  <div className="mb-2.5 flex items-start justify-between gap-2.5">
                                    <div className="min-w-0 flex-1 basis-0">
                                      <div className="flex min-w-0 items-start justify-between gap-3">
                                        <div className="min-w-0 w-0 max-w-full flex-1">
                                          <p className="truncate text-[14px] font-semibold leading-5 text-slate-950">
                                            {account.name}
                                          </p>
                                          <p className="mt-0.5 truncate text-[11px] text-slate-500">
                                            {contact ? getContactFullName(contact) : "Sem contato"}
                                          </p>
                                        </div>
                                        <div className="flex shrink-0 items-center gap-1">
                                          <div className="rounded-full bg-slate-100 p-1 text-slate-400">
                                            <GripVertical className="h-3.5 w-3.5 shrink-0" />
                                          </div>
                                          <div className="rounded-full bg-slate-100 p-1 text-slate-500">
                                            {isExpanded ? (
                                              <ChevronUp className="h-3.5 w-3.5 shrink-0" />
                                            ) : (
                                              <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                                            )}
                                          </div>
                                        </div>
                                      </div>

                                      <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-1">
                                        <Badge variant="outline" className={cn("border", crmMiniBadgeClassName, type.className)}>
                                          {type.shortLabel}
                                        </Badge>
                                        {billing ? (
                                          <Badge variant="outline" className={cn("border", crmMiniBadgeClassName, billing.className)}>
                                            {billing.shortLabel}
                                          </Badge>
                                        ) : null}
                                      </div>
                                    </div>
                                  </div>

                                  {isExpanded ? (
                                    <>
                                      <div className="grid min-w-0 gap-1.5 rounded-2xl border border-slate-200 bg-slate-50/70 p-2">
                                        {shouldShowFinancial ? (
                                          <div className="flex min-w-0 items-center justify-between gap-2 text-[11px]">
                                            <span className="text-slate-500">Financeiro</span>
                                            <span className="min-w-0 truncate font-medium text-slate-900">{finance?.label || "Sem cobrança"}</span>
                                          </div>
                                        ) : null}
                                        <div className={cn("grid min-w-0 gap-1.5", shouldShowFinancial ? "grid-cols-2" : "grid-cols-1")}>
                                          {shouldShowFinancial ? (
                                            <div className="min-w-0 rounded-2xl bg-white px-2.5 py-1.5">
                                              <p className="text-[10px] uppercase tracking-[0.08em] text-slate-500">Mensalidade</p>
                                              <p className="mt-1 truncate text-sm font-semibold text-slate-950">{formatCurrency(monthlyValue)}</p>
                                            </div>
                                          ) : null}
                                          <div className="min-w-0 rounded-2xl bg-white px-2.5 py-1.5">
                                            <p className="text-[10px] uppercase tracking-[0.08em] text-slate-500">Próxima ação</p>
                                            <p className="mt-1 truncate text-sm font-semibold text-slate-950">{formatDateTime(account.next_action_at)}</p>
                                          </div>
                                        </div>
                                      </div>

                                      <div className="mt-2.5 flex min-w-0 items-center justify-between gap-2">
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="h-8 rounded-full border-sky-200 bg-white px-3 text-xs font-medium text-sky-900 hover:bg-sky-50 hover:text-sky-950"
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            openAccountDrawer(account);
                                          }}
                                        >
                                          Contexto
                                        </Button>
                                        <div className="flex shrink-0 gap-1">
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className={cn(crmIconButtonClassName, "h-8 w-8 rounded-full bg-white hover:bg-sky-50")}
                                            onClick={(event) => {
                                              event.stopPropagation();
                                              setEditingAccount(account);
                                              setAccountDialogOpen(true);
                                            }}
                                          >
                                            <Pencil className={crmIconClassName} />
                                          </Button>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 rounded-full bg-white hover:bg-rose-50"
                                            onClick={(event) => {
                                              event.stopPropagation();
                                              if (!window.confirm(`Excluir ${account.name}?`)) return;
                                              void handleMutation(
                                                () => crm.deleteAccountMutation.mutateAsync(account.id),
                                                "Conta excluída",
                                                "A conta foi removida do CRM.",
                                              );
                                            }}
                                          >
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                          </Button>
                                        </div>
                                      </div>
                                    </>
                                  ) : null}
                                </article>
                              );
                            })
                          )}
                        </div>
                      </ScrollArea>
                    </section>
                  ))}
              </div>
            </div>
          ) : null}

          {section === "companies" ? (
            filteredAccounts.length === 0 ? (
              <EmptyState icon={Building2} title="Nenhuma conta encontrada" message="Cadastre um lead ou vincule um cliente real para começar a operar o CRM." />
            ) : (
              <BorisTable
                columns={companiesColumns}
                data={filteredAccounts}
                keyExtractor={(item) => item.id}
                onRowClick={openAccountDrawer}
                pageSize={filteredAccounts.length || 10}
              />
            )
          ) : null}

          {section === "contacts" ? (
            filteredContacts.length === 0 ? (
              <EmptyState icon={ContactRound} title="Nenhum contato encontrado" message="Cadastre contatos vinculados às contas para registrar relacionamento real." />
            ) : (
              <BorisTable
                columns={contactsColumns}
                data={filteredContacts}
                keyExtractor={(item) => item.id}
                onRowClick={(contact) => {
                  const account = crm.accountById.get(contact.account_id);
                  if (account) openAccountDrawer(account);
                }}
                pageSize={filteredContacts.length || 10}
              />
            )
          ) : null}

          {section === "tasks" ? (
            filteredTasks.length === 0 ? (
              <EmptyState icon={ListTodo} title="Nenhuma tarefa encontrada" message="Registre follow-ups e tarefas para acompanhar o comercial pelo próprio painel." />
            ) : (
              <BorisTable
                columns={tasksColumns}
                data={filteredTasks}
                keyExtractor={(item) => item.id}
                pageSize={filteredTasks.length || 10}
              />
            )
          ) : null}
        </>
      )}

      <CRMAccountDialog
        open={accountDialogOpen}
        onOpenChange={setAccountDialogOpen}
        account={editingAccount}
        organizations={organizationOptions}
        profiles={crm.profiles}
        pending={crm.saveAccountMutation.isPending}
        onSubmit={async (values) => {
          await handleMutation(
            () => crm.saveAccountMutation.mutateAsync(values),
            editingAccount ? "Conta atualizada" : "Conta criada",
            editingAccount ? "As alterações da conta foram salvas." : "A conta foi adicionada ao CRM.",
          );
          setAccountDialogOpen(false);
          setEditingAccount(null);
        }}
      />

      <CRMContactDialog
        open={contactDialogOpen}
        onOpenChange={setContactDialogOpen}
        contact={editingContact}
        accountOptions={accountOptions}
        pending={crm.saveContactMutation.isPending}
        defaultValues={contactDefaults}
        onSubmit={async (values) => {
          await handleMutation(
            () => crm.saveContactMutation.mutateAsync(values),
            editingContact ? "Contato atualizado" : "Contato criado",
            editingContact ? "As alterações do contato foram salvas." : "O contato foi adicionado ao CRM.",
          );
          setContactDialogOpen(false);
          setEditingContact(null);
          setContactDefaults({});
        }}
      />

      <CRMTimelineItemDialog
        open={timelineDialogOpen}
        onOpenChange={setTimelineDialogOpen}
        item={editingTimelineItem}
        defaultValues={timelineDefaults}
        pending={crm.saveTimelineItemMutation.isPending}
        onSubmit={async (values) => {
          if (!values.account_id && !values.opportunity_id) {
            notify.error("Vínculo obrigatório", "Escolha uma conta ou oportunidade para registrar este item.");
            return;
          }
          await handleMutation(
            () => crm.saveTimelineItemMutation.mutateAsync(values),
            editingTimelineItem ? "Registro atualizado" : "Registro adicionado",
            editingTimelineItem ? "O item de histórico foi atualizado." : "O item entrou na linha do tempo.",
          );
          setTimelineDialogOpen(false);
          setEditingTimelineItem(null);
          setTimelineDefaults({});
        }}
      />

      <CRMEntityDrawer
        open={Boolean(drawerTarget)}
        onOpenChange={(open) => {
          if (!open) setDrawerTarget(null);
        }}
        entity={drawerTarget ? { type: "account", account: drawerTarget.account } : null}
        contacts={filteredContactsForDrawer}
        opportunities={filteredOpportunitiesForDrawer}
        timelineItems={timelineItemsForDrawer}
        profiles={crm.profiles}
        onEditEntity={() => {
          if (!drawerTarget) return;
          setEditingAccount(drawerTarget.account);
          setAccountDialogOpen(true);
        }}
        onSyncStripe={() => {
          if (!drawerTarget) return;
          const syncState = getAccountStripeSyncState(drawerTarget.account);
          if (!syncState?.canSync) {
            notify.warning("Vínculo Stripe ausente", syncState?.missingReason || "Configure os IDs Stripe antes de sincronizar.");
            return;
          }
          void handleMutation(
            () => crm.syncAccountMutation.mutateAsync(drawerTarget.account.id),
            "Stripe sincronizada",
            "O contexto financeiro da conta foi atualizado.",
          );
        }}
        onAddTimelineItem={openTimelineDialogForCurrentEntity}
        onAddContact={() => {
          if (!drawerTarget) return;
          openContactDialogForAccount(drawerTarget.account);
        }}
        onEditTimelineItem={(item) => {
          setEditingTimelineItem(item);
          setTimelineDefaults({});
          setTimelineDialogOpen(true);
        }}
        onDeleteTimelineItem={(item) => {
          if (!window.confirm("Excluir este registro da linha do tempo?")) return;
          void handleMutation(
            () => crm.deleteTimelineItemMutation.mutateAsync(item.id),
            "Registro removido",
            "O item foi removido da linha do tempo.",
          );
        }}
        onToggleTask={(item, completed) => {
          void handleMutation(
            () => crm.completeTaskMutation.mutateAsync({ id: item.id, completed }),
            completed ? "Tarefa concluída" : "Tarefa reaberta",
            completed ? "A tarefa foi marcada como concluída." : "A tarefa voltou para a fila.",
          );
        }}
      />
    </AdminLayout>
  );
}
