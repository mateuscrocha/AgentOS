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
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { notify } from "@/components/ui/sonner";
import { Loader2, AlertCircle, Lock } from "lucide-react";
import { logEvent, getChangedFields } from "@/lib/audit";
import { useAuth } from "@/hooks/use-auth";
import { z } from "zod";

const groupSchema = z.object({
  name: z.string().trim().min(1, "Nome é obrigatório").max(100, "Nome deve ter no máximo 100 caracteres"),
});

interface Group {
  id: string;
  name: string;
  organization_id: string;
  provider: string;
  provider_group_id: string | null;
}

interface EditGroupModalProps {
  group: Group | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function EditGroupModal({
  group,
  open,
  onOpenChange,
  onSuccess,
}: EditGroupModalProps) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { user } = useAuth();

  useEffect(() => {
    if (group) {
      setName(group.name);
      setErrors({});
    }
  }, [group]);

  const validate = (): boolean => {
    const result = groupSchema.safeParse({ name });
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
    if (!group || !validate()) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("groups")
        .update({ name: name.trim() })
        .eq("id", group.id);

      if (error) {
        if (error.code === '42501' || error.message.includes('policy')) {
          notify.error("Sem permissão", "Você não pode editar este grupo.");
        } else {
          notify.error("Não foi possível atualizar", "Algo deu errado. Tente novamente.");
        }
        return;
      }

      // Log audit event
      if (user) {
        const changedFields = getChangedFields(
          group,
          { name: name.trim() },
          ['name']
        );
        await logEvent({
          eventType: 'GROUP_UPDATED',
          entityType: 'group',
          entityId: group.id,
          userId: user.id,
          metadata: { fields_changed: changedFields },
        });
      }

      notify.success("Grupo atualizado", "Dados salvos com sucesso.");
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      notify.error("Não foi possível concluir", "Algo deu errado. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-card-foreground">
            Editar Grupo
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome do grupo"
              className={errors.name ? "border-destructive" : ""}
            />
            {errors.name && (
              <p className="text-sm text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {errors.name}
              </p>
            )}
          </div>

          {/* Read-only fields */}
          {group && (
            <div className="space-y-3 pt-2 border-t border-border">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Lock className="h-3 w-3" />
                Campos somente leitura
              </p>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">Provider</Label>
                  <p className="text-sm text-card-foreground font-medium capitalize">
                    {group.provider}
                  </p>
                </div>
                
                {group.provider_group_id && (
                  <div className="space-y-1">
                    <Label className="text-muted-foreground text-xs">Provider ID</Label>
                    <p className="text-sm text-card-foreground font-mono text-xs">
                      {group.provider_group_id}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
