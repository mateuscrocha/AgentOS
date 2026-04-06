import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import {
  CRM_PIPELINE_STAGES,
  CRM_ACCOUNT_STATUS_META,
  CRM_DEAL_CONTACT_ROLE_META,
  CRM_LEAD_SOURCE_CATEGORY_META,
  CRM_STAGE_META,
  type CRMAccount,
  type CRMAccountFormValues,
  type CRMAccountStatus,
  type CRMContact,
  type CRMContactFormValues,
  type CRMOpportunity,
  type CRMOpportunityFormValues,
  type CRMOpportunityStage,
  type CRMProfileOption,
  type CRMTimelineItem,
  type CRMTimelineItemFormValues,
  type CRMTimelineItemType,
} from "@/hooks/use-crm";
import { ArrowLeft, ArrowRight, CalendarClock, Globe, Handshake, Link2, MessageSquareText, UserRound } from "lucide-react";

type Option = {
  id: string;
  label: string;
  accountId?: string;
};

const NONE = "__none__";
const CREATE_LEAD_SOURCE_SITE = "site_whatsapp";
const CREATE_LEAD_SOURCE_RELATIONSHIP = "relationship";

function isoLocalDateTime(value?: string | null) {
  if (!value) return "";
  return value.slice(0, 16);
}

export function CRMAccountDialog({
  open,
  onOpenChange,
  account,
  organizations,
  profiles,
  onSubmit,
  pending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: CRMAccount | null;
  organizations: Option[];
  profiles: CRMProfileOption[];
  onSubmit: (values: CRMAccountFormValues) => Promise<void> | void;
  pending?: boolean;
}) {
  const [form, setForm] = useState<CRMAccountFormValues>({
    name: "",
    status: "lead",
    stage: "new_lead",
  });
  const [createStep, setCreateStep] = useState<1 | 2 | 3>(1);
  const [leadSourcePreset, setLeadSourcePreset] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setCreateStep(1);
    setLeadSourcePreset(null);
    setForm(
      account
        ? {
            id: account.id,
            organization_id: account.organization_id,
            assigned_user_id: account.assigned_user_id,
            name: account.name,
            primary_contact_name: "",
            domain: account.domain,
            phone: account.phone,
            email: account.email,
            source: account.source,
            lead_source_category: account.lead_source_category,
            lead_source_detail: account.lead_source_detail,
            inbound_channel: account.inbound_channel,
            handoff_summary: account.handoff_summary,
            status: account.status,
            stage: account.stage,
            potential_value: account.potential_value,
            target_date: account.target_date,
            need: account.need,
            next_step: account.next_step,
            last_contact_at: isoLocalDateTime(account.last_contact_at),
            next_action_at: isoLocalDateTime(account.next_action_at),
            stage_position: account.stage_position,
            quick_notes: account.quick_notes,
            stripe_customer_id: account.stripe_customer_id,
            stripe_subscription_id: account.stripe_subscription_id,
          }
        : {
            name: "",
            status: "lead",
            organization_id: null,
            assigned_user_id: null,
            domain: "",
            primary_contact_name: "",
            phone: "",
            email: "",
            source: "",
            lead_source_category: null,
            lead_source_detail: "",
            inbound_channel: "",
            handoff_summary: "",
            quick_notes: "",
            stage: "new_lead",
            potential_value: null,
            target_date: "",
            need: "",
            next_step: "",
            last_contact_at: "",
            next_action_at: "",
            stage_position: 0,
            stripe_customer_id: "",
            stripe_subscription_id: "",
          },
    );
  }, [account, open]);

  useEffect(() => {
    if (account || !leadSourcePreset) return;

    if (leadSourcePreset === CREATE_LEAD_SOURCE_SITE) {
      setForm((current) => ({
        ...current,
        source: current.source || "Site",
        lead_source_category: "site",
        lead_source_detail: current.lead_source_detail || "site -> WhatsApp",
        inbound_channel: current.inbound_channel || "WhatsApp",
      }));
      return;
    }

    if (leadSourcePreset === CREATE_LEAD_SOURCE_RELATIONSHIP) {
      setForm((current) => ({
        ...current,
        source: current.source || "Indicação / networking",
        lead_source_category: "referral",
        lead_source_detail: current.lead_source_detail || "indicação / evento / networking",
        inbound_channel: current.inbound_channel || "Contato direto",
      }));
    }
  }, [account, leadSourcePreset]);

  const profileOptions = useMemo(
    () => profiles.map((profile) => ({ id: profile.id, label: profile.name || "Usuário sem nome" })),
    [profiles],
  );
  const isOrganizationBackedAccount = Boolean(form.organization_id);
  const isCreateMode = !account;
  const isCreateStepOneValid = Boolean(leadSourcePreset);
  const isCreateStepTwoValid = Boolean(
    form.name.trim() &&
    ((form.phone && form.phone.trim()) || (form.email && form.email.trim()) || (form.domain && form.domain.trim())),
  );

  const renderCreateWizard = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        {[1, 2, 3].map((step) => {
          const active = createStep === step;
          const done = createStep > step;
          return (
            <div
              key={step}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full border text-sm font-semibold transition-colors",
                done && "border-sky-600 bg-sky-600 text-white",
                active && !done && "border-sky-400 bg-sky-50 text-sky-900",
                !active && !done && "border-slate-200 bg-white text-slate-400",
              )}
            >
              {step}
            </div>
          );
        })}
        <div className="text-sm text-muted-foreground">
          {createStep === 1 ? "Origem" : createStep === 2 ? "Dados básicos" : "Detalhes"}
        </div>
      </div>

      {createStep === 1 ? (
        <div className="space-y-4">
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-foreground">De onde veio esse lead?</h3>
            <p className="text-sm text-muted-foreground">
              Essa escolha organiza o pipeline desde o início e já guarda o contexto certo.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setLeadSourcePreset(CREATE_LEAD_SOURCE_SITE)}
              className={cn(
                "rounded-2xl border p-4 text-left transition-colors",
                leadSourcePreset === CREATE_LEAD_SOURCE_SITE
                  ? "border-sky-400 bg-sky-50 text-sky-950"
                  : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50",
              )}
            >
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Globe className="h-4 w-4" />
                Site -{">"} WhatsApp
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Veio do CTA do site e caiu direto no seu WhatsApp.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setLeadSourcePreset(CREATE_LEAD_SOURCE_RELATIONSHIP)}
              className={cn(
                "rounded-2xl border p-4 text-left transition-colors",
                leadSourcePreset === CREATE_LEAD_SOURCE_RELATIONSHIP
                  ? "border-sky-400 bg-sky-50 text-sky-950"
                  : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50",
              )}
            >
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Handshake className="h-4 w-4" />
                Indicação / evento
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Veio de indicação, networking ou de alguém que você conheceu ao vivo.
              </p>
            </button>
          </div>
        </div>
      ) : null}

      {createStep === 2 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2">
            <h3 className="text-base font-semibold text-foreground">Capture o básico para não perder o lead</h3>
            <p className="text-sm text-muted-foreground">
              Nome e pelo menos um meio de contato já deixam o lead pronto para entrar no pipeline.
            </p>
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="crm-account-name">Nome do lead ou empresa</Label>
            <Input
              id="crm-account-name"
              value={form.name}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  name: event.target.value,
                  primary_contact_name: current.primary_contact_name ? current.primary_contact_name : event.target.value,
                }))
              }
              placeholder="Ex.: Rafael Wajnsztok ou Clínica Aurora"
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label>Nome do contato principal</Label>
            <Input
              value={form.primary_contact_name ?? ""}
              onChange={(event) => setForm((current) => ({ ...current, primary_contact_name: event.target.value }))}
              placeholder="Ex.: Rafael Wajnsztok"
            />
          </div>

          <div className="space-y-2">
            <Label>Telefone</Label>
            <Input
              value={form.phone ?? ""}
              onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
              placeholder="(11) 99999-0000"
            />
          </div>

          <div className="space-y-2">
            <Label>Email</Label>
            <Input
              type="email"
              value={form.email ?? ""}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              placeholder="contato@empresa.com"
            />
          </div>

          <div className="space-y-2">
            <Label>Empresa / domínio</Label>
            <Input
              value={form.domain ?? ""}
              onChange={(event) => setForm((current) => ({ ...current, domain: event.target.value }))}
              placeholder="empresa.com.br"
            />
          </div>

          <div className="space-y-2">
            <Label>Responsável interno</Label>
            <Select
              value={form.assigned_user_id ?? NONE}
              onValueChange={(value) => setForm((current) => ({ ...current, assigned_user_id: value === NONE ? null : value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sem responsável" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Sem responsável</SelectItem>
                {profileOptions.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      ) : null}

      {createStep === 3 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2">
            <h3 className="text-base font-semibold text-foreground">Detalhes rápidos para o próximo passo</h3>
            <p className="text-sm text-muted-foreground">
              Preencha só o que já souber. O resto pode evoluir depois.
            </p>
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label>Detalhe da origem</Label>
            <Input
              value={form.lead_source_detail ?? ""}
              onChange={(event) => setForm((current) => ({ ...current, lead_source_detail: event.target.value }))}
              placeholder="Ex.: site -> WhatsApp ou evento em São Paulo"
            />
          </div>

          <div className="space-y-2">
            <Label>Canal de entrada</Label>
            <Input
              value={form.inbound_channel ?? ""}
              onChange={(event) => setForm((current) => ({ ...current, inbound_channel: event.target.value }))}
              placeholder="Ex.: WhatsApp"
            />
          </div>

          <div className="space-y-2">
            <Label>Próxima ação</Label>
            <Input
              type="datetime-local"
              value={form.next_action_at ?? ""}
              onChange={(event) => setForm((current) => ({ ...current, next_action_at: event.target.value }))}
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label>Necessidade</Label>
            <Textarea
              rows={3}
              value={form.need ?? ""}
              onChange={(event) => setForm((current) => ({ ...current, need: event.target.value }))}
              placeholder="O que esse lead parece querer resolver?"
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label>Resumo / handoff</Label>
            <Textarea
              rows={3}
              value={form.handoff_summary ?? ""}
              onChange={(event) => setForm((current) => ({ ...current, handoff_summary: event.target.value }))}
              placeholder="Ex.: entrou pelo site e depois encaminhou o operacional para a call."
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label>Observações rápidas</Label>
            <Textarea
              rows={4}
              value={form.quick_notes ?? ""}
              onChange={(event) => setForm((current) => ({ ...current, quick_notes: event.target.value }))}
              placeholder="Resumo comercial, contexto, objeções ou sinais de prioridade..."
            />
          </div>
        </div>
      ) : null}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{account ? "Editar lead / conta comercial" : "Novo lead"}</DialogTitle>
          <DialogDescription>
            {account
              ? "Use esta tela tanto para leads quanto para clientes reais já vinculados ao painel."
              : "Capture o lead com rapidez e contexto suficiente para o próximo passo comercial."}
          </DialogDescription>
        </DialogHeader>

        {isCreateMode ? renderCreateWizard() : (
        <div className="space-y-5">
          <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="mb-4 flex items-start gap-3">
              <div className="rounded-full bg-sky-100 p-2 text-sky-700">
                <UserRound className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">Essencial</h3>
                <p className="text-sm text-muted-foreground">O mínimo para identificar a conta e decidir o próximo movimento.</p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="crm-account-name">Nome da conta</Label>
                <Input
                  id="crm-account-name"
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Ex.: Clínica Aurora"
                />
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(value) => setForm((current) => ({ ...current, status: value as CRMAccountStatus }))}
                >
                  <SelectTrigger disabled={isOrganizationBackedAccount}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CRM_ACCOUNT_STATUS_META).map(([value, meta]) => (
                      <SelectItem key={value} value={value}>
                        {meta.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {isOrganizationBackedAccount ? (
                  <p className="text-xs text-muted-foreground">
                    Como esta conta está vinculada a uma `organization`, o status comercial é derivado automaticamente do cliente real e do billing Stripe.
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label>Etapa comercial</Label>
                <Select
                  value={form.stage}
                  onValueChange={(value) => setForm((current) => ({ ...current, stage: value as CRMOpportunityStage }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CRM_PIPELINE_STAGES.map((value) => (
                      <SelectItem key={value} value={value}>
                        {CRM_STAGE_META[value].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input
                  value={form.phone ?? ""}
                  onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                  placeholder="(11) 99999-0000"
                />
              </div>

              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={form.email ?? ""}
                  onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                  placeholder="contato@conta.com.br"
                />
              </div>

              <div className="space-y-2">
                <Label>Próxima ação</Label>
                <div className="relative">
                  <CalendarClock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input className="pl-9" type="datetime-local" value={form.next_action_at ?? ""} onChange={(event) => setForm((current) => ({ ...current, next_action_at: event.target.value }))} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Responsável</Label>
                <Select
                  value={form.assigned_user_id ?? NONE}
                  onValueChange={(value) => setForm((current) => ({ ...current, assigned_user_id: value === NONE ? null : value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sem responsável" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Sem responsável</SelectItem>
                    {profileOptions.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="mb-4 flex items-start gap-3">
              <div className="rounded-full bg-amber-100 p-2 text-amber-700">
                <Link2 className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">Origem e contexto de entrada</h3>
                <p className="text-sm text-muted-foreground">Organize a origem sem transformar isso num bloco pesado demais.</p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Origem</Label>
                <Input
                  value={form.source ?? ""}
                  onChange={(event) => setForm((current) => ({ ...current, source: event.target.value }))}
                  placeholder="Outbound, indicação, inbound..."
                />
              </div>

              <div className="space-y-2">
                <Label>Categoria da origem</Label>
                <Select
                  value={form.lead_source_category ?? NONE}
                  onValueChange={(value) => setForm((current) => ({ ...current, lead_source_category: value === NONE ? null : value as CRMAccountFormValues["lead_source_category"] }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sem categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Sem categoria</SelectItem>
                    {Object.entries(CRM_LEAD_SOURCE_CATEGORY_META).map(([value, meta]) => (
                      <SelectItem key={value} value={value}>
                        {meta.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Detalhe da origem</Label>
                <Input
                  value={form.lead_source_detail ?? ""}
                  onChange={(event) => setForm((current) => ({ ...current, lead_source_detail: event.target.value }))}
                  placeholder="Ex.: site -> WhatsApp"
                />
              </div>

              <div className="space-y-2">
                <Label>Canal de entrada</Label>
                <Input
                  value={form.inbound_channel ?? ""}
                  onChange={(event) => setForm((current) => ({ ...current, inbound_channel: event.target.value }))}
                  placeholder="Ex.: WhatsApp"
                />
              </div>

              <div className="space-y-2">
                <Label>Domínio</Label>
                <Input
                  value={form.domain ?? ""}
                  onChange={(event) => setForm((current) => ({ ...current, domain: event.target.value }))}
                  placeholder="conta.com.br"
                />
              </div>

              <div className="space-y-2">
                <Label>Último contato</Label>
                <Input type="datetime-local" value={form.last_contact_at ?? ""} onChange={(event) => setForm((current) => ({ ...current, last_contact_at: event.target.value }))} />
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="mb-4 flex items-start gap-3">
              <div className="rounded-full bg-emerald-100 p-2 text-emerald-700">
                <MessageSquareText className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">Leitura comercial</h3>
                <p className="text-sm text-muted-foreground">Campos para contexto real de negociação, valor e passagem de bastão.</p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Valor potencial</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.potential_value ?? ""}
                  onChange={(event) => setForm((current) => ({ ...current, potential_value: event.target.value ? Number(event.target.value) : null }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Data alvo</Label>
                <Input type="date" value={form.target_date ?? ""} onChange={(event) => setForm((current) => ({ ...current, target_date: event.target.value }))} />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label>Organização do painel</Label>
                <Select
                  value={form.organization_id ?? NONE}
                  onValueChange={(value) => setForm((current) => ({ ...current, organization_id: value === NONE ? null : value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Lead sem organização ou cliente já vinculado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Sem vínculo (lead/prospect)</SelectItem>
                    {organizations.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Use vínculo com `organization` quando esta conta já for cliente real do Bóris. Leads e prospects podem continuar sem vínculo.
                </p>
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label>Necessidade</Label>
                <Textarea
                  rows={3}
                  value={form.need ?? ""}
                  onChange={(event) => setForm((current) => ({ ...current, need: event.target.value }))}
                  placeholder="Qual o problema principal ou o contexto de compra?"
                />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label>Próximo passo</Label>
                <Textarea
                  rows={3}
                  value={form.next_step ?? ""}
                  onChange={(event) => setForm((current) => ({ ...current, next_step: event.target.value }))}
                  placeholder="Qual a próxima ação combinada ou planejada?"
                />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label>Resumo do handoff</Label>
                <Textarea
                  rows={3}
                  value={form.handoff_summary ?? ""}
                  onChange={(event) => setForm((current) => ({ ...current, handoff_summary: event.target.value }))}
                  placeholder="Ex.: CEO iniciou o contato e encaminhou o responsável operacional pela avaliação."
                />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label>Observações rápidas</Label>
                <Textarea
                  rows={4}
                  value={form.quick_notes ?? ""}
                  onChange={(event) => setForm((current) => ({ ...current, quick_notes: event.target.value }))}
                  placeholder="Resumo comercial, contexto, trava principal, objeções..."
                />
              </div>

              <div className="space-y-2">
                <Label>Stripe customer ID</Label>
                <Input
                  value={form.stripe_customer_id ?? ""}
                  onChange={(event) => setForm((current) => ({ ...current, stripe_customer_id: event.target.value }))}
                  placeholder="cus_xxx"
                />
              </div>

              <div className="space-y-2">
                <Label>Stripe subscription ID</Label>
                <Input
                  value={form.stripe_subscription_id ?? ""}
                  onChange={(event) => setForm((current) => ({ ...current, stripe_subscription_id: event.target.value }))}
                  placeholder="sub_xxx"
                />
              </div>
            </div>
          </section>
        </div>
        )}

        <DialogFooter>
          {isCreateMode ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              {createStep > 1 ? (
                <Button variant="outline" onClick={() => setCreateStep((current) => Math.max(1, current - 1) as 1 | 2 | 3)}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Voltar
                </Button>
              ) : null}
              {createStep < 3 ? (
                <Button
                  onClick={() => setCreateStep((current) => Math.min(3, current + 1) as 1 | 2 | 3)}
                  disabled={(createStep === 1 && !isCreateStepOneValid) || (createStep === 2 && !isCreateStepTwoValid)}
                >
                  Continuar
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button
                  onClick={() => void onSubmit(form)}
                  disabled={pending || !form.name.trim()}
                >
                  {pending ? "Salvando..." : "Criar lead"}
                </Button>
              )}
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button
                onClick={() => void onSubmit(form)}
                disabled={pending || !form.name.trim()}
              >
                {pending ? "Salvando..." : "Salvar alterações"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CRMContactDialog({
  open,
  onOpenChange,
  contact,
  accountOptions,
  defaultValues,
  onSubmit,
  pending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: CRMContact | null;
  accountOptions: Option[];
  defaultValues?: Partial<CRMContactFormValues>;
  onSubmit: (values: CRMContactFormValues) => Promise<void> | void;
  pending?: boolean;
}) {
  const [form, setForm] = useState<CRMContactFormValues>({
    account_id: "",
    first_name: "",
  });

  useEffect(() => {
    if (!open) return;
    setForm(
      contact
        ? {
            id: contact.id,
            account_id: contact.account_id,
            first_name: contact.first_name,
            last_name: contact.last_name,
            email: contact.email,
            phone: contact.phone,
            title: contact.title,
            city: contact.city,
            role_in_deal: contact.role_in_deal,
            is_primary: contact.is_primary,
          }
        : {
            account_id: defaultValues?.account_id ?? accountOptions[0]?.id ?? "",
            first_name: defaultValues?.first_name ?? "",
            last_name: defaultValues?.last_name ?? "",
            email: defaultValues?.email ?? "",
            phone: defaultValues?.phone ?? "",
            title: defaultValues?.title ?? "",
            city: defaultValues?.city ?? "",
            role_in_deal: defaultValues?.role_in_deal ?? null,
            is_primary: defaultValues?.is_primary ?? false,
          },
    );
  }, [accountOptions, contact, defaultValues, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{contact ? "Editar contato" : "Novo contato"}</DialogTitle>
          <DialogDescription>Contato enxuto, ligado à conta certa e pronto para follow-up.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label>Conta vinculada</Label>
            <Select value={form.account_id} onValueChange={(value) => setForm((current) => ({ ...current, account_id: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a conta" />
              </SelectTrigger>
              <SelectContent>
                {accountOptions.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Nome</Label>
            <Input value={form.first_name} onChange={(event) => setForm((current) => ({ ...current, first_name: event.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Sobrenome</Label>
            <Input value={form.last_name ?? ""} onChange={(event) => setForm((current) => ({ ...current, last_name: event.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input type="email" value={form.email ?? ""} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Telefone</Label>
            <Input value={form.phone ?? ""} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Cargo</Label>
            <Input value={form.title ?? ""} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Cidade</Label>
            <Input value={form.city ?? ""} onChange={(event) => setForm((current) => ({ ...current, city: event.target.value }))} />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label>Papel no deal</Label>
            <Select
              value={form.role_in_deal ?? NONE}
              onValueChange={(value) => setForm((current) => ({ ...current, role_in_deal: value === NONE ? null : value as CRMContactFormValues["role_in_deal"] }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sem papel definido" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Sem papel definido</SelectItem>
                {Object.entries(CRM_DEAL_CONTACT_ROLE_META).map(([value, meta]) => (
                  <SelectItem key={value} value={value}>
                    {meta.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2 rounded-[var(--radius-md)] border border-border/70 px-3 py-2 sm:col-span-2">
            <Checkbox
              checked={Boolean(form.is_primary)}
              onCheckedChange={(checked) => setForm((current) => ({ ...current, is_primary: Boolean(checked) }))}
            />
            <span className="text-sm text-foreground">Definir como contato principal da conta</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => void onSubmit(form)}
            disabled={pending || !form.account_id || !form.first_name.trim()}
          >
            {pending ? "Salvando..." : contact ? "Salvar alterações" : "Criar contato"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CRMOpportunityDialog({
  open,
  onOpenChange,
  opportunity,
  accountOptions,
  contactOptions,
  defaultValues,
  profiles,
  onSubmit,
  pending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  opportunity: CRMOpportunity | null;
  accountOptions: Option[];
  contactOptions: Option[];
  defaultValues?: Partial<CRMOpportunityFormValues>;
  profiles: CRMProfileOption[];
  onSubmit: (values: CRMOpportunityFormValues) => Promise<void> | void;
  pending?: boolean;
}) {
  const [form, setForm] = useState<CRMOpportunityFormValues>({
    account_id: "",
    name: "",
    stage: "new_lead",
  });

  useEffect(() => {
    if (!open) return;
    setForm(
      opportunity
        ? {
            id: opportunity.id,
            account_id: opportunity.account_id,
            contact_id: opportunity.contact_id,
            owner_user_id: opportunity.owner_user_id,
            name: opportunity.name,
            stage: opportunity.stage,
            potential_value: opportunity.potential_value,
            target_date: opportunity.target_date,
            source: opportunity.source,
            need: opportunity.need,
            next_step: opportunity.next_step,
            notes: opportunity.notes,
            last_contact_at: isoLocalDateTime(opportunity.last_contact_at),
            next_action_at: isoLocalDateTime(opportunity.next_action_at),
            stage_position: opportunity.stage_position,
          }
        : {
            account_id: defaultValues?.account_id ?? accountOptions[0]?.id ?? "",
            name: defaultValues?.name ?? "",
            stage: defaultValues?.stage ?? "new_lead",
            contact_id: defaultValues?.contact_id ?? null,
            owner_user_id: defaultValues?.owner_user_id ?? null,
            potential_value: defaultValues?.potential_value ?? null,
            target_date: defaultValues?.target_date ?? "",
            source: defaultValues?.source ?? "",
            need: defaultValues?.need ?? "",
            next_step: defaultValues?.next_step ?? "",
            notes: defaultValues?.notes ?? "",
            last_contact_at: defaultValues?.last_contact_at ?? "",
            next_action_at: defaultValues?.next_action_at ?? "",
          },
    );
  }, [accountOptions, defaultValues, opportunity, open]);

  const profileOptions = useMemo(
    () => profiles.map((profile) => ({ id: profile.id, label: profile.name || "Usuário sem nome" })),
    [profiles],
  );
  const filteredContactOptions = useMemo(
    () => contactOptions.filter((option) => !option.accountId || option.accountId === form.account_id),
    [contactOptions, form.account_id],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{opportunity ? "Editar oportunidade" : "Nova oportunidade"}</DialogTitle>
          <DialogDescription>Pipeline simples, próximo passo claro e contexto suficiente para tocar a negociação.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label>Nome da oportunidade</Label>
            <Input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
          </div>

          <div className="space-y-2">
            <Label>Conta</Label>
            <Select value={form.account_id} onValueChange={(value) => setForm((current) => ({ ...current, account_id: value, contact_id: null }))}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a conta" />
              </SelectTrigger>
              <SelectContent>
                {accountOptions.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Contato principal</Label>
            <Select value={form.contact_id ?? NONE} onValueChange={(value) => setForm((current) => ({ ...current, contact_id: value === NONE ? null : value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Sem contato principal" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Sem contato</SelectItem>
                {filteredContactOptions.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Etapa</Label>
            <Select value={form.stage} onValueChange={(value) => setForm((current) => ({ ...current, stage: value as CRMOpportunityStage }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(CRM_STAGE_META).map(([value, meta]) => (
                  <SelectItem key={value} value={value}>
                    {meta.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Valor potencial</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={form.potential_value ?? ""}
              onChange={(event) => setForm((current) => ({ ...current, potential_value: event.target.value ? Number(event.target.value) : null }))}
            />
          </div>

          <div className="space-y-2">
            <Label>Data alvo</Label>
            <Input type="date" value={form.target_date ?? ""} onChange={(event) => setForm((current) => ({ ...current, target_date: event.target.value }))} />
          </div>

          <div className="space-y-2">
            <Label>Responsável</Label>
            <Select value={form.owner_user_id ?? NONE} onValueChange={(value) => setForm((current) => ({ ...current, owner_user_id: value === NONE ? null : value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Sem responsável" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Sem responsável</SelectItem>
                {profileOptions.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Origem</Label>
            <Input value={form.source ?? ""} onChange={(event) => setForm((current) => ({ ...current, source: event.target.value }))} />
          </div>

          <div className="space-y-2">
            <Label>Último contato</Label>
            <Input type="datetime-local" value={form.last_contact_at ?? ""} onChange={(event) => setForm((current) => ({ ...current, last_contact_at: event.target.value }))} />
          </div>

          <div className="space-y-2">
            <Label>Próxima ação</Label>
            <Input type="datetime-local" value={form.next_action_at ?? ""} onChange={(event) => setForm((current) => ({ ...current, next_action_at: event.target.value }))} />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label>Necessidade</Label>
            <Textarea rows={3} value={form.need ?? ""} onChange={(event) => setForm((current) => ({ ...current, need: event.target.value }))} />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label>Próximo passo</Label>
            <Textarea rows={3} value={form.next_step ?? ""} onChange={(event) => setForm((current) => ({ ...current, next_step: event.target.value }))} />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label>Observações</Label>
            <Textarea rows={4} value={form.notes ?? ""} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => void onSubmit(form)}
            disabled={pending || !form.account_id || !form.name.trim()}
          >
            {pending ? "Salvando..." : opportunity ? "Salvar alterações" : "Criar oportunidade"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CRMTimelineItemDialog({
  open,
  onOpenChange,
  item,
  defaultValues,
  onSubmit,
  pending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: CRMTimelineItem | null;
  defaultValues: Partial<CRMTimelineItemFormValues>;
  onSubmit: (values: CRMTimelineItemFormValues) => Promise<void> | void;
  pending?: boolean;
}) {
  const [form, setForm] = useState<CRMTimelineItemFormValues>({
    item_type: "note",
    content: "",
  });

  useEffect(() => {
    if (!open) return;
    setForm({
      id: item?.id,
      account_id: item?.account_id ?? defaultValues.account_id ?? null,
      opportunity_id: item?.opportunity_id ?? defaultValues.opportunity_id ?? null,
      item_type: item?.item_type ?? defaultValues.item_type ?? "note",
      title: item?.title ?? "",
      content: item?.content ?? "",
      due_at: isoLocalDateTime(item?.due_at ?? defaultValues.due_at ?? ""),
      follow_up_at: isoLocalDateTime(item?.follow_up_at ?? defaultValues.follow_up_at ?? ""),
      completed_at: isoLocalDateTime(item?.completed_at ?? defaultValues.completed_at ?? ""),
    });
  }, [defaultValues, item, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{item ? "Editar registro" : "Novo registro de contexto"}</DialogTitle>
          <DialogDescription>Notas, tarefas e próximos passos no mesmo histórico operacional.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select value={form.item_type} onValueChange={(value) => setForm((current) => ({ ...current, item_type: value as CRMTimelineItemType }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="note">Nota</SelectItem>
                <SelectItem value="task">Tarefa</SelectItem>
                <SelectItem value="next_step">Próximo passo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Título</Label>
            <Input value={form.title ?? ""} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="Resumo rápido" />
          </div>

          <div className="space-y-2">
            <Label>Conteúdo</Label>
            <Textarea rows={5} value={form.content} onChange={(event) => setForm((current) => ({ ...current, content: event.target.value }))} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Data da tarefa</Label>
              <Input type="datetime-local" value={form.due_at ?? ""} onChange={(event) => setForm((current) => ({ ...current, due_at: event.target.value }))} />
            </div>

            <div className="space-y-2">
              <Label>Data de follow-up</Label>
              <Input type="datetime-local" value={form.follow_up_at ?? ""} onChange={(event) => setForm((current) => ({ ...current, follow_up_at: event.target.value }))} />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => void onSubmit(form)}
            disabled={pending || !form.content.trim()}
          >
            {pending ? "Salvando..." : item ? "Salvar alterações" : "Registrar item"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
