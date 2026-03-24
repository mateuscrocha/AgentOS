import { useMemo, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { AdminPageHeader } from "@/components/layout/AdminPageHeader";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { BorisTable } from "@/components/ui/boris-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { notify } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import { getStripeFrontendConfig } from "@/lib/stripe-config";
import { useAuth } from "@/hooks/use-auth";
import { useUserRoles } from "@/hooks/use-user-roles";
import {
  CRM_ACCOUNT_STATUS_META,
  CRM_STAGE_META,
  CRM_TASK_TYPE_META,
  getAccountFinanceSummary,
  getAccountStripeSyncState,
  getContactFullName,
  type CRMAccount,
  type CRMContact,
  type CRMOpportunity,
  type CRMTimelineItem,
  useCRM,
} from "@/hooks/use-crm";
import { CRMAccountDialog, CRMContactDialog, CRMOpportunityDialog, CRMTimelineItemDialog } from "@/components/crm/CRMDialogs";
import { CRMEntityDrawer } from "@/components/crm/CRMEntityDrawer";
import AccessDenied from "./AccessDenied";
import {
  ArrowRightLeft,
  BriefcaseBusiness,
  Building2,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  Coins,
  ContactRound,
  FileText,
  GripVertical,
  Info,
  ListTodo,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  UserCircle2,
} from "lucide-react";

type Section = "pipeline" | "companies" | "contacts" | "tasks";
type DrawerTarget =
  | { type: "account"; account: CRMAccount }
  | { type: "opportunity"; opportunity: CRMOpportunity; account: CRMAccount | null }
  | null;

const sectionMeta: Array<{ id: Section; label: string; href: string }> = [
  { id: "pipeline", label: "Pipeline", href: "/system/crm/pipeline" },
  { id: "companies", label: "Contas", href: "/system/crm/companies" },
  { id: "contacts", label: "Contatos", href: "/system/crm/contacts" },
  { id: "tasks", label: "Tarefas", href: "/system/crm/tasks" },
];

const crmKpiCardClassName =
  "border-sky-200/70 bg-gradient-to-br from-sky-50 via-white to-cyan-50/70 shadow-[0_16px_40px_-24px_rgba(14,165,233,0.45)]";
const crmKpiTitleClassName = "text-sky-700/80";
const crmKpiValueClassName = "text-sky-950";
const crmKpiIconContainerClassName = "border-sky-200 bg-sky-100 shadow-[0_12px_24px_-18px_rgba(14,165,233,0.9)]";
const crmKpiIconClassName = "text-sky-700";
const crmIconButtonClassName =
  "text-sky-700 hover:bg-sky-50 hover:text-sky-900 disabled:text-slate-400 disabled:hover:bg-transparent";
const crmIconClassName = "h-4 w-4 text-sky-700";

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

function getAccountLifecycleMeta(account: CRMAccount) {
  if (!account.organization_id) {
    return {
      label: "Lead",
      description: "Lead do CRM",
      className: "border-slate-200 bg-slate-50 text-slate-700",
    };
  }

  if (account.relationship_type === "partner") {
    return {
      label: "Parceiro",
      description: "Cliente real",
      className: "border-violet-200 bg-violet-50 text-violet-700",
    };
  }

  if (account.relationship_type === "courtesy") {
    return {
      label: "Cortesia",
      description: "Cliente real",
      className: "border-cyan-200 bg-cyan-50 text-cyan-700",
    };
  }

  if (account.relationship_type === "internal") {
    return {
      label: "Interno",
      description: "Cliente real",
      className: "border-zinc-200 bg-zinc-100 text-zinc-700",
    };
  }

  if (account.relationship_type === "demo") {
    return {
      label: "Demo",
      description: "Cliente real",
      className: "border-sky-200 bg-sky-50 text-sky-700",
    };
  }

  if (account.relationship_type === "trial") {
    return {
      label: "Teste / trial",
      description: "Cliente real",
      className: "border-amber-200 bg-amber-50 text-amber-700",
    };
  }

  if (account.stripe_subscription_status === "active" || account.stripe_subscription_status === "trialing") {
    return {
      label: "Cliente ativo",
      description: "Cliente real",
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    };
  }

  if (account.stripe_subscription_status === "past_due" || account.stripe_subscription_status === "unpaid") {
    return {
      label: "Inadimplente",
      description: "Cliente real",
      className: "border-rose-200 bg-rose-50 text-rose-700",
    };
  }

  if (account.stripe_subscription_status === "canceled" || account.status === "inactive") {
    return {
      label: "Ex-cliente",
      description: "Cliente real",
      className: "border-amber-200 bg-amber-50 text-amber-700",
    };
  }

  return {
    label: "Cliente",
    description: "Cliente real",
    className: "border-sky-200 bg-sky-50 text-sky-700",
  };
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
  const stripeFrontend = getStripeFrontendConfig();

  const [search, setSearch] = useState("");
  const [draggedOpportunityId, setDraggedOpportunityId] = useState<string | null>(null);

  const [accountDialogOpen, setAccountDialogOpen] = useState(false);
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [opportunityDialogOpen, setOpportunityDialogOpen] = useState(false);
  const [timelineDialogOpen, setTimelineDialogOpen] = useState(false);

  const [editingAccount, setEditingAccount] = useState<CRMAccount | null>(null);
  const [editingContact, setEditingContact] = useState<CRMContact | null>(null);
  const [editingOpportunity, setEditingOpportunity] = useState<CRMOpportunity | null>(null);
  const [editingTimelineItem, setEditingTimelineItem] = useState<CRMTimelineItem | null>(null);
  const [timelineDefaults, setTimelineDefaults] = useState<Partial<CRMTimelineItem>>({});

  const [drawerTarget, setDrawerTarget] = useState<DrawerTarget>(null);

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
    : drawerTarget?.type === "opportunity"
      ? crm.contacts.filter((contact) => contact.account_id === drawerTarget.opportunity.account_id)
      : [];
  const filteredOpportunitiesForDrawer = drawerTarget?.type === "account"
    ? crm.opportunities.filter((opportunity) => opportunity.account_id === drawerTarget.account.id)
    : drawerTarget?.type === "opportunity"
      ? crm.opportunities.filter((item) => item.account_id === drawerTarget.opportunity.account_id)
      : [];
  const timelineItemsForDrawer = drawerTarget?.type === "account"
    ? crm.timelineByEntity.accountMap.get(drawerTarget.account.id) ?? []
    : drawerTarget?.type === "opportunity"
      ? crm.timelineByEntity.opportunityMap.get(drawerTarget.opportunity.id) ?? []
      : [];

  const normalizedSearch = search.trim().toLocaleLowerCase("pt-BR");

  const filteredAccounts = useMemo(() => {
    if (!normalizedSearch) return crm.accounts;
    return crm.accounts.filter((account) => {
      const contacts = crm.contactsByAccountId.get(account.id) ?? [];
      return [
        account.name,
        account.domain,
        account.email,
        account.phone,
        account.source,
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

  const filteredOpportunities = useMemo(() => {
    if (!normalizedSearch) return crm.opportunities;
    return crm.opportunities.filter((opportunity) => {
      const account = crm.accountById.get(opportunity.account_id);
      const contact = opportunity.contact_id ? crm.contactById.get(opportunity.contact_id) : null;
      return [
        opportunity.name,
        opportunity.source,
        opportunity.need,
        opportunity.next_step,
        opportunity.notes,
        account?.name,
        contact ? getContactFullName(contact) : null,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase("pt-BR").includes(normalizedSearch));
    });
  }, [crm.accountById, crm.contactById, crm.opportunities, normalizedSearch]);

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
      (Object.keys(CRM_STAGE_META) as Array<keyof typeof CRM_STAGE_META>).map((stage) => ({
        stage,
        items: filteredOpportunities
          .filter((item) => item.stage === stage)
          .sort((left, right) => left.stage_position - right.stage_position || left.updated_at.localeCompare(right.updated_at)),
      })),
    [filteredOpportunities],
  );
  const stripeOverview = useMemo(() => {
    const states = crm.accounts.map(getAccountStripeSyncState);
    return {
      missingCount: states.filter((item) => !item.canSync).length,
      linkedByOrganizationCount: states.filter((item) => !item.hasDirectIds && item.hasOrganizationIds).length,
    };
  }, [crm.accounts]);

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
  const openOpportunityDrawer = (opportunity: CRMOpportunity) =>
    setDrawerTarget({
      type: "opportunity",
      opportunity,
      account: crm.accountById.get(opportunity.account_id) ?? null,
    });

  const openTimelineDialogForCurrentEntity = (itemType: "note" | "task" | "next_step" = "note") => {
    if (!drawerTarget) return;
    setEditingTimelineItem(null);
    setTimelineDefaults(
      drawerTarget.type === "account"
        ? { account_id: drawerTarget.account.id, item_type: itemType }
        : { opportunity_id: drawerTarget.opportunity.id, account_id: drawerTarget.opportunity.account_id, item_type: itemType },
    );
    setTimelineDialogOpen(true);
  };

  const pageActions = (
    <div className="flex flex-wrap gap-2">
      {section === "pipeline" ? (
        <Button
          className="border border-sky-600 bg-sky-600 text-white shadow-[0_14px_30px_-18px_rgba(2,132,199,0.85)] hover:bg-sky-700"
          onClick={() => { setEditingOpportunity(null); setOpportunityDialogOpen(true); }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Nova oportunidade
        </Button>
      ) : null}
      {section === "companies" ? (
        <Button
          className="border border-sky-600 bg-sky-600 text-white shadow-[0_14px_30px_-18px_rgba(2,132,199,0.85)] hover:bg-sky-700"
          onClick={() => { setEditingAccount(null); setAccountDialogOpen(true); }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Nova conta
        </Button>
      ) : null}
      {section === "contacts" ? (
        <Button
          className="border border-sky-600 bg-sky-600 text-white shadow-[0_14px_30px_-18px_rgba(2,132,199,0.85)] hover:bg-sky-700"
          onClick={() => { setEditingContact(null); setContactDialogOpen(true); }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Novo contato
        </Button>
      ) : null}
      {section === "tasks" ? (
        <Button
          className="border border-sky-600 bg-sky-600 text-white shadow-[0_14px_30px_-18px_rgba(2,132,199,0.85)] hover:bg-sky-700"
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
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <p className="truncate text-xs text-muted-foreground">{account.domain || account.email || "Sem domínio"}</p>
            <Badge variant="outline" className={cn("border", getAccountLifecycleMeta(account).className)}>
              {getAccountLifecycleMeta(account).description}
            </Badge>
          </div>
        </div>
      ),
    },
    {
      key: "type",
      header: "Tipo",
      render: (account: CRMAccount) => {
        const meta = getAccountLifecycleMeta(account);
        return (
          <Badge variant="outline" className={cn("border", meta.className)}>
            {meta.label}
          </Badge>
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
      header: "Status",
      render: (account: CRMAccount) => (
        <Badge variant="outline" className={cn("border", CRM_ACCOUNT_STATUS_META[account.status].tone)}>
          {CRM_ACCOUNT_STATUS_META[account.status].label}
        </Badge>
      ),
    },
    {
      key: "source",
      header: "Origem",
      hideOn: "md" as const,
      render: (account: CRMAccount) => <span className="text-sm text-muted-foreground">{account.source || "Sem origem"}</span>,
    },
    {
      key: "financial",
      header: "Financeiro",
      hideOn: "lg" as const,
      render: (account: CRMAccount) => {
        const finance = getAccountFinanceSummary(account);
        const syncState = getAccountStripeSyncState(account);
        return (
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">{finance?.label || "Sem sync"}</p>
            <p className="truncate text-xs text-muted-foreground">{syncState.sourceLabel}</p>
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
      render: (contact: CRMContact) => <span className="text-sm text-card-foreground">{crm.accountById.get(contact.account_id)?.name || "Conta removida"}</span>,
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
              const opportunity = item.opportunity_id ? crm.opportunities.find((candidate) => candidate.id === item.opportunity_id) ?? null : null;
              if (opportunity) {
                openOpportunityDrawer(opportunity);
                return;
              }
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
              title="Oportunidades abertas"
              value={crm.metrics.openOpportunities}
              icon={BriefcaseBusiness}
              variant="kpi"
              className={crmKpiCardClassName}
              titleClassName={crmKpiTitleClassName}
              valueClassName={crmKpiValueClassName}
              iconContainerClassName={crmKpiIconContainerClassName}
              iconClassName={crmKpiIconClassName}
            />
            <StatsCard
              title="Pipeline potencial"
              value={formatCurrency(crm.metrics.totalPipelineValue)}
              icon={CircleDollarSign}
              variant="kpi"
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
              variant="kpi"
              className={crmKpiCardClassName}
              titleClassName={crmKpiTitleClassName}
              valueClassName={crmKpiValueClassName}
              iconContainerClassName={crmKpiIconContainerClassName}
              iconClassName={crmKpiIconClassName}
            />
            <StatsCard
              title="Clientes na carteira"
              value={crm.metrics.customers}
              icon={Building2}
              variant="kpi"
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
                className="border-sky-200 bg-white/90 pl-9 shadow-[0_10px_24px_-20px_rgba(14,165,233,0.7)] placeholder:text-slate-400 focus-visible:border-sky-400 focus-visible:ring-sky-400/30"
              />
            </div>
          </>
        }
      />

      <div className="mb-4 rounded-[var(--radius-lg)] border border-sky-200/80 bg-gradient-to-r from-sky-50 via-cyan-50/80 to-white px-4 py-3 text-sm text-sky-900 shadow-[0_18px_40px_-28px_rgba(14,165,233,0.55)]">
        O CRM agora separa claramente duas coisas: leads que vivem só no CRM e clientes reais que nascem em `organizations` e carregam seu contexto Stripe junto.
      </div>

      <div className="mb-4 space-y-3">
        <Alert className={cn(
          "text-sky-950",
          stripeFrontend.isConfigured
            ? "border-emerald-200/80 bg-emerald-50/80"
            : "border-amber-200/80 bg-amber-50/80 text-amber-950",
        )}>
          <Info className="h-4 w-4" />
          <AlertTitle>
            {stripeFrontend.isConfigured ? "Stripe de frontend configurada" : "Stripe de frontend pendente"}
          </AlertTitle>
          <AlertDescription>
            {stripeFrontend.isConfigured
              ? `O painel já reconhece \`VITE_STRIPE_PUBLISHABLE_KEY\` (${stripeFrontend.maskedKey}, modo ${stripeFrontend.mode}).`
              : "Defina `VITE_STRIPE_PUBLISHABLE_KEY` para habilitar fluxos de frontend que dependem da Stripe neste ambiente."}
          </AlertDescription>
        </Alert>
        {stripeOverview.missingCount > 0 ? (
          <Alert className="border-amber-200/80 bg-amber-50/80 text-amber-950">
            <Info className="h-4 w-4" />
            <AlertTitle>Contas sem vínculo Stripe</AlertTitle>
            <AlertDescription>
              {stripeOverview.missingCount} conta(s) ainda precisam de `stripe_customer_id`, `stripe_subscription_id` ou vínculo com organização que já tenha billing preenchido.
            </AlertDescription>
          </Alert>
        ) : null}
        {stripeOverview.linkedByOrganizationCount > 0 ? (
          <Alert className="border-sky-200/80 bg-sky-50/70 text-sky-950">
            <Info className="h-4 w-4" />
            <AlertTitle>Sync herdado da organização</AlertTitle>
            <AlertDescription>
              {stripeOverview.linkedByOrganizationCount} conta(s) estão usando os IDs Stripe da organização vinculada.
            </AlertDescription>
          </Alert>
        ) : null}
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {sectionMeta.map((item) => (
          <NavLink
            key={item.id}
            to={item.href}
            className={({ isActive }) =>
              cn(
                "inline-flex items-center rounded-full border px-4 py-2 text-sm font-medium transition-all",
                isActive
                  ? "border-sky-600 bg-sky-600 text-white shadow-[0_14px_30px_-18px_rgba(2,132,199,0.9)]"
                  : "border-sky-200 bg-white/90 text-sky-800 hover:border-sky-400 hover:bg-sky-50 hover:text-sky-900",
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
            <div className="grid gap-4 xl:grid-cols-6">
              {pipelineColumns.map((column) => (
                <section
                  key={column.stage}
                  className="flex min-h-[420px] flex-col rounded-[var(--radius-lg)] border border-sky-200/70 bg-gradient-to-b from-sky-50/95 via-white to-cyan-50/35 shadow-[0_20px_45px_-30px_rgba(14,165,233,0.45)]"
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => {
                    if (!draggedOpportunityId) return;
                    const nextPosition = (crm.opportunities.filter((item) => item.stage === column.stage).length + 1) * 1000;
                    void handleMutation(
                      () => crm.moveOpportunityMutation.mutateAsync({ id: draggedOpportunityId, stage: column.stage, stagePosition: nextPosition }),
                      "Etapa atualizada",
                      `Oportunidade movida para ${CRM_STAGE_META[column.stage].label}.`,
                    );
                    setDraggedOpportunityId(null);
                  }}
                >
                  <div className="flex items-center justify-between gap-3 border-b border-sky-100 px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-sky-950">{CRM_STAGE_META[column.stage].label}</p>
                      <p className="text-xs text-sky-700/70">{column.items.length} oportunidade(s)</p>
                    </div>
                    <Badge variant="outline" className={cn("border", CRM_STAGE_META[column.stage].tone)}>
                      {CRM_STAGE_META[column.stage].shortLabel}
                    </Badge>
                  </div>

                  <div className="flex flex-1 flex-col gap-3 p-3">
                    {column.items.length === 0 ? (
                      <div className="flex flex-1 items-center justify-center rounded-[var(--radius-md)] border border-dashed border-sky-200 bg-sky-50/60 p-4 text-center text-sm text-sky-800/75">
                        Solte aqui ou crie uma nova oportunidade nesta etapa.
                      </div>
                    ) : (
                      column.items.map((opportunity) => {
                        const account = crm.accountById.get(opportunity.account_id) ?? null;
                        const contact = opportunity.contact_id ? crm.contactById.get(opportunity.contact_id) ?? null : null;
                        const finance = account ? getAccountFinanceSummary(account) : null;
                        return (
                          <article
                            key={opportunity.id}
                            draggable
                            onDragStart={() => setDraggedOpportunityId(opportunity.id)}
                            onDragEnd={() => setDraggedOpportunityId(null)}
                            className="rounded-[var(--radius-lg)] border border-sky-100 bg-white/95 p-3 shadow-[0_16px_30px_-24px_rgba(14,165,233,0.5)] transition-all hover:border-sky-300 hover:shadow-[0_18px_38px_-24px_rgba(14,165,233,0.55)]"
                          >
                            <div className="mb-2 flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-slate-950">{opportunity.name}</p>
                                <p className="truncate text-xs text-muted-foreground">{account?.name || "Sem conta vinculada"}</p>
                              </div>
                              <GripVertical className="h-4 w-4 shrink-0 text-sky-400" />
                            </div>

                            <div className="space-y-2 text-sm">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-muted-foreground">Contato</span>
                                <span className="truncate font-medium text-foreground">{contact ? getContactFullName(contact) : "Sem contato"}</span>
                              </div>
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-muted-foreground">Status</span>
                                <Badge variant="outline" className={cn("border", CRM_STAGE_META[opportunity.stage].tone)}>
                                  {CRM_STAGE_META[opportunity.stage].shortLabel}
                                </Badge>
                              </div>
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-muted-foreground">Valor</span>
                                <span className="font-medium text-foreground">{formatCurrency(opportunity.potential_value)}</span>
                              </div>
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-muted-foreground">Próxima ação</span>
                                <span className="text-right font-medium text-foreground">{formatDateTime(opportunity.next_action_at || opportunity.last_contact_at)}</span>
                              </div>
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-muted-foreground">Financeiro</span>
                                <span className="text-right font-medium text-foreground">{finance?.label || "Sem sync"}</span>
                              </div>
                            </div>

                            <Separator className="my-3 bg-sky-100" />

                            <div className="flex justify-between gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="border-sky-200 bg-sky-50 text-sky-900 hover:bg-sky-100 hover:text-sky-950"
                                onClick={() => openOpportunityDrawer(opportunity)}
                              >
                                Contexto
                              </Button>
                              <div className="flex gap-2">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className={crmIconButtonClassName}
                                  onClick={() => { setEditingOpportunity(opportunity); setOpportunityDialogOpen(true); }}
                                >
                                  <Pencil className={crmIconClassName} />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    if (!window.confirm(`Excluir ${opportunity.name}?`)) return;
                                    void handleMutation(
                                      () => crm.deleteOpportunityMutation.mutateAsync(opportunity.id),
                                      "Oportunidade excluída",
                                      "A oportunidade foi removida do pipeline.",
                                    );
                                  }}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            </div>
                          </article>
                        );
                      })
                    )}
                  </div>
                </section>
              ))}
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
        onSubmit={async (values) => {
          await handleMutation(
            () => crm.saveContactMutation.mutateAsync(values),
            editingContact ? "Contato atualizado" : "Contato criado",
            editingContact ? "As alterações do contato foram salvas." : "O contato foi adicionado ao CRM.",
          );
          setContactDialogOpen(false);
          setEditingContact(null);
        }}
      />

      <CRMOpportunityDialog
        open={opportunityDialogOpen}
        onOpenChange={setOpportunityDialogOpen}
        opportunity={editingOpportunity}
        accountOptions={accountOptions}
        contactOptions={crm.contacts.map((contact) => ({
          id: contact.id,
          label: `${getContactFullName(contact)} • ${crm.accountById.get(contact.account_id)?.name || "Sem conta"}`,
        }))}
        profiles={crm.profiles}
        pending={crm.saveOpportunityMutation.isPending}
        onSubmit={async (values) => {
          await handleMutation(
            () => crm.saveOpportunityMutation.mutateAsync(values),
            editingOpportunity ? "Oportunidade atualizada" : "Oportunidade criada",
            editingOpportunity ? "A oportunidade foi atualizada." : "A nova oportunidade entrou no pipeline.",
          );
          setOpportunityDialogOpen(false);
          setEditingOpportunity(null);
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
        entity={drawerTarget ? (
          drawerTarget.type === "account"
            ? { type: "account", account: drawerTarget.account }
            : { type: "opportunity", opportunity: drawerTarget.opportunity, account: drawerTarget.account }
        ) : null}
        contacts={filteredContactsForDrawer}
        opportunities={filteredOpportunitiesForDrawer}
        timelineItems={timelineItemsForDrawer}
        profiles={crm.profiles}
        onEditEntity={() => {
          if (!drawerTarget) return;
          if (drawerTarget.type === "account") {
            setEditingAccount(drawerTarget.account);
            setAccountDialogOpen(true);
            return;
          }
          setEditingOpportunity(drawerTarget.opportunity);
          setOpportunityDialogOpen(true);
        }}
        onSyncStripe={() => {
          if (!drawerTarget) return;
          const account = drawerTarget.type === "account" ? drawerTarget.account : drawerTarget.account;
          const syncState = account ? getAccountStripeSyncState(account) : null;
          if (!syncState?.canSync) {
            notify.warning("Vínculo Stripe ausente", syncState?.missingReason || "Configure os IDs Stripe antes de sincronizar.");
            return;
          }
          const crmAccountId = drawerTarget.type === "account" ? drawerTarget.account.id : drawerTarget.opportunity.account_id;
          void handleMutation(
            () => crm.syncAccountMutation.mutateAsync(crmAccountId),
            "Stripe sincronizada",
            "O contexto financeiro da conta foi atualizado.",
          );
        }}
        onAddTimelineItem={openTimelineDialogForCurrentEntity}
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
