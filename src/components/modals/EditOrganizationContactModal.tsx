import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { notify } from "@/components/ui/sonner";
import { Loader2 } from "lucide-react";
import { z } from "zod";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
import { logEvent, getChangedFields } from "@/lib/audit";
import { useQuery } from "@tanstack/react-query";
import { useUserRoles } from "@/hooks/use-user-roles";

const contactSchema = z.object({
  user_id: z.string().uuid("Usuário inválido").optional().nullable(),
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
  user_id?: string | null;
  name: string;
  email?: string | null;
  phone?: string | null;
  role_title?: string | null;
  contact_role?: string | null;
  is_primary?: boolean;
}

type OrganizationContactUser = {
  id: string;
  name: string | null;
  phone_e164: string | null;
  avatar_url: string | null;
  role: string;
};

const USER_NONE = "__none__";

const ROLE_LABELS: Record<string, string> = {
  SYSTEM_ADMIN: "Admin do sistema",
  ORG_ADMIN: "Gestor da organização",
  GROUP_MANAGER: "Gestor de grupo",
  USER: "Usuário",
};

const ROLE_PRIORITY: Record<string, number> = {
  SYSTEM_ADMIN: 4,
  ORG_ADMIN: 3,
  GROUP_MANAGER: 2,
  USER: 1,
};

interface EditOrganizationContactModalProps {
  organizationId: string;
  contact: OrganizationContact | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function EditOrganizationContactModal({ organizationId, contact, open, onOpenChange, onSuccess }: EditOrganizationContactModalProps) {
  const { user } = useAuth();
  const { isSystemAdmin } = useUserRoles();
  const form = useForm({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      user_id: null,
      name: "",
      email: "",
      phone: "",
      role_title: "",
    },
    mode: "onChange",
  });

  const { data: organizationUsers, isLoading: organizationUsersLoading } = useQuery({
    queryKey: ["organization-contact-users", organizationId, contact?.user_id ?? null],
    queryFn: async () => {
      const [{ data: orgRoles, error: rolesError }, { data: orgRow, error: orgError }] = await Promise.all([
        supabase
          .from("user_roles")
          .select("user_id, role")
          .eq("organization_id", organizationId),
        supabase
          .from("organizations")
          .select("owner_user_id")
          .eq("id", organizationId)
          .maybeSingle(),
      ]);

      if (rolesError) throw rolesError;
      if (orgError) throw orgError;

      const roleByUser = new Map<string, string>();
      for (const row of orgRoles ?? []) {
        const current = roleByUser.get(row.user_id);
        const currentPriority = current ? (ROLE_PRIORITY[current] ?? 0) : 0;
        const nextPriority = ROLE_PRIORITY[row.role] ?? 0;
        if (!current || nextPriority > currentPriority) {
          roleByUser.set(row.user_id, row.role);
        }
      }

      if (orgRow?.owner_user_id && !roleByUser.has(orgRow.owner_user_id)) {
        roleByUser.set(orgRow.owner_user_id, "ORG_ADMIN");
      }

      if (contact?.user_id && !roleByUser.has(contact.user_id)) {
        roleByUser.set(contact.user_id, "USER");
      }

      const userIds = Array.from(roleByUser.keys());
      if (userIds.length === 0) return [] as OrganizationContactUser[];

      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, name, phone_e164, avatar_url")
        .in("id", userIds)
        .is("deleted_at", null)
        .order("name");

      if (profilesError) throw profilesError;

      return (profiles ?? [])
        .map((profile) => ({
          id: profile.id,
          name: profile.name,
          phone_e164: profile.phone_e164,
          avatar_url: profile.avatar_url,
          role: roleByUser.get(profile.id) ?? "USER",
        }))
        .sort((a, b) => {
          const byName = (a.name ?? "").localeCompare(b.name ?? "", "pt-BR", { sensitivity: "base" });
          if (byName !== 0) return byName;
          return a.id.localeCompare(b.id);
        });
    },
    enabled: open && !!organizationId,
    staleTime: 60_000,
  });

  const selectedUserId = form.watch("user_id");
  const selectedUser = useMemo(
    () => organizationUsers?.find((candidate) => candidate.id === selectedUserId) ?? null,
    [organizationUsers, selectedUserId],
  );

  const { data: selectedUserEmail } = useQuery({
    queryKey: ["organization-contact-user-email", selectedUserId],
    queryFn: async () => {
      if (!selectedUserId) return null;
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      const { data, error } = await supabase.functions.invoke("admin-get-user-email", {
        body: { user_id: selectedUserId },
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      });

      if (error) throw error;
      if (!data?.success) {
        throw new Error(data?.message || "Falha ao buscar email do usuário");
      }

      return (data.email as string | null) ?? null;
    },
    enabled: open && !!selectedUserId && isSystemAdmin,
    staleTime: 60_000,
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
        user_id: contact.user_id || null,
        name: contact.name || "",
        email: contact.email || "",
        phone: contact.phone || "",
        role_title: contact.role_title || "",
      });
    } else {
      form.reset({ user_id: null, name: "", email: "", phone: "", role_title: "" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contact, organizationId]);

  useEffect(() => {
    if (!selectedUser) return;

    if ((form.getValues("name") || "").trim() !== (selectedUser.name || "").trim()) {
      form.setValue("name", selectedUser.name || "", { shouldDirty: true, shouldValidate: true });
    }

    const currentPhone = (form.getValues("phone") || "").trim();
    if (!currentPhone && selectedUser.phone_e164) {
      form.setValue("phone", formatPhone(selectedUser.phone_e164), { shouldDirty: true, shouldValidate: true });
    }
  }, [selectedUser, form]);

  useEffect(() => {
    if (!selectedUserId || !selectedUserEmail) return;

    const currentEmail = (form.getValues("email") || "").trim();
    if (!currentEmail) {
      form.setValue("email", selectedUserEmail, { shouldDirty: true, shouldValidate: true });
    }
  }, [selectedUserId, selectedUserEmail, form]);

  const onSubmit = async (values: any) => {
    try {
      const payload = {
        organization_id: organizationId,
        user_id: values.user_id || null,
        name: values.name.trim(),
        email: (values.email || "").trim() || null,
        phone: (values.phone || "").trim() || null,
        role_title: (values.role_title || "").trim() || null,
        contact_role: contact?.contact_role || "responsavel_principal",
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
          const changed = getChangedFields(contact, payload, ["user_id", "name", "email", "phone", "role_title"]);
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
                  name="user_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Usuário vinculado</FormLabel>
                      <Select
                        value={field.value || USER_NONE}
                        onValueChange={(value) => field.onChange(value === USER_NONE ? null : value)}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue
                              placeholder={organizationUsersLoading ? "Carregando usuários..." : "Selecionar usuário da organização"}
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={USER_NONE}>Nenhum usuário vinculado</SelectItem>
                          {(organizationUsers ?? []).map((candidate) => (
                            <SelectItem key={candidate.id} value={candidate.id}>
                              {candidate.name || "Usuário sem nome"} • {ROLE_LABELS[candidate.role] || candidate.role}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Vincule um usuário do painel para indicar quem representa esta organização.
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome</FormLabel>
                      <FormControl>
                        <Input placeholder="Nome do responsável" {...field} />
                      </FormControl>
                      {selectedUser ? (
                        <p className="text-xs text-muted-foreground">
                          Nome preenchido a partir do usuário selecionado. Você ainda pode ajustar manualmente se precisar.
                        </p>
                      ) : null}
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
