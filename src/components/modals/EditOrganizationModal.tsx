import { useState, useEffect } from "react";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, AlertCircle } from "lucide-react";
import { logEvent, getChangedFields } from "@/lib/audit";
import { useAuth } from "@/hooks/use-auth";
import { z } from "zod";

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
  inactivation_reason: z.string().trim().max(200, "Motivo deve ter no máximo 200 caracteres").optional(),
});

interface Organization {
  id: string;
  name: string;
  status: string;
  inactivated_at?: string | null;
  inactivated_reason?: string | null;
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
  const [name, setName] = useState("");
  const [status, setStatus] = useState("active");
  const [description, setDescription] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [inactivationReason, setInactivationReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { user } = useAuth();

  useEffect(() => {
    if (organization) {
      setName(organization.name);
      setStatus(organization.status);
      setDescription((organization.settings as any)?.description || "");
      setContactName(organization.contact_name || "");
      setContactEmail(organization.contact_email || "");
      setContactPhone(organization.contact_phone || "");
      setInactivationReason(organization.inactivated_reason || "");
      setErrors({});
    }
  }, [organization]);

  const validate = (): boolean => {
    const result = organizationSchema.safeParse({ 
      name, 
      status, 
      description, 
      contact_name: contactName, 
      contact_email: contactEmail, 
      contact_phone: contactPhone,
      inactivation_reason: inactivationReason,
    });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach(err => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as string] = err.message;
        }
      });
      setErrors(fieldErrors);
      return false;
    }
    setErrors({});
    return true;
  };

  const handleSave = async () => {
    if (!organization || !validate()) return;

    setSaving(true);
    try {
      const updatedSettings = {
        ...(organization.settings || {}),
        description: description.trim(),
      };
      const normalizedContactName = contactName.trim() || null;
      const normalizedContactEmail = contactEmail.trim() || null;
      const normalizedContactPhone = contactPhone.trim() || null;
      const updates: any = {
        name: name.trim(),
        status,
        settings: updatedSettings,
        contact_name: normalizedContactName,
        contact_email: normalizedContactEmail,
        contact_phone: normalizedContactPhone,
      };
      if (status === 'inactive') {
        updates.inactivated_at = new Date().toISOString();
        updates.inactivated_reason = inactivationReason.trim() || null;
      } else {
        updates.inactivated_at = null;
        updates.inactivated_reason = null;
      }

      const { error } = await supabase
        .from("organizations")
        .update(updates)
        .eq("id", organization.id);

      if (error) {
        // Check for RLS permission error
        if (error.code === '42501' || error.message.includes('policy')) {
          toast.error("Sem permissão para editar esta organização");
        } else {
          toast.error(error.message || "Erro ao atualizar organização");
        }
        return;
      }

      // Log audit event
      if (user) {
        const changedFields = getChangedFields(
          organization,
          { 
            name: name.trim(), 
            status, 
            settings: updatedSettings,
            contact_name: normalizedContactName,
            contact_email: normalizedContactEmail,
            contact_phone: normalizedContactPhone,
          },
          ['name', 'status', 'settings', 'contact_name', 'contact_email', 'contact_phone', 'inactivated_at', 'inactivated_reason']
        );
        await logEvent({
          eventType: 'ORG_UPDATED',
          entityType: 'organization',
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
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-card-foreground">
            Configurações da organização
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <p className="text-xs text-muted-foreground">
            Essas informações ajudam a organizar melhor sua organização. Você pode preencher agora ou ajustar tudo depois, sem impacto no funcionamento.
          </p>
          <div className="space-y-2">
            <Label htmlFor="name">Nome</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome da organização"
              className={errors.name ? "border-destructive" : ""}
            />
            <p className="text-xs text-muted-foreground">Nome usado para identificar a organização no Bóris.</p>
            {errors.name && (
              <p className="text-sm text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {errors.name}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição / propósito</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Em poucas palavras, explique para que essa organização existe e qual é seu foco."
              className={errors.description ? "border-destructive" : ""}
            />
            <p className="text-xs text-muted-foreground">
              Esta descrição ajuda membros e gestores a entenderem o foco da organização.
            </p>
            {errors.description && (
              <p className="text-sm text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {errors.description}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-muted-foreground">Informações de contato (opcional)</h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="contact_name">Nome do Contato</Label>
              <Input
                id="contact_name"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="Nome da pessoa responsável"
                className={errors.contact_name ? "border-destructive" : ""}
              />
              {errors.contact_name && (
                <p className="text-sm text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors.contact_name}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact_email">Email</Label>
              <Input
                id="contact_email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="email@organizacao.com"
                className={errors.contact_email ? "border-destructive" : ""}
              />
              <p className="text-xs text-muted-foreground">Usado apenas para comunicações administrativas do Bóris.</p>
              {errors.contact_email && (
                <p className="text-sm text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors.contact_email}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact_phone">Telefone</Label>
              <Input
                id="contact_phone"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="(DDD) 00000-0000"
                className={errors.contact_phone ? "border-destructive" : ""}
              />
              <p className="text-xs text-muted-foreground">Opcional. Pode ser usado para contato administrativo, se necessário.</p>
              {errors.contact_phone && (
                <p className="text-sm text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors.contact_phone}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status da organização</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className={errors.status ? "border-destructive" : ""}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Ativo</SelectItem>
                <SelectItem value="inactive">Inativo</SelectItem>
                <SelectItem value="suspended">Suspenso</SelectItem>
              </SelectContent>
            </Select>
            {errors.status && (
              <p className="text-sm text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {errors.status}
              </p>
            )}
            {status === 'inactive' && (
              <div className="space-y-2 mt-3">
                <Label htmlFor="inactivation_reason">Motivo da desativação (opcional)</Label>
                <Textarea
                  id="inactivation_reason"
                  value={inactivationReason}
                  onChange={(e) => setInactivationReason(e.target.value)}
                  placeholder="Ex.: cancelamento, inadimplência, pausa operacional"
                  className={errors.inactivation_reason ? "border-destructive" : ""}
                />
                {errors.inactivation_reason && (
                  <p className="text-sm text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.inactivation_reason}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar alterações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
