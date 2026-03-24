import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { notify } from "@/components/ui/sonner";
import { CheckCircle2, CreditCard, Loader2, RefreshCw, Search, UserRound } from "lucide-react";
import { logEvent, getChangedFields } from "@/lib/audit";
import { useAuth } from "@/hooks/use-auth";
import { z } from "zod";
import { Form, FormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage } from "@/components/ui/form";
import { motion } from "framer-motion";
import { parseSupabaseFunctionInvokeError } from "@/lib/supabase-function-invoke-error";
import { cn } from "@/lib/utils";

const organizationSchema = z.object({
  name: z.string().trim().min(1, "Nome é obrigatório").max(100, "Nome deve ter no máximo 100 caracteres"),
  status: z.enum(["active", "inactive", "suspended"], {
    errorMap: () => ({ message: "Status inválido" }),
  }),
  relationship_type: z.enum(["paying_customer", "partner", "courtesy", "internal", "trial", "demo"], {
    errorMap: () => ({ message: "Tipo de relacionamento inválido" }),
  }),
  description: z.string().trim().max(500, "Descrição deve ter no máximo 500 caracteres").optional(),
});

interface Organization {
  id: string;
  name: string;
  status: string;
  relationship_type?: string | null;
  settings?: Record<string, any> | null;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  stripe_price_id?: string | null;
  billing_status?: string | null;
  billing_plan?: string | null;
  current_period_end?: string | null;
}

interface EditOrganizationModalProps {
  organization: Organization | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  canManageStripe?: boolean;
}

type StripeCustomerOption = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  created: number | null;
};

type StripeSubscriptionOption = {
  id: string;
  status: string;
  billing_status: string | null;
  stripe_price_id: string | null;
  price_nickname: string | null;
  unit_amount: number | null;
  currency: string | null;
  interval: string | null;
  current_period_end: string | null;
};

const BORIS_DEFAULT_PRICE_ID = (import.meta.env.VITE_STRIPE_PRICE_ID_DEFAULT ?? "").trim();

function formatCurrency(amount?: number | null, currency?: string | null) {
  if (amount == null) return "Sem valor";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: (currency || "BRL").toUpperCase(),
  }).format(amount / 100);
}

function formatDate(value?: string | null) {
  if (!value) return "Sem data";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date(value));
}

function getCustomerLabel(customer: StripeCustomerOption) {
  return customer.name || customer.email || customer.phone || customer.id;
}

function isBorisSubscription(subscription: StripeSubscriptionOption) {
  if (BORIS_DEFAULT_PRICE_ID && subscription.stripe_price_id === BORIS_DEFAULT_PRICE_ID) return true;
  return /boris/i.test(`${subscription.price_nickname ?? ""} ${subscription.stripe_price_id ?? ""}`);
}

export function EditOrganizationModal({
  organization,
  open,
  onOpenChange,
  onSuccess,
  canManageStripe = false,
}: EditOrganizationModalProps) {
  const { user } = useAuth();
  const form = useForm({
    resolver: zodResolver(organizationSchema),
    defaultValues: {
      name: "",
      status: "active",
      relationship_type: "paying_customer",
      description: "",
    },
    mode: "onChange",
  });

  const [customerSearch, setCustomerSearch] = useState("");
  const [stripeCustomers, setStripeCustomers] = useState<StripeCustomerOption[]>([]);
  const [customersLoaded, setCustomersLoaded] = useState(false);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [customersHasMore, setCustomersHasMore] = useState(false);
  const [customersNextCursor, setCustomersNextCursor] = useState<string | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<StripeCustomerOption | null>(null);
  const [subscriptions, setSubscriptions] = useState<StripeSubscriptionOption[]>([]);
  const [subscriptionsLoading, setSubscriptionsLoading] = useState(false);
  const [selectedSubscriptionId, setSelectedSubscriptionId] = useState<string>("");

  const filteredCustomers = useMemo(() => {
    const q = customerSearch.trim().toLocaleLowerCase("pt-BR");
    if (!q) return stripeCustomers;
    return stripeCustomers.filter((customer) =>
      [customer.id, customer.name, customer.email, customer.phone]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase("pt-BR").includes(q)),
    );
  }, [customerSearch, stripeCustomers]);

  useEffect(() => {
    if (!open) return;

    if (organization) {
      form.reset({
        name: organization.name || "",
        status: organization.status || "active",
        relationship_type: organization.relationship_type || "paying_customer",
        description: ((organization.settings as any)?.description as string) || "",
      });
    } else {
      form.reset({
        name: "",
        status: "active",
        relationship_type: "paying_customer",
        description: "",
      });
    }

    setCustomerSearch("");
    setStripeCustomers([]);
    setCustomersLoaded(false);
    setCustomersHasMore(false);
    setCustomersNextCursor(null);
    setSubscriptions([]);
    setSelectedSubscriptionId(organization?.stripe_subscription_id || "");
    setSelectedCustomer(
      organization?.stripe_customer_id
        ? {
            id: organization.stripe_customer_id,
            name: null,
            email: null,
            phone: null,
            created: null,
          }
        : null,
    );
  }, [organization, open, form]);

  const loadStripeCustomers = async (startingAfter?: string | null) => {
    setCustomersLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("billing-list-stripe-customers", {
        body: {
          limit: 100,
          ...(startingAfter ? { starting_after: startingAfter } : {}),
        },
      });

      if (error) throw error;

      const fetched = Array.isArray(data?.customers) ? (data.customers as StripeCustomerOption[]) : [];
      setStripeCustomers((current) => {
        const map = new Map(current.map((item) => [item.id, item]));
        fetched.forEach((item) => map.set(item.id, item));
        return Array.from(map.values());
      });
      setCustomersHasMore(Boolean(data?.has_more));
      setCustomersNextCursor((data?.next_starting_after as string | null) ?? null);
      setCustomersLoaded(true);
    } catch (err) {
      const parsed = await parseSupabaseFunctionInvokeError(err);
      notify.error("Não foi possível listar clientes da Stripe", parsed.message);
    } finally {
      setCustomersLoading(false);
    }
  };

  useEffect(() => {
    if (!open || !organization?.id || customersLoaded || customersLoading) return;
    void loadStripeCustomers(null);
  }, [open, organization?.id, customersLoaded, customersLoading]);

  useEffect(() => {
    if (!open || !organization?.stripe_customer_id || !organization?.id) return;
    if (stripeCustomers.some((item) => item.id === organization.stripe_customer_id)) return;

    let cancelled = false;

    const loadCurrentCustomer = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("billing-get-stripe-customer", {
          body: { stripe_customer_id: organization.stripe_customer_id },
        });
        if (error) throw error;
        if (cancelled || !data?.customer?.id) return;
        const customer = data.customer as StripeCustomerOption;
        setStripeCustomers((current) => (current.some((item) => item.id === customer.id) ? current : [customer, ...current]));
        setSelectedCustomer(customer);
      } catch {
        void 0;
      }
    };

    void loadCurrentCustomer();

    return () => {
      cancelled = true;
    };
  }, [open, organization?.id, organization?.stripe_customer_id, stripeCustomers]);

  useEffect(() => {
    if (!open || !selectedCustomer?.id) {
      setSubscriptions([]);
      return;
    }

    let cancelled = false;
    setSubscriptionsLoading(true);

    const loadSubscriptions = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("billing-list-stripe-subscriptions", {
          body: {
            stripe_customer_id: selectedCustomer.id,
            limit: 50,
          },
        });
        if (error) throw error;

        if (cancelled) return;
        const nextSubscriptions = Array.isArray(data?.subscriptions)
          ? (data.subscriptions as StripeSubscriptionOption[])
          : [];
        setSubscriptions(nextSubscriptions);

        const hasCurrent = nextSubscriptions.some((item) => item.id === selectedSubscriptionId);
        if (!hasCurrent) {
          const preferred =
            nextSubscriptions.find((item) => item.id === organization?.stripe_subscription_id) ||
            nextSubscriptions.find(isBorisSubscription) ||
            nextSubscriptions[0] ||
            null;
          setSelectedSubscriptionId(preferred?.id || "");
        }
      } catch (err) {
        if (cancelled) return;
        const parsed = await parseSupabaseFunctionInvokeError(err);
        notify.error("Não foi possível listar assinaturas da Stripe", parsed.message);
        setSubscriptions([]);
      } finally {
        if (!cancelled) setSubscriptionsLoading(false);
      }
    };

    void loadSubscriptions();

    return () => {
      cancelled = true;
    };
  }, [open, organization?.stripe_subscription_id, selectedCustomer?.id, selectedSubscriptionId]);

  const onSubmit = async (values: any) => {
    try {
      if (!organization) {
        const payload = {
          name: values.name.trim(),
          status: values.status,
          relationship_type: values.relationship_type,
          settings: { description: (values.description || "").trim() },
        };
        const { data, error } = await supabase
          .from("organizations")
          .insert(payload)
          .select("id")
          .single();
        if (error) {
          if (error.code === "42501" || error.message.includes("policy")) {
            notify.error("Sem permissão", "Você não pode criar organizações.");
          } else {
            notify.error("Não foi possível criar", "Algo deu errado. Tente novamente.");
          }
          return;
        }
        if (user && data?.id) {
          await logEvent({
            eventType: "ORG_CREATED",
            entityType: "organization",
            entityId: data.id,
            userId: user.id,
            metadata: { name: payload.name, status: payload.status },
          });
        }
        notify.success("Organização criada", "Tudo certo.");
        onSuccess();
        onOpenChange(false);
        return;
      }

      const updatedSettings = {
        ...(organization.settings || {}),
        description: (values.description || "").trim(),
      };

      const { error } = await supabase
        .from("organizations")
        .update({
          name: values.name.trim(),
          status: values.status,
          relationship_type: values.relationship_type,
          settings: updatedSettings,
        })
        .eq("id", organization.id);

      if (error) {
        if (error.code === "42501" || error.message.includes("policy")) {
          notify.error("Sem permissão", "Você não pode editar esta organização.");
        } else {
          notify.error("Não foi possível atualizar", "Algo deu errado. Tente novamente.");
        }
        return;
      }

      const nextCustomerId = selectedCustomer?.id || null;
      const nextSubscription = subscriptions.find((item) => item.id === selectedSubscriptionId) ?? null;

      if (nextCustomerId && nextCustomerId !== organization.stripe_customer_id) {
        const { error: customerLinkError } = await supabase.functions.invoke("billing-link-organization-stripe-customer", {
          body: {
            organization_id: organization.id,
            stripe_customer_id: nextCustomerId,
          },
        });
        if (customerLinkError) throw customerLinkError;
      }

      if (nextCustomerId && !nextSubscription && nextCustomerId !== organization.stripe_customer_id) {
        const { error: clearDerivedBillingError } = await supabase
          .from("organizations")
          .update({
            stripe_subscription_id: null,
            stripe_price_id: null,
            billing_status: null,
            billing_plan: null,
            current_period_end: null,
          })
          .eq("id", organization.id);

        if (clearDerivedBillingError) throw clearDerivedBillingError;
      }

      if (nextCustomerId && nextSubscription && nextSubscription.id !== organization.stripe_subscription_id) {
        const { error: subscriptionLinkError } = await supabase.functions.invoke("billing-link-organization-stripe-subscription", {
          body: {
            organization_id: organization.id,
            stripe_customer_id: nextCustomerId,
            stripe_subscription_id: nextSubscription.id,
          },
        });
        if (subscriptionLinkError) throw subscriptionLinkError;
      }

      const shouldSyncStripeContext =
        canManageStripe &&
        Boolean(nextCustomerId || organization.stripe_customer_id) &&
        (
          values.name.trim() !== organization.name ||
          values.relationship_type !== (organization.relationship_type || "paying_customer") ||
          nextCustomerId !== (organization.stripe_customer_id ?? null) ||
          (nextSubscription?.id ?? null) !== (organization.stripe_subscription_id ?? null)
        );

      if (shouldSyncStripeContext) {
        const { error: syncStripeContextError } = await supabase.functions.invoke("billing-sync-organization-stripe", {
          body: {
            organization_id: organization.id,
          },
        });
        if (syncStripeContextError) throw syncStripeContextError;
      }

      if (user) {
        const resultingSubscriptionId =
          nextSubscription?.id ??
          (nextCustomerId && nextCustomerId !== organization.stripe_customer_id ? null : organization.stripe_subscription_id ?? null);

        const changedFields = getChangedFields(
          organization,
          {
            name: values.name.trim(),
            status: values.status,
            settings: updatedSettings,
            stripe_customer_id: nextCustomerId,
            stripe_subscription_id: resultingSubscriptionId,
          },
          ["name", "status", "relationship_type", "settings", "stripe_customer_id", "stripe_subscription_id"],
        );
        await logEvent({
          eventType: "ORG_UPDATED",
          entityType: "organization",
          entityId: organization.id,
          userId: user.id,
          metadata: { fields_changed: changedFields },
        });
      }

      notify.success("Organização atualizada", "Dados salvos com sucesso.");
      onSuccess();
      onOpenChange(false);
    } catch (err) {
      const parsed = await parseSupabaseFunctionInvokeError(err);
      notify.error("Não foi possível concluir", parsed.message);
    }
  };

  const currentSubscription = subscriptions.find((item) => item.id === selectedSubscriptionId) ?? null;
  const selectedBillingStatus = currentSubscription?.billing_status || currentSubscription?.status || organization?.billing_status || null;
  const selectedBillingPlan = currentSubscription?.price_nickname || organization?.billing_plan || null;
  const selectedBillingRenewal = currentSubscription?.current_period_end || organization?.current_period_end || null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-card-foreground">{organization ? "Configurações da organização" : "Nova organização"}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 py-4">
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
                <div className="space-y-4">
                  <p className="text-xs text-muted-foreground">
                    Essas informações ajudam a organizar melhor sua organização. Você pode preencher agora ou ajustar tudo depois, sem impacto no funcionamento.
                  </p>

                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome</FormLabel>
                        <FormControl>
                          <Input placeholder="Nome da organização" {...field} />
                        </FormControl>
                        <FormDescription>Nome usado para identificar a organização no Bóris.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Descrição / propósito</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Explique o foco da organização." {...field} />
                        </FormControl>
                        <FormDescription>Ajuda membros e gestores a entenderem o foco da organização.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status da organização</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="active">Ativo</SelectItem>
                            <SelectItem value="inactive">Inativo</SelectItem>
                            <SelectItem value="suspended">Suspenso</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="relationship_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo de relacionamento</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="paying_customer">Cliente pagante</SelectItem>
                            <SelectItem value="partner">Parceiro</SelectItem>
                            <SelectItem value="courtesy">Cortesia</SelectItem>
                            <SelectItem value="internal">Interno</SelectItem>
                            <SelectItem value="trial">Teste / trial</SelectItem>
                            <SelectItem value="demo">Demo</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Define o enquadramento comercial do cliente sem depender só do billing da Stripe.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {canManageStripe ? (
                <div className="rounded-2xl border border-border/70 bg-secondary/20 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="flex items-center gap-2 text-sm font-semibold text-card-foreground">
                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                        Vincular Stripe
                      </h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        O cliente Stripe é o vínculo principal. A assinatura é opcional e serve para enriquecer status, plano e renovação.
                      </p>
                    </div>
                    {organization?.id ? (
                      <Button type="button" variant="outline" size="sm" onClick={() => void loadStripeCustomers(null)} disabled={customersLoading}>
                        {customersLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                        Atualizar
                      </Button>
                    ) : null}
                  </div>

                  {!organization?.id ? (
                    <div className="mt-4 rounded-xl border border-dashed border-border bg-background/70 p-4 text-sm text-muted-foreground">
                      Crie a organização primeiro. Depois disso, você poderá selecionar o cliente e a assinatura da Stripe por aqui.
                    </div>
                  ) : (
                    <div className="mt-4 space-y-4">
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          value={customerSearch}
                          onChange={(event) => setCustomerSearch(event.target.value)}
                          placeholder="Buscar cliente Stripe por nome, email, telefone ou ID..."
                          className="pl-9"
                        />
                      </div>

                      <div className="rounded-xl border border-border bg-background/80">
                        <ScrollArea className="h-56">
                          <div className="p-2">
                            {filteredCustomers.length === 0 ? (
                              <div className="rounded-lg px-3 py-6 text-center text-sm text-muted-foreground">
                                {customersLoading ? "Carregando clientes da Stripe..." : "Nenhum cliente encontrado nesta lista."}
                              </div>
                            ) : (
                              filteredCustomers.map((customer) => {
                                const isSelected = selectedCustomer?.id === customer.id;
                                return (
                                  <button
                                    key={customer.id}
                                    type="button"
                                    onClick={() => {
                                      setSelectedCustomer(customer);
                                      setSelectedSubscriptionId("");
                                    }}
                                    className={cn(
                                      "flex w-full items-start justify-between gap-3 rounded-xl px-3 py-3 text-left transition-colors",
                                      isSelected ? "bg-sky-50 text-sky-950" : "hover:bg-secondary/70",
                                    )}
                                  >
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-2">
                                        <UserRound className="h-4 w-4 text-muted-foreground" />
                                        <span className="truncate text-sm font-medium">{getCustomerLabel(customer)}</span>
                                      </div>
                                      <div className="mt-1 space-y-1 text-xs text-muted-foreground">
                                        <p className="truncate">{customer.email || customer.phone || customer.id}</p>
                                        <p className="truncate">{customer.id}</p>
                                      </div>
                                    </div>
                                    {isSelected ? <CheckCircle2 className="mt-0.5 h-4 w-4 text-sky-600" /> : null}
                                  </button>
                                );
                              })
                            )}
                          </div>
                        </ScrollArea>
                      </div>

                      {customersHasMore ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="w-full"
                          onClick={() => void loadStripeCustomers(customersNextCursor)}
                          disabled={customersLoading || !customersNextCursor}
                        >
                          {customersLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                          Carregar mais clientes
                        </Button>
                      ) : null}

                      <Separator />

                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-card-foreground">Assinaturas do cliente</p>
                            <p className="text-xs text-muted-foreground">
                              {selectedCustomer ? "Selecione a assinatura do Bóris se quiser salvar também o status e o plano atuais." : "Selecione um cliente acima para listar as assinaturas."}
                            </p>
                          </div>
                          {selectedCustomer ? (
                            <Badge variant="outline" className="max-w-[220px] truncate">
                              {getCustomerLabel(selectedCustomer)}
                            </Badge>
                          ) : null}
                        </div>

                        <div className="space-y-2">
                          {subscriptionsLoading ? (
                            <div className="rounded-xl border border-border bg-background/70 px-4 py-6 text-sm text-muted-foreground">
                              Carregando assinaturas...
                            </div>
                          ) : !selectedCustomer ? (
                            <div className="rounded-xl border border-dashed border-border bg-background/70 px-4 py-6 text-sm text-muted-foreground">
                              Nenhum cliente selecionado.
                            </div>
                          ) : subscriptions.length === 0 ? (
                            <div className="rounded-xl border border-dashed border-border bg-background/70 px-4 py-6 text-sm text-muted-foreground">
                              Esse cliente ainda não tem assinaturas encontradas na Stripe.
                            </div>
                          ) : (
                            subscriptions.map((subscription) => {
                              const isSelected = selectedSubscriptionId === subscription.id;
                              const isBoris = isBorisSubscription(subscription);
                              return (
                                <button
                                  key={subscription.id}
                                  type="button"
                                  onClick={() => setSelectedSubscriptionId(subscription.id)}
                                  className={cn(
                                    "w-full rounded-xl border px-4 py-3 text-left transition-colors",
                                    isSelected
                                      ? "border-sky-300 bg-sky-50 text-sky-950"
                                      : "border-border bg-background/80 hover:bg-secondary/70",
                                  )}
                                >
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-sm font-medium">
                                      {subscription.price_nickname || subscription.stripe_price_id || subscription.id}
                                    </span>
                                    {isBoris ? <Badge className="bg-emerald-100 text-emerald-900 hover:bg-emerald-100">Produto Bóris</Badge> : null}
                                    <Badge variant="outline" className="capitalize">
                                      {subscription.billing_status || subscription.status}
                                    </Badge>
                                  </div>
                                  <div className="mt-2 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                                    <p>{formatCurrency(subscription.unit_amount, subscription.currency)}{subscription.interval ? ` / ${subscription.interval}` : ""}</p>
                                    <p>Vence em {formatDate(subscription.current_period_end)}</p>
                                    <p className="truncate">{subscription.id}</p>
                                    <p className="truncate">{subscription.stripe_price_id || "Sem price ID"}</p>
                                  </div>
                                </button>
                              );
                            })
                          )}
                        </div>
                      </div>

                      <Separator />

                      <div className="rounded-xl border border-border bg-background/70 p-4">
                        <p className="text-sm font-medium text-card-foreground">Resumo do vínculo</p>
                        <div className="mt-3 space-y-2 text-sm">
                          <p>
                            <span className="text-muted-foreground">Cliente:</span>{" "}
                            <span className="font-medium text-card-foreground">{selectedCustomer ? getCustomerLabel(selectedCustomer) : "Nenhum selecionado"}</span>
                          </p>
                          <p>
                            <span className="text-muted-foreground">Assinatura:</span>{" "}
                            <span className="font-medium text-card-foreground">
                              {currentSubscription
                                ? currentSubscription.price_nickname || currentSubscription.id
                                : subscriptions.length > 0
                                  ? "Opcional: nenhuma selecionada"
                                  : "Sem assinatura disponível"}
                            </span>
                          </p>
                          <p>
                            <span className="text-muted-foreground">Billing atual:</span>{" "}
                            <span className="font-medium text-card-foreground">{selectedBillingStatus || "Ainda não sincronizado"}</span>
                          </p>
                          <p>
                            <span className="text-muted-foreground">Plano selecionado:</span>{" "}
                            <span className="font-medium text-card-foreground">{selectedBillingPlan || "Sem plano detectado"}</span>
                          </p>
                          <p>
                            <span className="text-muted-foreground">Próxima renovação:</span>{" "}
                            <span className="font-medium text-card-foreground">{formatDate(selectedBillingRenewal)}</span>
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                ) : null}
              </div>
            </motion.div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting || (!form.formState.isDirty && !!organization && selectedCustomer?.id === organization.stripe_customer_id && selectedSubscriptionId === (organization.stripe_subscription_id || ""))}>
                {form.formState.isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {organization ? "Salvar alterações" : "Criar organização"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
