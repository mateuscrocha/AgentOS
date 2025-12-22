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
});

interface Organization {
  id: string;
  name: string;
  status: string;
  settings?: Record<string, any> | null;
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
    },
    mode: "onChange",
  });

  useEffect(() => {
    if (organization) {
      form.reset({
        name: organization.name || "",
        status: organization.status || "active",
        description: ((organization.settings as any)?.description as string) || "",
      });
    }
  }, [organization, form]);

  const onSubmit = async (values: any) => {
    try {
      if (!organization) {
        const payload = {
          name: values.name.trim(),
          status: values.status,
          settings: { description: (values.description || "").trim() },
        };
        const { data, error } = await supabase
          .from("organizations")
          .insert(payload)
          .select("id")
          .single();
        if (error) {
          if (error.code === "42501" || error.message.includes("policy")) {
            toast.error("Sem permissão para criar organizações");
          } else {
            toast.error(error.message || "Erro ao criar organização");
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
        toast.success("Organização criada com sucesso");
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
          settings: updatedSettings,
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
          },
          ["name", "status", "settings"],
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
      toast.error(error.message || "Erro ao salvar organização");
    }
  };

  

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-card-foreground">{organization ? "Configurações da organização" : "Nova organização"}</DialogTitle>
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
              <Button type="submit" disabled={form.formState.isSubmitting || (!form.formState.isDirty && !!organization)}>
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
