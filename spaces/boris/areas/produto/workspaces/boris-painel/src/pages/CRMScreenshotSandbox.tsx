import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CRMAccountDialog } from "@/components/crm/CRMDialogs";
import {
  CRM_LEAD_SOURCE_CATEGORY_META,
  CRM_STAGE_META,
  type CRMAccount,
  type CRMAccountFormValues,
  type CRMContact,
  type CRMProfileOption,
} from "@/hooks/use-crm";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp, GripVertical, Pencil, Plus, Search } from "lucide-react";

const profiles: CRMProfileOption[] = [
  { id: "profile-1", name: "Mateus Rocha" },
  { id: "profile-2", name: "Ana Comercial" },
];

const initialAccounts: CRMAccount[] = [
  {
    id: "sandbox-account-1",
    organization_id: null,
    relationship_type: null,
    assigned_user_id: "profile-1",
    name: "Clínica Aurora",
    domain: "clinicaaurora.com.br",
    phone: "(11) 99999-1000",
    email: "contato@clinicaaurora.com.br",
    source: "Site",
    lead_source_category: "site",
    lead_source_detail: "site -> WhatsApp",
    inbound_channel: "WhatsApp",
    handoff_summary: "Lead quente vindo do CTA principal do site.",
    status: "lead",
    stage: "new_lead",
    potential_value: 2500,
    target_date: null,
    need: "Quer organizar onboarding e retenção da base de clientes.",
    next_step: "Agendar call de diagnóstico.",
    last_contact_at: "2026-03-26T14:00:00.000Z",
    next_action_at: "2026-03-28T13:00:00.000Z",
    stage_position: 1000,
    quick_notes: "Lead pediu retorno ainda esta semana.",
    stripe_customer_id: null,
    stripe_subscription_id: null,
    stripe_subscription_status: null,
    stripe_monthly_amount_cents: null,
    stripe_last_invoice_at: null,
    stripe_last_invoice_amount_cents: null,
    stripe_next_billing_at: null,
    stripe_is_delinquent: null,
    financial_context_updated_at: null,
    created_by: null,
    updated_by: null,
    created_at: "2026-03-26T14:00:00.000Z",
    updated_at: "2026-03-26T14:00:00.000Z",
    organization: null,
  },
  {
    id: "sandbox-account-2",
    organization_id: null,
    relationship_type: null,
    assigned_user_id: "profile-2",
    name: "Instituto Prisma",
    domain: "institutoprisma.com",
    phone: "(21) 98888-2000",
    email: "contato@institutoprisma.com",
    source: "Indicação",
    lead_source_category: "referral",
    lead_source_detail: "indicação de cliente atual",
    inbound_channel: "Contato direto",
    handoff_summary: "Contato veio por rede de parceiros.",
    status: "prospect",
    stage: "meeting",
    potential_value: 3800,
    target_date: null,
    need: "Precisa padronizar acompanhamento comercial.",
    next_step: "Enviar proposta revisada.",
    last_contact_at: "2026-03-25T18:00:00.000Z",
    next_action_at: "2026-03-29T15:30:00.000Z",
    stage_position: 1000,
    quick_notes: "Já conhece o produto e está comparando fornecedores.",
    stripe_customer_id: null,
    stripe_subscription_id: null,
    stripe_subscription_status: null,
    stripe_monthly_amount_cents: null,
    stripe_last_invoice_at: null,
    stripe_last_invoice_amount_cents: null,
    stripe_next_billing_at: null,
    stripe_is_delinquent: null,
    financial_context_updated_at: null,
    created_by: null,
    updated_by: null,
    created_at: "2026-03-24T10:00:00.000Z",
    updated_at: "2026-03-24T10:00:00.000Z",
    organization: null,
  },
];

const initialContacts: CRMContact[] = [
  {
    id: "sandbox-contact-1",
    account_id: "sandbox-account-1",
    organization_contact_id: null,
    first_name: "Rafael",
    last_name: "Almeida",
    email: "rafael@clinicaaurora.com.br",
    phone: "(11) 99999-1000",
    title: "CEO",
    city: "São Paulo",
    role_in_deal: "decision_maker",
    is_primary: true,
    created_by: null,
    updated_by: null,
    created_at: "2026-03-26T14:00:00.000Z",
    updated_at: "2026-03-26T14:00:00.000Z",
  },
  {
    id: "sandbox-contact-2",
    account_id: "sandbox-account-2",
    organization_contact_id: null,
    first_name: "Marina",
    last_name: "Costa",
    email: "marina@institutoprisma.com",
    phone: "(21) 98888-2000",
    title: "Operações",
    city: "Rio de Janeiro",
    role_in_deal: "champion",
    is_primary: true,
    created_by: null,
    updated_by: null,
    created_at: "2026-03-25T18:00:00.000Z",
    updated_at: "2026-03-25T18:00:00.000Z",
  },
];

function getContactFullName(contact: CRMContact | null) {
  if (!contact) return "Sem contato";
  return [contact.first_name, contact.last_name].filter(Boolean).join(" ");
}

function formatDateTime(value?: string | null) {
  if (!value) return "Sem data";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

export default function CRMScreenshotSandbox() {
  const [search, setSearch] = useState("");
  const [accounts, setAccounts] = useState(initialAccounts);
  const [contacts, setContacts] = useState(initialContacts);
  const [expandedPipelineAccountId, setExpandedPipelineAccountId] = useState<string | null>("sandbox-account-1");
  const [editingAccount, setEditingAccount] = useState<CRMAccount | null>(null);
  const [accountDialogOpen, setAccountDialogOpen] = useState(false);

  const filteredAccounts = useMemo(() => {
    const normalized = search.trim().toLocaleLowerCase("pt-BR");
    if (!normalized) return accounts;
    return accounts.filter((account) =>
      [account.name, account.email, account.phone, account.domain, account.lead_source_detail]
        .filter(Boolean)
        .some((value) => value!.toLocaleLowerCase("pt-BR").includes(normalized)),
    );
  }, [accounts, search]);

  const pipelineColumns = useMemo(
    () => ["new_lead", "meeting", "customer", "lost"].map((stage) => ({
      stage,
      items: filteredAccounts.filter((account) => account.stage === stage),
    })),
    [filteredAccounts],
  );

  const organizationOptions = useMemo(() => [], []);

  const handleSaveAccount = async (values: CRMAccountFormValues) => {
    if (values.id) {
      setAccounts((current) =>
        current.map((account) =>
          account.id === values.id
            ? {
                ...account,
                ...values,
                updated_at: new Date().toISOString(),
              }
            : account,
        ),
      );
      return;
    }

    const id = `sandbox-account-${Date.now()}`;
    const createdAt = new Date().toISOString();
    setAccounts((current) => [
      {
        id,
        organization_id: values.organization_id ?? null,
        relationship_type: null,
        assigned_user_id: values.assigned_user_id ?? null,
        name: values.name,
        domain: values.domain ?? null,
        phone: values.phone ?? null,
        email: values.email ?? null,
        source: values.source ?? null,
        lead_source_category: values.lead_source_category ?? null,
        lead_source_detail: values.lead_source_detail ?? null,
        inbound_channel: values.inbound_channel ?? null,
        handoff_summary: values.handoff_summary ?? null,
        status: values.status,
        stage: values.stage,
        potential_value: values.potential_value ?? null,
        target_date: values.target_date ?? null,
        need: values.need ?? null,
        next_step: values.next_step ?? null,
        last_contact_at: values.last_contact_at ?? null,
        next_action_at: values.next_action_at ?? null,
        stage_position: values.stage_position ?? 1000,
        quick_notes: values.quick_notes ?? null,
        stripe_customer_id: null,
        stripe_subscription_id: null,
        stripe_subscription_status: null,
        stripe_monthly_amount_cents: null,
        stripe_last_invoice_at: null,
        stripe_last_invoice_amount_cents: null,
        stripe_next_billing_at: null,
        stripe_is_delinquent: null,
        financial_context_updated_at: null,
        created_by: null,
        updated_by: null,
        created_at: createdAt,
        updated_at: createdAt,
        organization: null,
      },
      ...current,
    ]);
  };

  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <div className="mx-auto flex min-h-screen max-w-[1680px] flex-col gap-6 px-6 py-6">
        <header className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="text-sm font-medium uppercase tracking-[0.14em] text-sky-700">Sandbox visual</p>
              <h1 className="text-3xl font-semibold tracking-[-0.03em]">CRM Pipeline</h1>
              <p className="max-w-2xl text-sm text-slate-600">
                Ambiente local para screenshots do pipeline, card expandido e modal de edicao usando os mesmos componentes do CRM.
              </p>
            </div>
            <Button
              className="border border-sky-600 bg-sky-600 text-white shadow-none hover:bg-sky-700"
              onClick={() => {
                setEditingAccount(null);
                setAccountDialogOpen(true);
              }}
              data-testid="crm-new-lead-button"
            >
              <Plus className="mr-2 h-4 w-4" />
              Novo lead
            </Button>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <div className="relative min-w-[320px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sky-600/70" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar no pipeline sandbox..."
                className="border-sky-200 bg-white/95 pl-9 shadow-sm placeholder:text-slate-400 focus-visible:border-sky-400 focus-visible:ring-sky-400/30"
              />
            </div>
            <Badge variant="outline" className="border-sky-200 bg-sky-50 text-sky-900">
              {filteredAccounts.length} conta(s)
            </Badge>
          </div>
        </header>

        <section className="rounded-[28px] border border-slate-200 bg-white p-3 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3 px-1">
            <div>
              <p className="text-sm font-semibold text-sky-950">Pipeline</p>
              <p className="text-xs text-sky-700/70">Leitura rapida por etapa.</p>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
            {pipelineColumns.map((column) => (
              <section
                key={column.stage}
                className="flex min-w-0 h-[calc(100vh-20rem)] min-h-[26rem] max-h-[44rem] flex-col rounded-[var(--radius-lg)] border border-slate-200 bg-slate-50/60 shadow-sm"
              >
                <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-3.5 py-2.5">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{CRM_STAGE_META[column.stage as keyof typeof CRM_STAGE_META].label}</p>
                    <p className="text-[11px] text-slate-500">{column.items.length} contas</p>
                  </div>
                  <span className="text-[11px] font-medium text-slate-400">{CRM_STAGE_META[column.stage as keyof typeof CRM_STAGE_META].shortLabel}</span>
                </div>

                <ScrollArea className="min-w-0 flex-1">
                  <div className="flex min-w-0 flex-col gap-2.5 p-2.5">
                    {column.items.length === 0 ? (
                      <div className="flex min-h-[160px] items-center justify-center rounded-[var(--radius-md)] border border-dashed border-slate-200 bg-white p-4 text-center text-sm text-slate-500">
                        Nenhuma conta nesta etapa.
                      </div>
                    ) : (
                      column.items.map((account) => {
                        const contact =
                          contacts.find((item) => item.account_id === account.id && item.is_primary) ??
                          contacts.find((item) => item.account_id === account.id) ??
                          null;
                        const isExpanded = expandedPipelineAccountId === account.id;

                        return (
                          <article
                            key={account.id}
                            data-testid="crm-pipeline-card"
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
                                      {getContactFullName(contact)}
                                    </p>
                                    {(account.lead_source_detail || account.inbound_channel || account.source) ? (
                                      <p className="mt-1 truncate text-[11px] text-slate-500">
                                        {account.lead_source_detail || account.inbound_channel || account.source}
                                      </p>
                                    ) : null}
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
                                  <Badge variant="outline" className={cn("border border-slate-200 bg-slate-50 text-slate-700")}>
                                    Lead
                                  </Badge>
                                  {account.lead_source_category ? (
                                    <Badge variant="outline" className="border border-slate-200 bg-slate-50 text-slate-700">
                                      {CRM_LEAD_SOURCE_CATEGORY_META[account.lead_source_category].label}
                                    </Badge>
                                  ) : null}
                                </div>
                              </div>
                            </div>

                            {isExpanded ? (
                              <>
                                <div className="grid min-w-0 gap-1.5 rounded-2xl border border-slate-200 bg-slate-50/70 p-2">
                                  <div className="grid min-w-0 gap-1.5 grid-cols-2">
                                    <div className="min-w-0 rounded-2xl bg-white px-2.5 py-1.5">
                                      <p className="text-[10px] uppercase tracking-[0.08em] text-slate-500">Próxima ação</p>
                                      <p className="mt-1 truncate text-sm font-semibold text-slate-950">{formatDateTime(account.next_action_at)}</p>
                                    </div>
                                    <div className="min-w-0 rounded-2xl bg-white px-2.5 py-1.5">
                                      <p className="text-[10px] uppercase tracking-[0.08em] text-slate-500">Canal</p>
                                      <p className="mt-1 truncate text-sm font-semibold text-slate-950">{account.inbound_channel || "Sem canal"}</p>
                                    </div>
                                  </div>
                                </div>

                                <div className="mt-2.5 flex min-w-0 items-center justify-end gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label={`Editar ${account.name}`}
                                    className="h-8 w-8 rounded-full bg-white text-sky-700 hover:bg-sky-50"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      setEditingAccount(account);
                                      setAccountDialogOpen(true);
                                    }}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
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
        </section>
      </div>

      <CRMAccountDialog
        open={accountDialogOpen}
        onOpenChange={setAccountDialogOpen}
        account={editingAccount}
        organizations={organizationOptions}
        profiles={profiles}
        pending={false}
        onSubmit={async (values) => {
          await handleSaveAccount(values);
          setAccountDialogOpen(false);
          setEditingAccount(null);
        }}
      />
    </main>
  );
}
