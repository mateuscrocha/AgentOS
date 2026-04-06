import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  CRM_ACCOUNT_STATUS_META,
  CRM_DEAL_CONTACT_ROLE_META,
  CRM_LEAD_SOURCE_CATEGORY_META,
  CRM_STAGE_META,
  CRM_TASK_TYPE_META,
  getAccountFinanceSummary,
  getAccountMonthlyValue,
  getAccountStripeSyncState,
  getContactFullName,
  type CRMAccount,
  type CRMContact,
  type CRMProfileOption,
  type CRMTimelineItem,
} from "@/hooks/use-crm";
import { cn } from "@/lib/utils";
import { Building2, CalendarClock, CheckCircle2, Circle, Coins, FileText, ListTodo, Pencil, Plus, RefreshCw, Trash2, UserCircle2 } from "lucide-react";

type EntityTarget = { type: "account"; account: CRMAccount };

function formatDateTime(value?: string | null) {
  if (!value) return "Sem data";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatCurrency(value?: number | null) {
  if (value == null) return "Sem valor";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export function CRMEntityDrawer({
  open,
  onOpenChange,
  entity,
  contacts,
  opportunities,
  timelineItems,
  profiles,
  onEditEntity,
  onSyncStripe,
  onAddContact,
  onAddTimelineItem,
  onEditTimelineItem,
  onDeleteTimelineItem,
  onToggleTask,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entity: EntityTarget | null;
  contacts: CRMContact[];
  opportunities: CRMOpportunity[];
  timelineItems: CRMTimelineItem[];
  profiles: CRMProfileOption[];
  onEditEntity: () => void;
  onSyncStripe: () => void;
  onAddContact: () => void;
  onAddTimelineItem: (itemType?: "note" | "task" | "next_step") => void;
  onEditTimelineItem: (item: CRMTimelineItem) => void;
  onDeleteTimelineItem: (item: CRMTimelineItem) => void;
  onToggleTask: (item: CRMTimelineItem, completed: boolean) => void;
}) {
  const profileNameById = new Map(profiles.map((profile) => [profile.id, profile.name || "Sem nome"]));

  const account = entity?.account ?? null;
  const finance = account ? getAccountFinanceSummary(account) : null;
  const monthlyValue = account ? getAccountMonthlyValue(account) : null;
  const stripeSync = account ? getAccountStripeSyncState(account) : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-hidden p-0 sm:max-w-2xl">
        {!entity ? null : (
          <>
            <SheetHeader className="border-b border-border/80 px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                  <SheetTitle className="text-xl">
                    {entity.account.name}
                  </SheetTitle>
                  <SheetDescription>
                    {"Contexto comercial da conta, com histórico, pessoas e leitura operacional do cliente."}
                  </SheetDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={onSyncStripe} disabled={!stripeSync?.canSync}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Sync Stripe
                  </Button>
                  <Button variant="outline" size="sm" onClick={onEditEntity}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Editar
                  </Button>
                </div>
              </div>
            </SheetHeader>

            <ScrollArea className="h-[calc(100vh-92px)]">
              <div className="space-y-6 px-6 py-5">
                <section className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[var(--radius-lg)] border border-border/80 bg-card p-4 shadow-subtle">
                    <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                      <Building2 className="h-4 w-4 text-primary" />
                      Conta comercial
                    </div>
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <p className="font-medium text-foreground">{account?.name ?? "Sem conta"}</p>
                      <p>{account?.domain || "Sem domínio"}</p>
                      <p>{account?.email || "Sem email"}</p>
                      <p>{account?.phone || "Sem telefone"}</p>
                      <p>{account?.lead_source_detail || account?.source || "Sem origem detalhada"}</p>
                      {account ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className={cn("mt-1 border", CRM_STAGE_META[account.stage].tone)}>
                            {CRM_STAGE_META[account.stage].label}
                          </Badge>
                          <Badge variant="outline" className={cn("mt-1 border", CRM_ACCOUNT_STATUS_META[account.status].tone)}>
                            {CRM_ACCOUNT_STATUS_META[account.status].label}
                          </Badge>
                          {account.lead_source_category ? (
                            <Badge variant="outline">
                              {CRM_LEAD_SOURCE_CATEGORY_META[account.lead_source_category].label}
                            </Badge>
                          ) : null}
                          {account.organization_id ? <Badge variant="outline">Cliente real</Badge> : <Badge variant="outline">Lead do CRM</Badge>}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="rounded-[var(--radius-lg)] border border-border/80 bg-card p-4 shadow-subtle">
                    <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                      <Coins className="h-4 w-4 text-primary" />
                      Financeiro Stripe
                    </div>
                    <div className="space-y-2 text-sm text-muted-foreground">
                      {finance ? (
                        <>
                          <Badge
                            variant="outline"
                            className={cn(
                              "w-fit border",
                              finance.tone === "success" && "border-emerald-200 bg-emerald-50 text-emerald-700",
                              finance.tone === "warning" && "border-amber-200 bg-amber-50 text-amber-700",
                              finance.tone === "destructive" && "border-rose-200 bg-rose-50 text-rose-700",
                              finance.tone === "muted" && "border-slate-200 bg-slate-50 text-slate-700",
                            )}
                          >
                            {finance.label}
                          </Badge>
                          <p>Mensalidade: {formatCurrency(monthlyValue)}</p>
                          <p>Última cobrança: {finance.lastChargeAt ? formatDateTime(finance.lastChargeAt) : "Sem sync ainda"}</p>
                          <p>Valor: {finance.amountCents != null ? formatCurrency(finance.amountCents / 100) : "Sem sync ainda"}</p>
                          <p>Vencimento: {finance.nextBillingAt ? formatDateTime(finance.nextBillingAt) : "Sem data"}</p>
                          <p>{finance.isDelinquent ? "Cliente inadimplente" : "Sem inadimplência sinalizada"}</p>
                          <p>{stripeSync?.sourceLabel}</p>
                          <p>Último sync: {stripeSync?.lastSyncedAt ? formatDateTime(stripeSync.lastSyncedAt) : "Ainda não sincronizado"}</p>
                        </>
                      ) : (
                        <>
                          <p>Sem contexto financeiro sincronizado ainda.</p>
                          <p>{stripeSync?.sourceLabel}</p>
                          {stripeSync?.missingReason ? <p>{stripeSync.missingReason}</p> : null}
                        </>
                      )}
                    </div>
                  </div>

                  {account ? (
                    <div className="rounded-[var(--radius-lg)] border border-border/80 bg-card p-4 shadow-subtle sm:col-span-2">
                      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                        <FileText className="h-4 w-4 text-primary" />
                        Contexto comercial
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <div>
                          <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Etapa</p>
                          <Badge variant="outline" className={cn("mt-1 border", CRM_STAGE_META[account.stage].tone)}>
                            {CRM_STAGE_META[account.stage].label}
                          </Badge>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Mensalidade</p>
                          <p className="mt-1 text-sm font-medium text-foreground">{formatCurrency(monthlyValue)}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Data alvo</p>
                          <p className="mt-1 text-sm font-medium text-foreground">{account.target_date || "Sem data"}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Responsável</p>
                          <p className="mt-1 text-sm font-medium text-foreground">{account.assigned_user_id ? profileNameById.get(account.assigned_user_id) : "Sem responsável"}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Canal de entrada</p>
                          <p className="mt-1 text-sm font-medium text-foreground">{account.inbound_channel || "Sem canal"}</p>
                        </div>
                      </div>
                      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <div>
                          <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Último contato</p>
                          <p className="mt-1 text-sm font-medium text-foreground">{formatDateTime(account.last_contact_at)}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Próxima ação</p>
                          <p className="mt-1 text-sm font-medium text-foreground">{formatDateTime(account.next_action_at)}</p>
                        </div>
                      </div>
                      {(account.need || account.next_step || account.quick_notes) ? (
                        <>
                          <Separator className="my-4" />
                          <div className="grid gap-4 sm:grid-cols-3">
                            <div className="space-y-1">
                              <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Necessidade</p>
                              <p className="text-sm text-foreground">{account.need || "Sem contexto"}</p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Próximo passo</p>
                              <p className="text-sm text-foreground">{account.next_step || "Sem próximo passo"}</p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Observações</p>
                              <p className="text-sm text-foreground">{account.quick_notes || "Sem observações"}</p>
                            </div>
                          </div>
                        </>
                      ) : null}
                      {account.handoff_summary ? (
                        <>
                          <Separator className="my-4" />
                          <div className="space-y-1">
                            <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Handoff</p>
                            <p className="text-sm text-foreground">{account.handoff_summary}</p>
                          </div>
                        </>
                      ) : null}
                    </div>
                  ) : null}
                </section>

                <section className="rounded-[var(--radius-lg)] border border-border/80 bg-card p-4 shadow-subtle">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">Pessoas e carteira</h3>
                      <p className="text-sm text-muted-foreground">Contatos e contexto comercial vinculados.</p>
                    </div>
                    {entity ? (
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" onClick={onAddContact}>
                          <Plus className="mr-2 h-4 w-4" />
                          Contato
                        </Button>
                        <Button size="sm" onClick={onEditEntity}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Atualizar conta
                        </Button>
                      </div>
                    ) : null}
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                        <UserCircle2 className="h-4 w-4 text-primary" />
                        Contatos
                      </div>
                      {contacts.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Nenhum contato vinculado.</p>
                      ) : (
                        <div className="space-y-2">
                          {contacts.map((contact) => (
                            <div key={contact.id} className="rounded-[var(--radius-md)] border border-border/70 px-3 py-2">
                              <div className="flex items-center justify-between gap-3">
                                <p className="text-sm font-medium text-foreground">{getContactFullName(contact)}</p>
                                {contact.is_primary ? <Badge variant="outline">Principal</Badge> : null}
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {contact.title || "Sem cargo"} {contact.city ? `• ${contact.city}` : ""}
                              </p>
                              <p className="text-sm text-muted-foreground">{contact.email || contact.phone || "Sem contato direto"}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                        <ListTodo className="h-4 w-4 text-primary" />
                        Oportunidades
                      </div>
                      {opportunities.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Nenhuma oportunidade vinculada.</p>
                      ) : (
                        <div className="space-y-2">
                          {opportunities.map((item) => (
                            <div key={item.id} className="rounded-[var(--radius-md)] border border-border/70 px-3 py-2">
                              <div className="flex items-center justify-between gap-3">
                                <p className="text-sm font-medium text-foreground">{item.name}</p>
                                <Badge variant="outline" className={cn("border", CRM_STAGE_META[item.stage].tone)}>
                                  {CRM_STAGE_META[item.stage].shortLabel}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {formatCurrency(item.potential_value)} {item.next_action_at ? `• próxima ação ${formatDateTime(item.next_action_at)}` : ""}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </section>

                <section className="rounded-[var(--radius-lg)] border border-border/80 bg-card p-4 shadow-subtle">
                  <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">Linha do tempo</h3>
                      <p className="text-sm text-muted-foreground">Notas, tarefas e próximos passos em ordem cronológica.</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" onClick={() => onAddTimelineItem("note")}>
                        <Plus className="mr-2 h-4 w-4" />
                        Nota
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => onAddTimelineItem("task")}>
                        <Plus className="mr-2 h-4 w-4" />
                        Tarefa
                      </Button>
                      <Button size="sm" onClick={() => onAddTimelineItem("next_step")}>
                        <Plus className="mr-2 h-4 w-4" />
                        Próximo passo
                      </Button>
                    </div>
                  </div>

                  {timelineItems.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhum histórico registrado ainda.</p>
                  ) : (
                    <div className="space-y-3">
                      {timelineItems.map((item) => (
                        <div key={item.id} className="rounded-[var(--radius-md)] border border-border/70 p-3">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="outline" className={cn("border", CRM_TASK_TYPE_META[item.item_type].tone)}>
                                  {CRM_TASK_TYPE_META[item.item_type].label}
                                </Badge>
                                <span className="text-xs text-muted-foreground">{formatDateTime(item.created_at)}</span>
                                {item.created_by ? (
                                  <span className="text-xs text-muted-foreground">por {profileNameById.get(item.created_by) || "Equipe"}</span>
                                ) : null}
                              </div>
                              {item.title ? <p className="text-sm font-semibold text-foreground">{item.title}</p> : null}
                              <p className="text-sm leading-6 text-foreground">{item.content}</p>
                              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                                {item.due_at ? (
                                  <span className="inline-flex items-center gap-1">
                                    <CalendarClock className="h-3.5 w-3.5" />
                                    Tarefa: {formatDateTime(item.due_at)}
                                  </span>
                                ) : null}
                                {item.follow_up_at ? (
                                  <span className="inline-flex items-center gap-1">
                                    <CalendarClock className="h-3.5 w-3.5" />
                                    Follow-up: {formatDateTime(item.follow_up_at)}
                                  </span>
                                ) : null}
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              {item.item_type === "task" ? (
                                <Button variant="outline" size="sm" onClick={() => onToggleTask(item, !item.completed_at)}>
                                  {item.completed_at ? (
                                    <>
                                      <Circle className="mr-2 h-4 w-4" />
                                      Reabrir
                                    </>
                                  ) : (
                                    <>
                                      <CheckCircle2 className="mr-2 h-4 w-4" />
                                      Concluir
                                    </>
                                  )}
                                </Button>
                              ) : null}
                              <Button variant="ghost" size="icon" onClick={() => onEditTimelineItem(item)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => onDeleteTimelineItem(item)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            </ScrollArea>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
