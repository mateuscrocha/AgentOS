import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { notify } from "@/components/ui/sonner";
import { Loader2 } from "lucide-react";
import { z } from "zod";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
import { logEvent, getChangedFields } from "@/lib/audit";

const contactSchema = z.object({
  name: z.string().trim().min(1, "Nome é obrigatório").max(100, "Máx 100 caracteres"),
  email: z
    .string()
    .trim()
    .email("Email inválido")
    .optional()
    .or(z.literal("")),
  phone: z
    .string()
    .trim()
    .min(7, "Telefone muito curto")
    .max(20, "Telefone muito longo")
    .optional()
    .or(z.literal("")),
  role_title: z.string().trim().max(80, "Máx 80 caracteres").optional().or(z.literal("")),
});

interface OrganizationContact {
  id?: string;
  organization_id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  role_title?: string | null;
  is_primary?: boolean;
}

interface EditOrganizationContactModalProps {
  organizationId: string;
  contact: OrganizationContact | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function EditOrganizationContactModal({ organizationId, contact, open, onOpenChange, onSuccess }: EditOrganizationContactModalProps) {
  const { user } = useAuth();
  const form = useForm({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      role_title: "",
    },
    mode: "onChange",
  });

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && form.formState.isDirty && !form.formState.isSubmitting) {
      const confirmLeave = window.confirm("Descartar alterações não salvas?");
      if (!confirmLeave) return;
    }
    onOpenChange(nextOpen);
  };

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  };

  useEffect(() => {
    if (contact) {
      form.reset({
        name: contact.name || "",
        email: contact.email || "",
        phone: contact.phone || "",
        role_title: contact.role_title || "",
      });
    } else {
      form.reset({ name: "", email: "", phone: "", role_title: "" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contact, organizationId]);

  const onSubmit = async (values: any) => {
    try {
      const payload = {
        organization_id: organizationId,
        name: values.name.trim(),
        email: (values.email || "").trim() || null,
        phone: (values.phone || "").trim() || null,
        role_title: (values.role_title || "").trim() || null,
        is_primary: true,
        updated_at: new Date().toISOString(),
      };

      if (contact?.id) {
        const { error } = await supabase
          .from("organization_contacts" as any)
          .update(payload)
          .eq("id", contact.id);
        if (error) throw error;

        if (user) {
          const changed = getChangedFields(contact, payload, ["name", "email", "phone", "role_title"]);
          await logEvent({
            eventType: "ORG_UPDATED",
            entityType: "organization",
            entityId: organizationId,
            userId: user.id,
            metadata: { fields_changed: changed, contact_update: true },
          });
        }
      } else {
        const { error } = await supabase
          .from("organization_contacts" as any)
          .insert(payload);
        if (error) throw error;

        if (user) {
          await logEvent({
            eventType: "ORG_UPDATED",
            entityType: "organization",
            entityId: organizationId,
            userId: user.id,
            metadata: { contact_created: true, is_primary: true },
          });
        }
      }

      notify.success("Contato atualizado", "Tudo certo.");
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      if (error.code === "42501" || (error.message || "").includes("policy")) {
        notify.error("Sem permissão", "Você não pode editar este contato.");
      } else if ((error.message || "").includes("organization_contacts_primary_unique")) {
        notify.warning("Contato primário já existe", "Edite o contato existente.");
      } else {
        notify.error("Não foi possível concluir", "Algo deu errado. Tente novamente.");
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-card-foreground">Contato da organização</DialogTitle>
          <p className="text-sm text-muted-foreground">Pessoa responsável por representar a organização</p>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 py-4">
              {/* Identidade */}
              <div className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Identidade do contato</span>
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome</FormLabel>
                      <FormControl>
                        <Input placeholder="Nome do responsável" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Meios de contato */}
              <div className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Meios de contato</span>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2">
                    <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input type="email" inputMode="email" placeholder="email@organizacao.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Telefone</FormLabel>
                        <FormControl>
                          <Input
                            type="tel"
                            inputMode="tel"
                            maxLength={16}
                            placeholder="(11) 90000-0000"
                            value={field.value as any}
                            onChange={(e) => field.onChange(formatPhone(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              
              </div>

              {/* Função / Cargo */}
              <div className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Função / cargo</span>
                <FormField
                  control={form.control}
                  name="role_title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cargo</FormLabel>
                      <div className="flex flex-wrap gap-2 pt-1">
                        {["fundador","gestor","administrativo","financeiro","marketing","suporte","diretor","coordenador"].map((opt) => (
                          <Button
                            key={opt}
                            type="button"
                            variant={field.value === opt ? "default" : "outline"}
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => form.setValue("role_title", opt, { shouldDirty: true, shouldValidate: true })}
                          >
                            {opt}
                          </Button>
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </motion.div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (form.formState.isDirty && !form.formState.isSubmitting) {
                    const confirmLeave = window.confirm("Descartar alterações não salvas?");
                    if (!confirmLeave) return;
                  }
                  onOpenChange(false);
                }}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting || !form.formState.isDirty}>
                {form.formState.isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Salvar
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
