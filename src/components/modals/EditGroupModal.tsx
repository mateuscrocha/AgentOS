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
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

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

  useEffect(() => {
    if (group) {
      setName(group.name);
    }
  }, [group]);

  const handleSave = async () => {
    if (!group || !name.trim()) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("groups")
        .update({ name: name.trim() })
        .eq("id", group.id);

      if (error) throw error;

      toast.success("Grupo atualizado com sucesso");
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || "Erro ao atualizar grupo");
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
            />
          </div>

          {group && (
            <div className="text-sm text-muted-foreground space-y-1">
              <p>Provider: {group.provider}</p>
              {group.provider_group_id && (
                <p>Provider ID: {group.provider_group_id}</p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving || !name.trim()}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
