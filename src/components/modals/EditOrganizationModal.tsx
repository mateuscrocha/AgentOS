import { useEffect } from "react";
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
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { logEvent, getChangedFields } from "@/lib/audit";
import { useAuth } from "@/hooks/use-auth";
import { z } from "zod";
import { Form, FormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage } from "@/components/ui/form";
import { motion } from "framer-motion";

const organizationSchema = z.object({
  name: z.string().trim().min(1, "Nome é obrigatório").max(100, "Nome deve ter no máximo 100 caracteres"),
  status: z.enum(["active", "inactive", "suspended"], { 
    errorMap: () => ({ message: "Status inválido" }) 
  }),
  description: z.string().trim().max(500, "Descrição deve ter no máximo 500 caracteres").optional(),
  contact_name: z.string().trim().max(100, "Nome de contato deve ter no máximo 100 caracteres").optional(),
  contact_email: z
    .string()
    .trim()
    .email("Email inválido")
    .optional()
    .or(z.literal("")),
  contact_phone: z
    .string()
    .trim()
    .min(7, "Telefone muito curto")
    .max(20, "Telefone muito longo")
    .optional()
    .or(z.literal("")),
});

interface Organization {
  id: string;
  name: string;
  status: string;
  settings?: Record<string, any> | null;
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
}

interface EditOrganizationModalProps {
  organization: Organization | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function EditOrganizationModal({
  organization,
  open,
  onOpenChange,
  onSuccess,
}: EditOrganizationModalProps) {
  const { user } = useAuth();
  const form = useForm({
    resolver: zodResolver(organizationSchema),
    defaultValues: {
      name: "",
      status: "active",
      description: "",
      contact_name: "",
      contact_email: "",
      contact_phone: "",
    },
    mode: "onChange",
  });

  useEffect(() => {
    if (organization) {
      form.reset({
        name: organization.name || "",
        status: organization.status || "active",
        description: ((organization.settings as any)?.description as string) || "",
        contact_name: organization.contact_name || "",
        contact_email: organization.contact_email || "",
        contact_phone: organization.contact_phone || "",
      });
    }
  }, [organization, form]);

  const onSubmit = async (values: any) => {
    if (!organization) return;

    try {
      const updatedSettings = {
        ...(organization.settings || {}),
        description: (values.description || "").trim(),
      };
      const normalizedContactName = (values.contact_name || "").trim() || null;
      const normalizedContactEmail = (values.contact_email || "").trim() || null;
      const normalizedContactPhone = (values.contact_phone || "").trim() || null;

      const { error } = await supabase
        .from("organizations")
        .update({
          name: values.name.trim(),
          status: values.status,
          settings: updatedSettings,
          contact_name: normalizedContactName,
          contact_email: normalizedContactEmail,
          contact_phone: normalizedContactPhone,
        })
        .eq("id", organization.id);

      if (error) {
        if (error.code === "42501" || error.message.includes("policy")) {
          toast.error("Sem permissão para editar esta organização");
        } else {
          toast.error(error.message || "Erro ao atualizar organização");
        }
        return;
      }

      if (user) {
        const changedFields = getChangedFields(
          organization,
          {
            name: values.name.trim(),
            status: values.status,
            settings: updatedSettings,
            contact_name: normalizedContactName,
            contact_email: normalizedContactEmail,
            contact_phone: normalizedContactPhone,
          },
          ["name", "status", "settings", "contact_name", "contact_email", "contact_phone"],
        );
        await logEvent({
          eventType: "ORG_UPDATED",
          entityType: "organization",
          entityId: organization.id,
          userId: user.id,
          metadata: { fields_changed: changedFields },
        });
      }

      toast.success("Organização atualizada com sucesso");
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || "Erro ao atualizar organização");
    }
  };

  

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-card-foreground">Configurações da organização</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 py-4">
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

              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-muted-foreground">Informações de contato (opcional)</h4>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="contact_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome do Contato</FormLabel>
                      <FormControl>
                        <Input placeholder="Nome da pessoa responsável" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="contact_email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input placeholder="email@organizacao.com" {...field} />
                      </FormControl>
                      <FormDescription>Usado apenas para comunicações administrativas do Bóris.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="contact_phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefone</FormLabel>
                      <FormControl>
                        <Input placeholder="(DDD) 00000-0000" {...field} />
                      </FormControl>
                      <FormDescription>Opcional. Pode ser usado para contato administrativo, se necessário.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

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
            </motion.div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting || !form.formState.isDirty}>
                {form.formState.isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Salvar alterações
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
